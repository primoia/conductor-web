import { useState, useCallback, useEffect } from 'react';

interface SpeechRecognitionHook {
  isRecording: boolean;
  isSupported: boolean;
  transcript: string;
  toggleRecording: () => void;
  startRecording: () => void;
  stopRecording: () => void;
}

export const useSpeechRecognition = (): SpeechRecognitionHook => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  const isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognitionInstance = new SpeechRecognition();

    recognitionInstance.continuous = false;
    recognitionInstance.interimResults = false;
    recognitionInstance.lang = 'pt-BR';

    recognitionInstance.onresult = (event: any) => {
      const result = event.results[0][0].transcript;
      setTranscript(result);
      setIsRecording(false);
    };

    recognitionInstance.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
    };

    recognitionInstance.onend = () => {
      setIsRecording(false);
    };

    setRecognition(recognitionInstance);

    return () => {
      if (recognitionInstance) {
        recognitionInstance.stop();
      }
    };
  }, [isSupported]);

  const startRecording = useCallback(() => {
    if (!recognition || isRecording) return;

    setTranscript('');
    setIsRecording(true);
    recognition.start();
  }, [recognition, isRecording]);

  const stopRecording = useCallback(() => {
    if (!recognition || !isRecording) return;

    recognition.stop();
    setIsRecording(false);
  }, [recognition, isRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    isSupported,
    transcript,
    toggleRecording,
    startRecording,
    stopRecording,
  };
};