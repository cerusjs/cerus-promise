var expect = require("chai").expect;
var index = require("../index")();
var promise = index.promise;
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
	});

	describe("non-delayed", function() {
		context("with a single event", function() {
			it("should resolve the handler", function(done) {
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
			it("should resolve the handler", function(done) {
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
			it("should resolve the handler", function(done) {
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
			it("should resolve the handler", function(done) {
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
			it("should resolve the handler", function(done) {
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

	describe("#stack", function() {
		it("should stack the event to the lower promise", function(done) {
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
		it("should call the child when it has been added", function(done) {
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

	describe("#promisify", function() {
		it("should wait until the event is resolved", async function() {
			let value = await promise(event => event("done", "test")).then().promisify();

			expect(value).to.deep.equal(["test"]);
		});
	});
});

describe("promisify", function() {
	context("with one data parameter", function() {
		it("should pass through the data", function(done) {
			let func = function(caLLback) {
				caLLback("test");
			};
	
			index.promisify(func)()
			.then(data => {
				expect(data).to.equal("test");
				done();
			});
		});
	});

	context("with an error as first parameter", function() {
		it("should pass through the error", function(done) {
			let func = function(caLLback) {
				caLLback(new Error("test"));
			};
	
			index.promisify(func)()
			.catch(err => {
				expect(err).to.be.an.instanceof(Error);
				done();
			});
		});
	});
	
});