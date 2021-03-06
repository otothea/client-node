var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
// tslint:disable-next-line import-name no-require-imports
import { Socket } from '@mixer/chat-client-websocket';
import { all } from 'deepmerge';
import * as querystring from 'querystring';
import { OAuthProvider } from './providers/OAuth';
import { DefaultRequestRunner, } from './RequestRunner';
import { ChannelService } from './services/Channel';
import { ChatService } from './services/Chat';
import { ClipsService } from './services/Clips';
import { GameService } from './services/Game';
// DO NOT EDIT, THIS IS UPDATE BY THE BUILD SCRIPT
var packageVersion = '0.13.0'; // package version
/**
 * Main client.
 */
var Client = /** @class */ (function () {
    /**
     * The primary Mixer client, responsible for storing authentication state
     * and dispatching requests to the API.
     */
    function Client(requestRunner) {
        this.requestRunner = requestRunner;
        this.urls = {
            api: {
                v1: 'https://mixer.com/api/v1',
                v2: 'https://mixer.com/api/v2',
            },
            public: 'https://mixer.com',
        };
        this.channel = new ChannelService(this);
        this.chat = new ChatService(this);
        this.clips = new ClipsService(this);
        this.game = new GameService(this);
        this.userAgent = this.buildUserAgent();
        if (!requestRunner) {
            this.requestRunner = new DefaultRequestRunner();
        }
    }
    Client.prototype.buildUserAgent = function () {
        var client = "MixerClient/" + packageVersion;
        // tslint:disable-next-line no-typeof-undefined
        if (typeof navigator !== 'undefined') {
            // in-browser
            return navigator.userAgent + ' ' + client;
        }
        return client + ' (JavaScript; Node.js ' + process.version + ')';
    };
    /**
     * Sets the the API/public URLs for the client.
     *
     * If you are changing the URL for the API, you can set the version to which to set with the URL given.
     */
    Client.prototype.setUrl = function (kind, url, apiVer) {
        if (apiVer === void 0) { apiVer = 'v1'; }
        if (kind === 'api') {
            this.urls.api[apiVer] = url;
        }
        else {
            this.urls[kind] = url;
        }
        return this;
    };
    /**
     * Builds a path to the Mixer API by concating it with the address.
     */
    Client.prototype.buildAddress = function (base, path, querystr) {
        var url = base;
        // Strip any trailing slash from the base
        if (url.slice(-1) === '/') {
            url = url.slice(0, -1);
        }
        var sanitizedPath = path;
        // And any leading slash from the path.
        if (sanitizedPath.charAt(0) === '/') {
            sanitizedPath = sanitizedPath.slice(1);
        }
        url = url + '/' + sanitizedPath;
        // And just add the query string
        if (querystr) {
            url += '?' + querystring.stringify(querystr);
        }
        return url;
    };
    /**
     * Creates and returns an authentication provider instance.
     */
    Client.prototype.use = function (provider) {
        this.provider = provider;
        return provider;
    };
    /**
     * Returns the associated provider instance, as set by the
     * `use` method.
     */
    Client.prototype.getProvider = function () {
        return this.provider;
    };
    /**
     * Attempts to run a given request.
     */
    Client.prototype.request = function (method, path, data, apiVer) {
        var _this = this;
        if (data === void 0) { data = {}; }
        if (apiVer === void 0) { apiVer = 'v1'; }
        var apiBase = this.urls.api[apiVer.toLowerCase()];
        if (!apiBase) { // Default back to v1 if the one given is invalid.
            apiBase = this.urls.api.v1;
        }
        var req = all([
            this.provider ? this.provider.getRequest() : {},
            {
                method: method || '',
                url: this.buildAddress(apiBase, path || ''),
                headers: {
                    'User-Agent': this.userAgent,
                },
                json: true,
            },
            data,
        ]);
        return this.requestRunner.run(req).catch(function (err) {
            if (_this.provider) {
                return _this.provider.handleResponseError(err, req);
            }
            throw err;
        });
    };
    Client.prototype.createChatSocket = function (ws, endpoints, options) {
        return new Socket(ws, endpoints, __assign({ clientId: this.provider instanceof OAuthProvider ? this.provider.getClientId() : null }, options));
    };
    return Client;
}());
export { Client };
//# sourceMappingURL=Client.js.map