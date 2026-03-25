import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { AnimState, LlmProviderInfo, ResponseLangInfo, SttProfile, TtsVoiceInfo, WsMessage } from '../models/media-studio.models';
import { P, getEngineColor } from '../constants/media-studio-palette';
import { PaletteColor } from '../models/media-studio.models';

@Injectable({ providedIn: 'root' })
export class MediaStudioWebSocketService {
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  private _streaming = false;
  private _sessionId: string | null = null;
  private _activeEngine: string | null = null;

  // Exposed as sync getters for 60fps RAF — not Observable
  freqData = new Uint8Array(128);
  tdData = new Uint8Array(256);
  smoothLevel = 0;
  private audioLevel = 0;

  private ttsOutputAnalyser: AnalyserNode | null = null;
  private micTrack: MediaStreamTrack | null = null;

  // ── Chunked audio queue for streaming TTS ──
  private audioQueue: ArrayBuffer[] = [];
  private isPlayingChunk = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private ttsEndReceived = false;
  private pendingDecodes = 0;

  // Observable state
  animState$ = new BehaviorSubject<AnimState>('idle');
  tgtPal$ = new BehaviorSubject<PaletteColor>(P['idle']);
  statusText$ = new BehaviorSubject<string>('PRIMOIA MEDIA STUDIO');
  statusClass$ = new BehaviorSubject<string>('idle');
  infoText$ = new BehaviorSubject<string>('');
  tapHintVisible$ = new BehaviorSubject<boolean>(true);
  maxRecSeconds$ = new BehaviorSubject<number>(10);
  recordStart$ = new BehaviorSubject<number>(0);
  activeAgent$ = new BehaviorSubject<string | null>(null);
  ttsPlaying$ = new BehaviorSubject<boolean>(false);
  sttProfiles$ = new BehaviorSubject<SttProfile[]>([]);
  sttActiveProfile$ = new BehaviorSubject<string>('fast');
  llmProviders$ = new BehaviorSubject<LlmProviderInfo[]>([]);
  llmCurrentProvider$ = new BehaviorSubject<string>('');
  ttsVoices$ = new BehaviorSubject<TtsVoiceInfo[]>([]);
  ttsCurrentVoice$ = new BehaviorSubject<string>('');
  responseLangs$ = new BehaviorSubject<ResponseLangInfo[]>([]);
  responseCurrentLang$ = new BehaviorSubject<string>('auto');
  agentLocked$ = new BehaviorSubject<boolean>(false);
  micMuted$ = new BehaviorSubject<boolean>(false);

  // Events
  message$ = new Subject<WsMessage>();
  // MCP display commands
  displayCommand$ = new Subject<{ command: string; payload?: any }>();

  get streaming(): boolean {
    return this._streaming;
  }

  constructor(private zone: NgZone) { }

  updateAudioData(): void {
    const node = this.ttsOutputAnalyser || this.analyserNode;
    if (!node || !this._streaming) {
      this.audioLevel = 0;
      this.smoothLevel *= 0.92;
      return;
    }
    if (this.freqData.length !== node.frequencyBinCount) {
      this.freqData = new Uint8Array(node.frequencyBinCount);
    }
    node.getByteFrequencyData(this.freqData);
    if (this.tdData.length !== node.fftSize) {
      this.tdData = new Uint8Array(node.fftSize);
    }
    node.getByteTimeDomainData(this.tdData);
    let sum = 0;
    for (let i = 0; i < this.tdData.length; i++) {
      const v = (this.tdData[i] - 128) / 128;
      sum += v * v;
    }
    this.audioLevel = Math.sqrt(sum / this.tdData.length);
    this.smoothLevel += (Math.min(1, this.audioLevel * 4) - this.smoothLevel) * 0.15;
  }

  toggleMic(): void {
    if (this._streaming) {
      this.stopStreaming();
    } else {
      this.startStreaming();
    }
  }

