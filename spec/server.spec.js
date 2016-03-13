var transportProvider = require('./transport');
var RpcServer = require('../lib/index').RpcServer;

describe('server', function () {
    describe('constructor', function () {
        it('throws if default transport does not support postMessage', function () {
            expect(function () {
                var rpcServer = new RpcServer();
            }).toThrowError('Transport must provide an \'postMessage\' method.');
        });

        it('throws if provided transport does not support postMessage', function () {
            expect(function () {
                var rpcServer = new RpcServer(transportProvider({noPostMessage: true}));
            }).toThrowError('Transport must provide an \'postMessage\' method.');
        });

        it('throws if provided transport does not support addEventListener', function () {
            expect(function () {
                var rpcServer = new RpcServer(transportProvider({noAddEventListener: true}));
            }).toThrowError('Transport must provide an \'addEventListener\' method.');
        });

        it('calls addEventListener with expected parameters', function () {
            var transport = transportProvider();
            spyOn(transport, 'addEventListener').and.callThrough();
            var rpcServer = new RpcServer(transport);
            expect(transport.addEventListener).toHaveBeenCalledWith('message', jasmine.any(Function));
        })
    });

    describe('implement method', function () {
        it('throws if passed anonymous function', function () {
            var rpcServer = new RpcServer(transportProvider());
            expect(function () {
                rpcServer.implement(function (param1, param2) {
                });
            }).toThrowError('Cannot implement anonymous function: function (param1, pa...');
        });

        it('handles function with comments in parameter list', function () {
            var rpcServer = new RpcServer(transportProvider());
            expect(function () {
                rpcServer.implement(function test(param1 /* comment */, /* comment */ param2) {
                });
            }).not.toThrow();
        });

        describe('throws if duplicate method names defined', function () {
            it('in a single call', function () {
                var rpcServer = new RpcServer(transportProvider());
                expect(function () {
                    rpcServer.implement([function fn1(param1, param2) {
                    }, function fn1(param1, param2) {
                    }]);
                }).toThrowError('Duplicate function name: fn1');
            });

            it('across multiple calls', function () {
                var rpcServer = new RpcServer(transportProvider());
                rpcServer.implement(function fn1(param1, param2) {
                });
                expect(function () {
                    rpcServer.implement(function fn1(param1, param2) {
                    });
                }).toThrowError('Duplicate function name: fn1');

            });
        });

        describe('responds correctly when', function () {
            describe('single named method provided', function () {
                var transport = transportProvider();
                var rpcServer = new RpcServer(transport);
                rpcServer.implement(function sum(a, b, c) {
                    return a + b * c;
                });
                var request = {
                    data: {
                        request: {
                            id: 0,
                            jsonrpc: '2.0',
                            method: "sum",
                            params: [1, 2, 3]
                        }
                    }
                };

                it('and called with param array', function () {
                    spyOn(transport, "postMessage");
                    request.data.request.params = [1, 2, 3];
                    transport.fireEvent(request);
                    expect(transport.postMessage).toHaveBeenCalledWith({response: {jsonrpc: '2.0', id: 0, result: 7}});
                });
                it('and called with param object', function () {
                    spyOn(transport, "postMessage");
                    request.data.request.params = {b: 2, c: 3, a: 1};
                    transport.fireEvent(request);
                    expect(transport.postMessage).toHaveBeenCalledWith({response: {jsonrpc: '2.0', id: 0, result: 7}});
                });
            });

            it('methods provided in array (with nesting)', function () {
                var transport = transportProvider();
                var rpcServer = new RpcServer(transport);
                rpcServer.implement([function fn1(a, b) {
                    return a * b
                }, {
                    fn2: function () {
                    }, fn3: function dummy(a, b) {
                        return a + b
                    }
                }, [function fn4() {
                }, function fn5(a, b) {
                    return Math.pow(a, b)
                }]]);

                // We'll call all methods to verify they're defined, and a couple with params to verify they return
                // expected result.

                spyOn(transport, "postMessage");

                var request = {data: {request: {id: 0, jsonrpc: '2.0'}}};

                function callMethod(method, params, expectedResult, expectedError) {
                    transport.postMessage.calls.reset();
                    request.data.request.method = method;
                    if (params) {
                        request.data.request.params = params;
                    } else {
                        delete request.data.request.params;
                    }

                    transport.fireEvent(request);
                    expect(transport.postMessage).toHaveBeenCalledWith({
                        response: {
                            jsonrpc: '2.0',
                            id: 0,
                            result: expectedResult
                        }
                    });
                }

                callMethod('fn1', [4, 5], 20);
                callMethod('fn2', null, null);
                callMethod('fn3', [5, 6], 11);
                callMethod('fn4', null, null);
                callMethod('fn5', [2, 3], 8);
            });
        });
    });

    it('returns an error when called with no method name', function () {
        var transport = transportProvider();
        var rpcServer = new RpcServer(transport);
        var request = {data: {request: {id: 0, jsonrpc: '2.0'}}};

        spyOn(transport, "postMessage");
        transport.fireEvent(request);
        expect(transport.postMessage).toHaveBeenCalledWith({
            response: {
                jsonrpc: '2.0',
                id: 0,
                error: {code: -32600, message: 'Invalid request: no method specified: {"id":0,"jsonrpc":"2.0"}'}
            }
        });
    });

    it('returns an error when called with an invalid method name', function () {
        var transport = transportProvider();
        var rpcServer = new RpcServer(transport);
        var request = {data: {request: {id: 0, jsonrpc: '2.0', method: 'foo'}}};

        spyOn(transport, "postMessage");
        transport.fireEvent(request);
        expect(transport.postMessage).toHaveBeenCalledWith({
            response: {
                jsonrpc: '2.0',
                id: 0,
                error: {code: -32601, message: 'Method not implemented: foo'}
            }
        });
    });

    it('returns an error when called with an invalid parameter name', function () {
        var transport = transportProvider();
        var rpcServer = new RpcServer(transport);
        rpcServer.implement(function foo(a, b) {
        });
        var request = {data: {request: {id: 0, jsonrpc: '2.0', method: 'foo', params: {c: 0}}}};

        spyOn(transport, "postMessage");
        transport.fireEvent(request);
        expect(transport.postMessage).toHaveBeenCalledWith({
            response: {
                jsonrpc: '2.0',
                id: 0,
                error: { code: -32602, message: 'Parameter \'c\' not supported by method \'foo\'.' }
            }
        });

    });
});

