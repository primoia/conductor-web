import { useState, useEffect, useRef } from 'react';
import { ChatState, Message, ConductorConfig } from './types';
import { useConductorApi } from './hooks/useConductorApi';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { ChatMessages } from './components/ChatMessages';
import { ChatInput } from './components/ChatInput';
import { StatusIndicator } from './components/StatusIndicator';
import './styles.css';

const DEFAULT_CONFIG: ConductorConfig = {
  api: {
    baseUrl: 'http://localhost:5006',
    endpoint: '/api/v1/execute-direct',
    streamEndpoint: '/api/v1/stream-execute',
    apiKey: 'test-api-key-123',
    timeout: 30000,
    retryAttempts: 3
  },
  ui: {
    theme: 'gradient',
    animations: true,
    autoScroll: true,
    maxMessages: 100,
    messageDelay: 1000
  },
  chat: {
    welcomeMessage: 'Olá! Sou o Conductor Chat. Posso executar agentes de IA para você.',
    maxHistory: 50,
    saveHistory: true,
    clearOnStart: false
  },
  quickCommands: [
    {
      label: '📋 Listar Agentes',
      command: 'lista os agentes que vc tem?',
      description: 'Lista todos os agentes disponíveis'
    },
    {
      label: '✅ Validar Sistema',
      command: 'valida o sistema',
      description: 'Valida a configuração do sistema'
    },
    {
      label: '💾 Backup',
      command: 'backup dos agentes',
      description: 'Faz backup dos agentes'
    },
    {
      label: '🔧 Status',
      command: 'status do sistema',
      description: 'Verifica status do sistema'
    }
  ],
  specialCommands: {
    'limpar': {
      action: 'clearHistory',
      description: 'Limpa o histórico do chat'
    },
    'status': {
      action: 'checkConnection',
      description: 'Verifica status da conexão'
    },
    'ajuda': {
      action: 'showHelp',
      description: 'Mostra comandos disponíveis'
    }
  },
  production: {
    enableHttps: false,
    enableCors: true,
    enableRateLimit: false,
    enableLogging: true,
    logLevel: 'info'
  }
};

function App() {
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isConnected: false,
    isLoading: false
  });

  const config = (window as any).CONDUCTOR_WEB_CONFIG || DEFAULT_CONFIG;
  const { sendMessage, checkConnection } = useConductorApi(config.api);
  const { isRecording, toggleRecording, transcript } = useSpeechRecognition();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeChat();
    checkConnectionStatus();
    const interval = setInterval(checkConnectionStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (config.ui.autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatState.messages, config.ui.autoScroll]);

  useEffect(() => {
    if (transcript) {
      handleSendMessage(transcript);
    }
  }, [transcript]);

  const initializeChat = () => {
    const welcomeMessage: Message = {
      id: Date.now().toString(),
      content: config.chat.welcomeMessage,
      type: 'bot',
      timestamp: new Date()
    };

    setChatState(prev => ({
      ...prev,
      messages: [welcomeMessage]
    }));
  };

  const checkConnectionStatus = async () => {
    try {
      const isConnected = await checkConnection();
      setChatState(prev => ({ ...prev, isConnected }));
    } catch (error) {
      setChatState(prev => ({ ...prev, isConnected: false }));
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || chatState.isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      type: 'user',
      timestamp: new Date()
    };

    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true
    }));

    try {
      const response = await sendMessage(content.trim());

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.data || response.message || 'Resposta recebida',
        type: 'bot',
        timestamp: new Date()
      };

      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, botMessage],
        isLoading: false
      }));
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        type: 'bot',
        timestamp: new Date()
      };

      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        isLoading: false
      }));
    }
  };


  return (
    <div className="container">
      <header className="header">
        <h1>🤖 Conductor</h1>
        <StatusIndicator
          isConnected={chatState.isConnected}
          isLoading={chatState.isLoading}
        />
      </header>

      <div className="chat-container">
        <ChatMessages
          messages={chatState.messages}
          isLoading={chatState.isLoading}
        />
        <div ref={messagesEndRef} />

        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={chatState.isLoading}
          isRecording={isRecording}
          onToggleRecording={toggleRecording}
        />
      </div>

      <footer className="footer">
        <p>Conductor Gateway v3.1.0 | Powered by FastAPI + MCP</p>
      </footer>
    </div>
  );
}

export default App;