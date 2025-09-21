import React, { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isRecording: boolean;
  onToggleRecording: () => void;
  transcript?: string;
  onTranscriptUsed?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  isRecording,
  onToggleRecording,
  transcript,
  onTranscriptUsed,
}) => {
  const [message, setMessage] = useState('');

  // Handle transcript like old/ version - put in input for user to review
  React.useEffect(() => {
    if (transcript) {
      setMessage(transcript);
      if (onTranscriptUsed) {
        onTranscriptUsed();
      }
      // Focus input for user to review/edit like old/ version
      const input = document.getElementById('messageInput') as HTMLInputElement;
      if (input) {
        input.focus();
        // Auto-resize input like old/ version
        input.style.height = 'auto';
        input.style.height = input.scrollHeight + 'px';
      }
    }
  }, [transcript, onTranscriptUsed]);

  const handleSend = () => {
    if (message.trim() && !isLoading) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-input-container">
      <div className="input-group">
        <input
          type="text"
          id="messageInput"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Digite ou fale sua mensagem..."
          autoComplete="off"
          disabled={isLoading}
        />
        <button
          id="micButton"
          onClick={() => {
            console.log('Mic button clicked!');
            onToggleRecording();
          }}
          title={isRecording ? 'Gravando... Clique para parar' : 'Clique para falar'}
          className={isRecording ? 'recording' : ''}
          disabled={isLoading}
        >
          <span id="micIcon">{isRecording ? '🔴' : '🎤'}</span>
        </button>
        <button
          id="sendButton"
          onClick={handleSend}
          disabled={isLoading || !message.trim()}
        >
          {isLoading ? (
            <span className="spinner">⏳</span>
          ) : (
            <span>Enviar</span>
          )}
        </button>
      </div>
    </div>
  );
};