var error_events = ["err", "error", "catch", "failure"];
var then_handlers = ["then", "then2"];

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

	then(handler, has_event) {
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