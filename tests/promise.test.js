var expect = require("chai").expect;
var index = require("../index")();
var promise = index.promise;
var wait = setTimeout;

describe("promise", () => {
	describe("#constructor", () => {
		context("with a promise as parameter", () => {
			it("should create an event on resolve", done => {
				promise(new Promise(resolve => resolve("test")))
				.then(data => {
					expect(data).to.equal("test");

					done();
				});
			});
		});
	});

	describe("non-delayed", () => {
		context("with a single event", () => {
			it("should resolve the handler", done => {
				promise(event => {
					event("test");
				})
				.then(event => {
					expect(event).to.equal("test");
					done();
				}, {event: true});
			});
		});

		context("with multiple events", () => {
			it("should resolve the handler", done => {
				promise(event => {
					event("test1", "test");
					event("test2", "test");
				})
				.on("test1", data => {
					expect(data).to.equal("test");
				})
				.on("test2", data => {
					expect(data).to.equal("test");
					done();
				});
			});
		});

		context("with an error thrown", () => {
			it("should resolve the handler", done => {
				promise(event => {
					event("error", "test");
				})
				.catch(err => {
					expect(err).to.equal("test");
					done();
				});
			});
		});
	});

	describe("delayed", () => {
		context("with a single event", () => {
			it("should resolve the handler", done => {
				promise(event => {
					wait(() => {event("test")}, 1);
				})
				.then(event => {
					expect(event).to.equal("test");
					done();
				}, {event: true});
			});
		});

		context("with multiple events", () => {
			it("should resolve the handler", done => {
				promise(event => {
					wait(() => {event("test1", "test1")}, 1);
					wait(() => {event("test2", "test2")}, 2);
				})
				.on("test2", data => {
					expect(data).to.equal("test2");
				})
				.on("test1", data => {
					expect(data).to.equal("test1");
					done();
				});
			});
		});

		context("with an error thrown", () => {
			it("should work", done => {
				promise(event => {
					wait(() => {event("error", "test")}, 1);
				})
				.catch(err => {
					expect(err).to.equal("test");
					done();
				});
			});
		});
	});

	describe("#stack", () => {
		it("should stack the event to the lower promise", done => {
			promise(event => {
				promise(event => {
					event("done", "test");
				})
				.stack(event);
			})
			.then(data => {
				expect(data).to.equal("test");
				done();
			});
		});
	});

	describe("child", () => {
		context("when parent is called once", () => {
			it("should call the child when it has been added", done => {
				promise(event => {
					event("test1", "test");
				})
				.on("test1", data => {
					expect(data).to.equal("test");
					
					return promise(event => {
						event("test2", "test");
					});
				})
				.on("test2", data => {
					expect(data).to.equal("test");
					done();
				});
			});
		});

		context("when the parent is called multiple times", () => {
			it("should call the child multiple times", done => {
				promise(event => {
					event("test1", "testa");
					event("test1", "testb");
				})
				.on("test1", data => {
					if(data === "testa") return promise(event => event("test2", "testc"));
					if(data === "testb") return promise(event => event("test2", "testd"));

					throw new Error("data is incorrect");
				})
				.on("test2", data => {
					if(data === "testc") return;
					if(data === "testd") return done();
					
					throw new Error("data is incorrect");
				});
			});
		});
	});

	describe("#shadow", () => {
		it("should wait until the event is resolved", async () => {
			let value = await promise(event => event("done", "test")).shadow();

			expect(value).to.deep.equal("test");
		});
	});

	describe("passthrough", () => {
		context("with a .then function", () => {
			it("should pass through the data", done => {
				promise(event => {
					event("success", "test");
				})
				.then(data => data + "1", {passthrough: true})
				.then(data => {
					expect(data).to.equal("test1");

					done();
				});
			});
		});

		context("with a .then function and the multi option", () => {
			it("should pass through the data", done => {
				promise(event => {
					event("success", "test");
				})
				.then(data => [data + "1", data + "2"], {passthrough: true, multi: true})
				.then((data1, data2) => {
					expect(data1).to.equal("test1");
					expect(data2).to.equal("test2");

					done();
				});
			});
		});

		context("with a .catch function", () => {
			it("should pass through the data", done => {
				promise(event => {
					event("error", "test");
				})
				.catch(data => data + "1", {passthrough: true})
				.catch(data => {
					expect(data).to.equal("test1");

					done();
				});
			});
		});
	});
});

describe("promisify", () => {
	context("with one data parameter", () => {
		it("should pass through the data", done => {
			let func = callback => {
				callback("test");
			};
	
			index.promisify(func)()
			.then(data => {
				expect(data).to.equal("test");
				done();
			});
		});
	});

	context("with an error as first parameter", () => {
		it("should pass through the error", done => {
			let func = callback => {
				callback(new Error("test"));
			};
	
			index.promisify(func)()
			.catch(err => {
				expect(err).to.be.an.instanceof(Error);
				done();
			});
		});
	});
});