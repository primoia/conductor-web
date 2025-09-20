import React from 'react';
import { Message } from '../types';

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({ messages, isLoading }) => {
  const formatMessage = (content: string) => {
    if (content.includes('<ul>') || content.includes('<li>') || content.includes('<code>')) {
      return { __html: content };
    }
    return null;
  };

  return (
    <div className="chat-messages" id="chatMessages">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`message ${message.type}-message`}
        >
          <div className="message-content">
            {message.type === 'bot' && <strong>Conductor:</strong>}
            {formatMessage(message.content) ? (
              <span dangerouslySetInnerHTML={formatMessage(message.content)!} />
            ) : (
              <span> {message.content}</span>
            )}
          </div>
        </div>
      ))}

      {isLoading && (
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