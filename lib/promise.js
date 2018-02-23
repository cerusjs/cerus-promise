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
		this._child_index = -1;

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
				var returned = undefined;

				if(match.event === "then") {
					returned = match.func(item.event, ...item.args);
				}
				else {
					returned = match.func(...item.args);
				}

				if(returned && returned instanceof promise) {
					// Future promise chaining
				}
			}
		}

		this._queue = [];
	}

	event(event, ...args) {
		if(event === undefined) {
			return this;
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
}

module.exports = promise;

var execute = function(funcs, args) {
	if(funcs === undefined) {
		return;
	}

	for(var i = 0; i < funcs.length; i++) {
		funcs[i](...args);
	}
};

var execute_event = function(event, funcs, args) {
	if(funcs === undefined) {
		return;
	}

	for(var i = 0; i < funcs.length; i++) {
		funcs[i](event, ...args);
	}
};
