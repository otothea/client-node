/// <reference types="node" />
import { IncomingMessage } from 'http';
export declare const UNOTFOUND = "UNOTFOUND";
export declare const UACCESS = "UACCESS";
export declare const enum ErrorCode {
    Unknown = 4000,
    PurgeUserNotFound = 4001,
    PurgeNoPermissions = 4002,
    MessageNotFound = 4003,
    BadRequest = 4004,
    RateLimited = 4005,
    AuthServerError = 4006,
}
/**
 * Base error for all fe2 stuff.
 * This also acts as a polyfill when building with ES5 target.
 */
export declare abstract class ClientError extends Error {
    readonly message: string;
    constructor(message: string);
    protected static setProto(error: ClientError): void;
}
/**
 * Emitted by our WebSocket when we get a bad packet; one that is binary,
 * we can't decode, or has a type we don't know about.
 */
export declare class BadMessageError extends ClientError {
    constructor(msg: string);
}
/**
 * Emitted by our WebSocket when we get get a "reply" to a method
 * that we don't have a handler for.
 */
export declare class NoMethodHandlerError extends ClientError {
    constructor(msg: string);
}
/**
 * Basic "response" error message from which others inherit.
 */
export declare abstract class ResponseError extends ClientError {
    res: IncomingMessage | string;
    constructor(res: IncomingMessage | string);
}
/**
 * Emitted when we try to connect to the Mixer API, but have invalid
 * credentials.
 */
export declare class AuthenticationFailedError extends ResponseError {
    constructor(res: IncomingMessage | string);
}
/**
 * Happens when we get a code from the API that we don't expect.
 */
export declare class UnknownCodeError extends ResponseError {
    constructor();
}
/**
 * Happens when we attempt to access a point that needs authentication
 * or access that we don't have.
 */
export declare class NotAuthenticatedError extends ResponseError {
    constructor();
}
/**
 * A TimeoutError is thrown in call if we don't get a response from the
 * chat server within a certain interval.
 */
export declare class TimeoutError extends ClientError {
    constructor();
}
