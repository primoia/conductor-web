export type AnimState = 'idle' | 'connecting' | 'listening' | 'recording' | 'thinking' | 'speaking';

export interface PaletteColor {
  r: number;
  g: number;
  b: number;
  hex: string;
}

export interface EngineColorEntry {
  pal: PaletteColor;
  css: string;
  cssDim: string;
  cssBg: string;
}

export interface AgentColor {
  color: string;
  dim: string;
  glow: string;
}

export interface AgentCarouselItem {
  name: string;
  colorIdx: number;
}

export interface WsConfigMessage {
  type: 'config';
  session_id: string;
  max_record_seconds?: number;
  features?: string[];
  stt_profiles?: SttProfile[];
  stt_active_profile?: string;
  providers?: LlmProviderInfo[];
  current_provider?: string;
  tts_voices?: TtsVoiceInfo[];
  tts_current_voice?: string;
}

export interface WsLlmConfigAckMessage {
  type: 'llm_config_ack';
  current_provider: string;
  providers: LlmProviderInfo[];
}

export interface WsTtsConfigAckMessage {
  type: 'tts_config_ack';
  current_voice: string;
  voices: TtsVoiceInfo[];
}

export interface WsWakeWordMessage {
  type: 'wake_word';
  keyword: string;
  engine?: string;
}

export interface WsPartialMessage {
  type: 'partial';
  text: string;
}

export interface WsTranscriptionMessage {
  type: 'transcription';
  text: string;
  engine?: string;
}

export interface WsTtsStartMessage {
  type: 'tts_start';
  text: string;
}

export interface WsLlmStartMessage {
  type: 'llm_start';
  text: string;
}

export interface WsLlmTokenMessage {
  type: 'llm_token';
  text: string;
}

export interface WsLlmResponseMessage {
  type: 'llm_response';
  text: string;
}

export interface WsLlmEndMessage {
  type: 'llm_end';
}

export interface WsTtsEndMessage {
  type: 'tts_end';
  text?: string;
}

export interface WsInterruptedMessage {
  type: 'interrupted';
}

export interface WsConversationEndMessage {
  type: 'conversation_end';
}

export interface WsDisplayMessage {
  type: 'display';
  command: 'notification' | 'color' | 'overlay' | 'animate';
  payload?: {
    text?: string;
    color?: string;
    state?: AnimState;
    duration?: number;
    level?: 'info' | 'warning' | 'error';
    position?: 'top' | 'center' | 'bottom';
  };
}

export interface SttProfile {
  id: string;       // "fast", "en", "accurate"
  label: string;    // display name
  language: string; // "pt", "en", "auto"
  model: string;    // "base", "medium", "large-v3"
  latency: string;  // "~1s", "~3s"
}

export interface LlmProviderInfo {
  id: string;       // "deepseek", "openai", "groq"
  name: string;     // "DeepSeek", "OpenAI", "Groq"
  model: string;    // "deepseek-chat", "gpt-4o-mini", etc.
}

export interface TtsVoiceInfo {
  id: string;       // "pt-BR-FranciscaNeural"
  label: string;    // "Francisca"
  short: string;    // "FRA" (LED label)
}

export type WsMessage =
  | WsConfigMessage
  | WsWakeWordMessage
  | WsPartialMessage
  | WsTranscriptionMessage
  | WsLlmStartMessage
  | WsLlmTokenMessage
  | WsLlmResponseMessage
  | WsLlmEndMessage
  | WsTtsStartMessage
  | WsTtsEndMessage
  | WsInterruptedMessage
  | WsConversationEndMessage
  | WsDisplayMessage
  | WsLlmConfigAckMessage
  | WsTtsConfigAckMessage;

export interface WakeWordEntry {
  keyword?: string;
  Keyword?: string;
}

export interface MediaStudioConfig {
  wake_words?: (string | WakeWordEntry)[];
  wakeWords?: (string | WakeWordEntry)[];
}

export interface TranscriptEntry {
  text: string;
  type: 'partial' | 'final' | 'wake' | 'assistant';
  engine?: string;
  fading: boolean;
  faded: boolean;
}
