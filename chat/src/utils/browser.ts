export const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

export const isIOSMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);

export const isSpeechRecognitionSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

export const getBrowserInfo = () => ({
  isMobile,
  isIOSMobile,
  hasWebkitSpeech: 'webkitSpeechRecognition' in window,
  hasSpeech: 'SpeechRecognition' in window,
  isSupported: isSpeechRecognitionSupported
});