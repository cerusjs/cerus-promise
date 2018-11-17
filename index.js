module.exports = function() {
	var plugin = {};
	var package = require("./package.json");
	var promise = require("./lib/promise");
	
	plugin.name = package["name"];
	plugin.version = package["version"];

	plugin.promise = function(func) {
		return new promise(func);
	}

	/**
	 * Using this function you can easily promisify a function. Supply the function you want to 
	 * promisify as first argument and when you call the function that is returned from this 
	 * function using the arguments you would have normally used, it'll return a promise. When the 
	 * function is finished it'll resolve the promise, but when the first parameter in the callback
	 * function is an error it'll throw an error.<br>
	 * [Click me](/views/cerus-promise/reference/promise.html) for the documentation about the 
	 * promise class.
	 * @param {Function} func The function to promisify.
	 * @returns {Function} The promisified version of the original function.
	 * @class promisify
	 */
	plugin.promisify = function(func) {
		if(typeof func !== "function") {
			throw new TypeError("The argument func must be a function");
		}

		return (...args) => {
			return new promise(event => {
				func(...args, (...callbackArgs) => {
					if(callbackArgs.length > 0 && callbackArgs[0] instanceof Error) {
						return event("error", callbackArgs[0]);
					}

					event("success", ...callbackArgs);
				});
			});
		}
	}

	return plugin;
}