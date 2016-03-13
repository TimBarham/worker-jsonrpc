// Support private properties
var privateMap = new WeakMap();
var privateProps = function (object) {
    if (!privateMap.has(object)) {
        privateMap.set(object, {});
    }
    return privateMap.get(object);
};

// REGEX's for parsing function names and params
var PARSE_FN = /^function\s*([^\(\s]*)\s*\(\s*([^\)]*)\)/m;
var SPLIT_ARGS = /\s*,\s*/;
var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

class RpcServer {
    constructor(transport) {
        transport = transport || (new Function('return this;'))();
        if (!transport.postMessage) {
            throw new TypeError('Transport must provide an \'postMessage\' method.');
        }
        if (!transport.addEventListener) {
            throw new TypeError('Transport must provide an \'addEventListener\' method.');
        }

        privateProps(this).transport = transport;
        privateProps(this).implementers = {};
        transport.addEventListener('message', handleMessage.bind(this));
    }

    implement() {
        var args = Array.prototype.slice.call(arguments);
        args.forEach(def => {
            if (Array.isArray(def)) {
                def.forEach(_def => {
                    this.implement(_def);
                });
            } else if (typeof def === 'function') {
                implementOne.call(this, def);
            } else if (typeof def === 'object') {
                Object.getOwnPropertyNames(def).forEach(fnName => {
                    var fn = def[fnName];
                    if (typeof fn === 'function') {
                        implementOne.call(this, fn, fnName);
                    } else {
                        throw new TypeError('Member \'' + fnName + '\' is not a function.');
                    }
                });
            } else {
                throw new TypeError('Invalid argument: ' + def);
            }
        });
    }
}

/**
 * @param {{data: {jsonrpc: string, method: string, params, id: number}}} msg
 */
function handleMessage(msg) {
    // If this is a message we should handle, then msg.data should have a request property in the form:
    // {
    //   jsonrpc: '2.0',
    //   method: 'method-name',
    //   params: [value1, value2, ...] or {name1: value1, name2: value, ...}
    //   id: id
    // }
    //
    // If id is not provided, this is a notification that doesn't expect a reply.

    var data = msg.data;
    if (!data || (typeof data !== 'object')) {
        return;
    }

    var request = data.request;
    if (!request || request.jsonrpc !== '2.0') {
        return;
    }

    var id = request.id;
    if ((typeof id !== 'undefined') && (typeof id !== 'number')) {
        return respondError.call(this, request.id, -32600, 'Invalid request: id is not a number: ' + JSON.stringify(request));
    }

    var methodName = request.method;
    if (!methodName) {
        return respondError.call(this, request.id, -32600, 'Invalid request: no method specified: ' + JSON.stringify(request));
    }

    var fnInfo = privateProps(this).implementers[methodName];
    if (!fnInfo) {
        return respondError.call(this, request.id, -32601, 'Method not implemented: ' + methodName);
    }

    try {
        if (request.params) {
            var args;
            if (Array.isArray(request.params)) {
                args = request.params;
            } else {
                args = [];
                Object.getOwnPropertyNames(request.params).forEach(paramName => {
                    if (!fnInfo.args.hasOwnProperty(paramName)) {
                        throw 'Parameter \'' + paramName + '\' not supported by method \'' + methodName + '\'.';
                    }
                    args[fnInfo.args[paramName]] = request.params[paramName];
                });
            }
        }
    } catch (e) {
        return respondError.call(this, request.id, -32602, e.message || e);
    }

    respond.call(this, request.id, fnInfo.function.apply(this, args));
}

function respond(id, result) {
    if (typeof id === 'undefined') {
        return;
    }

    if (typeof result === 'undefined') {
        result = null;
    }

    privateProps(this).transport.postMessage({
        response: {
            jsonrpc: '2.0',
            id: id,
            result: result
        }
    });
}

function respondError(id, code, message) {
    if (typeof id === 'undefined') {
        return;
    }

    privateProps(this).transport.postMessage({
        response: {
            jsonrpc: '2.0',
            id: id,
            error: {
                code: code,
                message: message
            }
        }
    });
}

function implementOne(fn, name) {
    var fnInfo = parseFunction(fn);
    fnInfo.name = name || fnInfo.name;
    if (!fnInfo.name) {
        throw new TypeError('Cannot implement anonymous function: ' + fn.toString().slice(0, 20) + '...');
    }
    if (privateProps(this).implementers.hasOwnProperty(fnInfo.name)) {
        throw new TypeError('Duplicate function name: ' + fnInfo.name);
    }
    privateProps(this).implementers[fnInfo.name] = fnInfo;
}

function parseFunction(fn) {
    var fnString = fn.toString().replace(STRIP_COMMENTS, '');
    var match = fnString.match(PARSE_FN);
    if (!match) {
        throw new TypeError('Cannot parse function: ' + fnString.slice(0, 20) + '...');
    }
    return {
        name: match[1],
        function: fn,
        args: parseArgs(match[2])
    };
}

function parseArgs(args) {
    return args.split(SPLIT_ARGS).reduce((result, arg, index) => {
        if (arg) {
            result[arg] = index;
        }
        return result;
    }, {});
}

export {RpcServer};
