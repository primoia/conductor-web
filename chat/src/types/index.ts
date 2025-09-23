export interface ApiConfig {
  baseUrl: string;
  endpoint: string;
  streamEndpoint?: string;
  apiKey: string;
  timeout?: number;
  retryAttempts?: number;
}

export interface FeatureFlags {
  enableSSE: boolean;
  fallbackToHTTP: boolean;
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

export interface QuickCommand {
  label: string;
  command: string;
  description: string;
}

export interface SpecialCommand {
  action: string;
  description: string;
}

export interface UIConfig {
  theme: 'gradient' | 'dark' | 'light';
  animations: boolean;
  autoScroll: boolean;
  maxMessages: number;
  messageDelay: number;
}

export interface ChatConfig {
  welcomeMessage: string;
  maxHistory: number;
  saveHistory: boolean;
  clearOnStart: boolean;
}

export interface ProductionConfig {
  enableHttps: boolean;
  enableCors: boolean;
  enableRateLimit: boolean;
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface ConductorConfig {
  api: ApiConfig;
  ui: UIConfig;
  chat: ChatConfig;
  quickCommands: QuickCommand[];
  specialCommands: Record<string, SpecialCommand>;
  production: ProductionConfig;
}

export interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: (event: any) => void;
    onerror: (event: any) => void;
    onend: () => void;
    start(): void;
    stop(): void;
  }

  var SpeechRecognition: {
    prototype: SpeechRecognition;
    new(): SpeechRecognition;
  };
}