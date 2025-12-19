import { Injectable, Logger } from "@nestjs/common";
import { CHAT_MAX_CONNECTIONS, SSE_HEARTBEAT_INTERNBAL, SSE_RETRY_SECONDS } from "src/common/constants";

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name)
    private static activeConnections = 0;

    constructor() {
        this.logger.log('ChatService initialized')
    }

    public isOkayToConnect() {
        return ChatService.activeConnections < CHAT_MAX_CONNECTIONS;
    }

    public incrementActiveConnections(): boolean {
        if (ChatService.activeConnections >= CHAT_MAX_CONNECTIONS) {
            return false;
        }

        ChatService.activeConnections++;
        return true;
    }

    public decrementActiveConnections(): void {
        if (ChatService.activeConnections <= 0) {
            ChatService.activeConnections = 0;
            return;
        }

        ChatService.activeConnections--;
    }

    public getActiveConnections() {
        return ChatService.activeConnections;
    }

}