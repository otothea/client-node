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
// tslint:disable max-classes-per-file
export var UNOTFOUND = 'UNOTFOUND';
export var UACCESS = 'UACCESS';
/**
 * Base error for all fe2 stuff.
 * This also acts as a polyfill when building with ES5 target.
 */
var ClientError = /** @class */ (function (_super) {
    __extends(ClientError, _super);
    function ClientError(message) {
        var _this = _super.call(this) || this;
        _this.message = message;
        if (_this.stack) {
            return _this;
        }
        if (Error.captureStackTrace) {
            Error.captureStackTrace(_this, _this.constructor);
            return _this;
        }
        var stack = new Error().stack.split('\n'); // removes useless stack frame
        stack.splice(1, 1);
        _this.stack = stack.join('\n');
        return _this;
    }
    ClientError.setProto = function (error) {
        if (Object.setPrototypeOf) {
            Object.setPrototypeOf(error, this.prototype);
            return;
        }
        error.__proto__ = this.prototype; // Super emergency fallback
    };
    return ClientError;
}(Error));
export { ClientError };
/**
 * Emitted by our WebSocket when we get a bad packet; one that is binary,
 * we can't decode, or has a type we don't know about.
 */
var BadMessageError = /** @class */ (function (_super) {
    __extends(BadMessageError, _super);
    function BadMessageError(msg) {
        var _this = _super.call(this, msg) || this;
        BadMessageError.setProto(_this);
        return _this;
    }
    return BadMessageError;
}(ClientError));
export { BadMessageError };
/**
 * Emitted by our WebSocket when we get get a "reply" to a method
 * that we don't have a handler for.
 */
var NoMethodHandlerError = /** @class */ (function (_super) {
    __extends(NoMethodHandlerError, _super);
    function NoMethodHandlerError(msg) {
        var _this = _super.call(this, msg) || this;
        NoMethodHandlerError.setProto(_this);
        return _this;
    }
    return NoMethodHandlerError;
}(ClientError));
export { NoMethodHandlerError };
/**
 * Basic "response" error message from which others inherit.
 */
var ResponseError = /** @class */ (function (_super) {
    __extends(ResponseError, _super);
    function ResponseError(res) {
        var _this = _super.call(this, typeof res === 'string' ? res : 'Response error') || this;
        _this.res = res;
        return _this;
    }
    return ResponseError;
}(ClientError));
export { ResponseError };
/**
 * Emitted when we try to connect to the Mixer API, but have invalid
 * credentials.
 */
var AuthenticationFailedError = /** @class */ (function (_super) {
    __extends(AuthenticationFailedError, _super);
    function AuthenticationFailedError(res) {
        var _this = _super.call(this, res) || this;
        AuthenticationFailedError.setProto(_this);
        return _this;
    }
    return AuthenticationFailedError;
}(ResponseError));
export { AuthenticationFailedError };
/**
 * Happens when we get a code from the API that we don't expect.
 */
var UnknownCodeError = /** @class */ (function (_super) {
    __extends(UnknownCodeError, _super);
    function UnknownCodeError() {
        var _this = _super.call(this, 'An unknown error occurred') || this;
        UnknownCodeError.setProto(_this);
        return _this;
    }
    return UnknownCodeError;
}(ResponseError));
export { UnknownCodeError };
/**
 * Happens when we attempt to access a point that needs authentication
 * or access that we don't have.
 */
var NotAuthenticatedError = /** @class */ (function (_super) {
    __extends(NotAuthenticatedError, _super);
    function NotAuthenticatedError() {
        var _this = _super.call(this, 'You do not have permission to view this.') || this;
        NotAuthenticatedError.setProto(_this);
        return _this;
    }
    return NotAuthenticatedError;
}(ResponseError));
export { NotAuthenticatedError };
/**
 * A TimeoutError is thrown in call if we don't get a response from the
 * chat server within a certain interval.
 */
var TimeoutError = /** @class */ (function (_super) {
    __extends(TimeoutError, _super);
    function TimeoutError() {
        var _this = _super.call(this, 'Timeout') || this;
        TimeoutError.setProto(_this);
        return _this;
    }
    return TimeoutError;
}(ClientError));
export { TimeoutError };
//# sourceMappingURL=errors.js.map