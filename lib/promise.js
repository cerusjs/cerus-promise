module.exports = function(func) {
	if(typeof func !== "function") {
		throw new TypeError("argument func must be a function");
	}

	var self = {};

	var funcs = {};
	var locked = true;
	var stacked = null;

	setTimeout(function() {
		locked = false;
		self.update();
	}, 0);

	/**
	 * @function update
	 */
	self.update = function() {
		if(locked) {
			return;
		}

		for(var i = 0; i < self.queue.length; i++) {
			var event_ = self.queue[i];

			execute(funcs[event_.event], event_.args);

			if(event_.event == "err" || event_.event == "catch" || event_.event == "failure") {
				execute(funcs["error"], event_.args);
			}
			else if(event_.event != "error") {
				execute_then(event_.event, funcs["then"], event_.args);
				execute(funcs["then2"], event_.args);
			}

			self.queue.splice(i);
		}
	}

	var execute = function(funcs_, args) {
		if(funcs_ == null) {
			return;
		}

		for(var i = 0; i < funcs_.length; i++) {
			funcs_[i](...args);
		}
	}

	var execute_then = function(event_, funcs_, args) {
		if(funcs_ == null) {
			return;
		}

		for(var i = 0; i < funcs_.length; i++) {
			funcs_[i](event_, ...args);
		}
	}

	self.queue = [];

	self.event = function(event_, ...args_) {
		if(event_ == null) {
			return self;
		}

		if(stacked != null) {
			stacked(event_, args_);
			return self;
		}

		self.queue[self.queue.length] = {
			args: args_,
			event: event_
		}

		self.update();

		return self;
	}

	self.then = function(func_, event_) {
		if(typeof func_ !== "function") {
			throw new TypeError("argument func_ must be a function");
		}

		if(func_ == self.event) {
			return self.stack(func_);
		}

		event_ = event_ ? "then" : "then2";

		if(funcs[event_] == null) {
			funcs[event_] = [];
		}

		funcs[event_][funcs[event_].length] = func_;

		self.update();
	
		return self;
	}

	/**
	 * @function catch
	 */
	self.catch = function(func_) {
		if(typeof func_ !== "function") {
			throw new TypeError("argument func_ must be a function");
		}

		if(func_ == self.event) {
			return self.stack(func_);
		}

		if(funcs["error"] == null) {
			funcs["error"] = [];
		}

		funcs["error"][funcs["error"].length] = func_;

		self.update();
	
		return self;
	}

	/**
	 * @function on
	 */
	self.on = function(event_, func_) {
		if(typeof func_ !== "function") {
			throw new TypeError("argument func_ must be a function");
		}
		else if(typeof event_ !== "string") {
			throw new TypeError("argument event_ must be a string");
		}

		if(func_ == self.event) {
			return self.stack(func_);
		}

		if(funcs[event_] == null) {
			funcs[event_] = [];
		}

		funcs[event_][funcs[event_].length] = func_;

		self.update();
	
		return self;
	}

	/**
	 * @function stack
	 */
	self.stack = function(event_) {
		if(typeof func_ !== "function") {
			throw new TypeError("argument func_ must be a function");
		}

		locked = false;

		var promise_ = event_();

		stacked = promise_.event;
		promise_.queue = promise_.queue.concat(self.queue);
		promise_.update();
	
		return self;
	}

	func.apply(self, [self.event]);
	
	return self;
}