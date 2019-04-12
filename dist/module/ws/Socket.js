var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
import { EventEmitter } from 'events';
import { AuthenticationFailedError, BadMessageError, NoMethodHandlerError, TimeoutError, UACCESS, UnknownCodeError, UNOTFOUND, } from '../errors';
import { Reply } from './Reply';
// The method of the authentication packet to store.
var authMethod = 'auth';
/**
 * Return a promise which is rejected with a TimeoutError after the
 * provided delay.
 */
function timeout(delay) {
    return new Socket.Promise(function (_resolve, reject) {
        setTimeout(function () { return reject(new TimeoutError()); }, delay);
    });
}
function isBrowserWebSocket(socket) {
    return !socket.ping;
}
function isNodeWebSocket(socket) {
    return !isBrowserWebSocket(socket);
}
/**
 * Wraps a DOM socket with EventEmitter-like syntax.
 */
export function wrapDOM(socket) {
    function wrapHandler(event, fn) {
        return function (ev) {
            if (event === 'message') {
                fn(ev.data);
            }
            else {
                fn(ev);
            }
        };
    }
    socket.on = function (event, listener) {
        var wrapped = wrapHandler(event, listener);
        socket.addEventListener(event, wrapped);
    };
    socket.once = function (event, listener) {
        var wrapped = wrapHandler(event, listener);
        socket.addEventListener(event, function (ev) {
            wrapped(ev);
            socket.removeEventListener(event, wrapped);
        });
    };
    return socket;
}
/**
 * Manages a connect to Mixer's chat servers.
 */
