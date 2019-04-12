"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const errors_1 = require("../errors");
const Reply_1 = require("./Reply");
// The method of the authentication packet to store.
const authMethod = 'auth';
/**
 * Return a promise which is rejected with a TimeoutError after the
 * provided delay.
 */
function timeout(delay) {
    return new Socket.Promise((_resolve, reject) => {
        setTimeout(() => reject(new errors_1.TimeoutError()), delay);
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
function wrapDOM(socket) {
    function wrapHandler(event, fn) {
        return (ev) => {
            if (event === 'message') {
                fn(ev.data);
            }
            else {
                fn(ev);
            }
        };
    }
    socket.on = (event, listener) => {
        const wrapped = wrapHandler(event, listener);
        socket.addEventListener(event, wrapped);
    };
    socket.once = (event, listener) => {
        const wrapped = wrapHandler(event, listener);
        socket.addEventListener(event, ev => {
            wrapped(ev);
            socket.removeEventListener(event, wrapped);
        });
    };
    return socket;
}
exports.wrapDOM = wrapDOM;
/**
 * Manages a connect to Mixer's chat servers.
 */
class Socket extends events_1.EventEmitter {
    constructor(wsCtor, addresses, options) {
        super();
        this.wsCtor = wsCtor;
        this.options = options;
        // Spool to store events queued when the connection is lost.
        this._spool = [];
        // Counter of the current number of reconnect retries, and the number of
        // retries before we reset our reconnect attempts.
        this._retries = 0;
        this._retryWrap = 7; // max 2 minute retry time;
        this._optOutEventsArgs = [];
        this.options = Object.assign({ pingInterval: 15 * 1000, pingTimeout: 5 * 1000, callTimeout: 20 * 1000, protocolVersion: '1.0', clientId: null }, options);
        // Which connection we use in our load balancing.
        this._addressOffset = Math.floor(Math.random() * addresses.length);
        // List of addresses we can connect to.
        this._addresses = addresses;
        // Information for server pings. We ping the server on the interval
        // (if we don't get any other packets) and consider a connection
        // dead if it doesn't respond within the timeout.
        this._pingTimeoutHandle = null;
        // The status of the socket connection.
        this.status = Socket.IDLE;
        // Timeout waiting to reconnect
        this._reconnectTimeout = null;
        // Map of call IDs to promises that should be resolved on
        // method responses.
        this._replies = {};
        // Authentication packet store that we'll resend if we have to reconnect.
        this._authpacket = null;
        // Counter for method calls.
        this._callNo = 0;
    }
    // tslint:disable-next-line: no-unnecessary-override
    on(event, cb) {
        return super.on(event, cb);
    }
    /**
     * Gets the status of the socket connection.
     */
    getStatus() {
        return this.status;
    }
    /**
     * Returns whether the socket is currently connected.
     */
    isConnected() {
        return this.status === Socket.CONNECTED;
    }
    /**
     * Retrieves a chat endpoint to connect to. We use round-robin balancing.
     */
    getAddress() {
        if (++this._addressOffset >= this._addresses.length) {
            this._addressOffset = 0;
        }
        let address = this._addresses[this._addressOffset];
        address += `?version=${this.options.protocolVersion}`;
        if (this.options.clientId) {
            address += `&Client-ID=${this.options.clientId}`;
        }
        return address;
    }
    /**
     * Returns how long to wait before attempting to reconnect. This does TCP-style
     * limited exponential backoff.
     */
    getNextReconnectInterval() {
        const power = (this._retries++ % this._retryWrap) + Math.round(Math.random());
        return (1 << power) * 500;
    }
    /**
     * handleClose is called when the websocket closes or emits an error. If
     * we weren't gracefully closed, we'll try to reconnect.
     */
    handleClose() {
        clearTimeout(this._pingTimeoutHandle);
        this._pingTimeoutHandle = null;
        const socket = this.ws;
        this.ws = null;
        this.removeAllListeners('WelcomeEvent');
        if (this.status === Socket.CLOSING) {
            this.status = Socket.CLOSED;
            this.emit('closed');
            return;
        }
        const interval = this.getNextReconnectInterval();
        this.status = Socket.CONNECTING;
        this._reconnectTimeout = setTimeout(this.boot.bind(this), interval);
        this.emit('reconnecting', { interval: interval, socket });
    }
    /**
     * Sets the socket to send a ping message after an interval. This is
     * called when a successful ping is received and after data is received
     * from the socket (there's no need to ping when we know the socket
     * is still alive).
     */
    resetPingTimeout() {
        clearTimeout(this._pingTimeoutHandle);
        this._pingTimeoutHandle = setTimeout(() => this.ping().catch(() => undefined), this.options.pingInterval);
    }
    /**
     * Resets the connection timeout handle. This will run the handler
     * after a short amount of time.
     */
    resetConnectionTimeout(handler) {
        clearTimeout(this._pingTimeoutHandle);
        this._pingTimeoutHandle = setTimeout(handler, this.options.pingTimeout);
    }
    /**
     * Ping runs a ping against the server and returns a promise which is
     * resolved if the server responds, or rejected on timeout.
     */
    ping() {
        const ws = this.ws;
        clearTimeout(this._pingTimeoutHandle);
        if (!this.isConnected()) {
            return new Socket.Promise((_resolve, reject) => {
                reject(new errors_1.TimeoutError());
            });
        }
        let promise;
        if (isNodeWebSocket(ws)) {
            // Node's ws module has a ping function we can use rather than
            // sending a message. More lightweight, less noisy.
            promise = Socket.Promise.race([
                timeout(this.options.pingTimeout),
                new Socket.Promise(resolve => ws.once('pong', resolve)),
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
        return promise.then(this.resetPingTimeout.bind(this)).catch((err) => {
            if (!(err instanceof errors_1.TimeoutError)) {
                throw err;
            }
            // If we haven't noticed the socket is dead since we started trying
            // to ping, manually emit an error. This'll cause it to close.
            if (this.ws === ws) {
                this.emit('error', err);
                ws.close();
                // trigger a close immediately -- some browsers are slow about this,
                // leading to a delay before we try reconnecting.
                this.handleClose();
            }
            throw err;
        });
    }
    /**
     * Starts a socket client. Attaches events and tries to connect to a
     * chat server.
     * @fires Socket#connected
     * @fires Socket#closed
     * @fires Socket#error
     */
    boot() {
        const ws = (this.ws = new this.wsCtor(this.getAddress()));
        if (isBrowserWebSocket(ws)) {
            wrapDOM(ws);
        }
        const whilstSameSocket = (fn) => {
            return (...args) => {
                if (this.ws === ws) {
                    fn.apply(this, args);
                }
            };
        };
        this.status = Socket.CONNECTING;
        // If the connection doesn't open fast enough
        this.resetConnectionTimeout(() => {
            ws.close();
        });
        // Websocket connection has been established.
        ws.on('open', whilstSameSocket(() => {
            // If we don't get a WelcomeEvent, kill the connection
            this.resetConnectionTimeout(() => {
                ws.close();
            });
        }));
        // Chat server has acknowledged our connection
        this.once('WelcomeEvent', (...args) => {
            this.resetPingTimeout();
            this.unspool.apply(this, args);
        });
        // We got an incoming data packet.
        ws.on('message', whilstSameSocket((...args) => {
            this.resetPingTimeout();
            this.parsePacket.apply(this, args);
        }));
        // Websocket connection closed
        ws.on('close', whilstSameSocket(() => {
            this.handleClose();
        }));
        // Websocket hit an error and is about to close.
        ws.on('error', whilstSameSocket((err) => {
            this.emit('error', err);
            ws.close();
        }));
        return this;
    }
    /**
     * Should be called on reconnection. Authenticates and sends follow-up
     * packets if we have any. After we get re-established with auth
     * we'll formally say this socket is connected. This is to prevent
     * race conditions where packets could get send before authentication
     * is reestablished.
     */
    unspool() {
        // Helper function that's called when we're fully reestablished and
        // ready to take direct calls again.
        const bang = () => {
            // Send any spooled events that we have.
            for (let i = 0; i < this._spool.length; i++) {
                // tslint:disable-next-line no-floating-promises
                this.send(this._spool[i].data, { force: true }).catch(err => {
                    this.emit('error', err);
                });
                this._spool[i].resolve();
            }
            this._spool = [];
            // Finally, tell the world we're connected.
            this._retries = 0;
            this.status = Socket.CONNECTED;
            this.emit('connected');
        };
        let promise = Promise.resolve();
        if (this._optOutEventsArgs.length) {
            promise = promise
                .then(() => this.call('optOutEvents', this._optOutEventsArgs, { force: true }))
                .catch(() => this.emit('error', new errors_1.UnknownCodeError()))
                .then(() => this.emit('optOutResult'));
        }
        // If we already authed, it means we're reconnecting and should
        // establish authentication again.
        if (this._authpacket) {
            // tslint:disable-next-line no-floating-promises
            promise = promise
                .then(() => this.callAuth(this._authpacket, { force: true }))
                .then(result => this.emit('authresult', result));
        }
        promise.then(bang).catch((e) => {
            let message = 'Authentication Failed, please check your credentials.';
            if (e.message === errors_1.UNOTFOUND) {
                message =
                    'Authentication Failed: User not found. Please check our guide at: https://aka.ms/unotfound';
            }
            if (e.message === errors_1.UACCESS) {
                message =
                    'Authentication Failed: Channel is in test mode. The client user does not have access during test mode.';
            }
            this.emit('error', new errors_1.AuthenticationFailedError(message));
            this.close();
        });
    }
    /**
     * Parses an incoming packet from the websocket.
     * @fires Socket#error
     * @fires Socket#packet
     */
    parsePacket(data, flags) {
        if (flags && flags.binary) {
            // We can't handle binary packets. Why the fudge are we here?
            this.emit('error', new errors_1.BadMessageError('Cannot parse binary packets. Wat.'));
            return;
        }
        // Unpack the packet data.
        let packet;
        try {
            packet = JSON.parse(data);
        }
        catch (e) {
            this.emit('error', new errors_1.BadMessageError('Unable to parse packet as json'));
            return;
        }
        this.emit('packet', packet);
        switch (packet.type) {
            case 'reply':
                // Try to look up the packet reply handler, and call it if we can.
                const reply = this._replies[packet.id];
                if (reply !== undefined) {
                    reply.handle(packet);
                    delete this._replies[packet.id];
                }
                else {
                    // Otherwise emit an error. This might happen occasionally,
                    // but failing silently is lame.
                    this.emit('error', new errors_1.NoMethodHandlerError('No handler for reply ID.'));
                }
                break;
            case 'event':
                // Just emit events out on this emitter.
                this.emit(packet.event, packet.data);
                break;
            default:
                this.emit('error', new errors_1.BadMessageError('Unknown packet type ' + packet.type));
        }
    }
    /**
     * Sends raw packet data to the server. It may not send immediately;
     * if we aren't connected, it'll just be spooled up.
     *
     * @fires Socket#sent
     * @fires Socket#spooled
     */
    send(
        // tslint:disable-next-line no-banned-terms
        data, options = {}) {
        if (this.isConnected() || options.force) {
            this.ws.send(JSON.stringify(data));
            this.emit('sent', data);
            return Socket.Promise.resolve();
        }
        else if (data.method !== authMethod) {
            return new Socket.Promise(resolve => {
                this._spool.push({ data: data, resolve });
                this.emit('spooled', data);
            });
        }
        return Socket.Promise.resolve();
    }
    /**
     * auth sends a packet over the socket to authenticate with a chat server
     * and join a specified channel. If you wish to join anonymously, user
     * and authkey can be omitted.
     */
    auth(id, user, authkey, accessKey) {
        this._authpacket = [id, user, authkey, accessKey];
        // Two cases here: if we're already connected, with send the auth
        // packet immediately. Otherwise we wait for a `connected` event,
        // which won't be sent until after we re-authenticate.
        if (this.isConnected()) {
            return this.callAuth([id, user, authkey, accessKey]);
        }
        return new Socket.Promise(resolve => this.once('authresult', resolve));
    }
    /**
     * optOutEvents sends a packet over the socket to opt out from receiving events
     * from a chat server. Pass in Events to be opted out from as args
     */
    optOutEvents(args) {
        if (args.length === 0) {
            return Promise.resolve();
        }
        this._optOutEventsArgs = args;
        if (this.isConnected()) {
            return this.call('optOutEvents', args);
        }
        return new Socket.Promise(resolve => this.once('optOutResult', resolve));
    }
    call(method, args = [], options = {}) {
        // Send out the data
        const id = this._callNo++;
        // This is created before we call and wait on .send purely for ease
        // of use in tests, so that we can mock an incoming packet synchronously.
        const replyPromise = new Socket.Promise((resolve, reject) => {
            this._replies[id] = new Reply_1.Reply(resolve, reject);
        });
        return this.send({
            type: 'method',
            method: method,
            arguments: args,
            id: id,
        }, options)
            .then(() => {
            // Then create and return a promise that's resolved when we get
            // a reply, if we expect one to be given.
            if (options.noReply) {
                return undefined;
            }
            return Socket.Promise.race([
                timeout(options.timeout || this.options.callTimeout),
                replyPromise,
            ]);
        })
            .catch((err) => {
            if (err instanceof errors_1.TimeoutError) {
                delete this._replies[id];
            }
            throw err;
        });
    }
    /**
     * Closes the websocket gracefully.
     */
    close() {
        if (this.ws) {
            this.ws.close();
            this.status = Socket.CLOSING;
        }
        else {
            clearTimeout(this._reconnectTimeout);
            this.status = Socket.CLOSED;
        }
    }
    callAuth(args, options) {
        return this.call(authMethod, args, options).catch((err) => {
            // If server returns Internal Server Error, close the socket and try again
            if (err.code && err.code === 4006 /* AuthServerError */) {
                this.handleClose();
            }
            throw err;
        });
    }
}
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
exports.Socket = Socket;
//# sourceMappingURL=Socket.js.map