  /** Send an interrupt command to stop current LLM/TTS processing. */
  interrupt(): void {
    this.stopAudioPlayback();
    this.sendTtsState(false);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'interrupt' }));
    }
    this.zone.run(() => {
      this.ttsPlaying$.next(false);
      this.setAnimState('listening');
      this.setStatus('LISTENING', 'listening');
    });
  }

  /** Switch the STT profile on the server (e.g., "fast", "en", "accurate"). */
  setSttProfile(profileId: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'stt_config', profile: profileId }));
    }
    this.sttActiveProfile$.next(profileId);
  }

  /** Switch the LLM provider on the server (e.g., "deepseek", "openai", "groq"). */
  setLlmProvider(providerId: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'llm_config', provider: providerId }));
    }
    this.llmCurrentProvider$.next(providerId);
  }

  /** Switch the TTS voice on the server (e.g., "pt-BR-FranciscaNeural"). */
  setTtsVoice(voiceId: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'tts_config', voice: voiceId }));
    }
    this.ttsCurrentVoice$.next(voiceId);
  }

  /** Switch the LLM response language on the server (e.g., "auto", "pt-BR", "en"). */
  setResponseLang(langId: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'response_lang_config', language: langId }));
    }
    this.responseCurrentLang$.next(langId);
  }

  /** Toggle agent lock — prevents conversation_end timeout when agent is active. */
  toggleAgentLock(): void {
    const locked = !this.agentLocked$.getValue();
    this.agentLocked$.next(locked);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'lock_agent', locked }));
    }
  }

  /** Toggle microphone mute — silences audio input while keeping session alive. */
  toggleMicMute(): void {
    const muted = !this.micMuted$.getValue();
    this.micMuted$.next(muted);
    if (this.micTrack) {
      this.micTrack.enabled = !muted;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'mic_mute', muted }));
    }
  }

  async startStreaming(): Promise<void> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        if (!local) {
          this.setStatus('HTTPS REQUIRED', 'error');
          this.setAnimState('idle');
          return;
        }
        throw new Error('getUserMedia not available');
      }

      this.setAnimState('connecting');
      this.setStatus('CONNECTING...', 'connected');
      this.tapHintVisible$.next(false);

      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: false, autoGainControl: true },
        });
      } catch {
        // Fallback for WebKitGTK / browsers that reject advanced constraints
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      this.micTrack = this.mediaStream.getAudioTracks()[0] || null;
      this.audioCtx = new AudioContext();
      // Capacitor native: assets served locally, connect WS to remote server
      const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
      const wsHost = isNative ? 'conductor.primoia.dev' : location.host;
      const wsProto = isNative ? 'wss:' : (location.protocol === 'https:' ? 'wss:' : 'ws:');
      this.ws = new WebSocket(wsProto + '//' + wsHost + '/jarvis/ws/stream');
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.setStatus('CONNECTED', 'connected');
        this.ws!.send(JSON.stringify({ type: 'config', sample_rate: this.audioCtx!.sampleRate }));
      };

      this.ws.onmessage = (e) => {
        if (e.data instanceof ArrayBuffer) {
          this.enqueueTtsAudio(e.data);
          return;
        }
        const msg: WsMessage = JSON.parse(e.data);
        this.handleMessage(msg);
      };

      this.ws.onerror = () => {
        this.setStatus('CONNECTION ERROR', 'error');
        this.setAnimState('idle');
      };

      this.ws.onclose = () => {
        this.setStatus('DISCONNECTED', 'error');
        this.stopStreaming();
      };

      await this.audioCtx.audioWorklet.addModule('assets/audio/pcm-capture.worklet.js?v=' + Date.now());
      const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.workletNode = new AudioWorkletNode(this.audioCtx, 'pcm-capture');
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;
      source.connect(this.analyserNode);

      this.workletNode.port.onmessage = (e) => {
        if (e.data && e.data.type === 'info') return;
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(e.data);
        }
      };

      source.connect(this.workletNode);
      this.workletNode.connect(this.audioCtx.destination);

      this._streaming = true;
      this.setAnimState('listening');
      this.setStatus('LISTENING', 'listening');

      const resample = this.audioCtx.sampleRate !== 16000;
      this.infoText$.next(
        resample ? `${this.audioCtx.sampleRate}Hz → 16kHz` : `${this.audioCtx.sampleRate}Hz`
      );
    } catch (err: any) {
      this.setStatus('MIC ERROR: ' + (err.message || '').toUpperCase(), 'error');
      this.setAnimState('idle');
      this.tapHintVisible$.next(true);
    }
  }

  stopStreaming(): void {
    this._streaming = false;
    this._activeEngine = null;
    this.stopAudioPlayback();
    this.setAnimState('idle');
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    this.analyserNode = null;
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    this.micTrack = null;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('TAP TO CONNECT', 'idle');
    this.tapHintVisible$.next(true);
    this.infoText$.next('');
    this.agentLocked$.next(false);
    this.micMuted$.next(false);
    this.freqData = new Uint8Array(128);
    this.tdData = new Uint8Array(256);
  }

  private handleMessage(msg: WsMessage): void {
    this.zone.run(() => {
      this.message$.next(msg);

      switch (msg.type) {
        case 'config':
          this._sessionId = msg.session_id;
          if (msg.max_record_seconds) {
            this.maxRecSeconds$.next(msg.max_record_seconds);
          }
          if (msg.stt_profiles && msg.stt_profiles.length > 0) {
            this.sttProfiles$.next(msg.stt_profiles);
          }
          if (msg.stt_active_profile) {
            this.sttActiveProfile$.next(msg.stt_active_profile);
          }
          if (msg.providers && msg.providers.length > 0) {
            this.llmProviders$.next(msg.providers);
          }
          if (msg.current_provider) {
            this.llmCurrentProvider$.next(msg.current_provider);
          }
          if (msg.tts_voices && msg.tts_voices.length > 0) {
            this.ttsVoices$.next(msg.tts_voices);
          }
          if (msg.tts_current_voice) {
            this.ttsCurrentVoice$.next(msg.tts_current_voice);
          }
          if (msg.response_languages && msg.response_languages.length > 0) {
            this.responseLangs$.next(msg.response_languages);
          }
          if (msg.response_current_language) {
            this.responseCurrentLang$.next(msg.response_current_language);
          }
          this.setStatus('LISTENING', 'listening');
          this.setAnimState('listening');
          break;

        case 'wake_word':
          this._activeEngine = msg.engine || 'vosk';
          this.activeAgent$.next(msg.keyword || null);
          // Barge-in: if currently speaking, stop playback
          if (this.animState$.getValue() === 'speaking') {
            this.stopAudioPlayback();
          }
          this.setAnimState('recording', this._activeEngine);
          this.setStatus(`[${this._activeEngine.toUpperCase()}] RECORDING`, this._activeEngine);
          break;

        case 'transcription':
          this._activeEngine = null;
          // Keep activeAgent$ alive — only clear on conversation_end
          this.setAnimState('listening');
          this.setStatus('LISTENING', 'listening');
          break;

        case 'llm_start':
          this.setAnimState('thinking');
          this.setStatus('THINKING...', 'thinking');
          break;

        case 'llm_token':
          // Stay in thinking state — transcript overlay handles token display
          break;

        case 'llm_response':
          // Full LLM response received — stay in current state
          break;

        case 'llm_end':
          // If not speaking (no TTS), transition to listening
          if (this.animState$.getValue() === 'thinking') {
            this.setAnimState('listening');
            this.setStatus('LISTENING', 'listening');
          }
          break;

        case 'tts_start':
          this.ttsEndReceived = false;
          this.ttsPlaying$.next(true);
          this.setAnimState('speaking');
          this.setStatus('SPEAKING', 'speaking');
          this.sendTtsState(true);
          break;

        case 'tts_end':
          this.ttsEndReceived = true;
          // If audio queue is empty, nothing playing, and no decodes in flight, transition now
          if (this.audioQueue.length === 0 && !this.isPlayingChunk && this.pendingDecodes === 0) {
            this.onAllAudioFinished();
          }
          // Otherwise, onChunkEnded will handle transition when queue drains
          break;

        case 'interrupted':
          this.stopAudioPlayback();
          this.ttsPlaying$.next(false);
          this.setAnimState('listening');
          this.setStatus('LISTENING', 'listening');
          break;

        case 'conversation_end':
          this.activeAgent$.next(null);
          this.setAnimState('listening');
          this.setStatus('LISTENING', 'listening');
          break;

        case 'llm_config_ack':
          if (msg.providers) this.llmProviders$.next(msg.providers);
          if (msg.current_provider) this.llmCurrentProvider$.next(msg.current_provider);
          break;

        case 'tts_config_ack':
          if (msg.voices) this.ttsVoices$.next(msg.voices);
          if (msg.current_voice) this.ttsCurrentVoice$.next(msg.current_voice);
          break;

        case 'response_lang_config_ack':
          if (msg.response_languages) this.responseLangs$.next(msg.response_languages);
          if (msg.current_language) this.responseCurrentLang$.next(msg.current_language);
          break;

        case 'lock_agent_ack':
          if (msg.locked !== undefined) this.agentLocked$.next(msg.locked);
          break;

        case 'display':
          this.handleDisplayCommand(msg);
          break;
      }
    });
  }

  // ── Chunked Audio Queue Player ──

  /** Enqueue a TTS audio chunk for sequential playback. */
  private enqueueTtsAudio(arrayBuffer: ArrayBuffer): void {
    if (!this.audioCtx) return;
    this.pendingDecodes++;
    // Pre-decode WAV eagerly so playNextChunk is instant (no async gap between chunks)
    this.audioCtx.decodeAudioData(arrayBuffer.slice(0)).then((buf) => {
      this.pendingDecodes--;
      // Fade-in 128 samples (~6ms) to smooth chunk start
      const data = buf.getChannelData(0);
      const fadeLen = Math.min(128, data.length);
      for (let i = 0; i < fadeLen; i++) data[i] *= i / fadeLen;

      this.audioQueue.push(buf as any);
      // If we're in thinking state and first audio arrives, switch to speaking
      if (this.animState$.getValue() === 'thinking') {
        this.zone.run(() => {
          this.ttsPlaying$.next(true);
          this.setAnimState('speaking');
          this.setStatus('SPEAKING', 'speaking');
        });
        this.sendTtsState(true);
      }
      // If not currently playing, start
      if (!this.isPlayingChunk) {
        this.playNextChunk();
      }
    }).catch((err) => {
      this.pendingDecodes--;
      console.error('[audio] decode error:', err);
    });
  }

  /** Play the next chunk from the audio queue. */
  private playNextChunk(): void {
    if (!this.audioCtx || this.audioQueue.length === 0) {
      this.isPlayingChunk = false;
      // If tts_end was already received, queue drained, and no decodes in flight, finish
      if (this.ttsEndReceived && this.pendingDecodes === 0) {
        this.onAllAudioFinished();
      }
      return;
    }

    this.isPlayingChunk = true;
    const buf = this.audioQueue.shift()! as any as AudioBuffer;

    const source = this.audioCtx.createBufferSource();
    source.buffer = buf;
    this.currentSource = source;

    // Create/reuse output analyser for speaking visualization
    if (!this.ttsOutputAnalyser && this.audioCtx) {
      this.ttsOutputAnalyser = this.audioCtx.createAnalyser();
      this.ttsOutputAnalyser.fftSize = 256;
      this.ttsOutputAnalyser.connect(this.audioCtx.destination);
    }

    if (this.ttsOutputAnalyser) {
      source.connect(this.ttsOutputAnalyser);
    } else {
      source.connect(this.audioCtx.destination);
    }

    source.onended = () => {
      this.currentSource = null;
      this.playNextChunk();
    };
    source.start();
  }

  /** Called when all audio chunks have been played and tts_end was received. */
  private onAllAudioFinished(): void {
    this.sendTtsState(false);
    this.zone.run(() => {
      this.ttsOutputAnalyser = null;
      this.ttsPlaying$.next(false);
      if (this._streaming) {
        this.setAnimState('listening');
        this.setStatus('LISTENING', 'listening');
      }
    });
  }

  /** Notify server whether TTS is currently playing (for voice barge-in). */
  private sendTtsState(active: boolean): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'tts_state', active }));
    }
  }

  /** Stop any in-progress audio playback and clear the queue. */
  private stopAudioPlayback(): void {
    this.audioQueue = [];
    this.isPlayingChunk = false;
    this.ttsEndReceived = false;
    this.pendingDecodes = 0;
    if (this.currentSource) {
      try { this.currentSource.stop(); } catch { /* already stopped */ }
      this.currentSource = null;
    }
    this.ttsOutputAnalyser = null;
  }

  /** Handle MCP display commands from REST facade. */
  private handleDisplayCommand(msg: any): void {
    const command = msg.command;
    const payload = msg.payload || {};
    this.displayCommand$.next({ command, payload });

    switch (command) {
      case 'animate':
        if (payload.state) {
          this.setAnimState(payload.state);
        }
        break;
      case 'color':
        if (payload.color) {
          const hex = payload.color.replace('#', '');
          const r = parseInt(hex.substr(0, 2), 16);
          const g = parseInt(hex.substr(2, 2), 16);
          const b = parseInt(hex.substr(4, 2), 16);
          this.tgtPal$.next({ r, g, b, hex: '#' + hex });
        }
        break;
      // notification and overlay are handled by the transcript overlay component via displayCommand$
    }
  }

  private setAnimState(st: AnimState, engine?: string): void {
    this.animState$.next(st);
    switch (st) {
      case 'idle':
        this.tgtPal$.next(P['idle']);
        break;
      case 'connecting':
        this.tgtPal$.next(P['green']);
        break;
      case 'listening':
        this.tgtPal$.next(P['listen']);
        break;
      case 'recording': {
        const ec = getEngineColor(engine || 'vosk');
        this.tgtPal$.next(ec.pal);
        this.recordStart$.next(Date.now());
        break;
      }
      case 'thinking':
        this.tgtPal$.next(P['thinking']);
        break;
      case 'speaking':
        this.tgtPal$.next(P['speaking']);
        break;
    }
  }

  private setStatus(text: string, cls: string): void {
    this.statusText$.next(text);
    this.statusClass$.next(cls);
  }
}