var Socket = /** @class */ (function (_super) {
    __extends(Socket, _super);
    function Socket(wsCtor, addresses, options) {
        var _this = _super.call(this) || this;
        _this.wsCtor = wsCtor;
        _this.options = options;
        // Spool to store events queued when the connection is lost.
        _this._spool = [];
        // Counter of the current number of reconnect retries, and the number of
        // retries before we reset our reconnect attempts.
        _this._retries = 0;
        _this._retryWrap = 7; // max 2 minute retry time;
        _this._optOutEventsArgs = [];
        _this.options = __assign({ pingInterval: 15 * 1000, pingTimeout: 5 * 1000, callTimeout: 20 * 1000, protocolVersion: '1.0', clientId: null }, options);
        // Which connection we use in our load balancing.
        _this._addressOffset = Math.floor(Math.random() * addresses.length);
        // List of addresses we can connect to.
        _this._addresses = addresses;
        // Information for server pings. We ping the server on the interval
        // (if we don't get any other packets) and consider a connection
        // dead if it doesn't respond within the timeout.
        _this._pingTimeoutHandle = null;
        // The status of the socket connection.
        _this.status = Socket.IDLE;
        // Timeout waiting to reconnect
        _this._reconnectTimeout = null;
        // Map of call IDs to promises that should be resolved on
        // method responses.
        _this._replies = {};
        // Authentication packet store that we'll resend if we have to reconnect.
        _this._authpacket = null;
        // Counter for method calls.
        _this._callNo = 0;
        return _this;
    }
    // tslint:disable-next-line: no-unnecessary-override
    Socket.prototype.on = function (event, cb) {
        return _super.prototype.on.call(this, event, cb);
    };
    /**
     * Gets the status of the socket connection.
     */
    Socket.prototype.getStatus = function () {
        return this.status;
    };
    /**
     * Returns whether the socket is currently connected.
     */
    Socket.prototype.isConnected = function () {
        return this.status === Socket.CONNECTED;
    };
    /**
     * Retrieves a chat endpoint to connect to. We use round-robin balancing.
     */
    Socket.prototype.getAddress = function () {
        if (++this._addressOffset >= this._addresses.length) {
            this._addressOffset = 0;
        }
        var address = this._addresses[this._addressOffset];
        address += "?version=" + this.options.protocolVersion;
        if (this.options.clientId) {
            address += "&Client-ID=" + this.options.clientId;
        }
        return address;
    };
    /**
     * Returns how long to wait before attempting to reconnect. This does TCP-style
     * limited exponential backoff.
     */
    Socket.prototype.getNextReconnectInterval = function () {
        var power = (this._retries++ % this._retryWrap) + Math.round(Math.random());
        return (1 << power) * 500;
    };
    /**
     * handleClose is called when the websocket closes or emits an error. If
     * we weren't gracefully closed, we'll try to reconnect.
     */
    Socket.prototype.handleClose = function () {
        clearTimeout(this._pingTimeoutHandle);
        this._pingTimeoutHandle = null;
        var socket = this.ws;
        this.ws = null;
        this.removeAllListeners('WelcomeEvent');
        if (this.status === Socket.CLOSING) {
            this.status = Socket.CLOSED;
            this.emit('closed');
            return;
        }
        var interval = this.getNextReconnectInterval();
        this.status = Socket.CONNECTING;
        this._reconnectTimeout = setTimeout(this.boot.bind(this), interval);
        this.emit('reconnecting', { interval: interval, socket: socket });
    };
    /**
     * Sets the socket to send a ping message after an interval. This is
     * called when a successful ping is received and after data is received
     * from the socket (there's no need to ping when we know the socket
     * is still alive).
     */
    Socket.prototype.resetPingTimeout = function () {
        var _this = this;
        clearTimeout(this._pingTimeoutHandle);
        this._pingTimeoutHandle = setTimeout(function () { return _this.ping().catch(function () { return undefined; }); }, this.options.pingInterval);
    };
    /**
     * Resets the connection timeout handle. This will run the handler
     * after a short amount of time.
     */
    Socket.prototype.resetConnectionTimeout = function (handler) {
        clearTimeout(this._pingTimeoutHandle);
        this._pingTimeoutHandle = setTimeout(handler, this.options.pingTimeout);
    };
    /**
     * Ping runs a ping against the server and returns a promise which is
     * resolved if the server responds, or rejected on timeout.
     */
    Socket.prototype.ping = function () {
        var _this = this;
        var ws = this.ws;
        clearTimeout(this._pingTimeoutHandle);
        if (!this.isConnected()) {
            return new Socket.Promise(function (_resolve, reject) {
                reject(new TimeoutError());
            });
        }
        var promise;
        if (isNodeWebSocket(ws)) {
            // Node's ws module has a ping function we can use rather than
            // sending a message. More lightweight, less noisy.
            promise = Socket.Promise.race([
                timeout(this.options.pingTimeout),
                new Socket.Promise(function (resolve) { return ws.once('pong', resolve); }),
            ]);
            try {
                ws.ping();
            }
            catch (e) {
                // Ignore error and just let it trigger a timeout
            }
        }
        else {
            // Otherwise we'll resort to sending a ping message over the socket.
            promise = this.call('ping', [], {
                timeout: this.options.pingTimeout,
            });
        }
        return promise.then(this.resetPingTimeout.bind(this)).catch(function (err) {
            if (!(err instanceof TimeoutError)) {
                throw err;
            }
            // If we haven't noticed the socket is dead since we started trying
            // to ping, manually emit an error. This'll cause it to close.
            if (_this.ws === ws) {
                _this.emit('error', err);
                ws.close();
                // trigger a close immediately -- some browsers are slow about this,
                // leading to a delay before we try reconnecting.
                _this.handleClose();
            }
            throw err;
        });
    };
    /**
     * Starts a socket client. Attaches events and tries to connect to a
     * chat server.
     * @fires Socket#connected
     * @fires Socket#closed
     * @fires Socket#error
     */
    Socket.prototype.boot = function () {
        var _this = this;
        var ws = (this.ws = new this.wsCtor(this.getAddress()));
        if (isBrowserWebSocket(ws)) {
            wrapDOM(ws);
        }
        var whilstSameSocket = function (fn) {
            return function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                if (_this.ws === ws) {
                    fn.apply(_this, args);
                }
            };
        };
        this.status = Socket.CONNECTING;
        // If the connection doesn't open fast enough
        this.resetConnectionTimeout(function () {
            ws.close();
        });
        // Websocket connection has been established.
        ws.on('open', whilstSameSocket(function () {
            // If we don't get a WelcomeEvent, kill the connection
            _this.resetConnectionTimeout(function () {
                ws.close();
            });
        }));
        // Chat server has acknowledged our connection
        this.once('WelcomeEvent', function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            _this.resetPingTimeout();
            _this.unspool.apply(_this, args);
        });
        // We got an incoming data packet.
        ws.on('message', whilstSameSocket(function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            _this.resetPingTimeout();
            _this.parsePacket.apply(_this, args);
        }));
        // Websocket connection closed
        ws.on('close', whilstSameSocket(function () {
            _this.handleClose();
        }));
        // Websocket hit an error and is about to close.
        ws.on('error', whilstSameSocket(function (err) {
            _this.emit('error', err);
            ws.close();
        }));
        return this;
    };
    /**
     * Should be called on reconnection. Authenticates and sends follow-up
     * packets if we have any. After we get re-established with auth
     * we'll formally say this socket is connected. This is to prevent
     * race conditions where packets could get send before authentication
     * is reestablished.
     */
    Socket.prototype.unspool = function () {
        var _this = this;
        // Helper function that's called when we're fully reestablished and
        // ready to take direct calls again.
        var bang = function () {
            // Send any spooled events that we have.
            for (var i = 0; i < _this._spool.length; i++) {
                // tslint:disable-next-line no-floating-promises
                _this.send(_this._spool[i].data, { force: true }).catch(function (err) {
                    _this.emit('error', err);
                });
                _this._spool[i].resolve();
            }
            _this._spool = [];
            // Finally, tell the world we're connected.
            _this._retries = 0;
            _this.status = Socket.CONNECTED;
            _this.emit('connected');
        };
        var promise = Promise.resolve();
        if (this._optOutEventsArgs.length) {
            promise = promise
                .then(function () { return _this.call('optOutEvents', _this._optOutEventsArgs, { force: true }); })
                .catch(function () { return _this.emit('error', new UnknownCodeError()); })
                .then(function () { return _this.emit('optOutResult'); });
        }
        // If we already authed, it means we're reconnecting and should
        // establish authentication again.
        if (this._authpacket) {
            // tslint:disable-next-line no-floating-promises
            promise = promise
                .then(function () { return _this.callAuth(_this._authpacket, { force: true }); })
                .then(function (result) { return _this.emit('authresult', result); });
        }
        promise.then(bang).catch(function (e) {
            var message = 'Authentication Failed, please check your credentials.';
            if (e.message === UNOTFOUND) {
                message =
                    'Authentication Failed: User not found. Please check our guide at: https://aka.ms/unotfound';
            }
            if (e.message === UACCESS) {
                message =
                    'Authentication Failed: Channel is in test mode. The client user does not have access during test mode.';
            }
            _this.emit('error', new AuthenticationFailedError(message));
            _this.close();
        });
    };
    /**
     * Parses an incoming packet from the websocket.
     * @fires Socket#error
     * @fires Socket#packet
     */
    Socket.prototype.parsePacket = function (data, flags) {
        if (flags && flags.binary) {
            // We can't handle binary packets. Why the fudge are we here?
            this.emit('error', new BadMessageError('Cannot parse binary packets. Wat.'));
            return;
        }
        // Unpack the packet data.
        var packet;
        try {
            packet = JSON.parse(data);
        }
        catch (e) {
            this.emit('error', new BadMessageError('Unable to parse packet as json'));
            return;
        }
        this.emit('packet', packet);
        switch (packet.type) {
            case 'reply':
                // Try to look up the packet reply handler, and call it if we can.
                var reply = this._replies[packet.id];
                if (reply !== undefined) {
                    reply.handle(packet);
                    delete this._replies[packet.id];
                }
                else {
                    // Otherwise emit an error. This might happen occasionally,
                    // but failing silently is lame.
                    this.emit('error', new NoMethodHandlerError('No handler for reply ID.'));
                }
                break;
            case 'event':
                // Just emit events out on this emitter.
                this.emit(packet.event, packet.data);
                break;
            default:
                this.emit('error', new BadMessageError('Unknown packet type ' + packet.type));
        }
    };
    /**
     * Sends raw packet data to the server. It may not send immediately;
     * if we aren't connected, it'll just be spooled up.
     *
     * @fires Socket#sent
     * @fires Socket#spooled
     */
    Socket.prototype.send = function (
        // tslint:disable-next-line no-banned-terms
        data, options) {
        var _this = this;
        if (options === void 0) { options = {}; }
        if (this.isConnected() || options.force) {
            this.ws.send(JSON.stringify(data));
            this.emit('sent', data);
            return Socket.Promise.resolve();
        }
        else if (data.method !== authMethod) {
            return new Socket.Promise(function (resolve) {
                _this._spool.push({ data: data, resolve: resolve });
                _this.emit('spooled', data);
            });
        }
        return Socket.Promise.resolve();
    };
    /**
     * auth sends a packet over the socket to authenticate with a chat server
     * and join a specified channel. If you wish to join anonymously, user
     * and authkey can be omitted.
     */
    Socket.prototype.auth = function (id, user, authkey, accessKey) {
        var _this = this;
        this._authpacket = [id, user, authkey, accessKey];
        // Two cases here: if we're already connected, with send the auth
        // packet immediately. Otherwise we wait for a `connected` event,
        // which won't be sent until after we re-authenticate.
        if (this.isConnected()) {
            return this.callAuth([id, user, authkey, accessKey]);
        }
        return new Socket.Promise(function (resolve) { return _this.once('authresult', resolve); });
    };
    /**
     * optOutEvents sends a packet over the socket to opt out from receiving events
     * from a chat server. Pass in Events to be opted out from as args
     */
    Socket.prototype.optOutEvents = function (args) {
        var _this = this;
        if (args.length === 0) {
            return Promise.resolve();
        }
        this._optOutEventsArgs = args;
        if (this.isConnected()) {
            return this.call('optOutEvents', args);
        }
        return new Socket.Promise(function (resolve) { return _this.once('optOutResult', resolve); });
    };
    Socket.prototype.call = function (method, args, options) {
        var _this = this;
        if (args === void 0) { args = []; }
        if (options === void 0) { options = {}; }
        // Send out the data
        var id = this._callNo++;
        // This is created before we call and wait on .send purely for ease
        // of use in tests, so that we can mock an incoming packet synchronously.
        var replyPromise = new Socket.Promise(function (resolve, reject) {
            _this._replies[id] = new Reply(resolve, reject);
        });
        return this.send({
            type: 'method',
            method: method,
            arguments: args,
            id: id,
        }, options)
            .then(function () {
            // Then create and return a promise that's resolved when we get
            // a reply, if we expect one to be given.
            if (options.noReply) {
                return undefined;
            }
            return Socket.Promise.race([
                timeout(options.timeout || _this.options.callTimeout),
                replyPromise,
            ]);
        })
            .catch(function (err) {
            if (err instanceof TimeoutError) {
                delete _this._replies[id];
            }
            throw err;
        });
    };
    /**
     * Closes the websocket gracefully.
     */
    Socket.prototype.close = function () {
        if (this.ws) {
            this.ws.close();
            this.status = Socket.CLOSING;
        }
        else {
            clearTimeout(this._reconnectTimeout);
            this.status = Socket.CLOSED;
        }
    };
    Socket.prototype.callAuth = function (args, options) {
        var _this = this;
        return this.call(authMethod, args, options).catch(function (err) {
            // If server returns Internal Server Error, close the socket and try again
            if (err.code && err.code === 4006 /* AuthServerError */) {
                _this.handleClose();
            }
            throw err;
        });
    };
    /**
     * We've not tried connecting yet
     */
    Socket.IDLE = 0;
    /**
     * We successfully connected
     */
    Socket.CONNECTED = 1;
    /**
     * The socket was is closing gracefully.
     */
    Socket.CLOSING = 2;
    /**
     * The socket was closed gracefully.
     */
    Socket.CLOSED = 3;
    /**
     * We're currently trying to connect.
     */
    Socket.CONNECTING = 4;
    // tslint:disable-next-line variable-name
    Socket.Promise = Promise;
    return Socket;
}(EventEmitter));
export { Socket };
//# sourceMappingURL=Socket.js.map