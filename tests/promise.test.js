var expect = require("chai").expect;
var promise = require("./../index")().promise;
var wait = setTimeout;

describe("promise", function() {
	describe("#constructor", function() {
		context("with no parameters", function() {
			it("should throw an error", function() {
				var func = function() {
					promise()
				}

				expect(func).to.throw();
			});
		});

		context("with a function as parameters", function() {
			it("shouldn't throw an error", function() {
				var func = function() {
					promise(function() {})
				}

				expect(func).to.not.throw();
			});
		});
	});

	describe("non-delayed", function() {
		context("with a single event", function() {
			it("should work", function(done) {
				promise(function(event) {
					event("test");
				})
				.then(function(event) {
					expect(event).to.equal("test");
					done();
				}, true);
			});
		});

		context("with multiple events", function() {
			it("should work", function(done) {
				promise(function(event) {
					event("test1", "test");
					event("test2", "test");
				})
				.on("test1", function(data) {
					expect(data).to.equal("test");
				})
				.on("test2", function(data) {
					expect(data).to.equal("test");
					done();
				});
			});
		});

		context("with an error thrown", function() {
			it("should work", function(done) {
				promise(function(event) {
					event("error", "test");
				})
				.catch(function(err) {
					expect(err).to.equal("test");
					done();
				});
			});
		});
	});

	describe("delayed", function() {
		context("with a single event", function() {
			it("should work", function(done) {
				promise(function(event) {
					wait(function() {event("test")}, 1);
				})
				.then(function(event) {
					expect(event).to.equal("test");
					done();
				}, true);
			});
		});

		context("with multiple events", function() {
			it("should work", function(done) {
				promise(function(event) {
					wait(function() {event("test1", "test1")}, 1);
					wait(function() {event("test2", "test2")}, 2);
				})
				.on("test2", function(data) {
					expect(data).to.equal("test2");
				})
				.on("test1", function(data) {
					expect(data).to.equal("test1");
					done();
				});
			});
		});

		context("with an error thrown", function() {
			it("should work", function(done) {
				promise(function(event) {
					wait(function() {event("error", "test")}, 1);
				})
				.catch(function(err) {
					expect(err).to.equal("test");
					done();
				});
			});
		});
	});

	describe("stack", function() {
		it("should work", function(done) {
			promise(function(event) {
				promise(function(event) {
					event("done", "test");
				})
				.stack(event);
			})
			.then(function(data) {
				expect(data).to.equal("test");
				done();
			});
		});
	});

	describe("child", function() {
		it("should work", function(done) {
			promise(function(event) {
				event("test1", "test");
			})
			.on("test1", function(data) {
				expect(data).to.equal("test");
				
				return promise(function(event) {
					event("test2", "test");
				});
			})
			.on("test2", function(data) {
				expect(data).to.equal("test");
				done();
			});
		});
	});
});