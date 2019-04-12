"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable max-classes-per-file
exports.UNOTFOUND = 'UNOTFOUND';
exports.UACCESS = 'UACCESS';
/**
 * Base error for all fe2 stuff.
 * This also acts as a polyfill when building with ES5 target.
 */
class ClientError extends Error {
    constructor(message) {
        super();
        this.message = message;
        if (this.stack) {
            return;
        }
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
            return;
        }
        const stack = new Error().stack.split('\n'); // removes useless stack frame
        stack.splice(1, 1);
        this.stack = stack.join('\n');
    }
    static setProto(error) {
        if (Object.setPrototypeOf) {
            Object.setPrototypeOf(error, this.prototype);
            return;
        }
        error.__proto__ = this.prototype; // Super emergency fallback
    }
}
exports.ClientError = ClientError;
/**
 * Emitted by our WebSocket when we get a bad packet; one that is binary,
 * we can't decode, or has a type we don't know about.
 */
class BadMessageError extends ClientError {
    constructor(msg) {
        super(msg);
        BadMessageError.setProto(this);
    }
}
exports.BadMessageError = BadMessageError;
/**
 * Emitted by our WebSocket when we get get a "reply" to a method
 * that we don't have a handler for.
 */
class NoMethodHandlerError extends ClientError {
    constructor(msg) {
        super(msg);
        NoMethodHandlerError.setProto(this);
    }
}
exports.NoMethodHandlerError = NoMethodHandlerError;
/**
 * Basic "response" error message from which others inherit.
 */
class ResponseError extends ClientError {
    constructor(res) {
        super(typeof res === 'string' ? res : 'Response error');
        this.res = res;
    }
}
exports.ResponseError = ResponseError;
/**
 * Emitted when we try to connect to the Mixer API, but have invalid
 * credentials.
 */
class AuthenticationFailedError extends ResponseError {
    constructor(res) {
        super(res);
        AuthenticationFailedError.setProto(this);
    }
}
exports.AuthenticationFailedError = AuthenticationFailedError;
/**
 * Happens when we get a code from the API that we don't expect.
 */
class UnknownCodeError extends ResponseError {
    constructor() {
        super('An unknown error occurred');
        UnknownCodeError.setProto(this);
    }
}
exports.UnknownCodeError = UnknownCodeError;
/**
 * Happens when we attempt to access a point that needs authentication
 * or access that we don't have.
 */
class NotAuthenticatedError extends ResponseError {
    constructor() {
        super('You do not have permission to view this.');
        NotAuthenticatedError.setProto(this);
    }
}
exports.NotAuthenticatedError = NotAuthenticatedError;
/**
 * A TimeoutError is thrown in call if we don't get a response from the
 * chat server within a certain interval.
 */
class TimeoutError extends ClientError {
    constructor() {
        super('Timeout');
        TimeoutError.setProto(this);
    }
}
exports.TimeoutError = TimeoutError;
//# sourceMappingURL=errors.js.map