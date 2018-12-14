const assert = require("assert");

const error_events = ["err", "error", "catch", "failure"];
const then_handlers = ["then", "then2"];

/**
 * This class is used to create a fuly custom promise. Why a new type of promises? Since it 
 * supports the usage of events, stacking, children and some other features. It is mostly the same 
 * as the original promises with a few differences. The first difference is that the resolver 
 * function receives just one argument: the event argument. When you call this argument the first 
 * parameter you supply is the name of the event and after that you can supply the remaining 
 * parameters you want to pass through. You can also add handlers to the promise using the .on(), 
 * .then() and .catch(), each of which is explained in the function descriptions. When an event is 
 * created, it is added to the queue and when there is an update each item in the queue will be 
 * checked and the matched handlers per item will be called. When a handler returns a promise, 
 * which shall be named "child", all handlers added after the child returning handler will be added
 * to the child. It is also important to note that the first tick the promise is locked, meaning no
 * events will be called. This is because this allows for multiple handlers to be added without the
 * first added handler clearing out all the events.
 * @example
 * cerus.promise(function(event) {
 *   event("done", "test");
 * })
 * .on("done", console.log);
 * // logs "test"
 * @example
 * cerus.promise(function(event) {
 *   event("done", "test");
 * })
 * .on("done", function(value) {
 *   return cerus.promise(function(event) {
 *     event("other_event", value);
 *   });
 * })
 * .on("other_event", console.log);
 * // logs "test"
 * @param {Function|Promise} (executor) The function or promise to listen for events on.
 * @class promise
 */
class promise {
	constructor(executor) {
		this._handlers = [];
		this._locked = true;
		this._queue = [];

		setTimeout(() => {
			this._locked = false;
			this._update();
		}, 0);

		if(executor instanceof Promise) {
			executor.then((...args) => this.event("success", ...args));
			executor.catch(err => this.event("error", err));
		}
		else if(typeof executor === "function") {
			try {
				executor.call(this, this.event.bind(this));
			} 
			catch (e) {
				this.event("error", e);
			}
		}

		return this;
	}

	/**
	 * This function updates all the events that are in the queue. It does this by looping through 
	 * all the events in the queue and matching all the handlers there are listening for every 
	 * event. Those handlers then get called. If the promise is locked it will return and do 
	 * nothing. After looping through all the events in queue the queue is cleared.
	 * @summary Updates all the events in the queue.
	 * @access internal
	 * @function _update
	 */
	_update() {
		if(this._locked) {
			return;
		}

		this._queue.forEach(item => {
			const matched_handlers = this._handlers.filter(handler => this._match_handler(handler, item.event));

			if(error_events.includes(item.event) && matched_handlers.length === 0) {
				console.error("UnhandledPromiseRejectionWarning: " + item.args[0]);
			}

			matched_handlers.forEach(handler => {
				if(!this._handlers.includes(handler)) {
					return;
				}

				let child;

				if(handler.event === "then") {
					child = handler.callback(item.event, ...item.args);
				}
				else {
					child = handler.callback(...item.args);
				}

				if(child instanceof promise && child !== this) {
					this._parentify(child, this._handlers.indexOf(handler) + 1);
				}
				else if(child !== undefined && handler.options.passthrough) {
					let args = [];

					if(handler.options.multi && child instanceof Array) {
						args.push(...child);
					}
					else {
						args.push(child);
					}

					this._parentify(new promise().event(item.event, ...args), this._handlers.indexOf(handler) + 1);
				}
			});
		});

		this._queue = [];
	}

	_match_handler(handler, event) {
		return handler.event === event || 
			(handler.event === "error" && error_events.includes(event)) ||
			(then_handlers.includes(handler.event) && !error_events.includes(event));
	}

	_parentify(child, handlers_index) {
		assert(handlers_index >= 0, "The index of the function that returns the child wasn't found");
	
		// Change the child
		child._handlers = child._handlers.concat(this._handlers.slice(handlers_index));
		child._update();
	
		// Change the parent
		this._handlers = this._handlers.slice(0, handlers_index);
		this._child = child;
	}

	/**
	 * This function will call the specified event. This function is passed into the promise 
	 * function, but can also be used to call events from outside of the promise. You can also add
	 * arguments by just adding them to function. What events cause what to happen, like "then" and
	 * "catch" functions is explained in the class description.
	 * @summary Calls the specified event.
	 * @param {String} event The name of the event to call.
	 * @param  {...Any} args The arguments for the event that will be called.
	 * @returns {Self} This function returns itself for chaining.
	 * @function event
	 */
	event(event, ...args) {
		if(event === undefined) {
			return this;
		}

		if(this._child && error_events.includes(event)) {
			this._child.event(event, ...args);
		}

		if(this._stacked !== undefined) {
			this._stacked(event, args);

			return this;
		}

		this._queue[this._queue.length] = {
			args, event
		};

		this._update();

		return this;
	}

