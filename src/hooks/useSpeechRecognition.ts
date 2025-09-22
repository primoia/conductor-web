import { useState, useCallback, useEffect } from 'react';
import { getBrowserInfo } from '../utils';

interface SpeechRecognitionHook {
  isRecording: boolean;
  isSupported: boolean;
  transcript: string;
  toggleRecording: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  clearTranscript: () => void;
}

export const useSpeechRecognition = (): SpeechRecognitionHook => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  const { isSupported } = getBrowserInfo();

  console.log('Browser detection:', getBrowserInfo());

  useEffect(() => {
    console.log('useSpeechRecognition useEffect - isSupported:', isSupported);

    if (!isSupported) {
      console.warn('Web Speech API não suportada neste navegador');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    console.log('SpeechRecognition class:', SpeechRecognition);

    try {
      const recognitionInstance = new SpeechRecognition();
      console.log('Recognition instance created:', recognitionInstance);

      // Configuration like old/ version
      recognitionInstance.lang = 'pt-BR';
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = true; // Show partial results
      recognitionInstance.maxAlternatives = 1;

      let recognitionTimeout: NodeJS.Timeout | null = null;

      recognitionInstance.onstart = () => {
        console.log('Reconhecimento de voz iniciado');
        setIsRecording(true);

        // Safety timeout like old/ version
        if (recognitionTimeout) {
          clearTimeout(recognitionTimeout);
        }
        recognitionTimeout = setTimeout(() => {
          console.log('Timeout do reconhecimento de voz - parando automaticamente');
          try {
            recognitionInstance.stop();
          } catch (e) {
            console.error('Erro ao parar reconhecimento por timeout:', e);
          }
        }, 15000);
      };

      recognitionInstance.onresult = (event: any) => {
        let finalTranscript = '';

        // Process all results like old/ version
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          }
        }

        if (finalTranscript.trim()) {
          setTranscript(finalTranscript.trim());
        }
      };

      recognitionInstance.onerror = (event: any) => {
        console.error('Erro no reconhecimento de voz:', event.error);
        setIsRecording(false);

        if (recognitionTimeout) {
          clearTimeout(recognitionTimeout);
        }

        // Detailed error handling like old/ version
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

      recognitionInstance.onend = () => {
        console.log('Reconhecimento de voz finalizado');
        setIsRecording(false);

        if (recognitionTimeout) {
          clearTimeout(recognitionTimeout);
        }
      };

      setRecognition(recognitionInstance);
      console.log('Recognition instance set to state');

      return () => {
        if (recognitionInstance) {
          recognitionInstance.stop();
        }
        if (recognitionTimeout) {
          clearTimeout(recognitionTimeout);
        }
      };
    } catch (error) {
      console.error('Erro ao criar instância do SpeechRecognition:', error);
    }
  }, [isSupported]);

  const startRecording = useCallback(() => {
    if (!recognition || isRecording) return;

    setTranscript('');

    // Check permissions first like old/ version
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
        console.log('Microphone permission state:', result.state);

        if (result.state === 'denied') {
          console.warn('Permissão do microfone negada pelo navegador');
          // Show message like old/ version but don't start
          return;
        }

        // Permission is granted or prompt - try to start
        console.log('Permission OK, starting recognition...');
        try {
          recognition.start();
        } catch (error) {
          console.error('Erro ao iniciar reconhecimento:', error);
          setIsRecording(false);
        }
      }).catch((error) => {
        console.log('Permissions API error:', error, '- trying direct start');
        // Fallback - try direct start
        try {
          recognition.start();
        } catch (startError) {
          console.error('Erro ao iniciar reconhecimento:', startError);
          setIsRecording(false);
        }
      });
    } else {
      console.log('No permissions API - trying direct start');
      // No permissions API - just try to start
      try {
        recognition.start();
      } catch (error) {
        console.error('Erro ao iniciar reconhecimento:', error);
        setIsRecording(false);
      }
    }
  }, [recognition, isRecording]);

  const stopRecording = useCallback(() => {
    if (!recognition || !isRecording) return;

    recognition.stop();
    setIsRecording(false);
  }, [recognition, isRecording]);

  const toggleRecording = useCallback(() => {
    console.log('toggleRecording called - recognition:', !!recognition, 'isRecording:', isRecording, 'isSupported:', isSupported);

    // Like old/ version - check if recognition exists, if not try to initialize
    if (!recognition) {
      console.log('Recognition not initialized, trying to reinitialize...');
      if (!isSupported) {
        console.error('Speech recognition not supported');
        return;
      }
      // Try to reinitialize like old/ version does
      return;
    }

    if (isRecording) {
      console.log('Stopping recording...');
      stopRecording();
    } else {
      console.log('Starting recording...');
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording, recognition, isSupported]);

  const clearTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return {
    isRecording,
    isSupported,
    transcript,
    toggleRecording,
    startRecording,
    stopRecording,
    clearTranscript,
  };
};