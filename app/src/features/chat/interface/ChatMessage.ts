export interface ChatMessage {
  type: string;
  sessionId?: string;
  uuid?: string;
  content?: string;
  timestamp?: string;
}
