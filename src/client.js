// Support private properties
var privateMap = new WeakMap();
var privateProps = function (object) {
    if (!privateMap.has(object)) {
        privateMap.set(object, {});
    }
    return privateMap.get(object);
};

class RpcClient {
    constructor(transport) {
        transport = transport || (new Function('return this;'))();
        if (!transport.postMessage) {
            throw new TypeError('Transport must provide an \'postMessage\' method.');
        }
        if (!transport.addEventListener) {
            throw new TypeError('Transport must provide an \'addEventListener\' method.');
        }
        transport.addEventListener('message', handleMessage.bind(this));

        privateProps(this).transport = transport;
        privateProps(this).nextId = 0;
        privateProps(this).handlers = {};
    }

    call(method, params) {
        return new Promise((fulfill, reject) => {
            var id = privateProps(this).nextId++;
            privateProps(this).handlers[id] = {
                fulfill: fulfill,
                reject: reject
            };
            postRequest.call(this, method, params, id);
        });
    }

    notify(method, params) {
        postRequest.call(this, method, params);
    }
}

function postRequest(method, params, id) {
    var request = {
        jsonrpc: '2.0',
        method: method
    };
    if (typeof params !== 'undefined') {
        request.params = params;
    }
    if (typeof id === 'number') {
        request.id = id;
    }
    privateProps(this).transport.postMessage({
        request: request
    });
}

/**
 * @param {{data: {jsonrpc: string, result, error: {}, id: number}}} msg
 */
function handleMessage(msg) {
    // If this is a message we should handle, then msg.data will be in the form:
    // {
    //   jsonrpc: '2.0',
    //   result: result, // if success
    //   error: error, // if failure
    //   id: id
    // }

    var data = msg.data;
    if (!data || (typeof data !== 'object')) {
        return;
    }

    var response = data.response;
    if (!data.response || data.response.jsonrpc !== '2.0') {
        return;
    }

    var hasResult = response.hasOwnProperty('result');
    if (hasResult === !!response.error) {
        // We either have neither result nor error, or both - ignore invalid response
        return;
    }

    var id = response.id;
    if (typeof id !== 'number') {
        // Ignore response without a valid id
        return;
    }

    var handlers = privateProps(this).handlers[id];
    if (!handlers) {
        // Ignore response we don't have handlers for
        return;
    }
    delete privateProps(this).handlers[id];

    if (hasResult) {
        handlers.fulfill(response.result);
    } else {
        handlers.reject(response.error);
    }
}

export {RpcClient};
