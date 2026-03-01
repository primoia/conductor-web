import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { AnimState, WsMessage } from '../models/media-studio.models';
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

  // Events
  message$ = new Subject<WsMessage>();

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

      this.audioCtx = new AudioContext();
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.ws = new WebSocket(proto + '//' + location.host + '/jarvis/ws/stream');
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.setStatus('CONNECTED', 'connected');
        this.ws!.send(JSON.stringify({ type: 'config', sample_rate: this.audioCtx!.sampleRate }));
      };

      this.ws.onmessage = (e) => {
        if (e.data instanceof ArrayBuffer) {
          this.playTtsAudio(e.data);
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
          this.setStatus('LISTENING', 'listening');
          this.setAnimState('listening');
          break;

        case 'wake_word':
          this._activeEngine = msg.engine || 'vosk';
          this.activeAgent$.next(msg.keyword || null);
          this.setAnimState('recording', this._activeEngine);
          this.setStatus(`[${this._activeEngine.toUpperCase()}] RECORDING`, this._activeEngine);
          break;

        case 'transcription':
          this._activeEngine = null;
          this.activeAgent$.next(null);
          this.setAnimState('listening');
          this.setStatus('LISTENING', 'listening');
          break;

        case 'tts_start':
          this.ttsPlaying$.next(true);
          this.setAnimState('speaking');
          this.setStatus('SPEAKING', 'speaking');
          break;

        case 'tts_end':
          // If audio already finished playing, transition immediately
          if (!this.ttsOutputAnalyser) {
            this.ttsPlaying$.next(false);
            this.setAnimState('listening');
            this.setStatus('LISTENING', 'listening');
          }
          // Otherwise source.onended will handle the transition
          break;
      }
    });
  }

  private playTtsAudio(arrayBuffer: ArrayBuffer): void {
    if (!this.audioCtx) return;
    // PCM S16LE at 22050 Hz, mono
    const pcm = new Int16Array(arrayBuffer);
    const sampleRate = 22050;
    const float32 = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) {
      float32[i] = pcm[i] / 32768;
    }

    const buf = this.audioCtx.createBuffer(1, float32.length, sampleRate);
    buf.getChannelData(0).set(float32);

    const source = this.audioCtx.createBufferSource();
    source.buffer = buf;

    this.ttsOutputAnalyser = this.audioCtx.createAnalyser();
    this.ttsOutputAnalyser.fftSize = 256;
    source.connect(this.ttsOutputAnalyser);
    this.ttsOutputAnalyser.connect(this.audioCtx.destination);

    source.onended = () => {
      this.zone.run(() => {
        this.ttsOutputAnalyser = null;
        this.ttsPlaying$.next(false);
        this.setAnimState('listening');
        this.setStatus('LISTENING', 'listening');
      });
    };
    source.start();
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
