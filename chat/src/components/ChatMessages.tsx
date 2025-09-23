import React from 'react';
import { Message } from '../types';
import { formatMessage } from '../utils';

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  progressMessage?: Message | null;
  streamingMessage?: Message | null;
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  isLoading,
  progressMessage,
  streamingMessage
}) => {

  return (
    <div className="chat-messages" id="chatMessages">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`message ${message.type}-message`}
        >
          <div className="message-content">
            {message.type === 'user' && <strong>Você:</strong>}
            {message.type === 'bot' && <strong>Conductor:</strong>}
            {formatMessage(message.content) ? (
              <span dangerouslySetInnerHTML={formatMessage(message.content)!} />
            ) : (
              <span> {message.content}</span>
            )}
          </div>
        </div>
      ))}

      {/* Progress message like old/ version - italic, no "Conductor:" prefix */}
      {progressMessage && (
        <div className="message bot-message progress-message">
          <div className="message-content">
            <em>{progressMessage.content}</em>
          </div>
        </div>
      )}

      {/* Streaming message like old/ version - with "Conductor:" prefix */}
      {streamingMessage && (
        <div className="message bot-message">
          <div className="message-content">
            <strong>Conductor:</strong> {streamingMessage.content}
          </div>
        </div>
      )}

      {/* Only show typing indicator if no progress message - like old/ version */}
      {isLoading && !progressMessage && (
        <div className="message bot-message">
          <div className="message-content">
            <strong>Conductor:</strong>
            <span className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};