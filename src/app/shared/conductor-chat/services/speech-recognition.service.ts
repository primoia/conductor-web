import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class SpeechRecognitionService {
  private recognition: any = null;
  private isRecordingSubject = new BehaviorSubject<boolean>(false);
  private transcriptSubject = new BehaviorSubject<string>('');
  private recognitionTimeout: any = null;

  public isRecording$: Observable<boolean> = this.isRecordingSubject.asObservable();
  public transcript$: Observable<string> = this.transcriptSubject.asObservable();
  public isSupported: boolean = false;

  constructor() {
    this.initializeRecognition();
  }

  private initializeRecognition(): void {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Web Speech API não suportada neste navegador');
      this.isSupported = false;
      return;
    }

    this.isSupported = true;

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'pt-BR';
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => {
        console.log('Reconhecimento de voz iniciado');
        this.isRecordingSubject.next(true);

        // Safety timeout
        if (this.recognitionTimeout) {
          clearTimeout(this.recognitionTimeout);
        }
        this.recognitionTimeout = setTimeout(() => {
          console.log('Timeout do reconhecimento de voz - parando automaticamente');
          this.stopRecording();
        }, 15000);
      };

      this.recognition.onresult = (event: any) => {
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          }
        }

        if (finalTranscript.trim()) {
          this.transcriptSubject.next(finalTranscript.trim());
        }
      };

      this.recognition.onerror = (event: any) => {
        console.error('Erro no reconhecimento de voz:', event.error);
        this.isRecordingSubject.next(false);

        if (this.recognitionTimeout) {
          clearTimeout(this.recognitionTimeout);
        }

        let errorMessage = 'Erro no reconhecimento de voz';
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'Nenhuma fala detectada. Tente novamente.';
            break;
          case 'audio-capture':
            errorMessage = 'Microfone não encontrado.';
            break;
          case 'not-allowed':
            errorMessage = 'Permissão do microfone negada.';
            break;
          case 'network':
            errorMessage = 'Erro de rede.';
            break;
        }
        console.warn(errorMessage);
      };

      this.recognition.onend = () => {
        console.log('Reconhecimento de voz finalizado');
        this.isRecordingSubject.next(false);

        if (this.recognitionTimeout) {
          clearTimeout(this.recognitionTimeout);
        }
      };

      console.log('Recognition instance initialized');
    } catch (error) {
      console.error('Erro ao criar instância do SpeechRecognition:', error);
      this.isSupported = false;
    }
  }

  startRecording(): void {
    if (!this.recognition || this.isRecordingSubject.value) return;

    this.transcriptSubject.next('');

    // Always try direct start - navigator.permissions can report 'denied'
    // on HTTP (non-secure) contexts even when the Speech API still works.
    // Let the recognition.onerror handler deal with actual permission failures.
    this.startRecognitionInstance();
  }

  private startRecognitionInstance(): void {
    try {
      this.recognition.start();
    } catch (error) {
      console.error('Erro ao iniciar reconhecimento:', error);
      this.isRecordingSubject.next(false);
    }
  }

  stopRecording(): void {
    if (!this.recognition || !this.isRecordingSubject.value) return;

    try {
      this.recognition.stop();
      this.isRecordingSubject.next(false);
    } catch (error) {
      console.error('Erro ao parar reconhecimento:', error);
    }
  }

  toggleRecording(): void {
    if (this.isRecordingSubject.value) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  clearTranscript(): void {
    this.transcriptSubject.next('');
  }

  ngOnDestroy(): void {
    if (this.recognition) {
      this.recognition.stop();
    }
    if (this.recognitionTimeout) {
      clearTimeout(this.recognitionTimeout);
    }
  }
}