	/**
	 * With this function you can create a handler that responds to all non-error events. The 
	 * meaning of a handler is explained in the class description. You can also supply the 
	 * event option which sets if the first argument when the handler is called is the 
	 * name of the event. By default this is set to false.
	 * @summary Creates a handler that responds to non-error events.
	 * @param {Function} callback The callback that will be called on non-error events.
	 * @param {Object} (options) The optional options object.
	 * @param {Boolean} (options.event = false) If the first argument when the handler is called is the event.
	 * @param {Boolean} (options.passthrough = faslse) If the value returned by the handler may be treaded as a resolved promise.
	 * @returns {Self} This function returns itself for chaining.
	 * @function then
	 */
	then(callback, options = {}) {
		if(this._child) {
			this._child.then(...arguments);

			return this;
		}

		if(callback === this.event) {
			return this.stack(callback);
		}

		let _options = Object.assign({}, {
			event: false,
			passthrough: false
		}, options);

		const event = _options.event ? "then" : "then2";

		this._handlers.push({event, callback, options: _options});
		this._update();
	
		return this;
	}

	/**
	 * With this function you can create a handler that responds to all error events. The meaning
	 * of a handler is explained in the class description. The error events are: "err", "error", 
	 * "catch" and "failure".
	 * @summary Creates a handler that responds to error events.
	 * @param {Function} callback The callback that will be called on error events.
	 * @param {Object} (options) The optional options object.
	 * @param {Boolean} (options.passthrough = faslse) If the value returned by the handler may be treaded as a resolved promise.
	 * @returns {Self} This function returns itself for chaining.
	 * @function catch
	 */
	catch(callback, options = {}) {
		if(this._child) {
			this._child.catch(...arguments);

			return this;
		}

		if(callback === this.event) {
			return this.stack(callback);
		}

		let _options = Object.assign({}, {
			passthrough: false
		}, options);

		this._handlers.push({event: "error", callback, options: _options});
		this._update();
	
		return this;
	}

	/**
	 * With this function you can create a handler that responds to the specified event. The 
	 * meaning of a handler is explained in the class description. You can set the event using the
	 * event parameter.
	 * @summary Creates a handler that response to the specified event.
	 * @param {String} event The event for this handler to listen for.
	 * @param {Function} callback The callback that will be called on the specified event.
	 * @param {Object} (options) The optional options object.
	 * @param {Boolean} (options.passthrough = faslse) If the value returned by the handler may be treaded as a resolved promise.
	 * @returns {Self} This function returns itself for chaining.
	 * @function on
	 */
	on(event, callback, options = {}) {
		assert.strictEqual(typeof event, "string", "The argument event must be a string");

		if(this._child) {
			this._child.on(...arguments);

			return this;
		}

		if(callback === this.event) {
			return this.stack(callback);
		}

		let _options = Object.assign({}, {
			passthrough: false,
			multi: false
		}, default_options, options);

		this._handlers.push({event, callback, options: _options});
		this._update();
	
		return this;
	}

	/**
	 * This function is used to stack the promise. Stacking means that you can stack this on top of
	 * another promise. By doing this the other promise will receive the same all the events called
	 * on this promise, basically passing through the event downwards. Stack a promise on top of 
	 * another promise using the event function of the promise being stacked on top of.
	 * @example
	 * cerus.promise(function(event1) {
	 *   cerus.promise(function(event2) {
	 *     event2("done", "test");
	 *   })
	 *   .stack(event1);
	 * })
	 * .on("done", console.log);
	 * // logs "test"
	 * @summary Stack a promise on top of another one.
	 * @param {Function} event The event function of the promise to stack on top of.
	 * @returns {Self} This function returns itself for chaining.
	 * @function stack
	 */
	stack(event) {
		assert.strictEqual(typeof event, "function", "The argument event must be a function");

		if(this._child) {
			this._child.stack(...arguments);

			return this;
		}

		this._locked = false;

		const promise = event();

		this._stacked = promise.event;
		promise._queue = promise._queue.concat(this._queue);
		promise._update();
	
		return this;
	}

	/**
	 * This function returns a promise that will be resolved when the specified handler has 
	 * resolved. By default the handler that has last been added is promisified. The promise that 
	 * is returned will allways resolve succesfully even if the handler is catch handler.
	 * @example
	 * let test_promise = new promise(event => event("done", "test"));
	 * console.log(await test_promise.shadow());
	 * // logs "test"
	 * @summary Promisifies the specified handler.
	 * @param {Number} (handler_index) The index of the handler to shadow. Be default this is the last added handler.
	 * @returns {Promise} The newly created promise.
	 * @function shadow
	 */
	shadow(handler_index = this._handlers.length - 1) {
		if(this._child) {
			return this._child.shadow(handler_index);
		}

		if(this._handlers.length === 0) {
			this.then();

			handler_index++;
		}

		const handler = this._handlers[handler_index];

		assert.notStrictEqual(handler, undefined, "There is no handler with the index " + handler_index);

		const original_callback = handler.callback;

		return new Promise(success => {
			handler.callback = function(...args) {
				if(typeof original_callback === "function") {
					original_callback(...args);
				}

				success(...args);
			};
		});
	}
}

module.exports = promise;