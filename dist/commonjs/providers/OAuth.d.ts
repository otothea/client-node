import { Client } from '../Client';
import { IOptionalUrlRequestOptions } from '../RequestRunner';
import { Provider } from './Provider';
export interface ITokenBase {
    access?: string;
    refresh?: string;
}
export interface ITokens extends ITokenBase {
    expires: number | string | Date;
}
export interface IParsedTokens extends ITokenBase {
    expires?: Date;
}
export interface IOAuthProviderOptions {
    clientId: string;
    secret?: string;
    tokens?: ITokens;
}
export interface IQueryAttemptQueryString {
    error: string;
    error_description: string;
    code: string;
}
/**
 * Provider for oauth-based authentication.
 */
export declare class OAuthProvider extends Provider {
    private details;
    private tokens;
    constructor(client: Client, options: IOAuthProviderOptions);
    /**
     * Returns if the client is currently authenticated: they must
     * have a non-expired key pair.
     */
    isAuthenticated(): boolean;
    /**
     * Returns a redirect to the webpage to get authentication.
     */
    getRedirect(redirect: string, permissions: string | string[]): string;
    /**
     * Returns the access token, if any, or undefined.
     */
    accessToken(): string;
    /**
     * Returns the refresh token, if any, or undefined.
     */
    refreshToken(): string;
    /**
     * Returns the date that the current tokens expire. You must refresh
     * before then, or reauthenticate.
     */
    expires(): Date;
    /**
     * Returns the set of tokens. These can be saved and used to
     * reload the provider later using OAuthProvider.fromTokens.
     */
    getTokens(): IParsedTokens;
    /**
     * Sets the tokens for the oauth provider.
     */
    setTokens(tokens?: ITokens): this;
    /**
     * Unpacks data from a token response.
     */
    private unpackResponse;
    /**
     * Attempts to authenticate based on a query string, gotten from
     * redirecting back from the authorization url (see .getRedirect).
     *
     * Returns a promise which is rejected if there was an error
     * in obtaining authentication.
     */
    attempt(redirect: string, qs: IQueryAttemptQueryString): Promise<void>;
    /**
     * Refreshes the authentication tokens, bumping the expires time.
     */
    refresh(): Promise<void>;
    /**
     * Returns info to add to the client's request.
     */
    getRequest(): IOptionalUrlRequestOptions;
    getClientId(): string;
}
