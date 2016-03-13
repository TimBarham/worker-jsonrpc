var webpack = require("webpack");

module.exports = {
    entry: './lib/index.js',
    output: {
        filename: 'dist/post-message-rpc.js',
        library: 'PostMessageRpc'
    }
};
