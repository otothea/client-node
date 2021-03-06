var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
import { Service } from './Service';
/**
 * Service for interacting with the chat endpoints on the Mixer REST API.
 */
var ChatService = /** @class */ (function (_super) {
    __extends(ChatService, _super);
    function ChatService() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
     * Joins the chat for a specified channel ID.
     */
    ChatService.prototype.join = function (channelId) {
        return this.makeHandled('get', "v2/chats/" + channelId);
    };
    /**
     * Retrieve a list of online users in a chat specified by channelId.
     */
    ChatService.prototype.getUsers = function (channelId, data) {
        return this.makeHandled('get', "v2/chats/" + channelId + "/users", {
            qs: data,
        });
    };
    /**
     * Search for users within a chat specified by channelId.
     */
    ChatService.prototype.searchUsers = function (channelId, data) {
        return this.makeHandled('get', "v2/chats/" + channelId + "/users/search", {
            qs: data,
        });
    };
    return ChatService;
}(Service));
export { ChatService };
//# sourceMappingURL=Chat.js.map