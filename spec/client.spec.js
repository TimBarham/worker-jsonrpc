var transportProvider = require('./transport');
var RpcClient = require('../lib/client').RpcClient;

describe('client', function () {
    describe('constructor', function () {
        it('throws if default transport does not support postMessage', function () {
            expect(function () {
                var rpcClient = new RpcClient();
            }).toThrowError('Transport must provide an \'postMessage\' method.');
        });

        it('throws if provided transport does not support postMessage', function () {
            expect(function () {
                var rpcClient = new RpcClient(transportProvider({noPostMessage: true}));
            }).toThrowError('Transport must provide an \'postMessage\' method.');
        });

        it('throws if provided transport does not support addEventListener', function () {
            expect(function () {
                var rpcClient = new RpcClient(transportProvider({noAddEventListener: true}));
            }).toThrowError('Transport must provide an \'addEventListener\' method.');
        });

        it('calls addEventListener with expected parameters', function () {
            var transport = transportProvider();
            spyOn(transport, 'addEventListener').and.callThrough();
            var rpcClient = new RpcClient(transport);
            expect(transport.addEventListener).toHaveBeenCalledWith('message', jasmine.any(Function));
        })
    });

    describe('call method', function () {
        it('calls transport.postMessage() with expected values', function () {
            var transport = transportProvider();
            var rpcClient = new RpcClient(transport);
            spyOn(transport, 'postMessage');
            rpcClient.call('MyMethod', {param1: "param1-value", param2: 0});
            expect(transport.postMessage).toHaveBeenCalledWith({
                request: {
                    jsonrpc: '2.0',
                    method: 'MyMethod',
                    params: {param1: 'param1-value', param2: 0},
                    id: 0
                }
            });
        });

        it('calls transport.postMessage() without params if none provided', function () {
            var transport = transportProvider();
            var rpcClient = new RpcClient(transport);
            spyOn(transport, 'postMessage');
            rpcClient.call('MyMethod');
            expect(transport.postMessage).toHaveBeenCalledWith({request: {jsonrpc: '2.0', method: 'MyMethod', id: 0}});
        });

        it('returns a promise', function () {
            var transport = transportProvider();
            var rpcClient = new RpcClient(transport);
            var result = rpcClient.call('MyMethod');
            expect(result.then).toBeDefined();
        });

        it('resolves promise when message event fires with a result', function (done) {
            var transport = transportProvider();
            var rpcClient = new RpcClient(transport);
            var result = rpcClient.call('MyMethod')
                .then(function (val) {
                    expect(val).toBe('SOME VALUE');
                    done();
                }).catch(function (error) {
                    fail('Promise should not have been rejected: ' + error);
                    done();
                });
            transport.fireEvent({
                data: {
                    response: {
                        id: 0,
                        jsonrpc: '2.0',
                        result: "SOME VALUE"
                    }
                }
            });
        });

        it('rejects promise when message event fires with an error', function (done) {
            var transport = transportProvider();
            var rpcClient = new RpcClient(transport);
            var result = rpcClient.call('MyMethod')
                .then(function (val) {
                    fail('Promise should not have been resolved: ' + val);
                    done();
                }).catch(function (error) {
                    expect(error).toBe('SOME ERROR');
                    done();
                });
            transport.fireEvent({
                data: {
                    response: {
                        id: 0,
                        jsonrpc: '2.0',
                        error: "SOME ERROR"
                    }
                }
            });
        });
    });

    describe('notify method', function () {
        it('calls transport.postMessage() with expected values', function () {
            var transport = transportProvider();
            var rpcClient = new RpcClient(transport);
            spyOn(transport, 'postMessage');
            rpcClient.notify('MyMethod', {param1: "param1-value", param2: 0});
            expect(transport.postMessage).toHaveBeenCalledWith({
                request: {
                    jsonrpc: '2.0',
                    method: 'MyMethod',
                    params: {param1: 'param1-value', param2: 0}
                }
            });
        });

        it('calls transport.postMessage() without params if none provided', function () {
            var transport = transportProvider();
            var rpcClient = new RpcClient(transport);
            spyOn(transport, 'postMessage');
            rpcClient.notify('MyMethod');
            expect(transport.postMessage).toHaveBeenCalledWith({request: {jsonrpc: '2.0', method: 'MyMethod'}});
        });

        it('returns nothing', function () {
            var transport = transportProvider();
            var rpcClient = new RpcClient(transport);
            var result = rpcClient.notify('MyMethod');
            expect(result).toBeUndefined();
        });
    });
});
