import React, { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isRecording: boolean;
  onToggleRecording: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  isRecording,
  onToggleRecording,
}) => {
  const [message, setMessage] = useState('');

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
          onClick={onToggleRecording}
          title="Clique para falar"
          className={isRecording ? 'recording' : ''}
          disabled={isLoading}
        >
          <span id="micIcon">{isRecording ? '⏹️' : '🎤'}</span>
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