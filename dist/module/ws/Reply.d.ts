import { ErrorCode } from '../errors';
export interface IPacket {
    error: string | IErrorPacket;
    data: any;
}
export interface IErrorPacket {
    code: ErrorCode;
    message: string;
    stacktrace: string;
}
/**
 * Simple wrapper that waits for a dispatches a method reply.
 */
export declare class Reply {
    private resolve;
    private reject;
    constructor(resolve: (value: any) => void, reject: (value: any) => void);
    /**
     * Handles "reply" packet data from the websocket.
     */
    handle(packet: IPacket): void;
}
