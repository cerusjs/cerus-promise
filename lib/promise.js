var error_events = ["err", "error", "catch", "failure"];
var then_handlers = ["then", "then2"];

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
 * @class promise
 */
class promise {
	constructor(func) {
		if(typeof func !== "function") {
			throw new TypeError("argument func must be a function");
		}

		this._handlers = [];
		this._locked = true;
		this._queue = [];

		setTimeout(function() {
			this._locked = false;
			this._update();
		}.bind(this), 0);

		func.call(this, this.event.bind(this));

		return this;
	}

	_update() {
		if(this._locked) {
			return;
		}

		for(var i = 0; i < this._queue.length; i++) {
			var item = this._queue[i];
			var matches = this._handlers.filter(function(handler) {
				return match_handler(handler, item);
			}.bind(this)) || [];

			for(var n = 0; n < matches.length; n++) {
				var match = matches[n];
				var child;

				if(match.event === "then") {
					child = match.handler(item.event, ...item.args);
				}
				else {
					child = match.handler(...item.args);
				}

				if(child instanceof promise) {
					parentify(this, child, this._handlers.indexOf(match) + 1);
				}
			}
		}

		this._queue = [];
	}

	event(event, ...args) {
		if(event === undefined) {
			return this;
		}

		// Do I want errors to be send through to the child?
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
	 * supply_event argument which sets if the first argument when the handler is called is the 
	 * name of the event. By default this is set to false.
	 * @summary Creates a handler that responds to non-error events.
	 * @param {Function} handler The handler that will be called on non-error events.
	 * @param {Boolean} (supply_event = false) If the first argument when the handler is called is the event.
	 * @returns {Self} This function returns itself for chaining.
	 * @function then
	 */
	then(handler, supply_event = false) {
		if(this._child) {
			this._child.then(handler, has_event);

			return this;
		}

		if(handler === this.event) {
			return this.stack(handler);
		}

		var event = has_event ? "then" : "then2";

		this._handlers.push({event, handler});
		this._update();
	
		return this;
	}

	/**
	 * With this function you can create a handler that responds to all error events. The meaning
	 * of a handler is explained in the class description. The error events are: "err", "error", 
	 * "catch" and "failure".
	 * @summary Creates a handler that responds to error events.
	 * @param {Function} handler The handler that will be called on error events.
	 * @returns {Self} This function returns itself for chaining.
	 * @function catch
	 */
	catch(handler) {
		if(this._child) {
			this._child.catch(handler);

			return this;
		}

		if(handler === this.event) {
			return this.stack(handler);
		}

		this._handlers.push({event: "error", handler});
		this._update();
	
		return this;
	}

	/**
	 * With this function you can create a handler that responds to the specified event. The 
	 * meaning of a handler is explained in the class description. You can set the event using the
	 * event parameter.
	 * @summary Creates a handler that response to the specified event.
	 * @param {String} event The event for this handler to listen for.
	 * @param {Function} handler The handler that will be called on the specified event.
	 * @returns {Self} This function returns itself for chaining.
	 * @function on
	 */
	on(event, handler) {
		if(this._child) {
			this._child.on(event, handler);

			return this;
		}

		if(typeof event !== "string") {
			throw new TypeError("argument event must be a string");
		}

		if(handler === this.event) {
			return this.stack(handler);
		}

		this._handlers.push({event, handler});
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
		if(this._child) {
			this._child.stack(event);

			return this;
		}

		if(typeof event !== "function") {
			throw new TypeError("argument event must be a function");
		}

		this._locked = false;

		var promise = event();

		this._stacked = promise.event;
		promise._queue = promise._queue.concat(this._queue);
		promise._update();
	
		return this;
	}

	child(child) {
		parentify(this, child, this._handlers.length);
	}

	lock() {
		this._locked = true;
	}

	unlock() {
		this._locked = false;
	}

	promisify() {
	/**
	 * This function returns a promise that will be resolved when the specified handler has 
	 * resolved. By default the handler that has last been added is promisified. The promise that 
	 * is returned will allways resolve succesfully even if the handler is catch handler.
	 * @example
	 * let test_promise = new promise((event) => event("done", "test"));
	 * console.log(await test_promise.then().promisify());
	 * // logs "test"
	 * @summary Promisifies the specified handler.
	 * @param {Number} (handler_index) The index of the handler to promisify. Be default this is the last added handler.
	 * @returns {Promise} The newly created promise.
	 * @function promisify
	 */
	promisify(handler_index = this._handlers.length - 1) {
		if(this._child) {
			return this._child.await();
		}

		return new Promise(success => {
			let handler = this._handlers[this._handlers.length-1];
			let oldHandler = handler.handler;

			handler.handler = function(...args) {
				oldHandler(...args);

				success([...args]);
			};
		});
	}
}

module.exports = promise;

var parentify = function add_child_to_parent(parent, child, index) {
	if(child < 0) {
		throw new Error("the index of the child returning function wasn't found");
	}

	// Change the child
	child._handlers = child._handlers.concat(parent._handlers.slice(index));
	child._update();

	// Change the parent
	parent._handlers = parent._handlers.slice(0, index);
	parent._child = child;
};

var match_handler = function match_handler_with_item(handler, item) {
	// Match all the event ("on") handlers with the correct event
	return handler.event === item.event || 
	// Match all the error handlers when there was an error event
	(handler.event === "error" && error_events.includes(item.event)) ||
	// Match all the then handlers when there was a non-error event
	(then_handlers.includes(handler.event) && !error_events.includes(item.event));
};