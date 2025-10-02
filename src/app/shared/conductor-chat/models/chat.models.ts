export interface ApiConfig {
  baseUrl: string;
  endpoint: string;
  streamEndpoint?: string;
  apiKey: string;
  timeout?: number;
  retryAttempts?: number;
}

export interface Message {
  id: string;
  content: string;
  type: 'user' | 'bot';
  timestamp: Date;
  isStreaming?: boolean;
}

export interface ChatState {
  messages: Message[];
  isConnected: boolean;
  isLoading: boolean;
  currentStreamingMessageId?: string;
}

export type ChatMode = 'ask' | 'agent';

export interface ConductorConfig {
  api: ApiConfig;
  mode: ChatMode;
  welcomeMessage: string;
  autoScroll: boolean;
  maxMessages: number;
}

export interface StreamEvent {
  event: string;
  data?: any;
}

export interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  result?: string;
}
