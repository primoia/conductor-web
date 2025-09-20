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
    endpoint: '/execute',
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

  const [progressMessage, setProgressMessage] = useState<Message | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);

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

  const addProgressMessage = (text: string) => {
    const progress: Message = {
      id: `progress-${Date.now()}`,
      content: text,
      type: 'bot',
      timestamp: new Date()
    };
    setProgressMessage(progress);
  };

  const updateProgressMessage = (text: string) => {
    if (progressMessage) {
      setProgressMessage(prev => prev ? { ...prev, content: text } : null);
    } else {
      addProgressMessage(text);
    }
  };

  const clearProgressMessage = () => {
    setProgressMessage(null);
  };

  const appendToStreamingMessage = (token: string) => {
    if (!streamingMessage) {
      const newMessage: Message = {
        id: `stream-${Date.now()}`,
        content: token,
        type: 'bot',
        timestamp: new Date()
      };
      setStreamingMessage(newMessage);
    } else {
      setStreamingMessage(prev => prev ? { ...prev, content: prev.content + token } : null);
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

    // Clear any existing progress/streaming messages
    clearProgressMessage();
    setStreamingMessage(null);

    try {
      const response = await sendMessage(content.trim(), (event) => {
        console.log('Progress event:', event);

        switch (event.event) {
          case 'job_started':
            addProgressMessage('🚀 Iniciando execução...');
            break;
          case 'status_update':
            updateProgressMessage(event.data?.message || 'Processando...');
            break;
          case 'on_llm_start':
            updateProgressMessage('🤖 LLM iniciando análise...');
            break;
          case 'on_llm_new_token':
            if (event.data?.chunk) {
              appendToStreamingMessage(event.data.chunk);
            }
            break;
          case 'on_tool_start':
            if (event.data?.tool) {
              updateProgressMessage(`🔧 Usando ferramenta: ${event.data.tool.name || event.data.tool}...`);
            }
            break;
          case 'on_tool_end':
            if (event.data?.output) {
              const toolResult = event.data.output.substring(0, 100) + '...';
              setChatState(prev => ({
                ...prev,
                messages: [...prev.messages, {
                  id: `tool-${Date.now()}`,
                  content: `⚙️ Ferramenta concluída: ${toolResult}`,
                  type: 'bot',
                  timestamp: new Date()
                }]
              }));
            }
            break;
          case 'result':
            clearProgressMessage();
            break;
          case 'error':
            clearProgressMessage();
            break;
        }
      });

      // Clear progress and add final result
      clearProgressMessage();

      // If we have a streaming message, finalize it
      if (streamingMessage) {
        setChatState(prev => ({
          ...prev,
          messages: [...prev.messages, streamingMessage],
          isLoading: false
        }));
        setStreamingMessage(null);
      } else {
        // Add final result message
        const finalMessage: Message = {
          id: `final-${Date.now()}`,
          content: response.data || response.message || 'Execução concluída',
          type: 'bot',
          timestamp: new Date()
        };

        setChatState(prev => ({
          ...prev,
          messages: [...prev.messages, finalMessage],
          isLoading: false
        }));
      }
    } catch (error) {
      clearProgressMessage();
      setStreamingMessage(null);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `❌ Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
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