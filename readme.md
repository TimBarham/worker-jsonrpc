[![Build Status](https://travis-ci.org/TimBarham/worker-jsonrpc.svg?branch=master)](https://travis-ci.org/TimBarham/worker-jsonrpc) [![Coverage Status](http://img.shields.io/coveralls/TimBarham/worker-jsonrpc.svg)](https://coveralls.io/r/TimBarham/worker-jsonrpc)

# JSON-RPC 2.0 for Web Workers
(Or: 'Yet Another JSON-RPC 2.0 `postMessage` Implementation')

A quick and dirty JSON-RPC 2.0 client and server that will work with any transport that supports `postMessage(value)`
and `addEventListener('message')`. As such, works OOTB with web workers. Alternatively a transport object can implemented
to wrap other communication mechanisms.

# Features

* Reasonably complete implementation of JSON-RPC 2.0 spec. Does not yet support batch request/response, nor enforce
  parameter counts when passed as arrays.
* Supports named and positional parameters.
* No dependencies.

Why? Because I needed something small and simple and the available options didn't suit my needs. 

# Usage

```
npm-install worker-jsonrpc
```

In the browser, include `post-message-rpc.js` or `post-message-rpc.min.js`, found in the `dist` directory (in a web worker,
you can include this file using `importScripts()`). This will make available the global `PostMessageRpc` object.

Note that `worker-jsonrpc` expects a Promise implementation to be available. If a Promise implementation may not be available,
provide a polyfill (such as [es6-promise](https://www.npmjs.com/package/es6-promise)).

## Server

``` js
var rpcServer = new PostMessageRpc.RpcServer([transport]);
```

See below for a discussion of the `transport` parameter.

Once a server is constructed, define methods on it using the `implement` method:

``` js
rpcServer.implement(function add(a, b) { return a + b; }, function close() { ... });
```

The `implement` method accepts multiple arguments. Each argument can be one of the following:
 
* A single, named function.
* An object where each key is the method name, and the value is a function (if the function is named, its name is ignored).
* An array where each item is any of the these three options.

## Client

``` js
var rpcClient = new PostMessageRpc.RpcClient([transport]);
```

See below for a discussion of the `transport` parameter.

Once a client is constructed, call methods on it using the `call` or `notify` methods"

``` js
rpcClient.call('add', [1, 2]).then(function (result) {
    console.log('The add method returned the following: ' + result);
}, function (error) {
    console.log('An error occurred calling the add method: ' + error);
});

rpcClient.notify('close');
```

The `call` method takes two parameters - the method to call and, optionally, the parameters. Parameters can be specified
as an array of ordered parameters, or as an object defining parameters by name:

``` js
rpcClient.call('add', {a: 1, b: 2});
```

The `call` method returns a promise that is resolved with the methods return value on success, or rejected if an error occurs.

The `notify` method is essentially the same as the `call` method, except it doesn't expect a response (and doesn't return a promise).

## The `transport` parameter

A `transport` parameter can optionally be provided to both the client and server constructors. If it is not provided, the
current global object will be used. 

Messages are sent between client and server by calling `transport.postMessage()`, and are received by subscribing to the
`message` event (that is, by calling `transport.addEventListener('message', cb)`).

In the case of communicating with a web worker, you can pass the worker itself in the code that owns the worker:

``` js
var worker = new Worker('worker.js');
var rpcClient = new PostMessageRpc.RpcClient(worker);
var rpcServer = new PostMessageRpc.RpcServer(worker);
```

For code within the web worker, no transport needs to be provided as it can use the global object.

In other scenarios, a `transport` object can be implemented that provides the interface to the alternative transport
mechanism. Note that the value passed to `postMessage()` is always an JavaScript object. Implementations that require
strings will have to `JSON.stringify()` it. 

Also, In order to differentiate between requests and responses over the same pipe-line, the object is of the form:

```js
{
  request: {
    method: ...
  }
}
```

or

```js
{
  response: {
    id: ...
  }
}
```

# Building

    npm run build

This first runs `babel` to create ES5 compatible files in `lib`, then `webpack` to create regular and minified browser packages in `dist`.

# Tests

Run tests:

    npm run test

Run tests with code coverage:

    npm run cover
