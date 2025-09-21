import { render, screen } from '@testing-library/react';
import { ChatMessages } from '../ChatMessages';
import { Message } from '../../types';

const mockMessages: Message[] = [
  {
    id: '1',
    content: 'Hello, world!',
    type: 'user',
    timestamp: new Date(),
  },
  {
    id: '2',
    content: 'Hi there! How can I help you?',
    type: 'bot',
    timestamp: new Date(),
  },
];

describe('ChatMessages', () => {
  it('should render messages correctly', () => {
    render(
      <ChatMessages
        messages={mockMessages}
        isLoading={false}
      />
    );

    expect(screen.getByText('Você:')).toBeInTheDocument();
    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
    expect(screen.getByText('Conductor:')).toBeInTheDocument();
    expect(screen.getByText('Hi there! How can I help you?')).toBeInTheDocument();
  });

  it('should show typing indicator when loading', () => {
    render(
      <ChatMessages
        messages={[]}
        isLoading={true}
      />
    );

    expect(screen.getByText('Conductor:')).toBeInTheDocument();
    expect(screen.getByClassName('typing-indicator')).toBeInTheDocument();
  });

  it('should show progress message when provided', () => {
    const progressMessage: Message = {
      id: 'progress-1',
      content: 'Processing your request...',
      type: 'bot',
      timestamp: new Date(),
    };

    render(
      <ChatMessages
        messages={[]}
        isLoading={true}
        progressMessage={progressMessage}
      />
    );

    expect(screen.getByText('Processing your request...')).toBeInTheDocument();
  });
});