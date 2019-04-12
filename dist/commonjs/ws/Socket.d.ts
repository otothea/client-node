/// <reference types="node" />
import { EventEmitter } from 'events';
import { IChatMessage, IDeleteMessage, IPollEvent, IPurgeMessage, IUserAuthenticated, IUserConnection, IUserTimeout, IUserUpdate } from '../defs/chat';
export declare type AuthArgs = [number, number, string, string | undefined];
/**
 * Wraps a DOM socket with EventEmitter-like syntax.
 */
export declare function wrapDOM(socket: WebSocket): WebSocket;
export interface IGenericWebSocket {
    new (address: string, subprotocols?: string[]): IGenericWebSocket;
    close(): void;
    on(ev: string, listener: (arg: any) => void): this;
    once(ev: string, listener: (arg: any) => void): this;
    send(data: string): void;
}
export interface ICallOptions {
    /**
     * Set to false if you want a Promise to return for when the event is sent and received by the chat server.
     */
    noReply?: boolean;
    /**
     * Set to true if you want to force send a event to the server.
     */
    force?: boolean;
    /**
     * Call timeout.
     */
    timeout?: number;
}
export interface ISocketOptions {
    pingInterval?: number;
    pingTimeout?: number;
    callTimeout?: number;
    protocolVersion?: string;
    clientId: string;
}
/**
 * Manages a connect to Mixer's chat servers.
 */
export declare class Socket extends EventEmitter {
    private wsCtor;
    private options;
    private _addressOffset;
    private _spool;
    private _addresses;
    private ws;
    private _pingTimeoutHandle;
    private _retries;
    private _retryWrap;
    private _reconnectTimeout;
    private _callNo;
    private status;
    private _authpacket;
    private _replies;
    private _optOutEventsArgs;
    /**
     * We've not tried connecting yet
     */
    static IDLE: number;
    /**
     * We successfully connected
     */
    static CONNECTED: number;
    /**
     * The socket was is closing gracefully.
     */
    static CLOSING: number;
    /**
     * The socket was closed gracefully.
     */
    static CLOSED: number;
    /**
     * We're currently trying to connect.
     */
    static CONNECTING: number;
    static Promise: typeof Promise;
    on(event: 'reconnecting', cb: (data: {
        interval: number;
        socket: WebSocket;
    }) => any): this;
    on(event: 'connected', cb: () => any): this;
    on(event: 'closed', cb: () => any): this;
    on(event: 'error', cb: (err: Error) => any): this;
    on(event: 'authresult', cb: (res: IUserAuthenticated) => any): this;
    on(event: 'packet', cb: (packet: any) => any): this;
    on(event: 'ChatMessage', cb: (message: IChatMessage) => any): this;
    on(event: 'ClearMessages', cb: () => void): this;
    on(event: 'DeleteMessage', cb: (message: IDeleteMessage) => any): this;
    on(event: 'PollStart', cb: (poll: IPollEvent) => any): this;
    on(event: 'PollEnd', cb: (poll: IPollEvent) => any): this;
    on(event: 'PurgeMessage', cb: (purge: IPurgeMessage) => any): this;
    on(event: 'UserJoin', cb: (join: IUserConnection) => any): this;
    on(event: 'UserLeave', cb: (join: IUserConnection) => any): this;
    on(event: 'UserTimeout', cb: (timeout: IUserTimeout) => any): this;
    on(event: 'UserUpdate', cb: (update: IUserUpdate) => any): this;
    constructor(wsCtor: IGenericWebSocket, addresses: string[], options?: ISocketOptions);
    /**
     * Gets the status of the socket connection.
     */
    getStatus(): number;
    /**
     * Returns whether the socket is currently connected.
     */
    isConnected(): boolean;
    /**
     * Retrieves a chat endpoint to connect to. We use round-robin balancing.
     */
    protected getAddress(): string;
    /**
     * Returns how long to wait before attempting to reconnect. This does TCP-style
     * limited exponential backoff.
     */
    private getNextReconnectInterval();
    /**
     * handleClose is called when the websocket closes or emits an error. If
     * we weren't gracefully closed, we'll try to reconnect.
     */
    private handleClose();
    /**
     * Sets the socket to send a ping message after an interval. This is
     * called when a successful ping is received and after data is received
     * from the socket (there's no need to ping when we know the socket
     * is still alive).
     */
    private resetPingTimeout();
    /**
     * Resets the connection timeout handle. This will run the handler
     * after a short amount of time.
     */
    private resetConnectionTimeout(handler);
    /**
     * Ping runs a ping against the server and returns a promise which is
     * resolved if the server responds, or rejected on timeout.
     */
    ping(): Promise<void>;
    /**
     * Starts a socket client. Attaches events and tries to connect to a
     * chat server.
     * @fires Socket#connected
     * @fires Socket#closed
     * @fires Socket#error
     */
    boot(): this;
    /**
     * Should be called on reconnection. Authenticates and sends follow-up
     * packets if we have any. After we get re-established with auth
     * we'll formally say this socket is connected. This is to prevent
     * race conditions where packets could get send before authentication
     * is reestablished.
     */
    protected unspool(): void;
    /**
     * Parses an incoming packet from the websocket.
     * @fires Socket#error
     * @fires Socket#packet
     */
    protected parsePacket(data: string, flags?: {
        binary: boolean;
    }): void;
    /**
     * Sends raw packet data to the server. It may not send immediately;
     * if we aren't connected, it'll just be spooled up.
     *
     * @fires Socket#sent
     * @fires Socket#spooled
     */
    protected send(data: {
        id: number;
        type: string;
        method: string;
        arguments: any[];
    }, options?: {
        force?: boolean;
    }): Promise<void>;
    /**
     * auth sends a packet over the socket to authenticate with a chat server
     * and join a specified channel. If you wish to join anonymously, user
     * and authkey can be omitted.
     */
    auth(id: number, user: number, authkey: string, accessKey?: string): Promise<IUserAuthenticated>;
    /**
     * optOutEvents sends a packet over the socket to opt out from receiving events
     * from a chat server. Pass in Events to be opted out from as args
     */
    optOutEvents(args: string[]): Promise<void>;
    /**
     * Runs a method on the socket. Returns a promise that is rejected or
     * resolved upon reply.
     */
    call(method: 'auth', args: [number], options?: ICallOptions): Promise<IUserAuthenticated>;
    call(method: 'auth', args: [number, number, string], options?: ICallOptions): Promise<IUserAuthenticated>;
    call(method: 'msg', args: [string], options?: ICallOptions): Promise<IChatMessage>;
    call(method: 'whisper', args: [string, string], options?: ICallOptions): Promise<any>;
    call(method: 'history', args: [number], options?: ICallOptions): Promise<IChatMessage[]>;
    call(method: 'timeout', args: [string, string], options?: ICallOptions): Promise<string>;
    call(method: 'optOutEvents', args: (string)[], options?: ICallOptions): Promise<void>;
    call(method: 'ping', args: [any]): Promise<any>;
    call(method: 'vote:start', args: [string, string[], number]): Promise<void>;
    call(method: string, args: (string | number)[], options?: ICallOptions): Promise<any>;
    /**
     * Closes the websocket gracefully.
     */
    close(): void;
    private callAuth(args, options?);
}
