class promise {
	constructor(func) {
		if(typeof func !== "function") {
			throw new TypeError("argument func must be a function");
		}

		this._funcs = {};
		this._locked = true;
		this._stacked = undefined;
		this._queue = [];

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

			execute(this._funcs[item.event], item.args);

			if(item.event === "err" || item.event === "error" || item.event === "catch" || item.event === "failure") {
				execute(this._funcs["error"], item.args);
			}
			else if(item.event !== "error") {
				execute_event(item.event, this._funcs["then"], item.args);
				execute(this._funcs["then2"], item.args);
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

		var event_ = has_event ? "then" : "then2";

		if(this._funcs[event_] === undefined) {
			this._funcs[event_] = [];
		}

		this._funcs[event_].push(func);

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

		if(this._funcs["error"] === undefined) {
			this._funcs["error"] = [];
		}

		this._funcs["error"].push(func);

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

		if(this._funcs[event] === undefined) {
			this._funcs[event] = [];
		}

		this._funcs[event].push(func);

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
