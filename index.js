module.exports = function() {
	var self = {};

	var package = require("../package.json");
	
	self.name = package["name"];
	self.version = package["version"];

	self.promise = require("./lib/promise");

	return self;
}