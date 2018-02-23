var error_events = ["err", "error", "catch", "failure"];

class promise {
	constructor(func) {
		if(typeof func !== "function") {
			throw new TypeError("argument func must be a function");
		}

		this._funcs = [];
		this._locked = true;
		this._stacked = undefined;
		this._queue = [];
		this._child = undefined;

		setTimeout(function() {
			this._locked = false;
			this.update();
		}.bind(this), 0);

		func.call(this, this.event.bind(this));

		return this;
	}

	update() {
		if(this._locked) {
			return;
		}

		for(var i = 0; i < this._queue.length; i++) {
			var item = this._queue[i];
			var matches = this._funcs.filter(function(func) {
				// Match all the event ("on") functions with the correct event
				return func.event === item.event || 
				// Match all the error functions when there was an error event
				(func.event === "error" && error_events.includes(item.event)) ||
				// Match all the then functions when there was a non-error event
				(["then", "then2"].includes(func.event) && !error_events.includes(item.event));
			}.bind(this)) || [];

			for(var n = 0; n < matches.length; n++) {
				var match = matches[n];
				var child;

				if(match.event === "then") {
					child = match.func(item.event, ...item.args);
				}
				else {
					child = match.func(...item.args);
				}

				if(child instanceof promise) {
					parentify(this, child, this._funcs.indexOf(match) + 1);
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

		this.update();

		return this;
	}

	then(func, has_event) {
		if(this._child) {
			this._child.then(event, has_event);
			return this;
		}

		if(typeof func !== "function") {
			throw new TypeError("argument func must be a function");
		}

		if(func === this.event) {
			return this.stack(func);
		}

		var event = has_event ? "then" : "then2";

		this._funcs.push({event, func});
		this.update();
	
		return this;
	}

	catch(func) {
		if(this._child) {
			this._child.catch(event);
			return this;
		}

		if(typeof func !== "function") {
			throw new TypeError("argument func must be a function");
		}

		if(func === this.event) {
			return this.stack(func);
		}

		this._funcs.push({"event": "error", func});
		this.update();
	
		return this;
	}

	on(event, func) {
		if(this._child) {
			this._child.on(event, func);
			return this;
		}

		if(typeof func !== "function") {
			throw new TypeError("argument func must be a function");
		}

		if(typeof event !== "string") {
			throw new TypeError("argument event must be a string");
		}

		if(func === this.event) {
			return this.stack(func);
		}

		this._funcs.push({event, func});
		this.update();
	
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
		promise.update();
	
		return this;
	}

	child(child) {
		parentify(this, child, this._funcs.length);
	}
}

module.exports = promise;

var parentify = function(parent, child, index) {
	if(child < 0) {
		throw new Error("the index of the child returning function wasn't found");
	}

	// Change the child
	child._funcs = child._funcs.concat(parent._funcs.slice(index));
	child.update();

	// Change the parent
	parent._funcs = parent._funcs.slice(0, index);
	parent._child = child;
}