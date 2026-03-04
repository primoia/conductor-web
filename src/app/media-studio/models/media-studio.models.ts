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
  | WsDisplayMessage;

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
