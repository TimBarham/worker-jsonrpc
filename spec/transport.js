/**
 * @param {{noPostMessage?: boolean, noAddEventListener?: boolean}} [options]
 */
module.exports = function (options) {
    options = options || {};
    var transport = {};
    if (!options.noPostMessage) {
        transport.postMessage = function () {};
    }
    if (!options.noAddEventListener) {
        transport.addEventListener = function (message, cb) {
            this.cb = cb;
        };
        transport.fireEvent = function (value) {
            this.cb(value);
        }
    }
    return transport;
};
