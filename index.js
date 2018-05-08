module.exports = function() {
	var plugin = {};
	var package = require("./package.json");
	var promise = require("./lib/promise");
	
	plugin.name = package["name"];
	plugin.version = package["version"];

	plugin.promise = function(func) {
		return new promise(func);
	}

	return plugin;
}