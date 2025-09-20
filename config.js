// Configurações do Conductor Web Chat
const CONDUCTOR_WEB_CONFIG = {
    // Configurações da API
    api: {
        baseUrl: 'http://localhost:5006',
        endpoint: '/api/v1/execute-direct',  // Endpoint direto
        apiKey: 'test-api-key-123',
        timeout: 30000, // 30 segundos
        retryAttempts: 3
    },
    
    // Configurações da Interface
    ui: {
        theme: 'gradient', // 'gradient', 'dark', 'light'
        animations: true,
        autoScroll: true,
        maxMessages: 100,
        messageDelay: 1000 // Delay entre mensagens (ms)
    },
    
    // Configurações do Chat
    chat: {
        welcomeMessage: 'Olá! Sou o Conductor Chat. Posso executar agentes de IA para você.',
        maxHistory: 50,
        saveHistory: true,
        clearOnStart: false
    },
    
    // Comandos Rápidos
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
    
    // Comandos Especiais
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
    
    // Configurações de Produção
    production: {
        enableHttps: false,
        enableCors: true,
        enableRateLimit: false,
        enableLogging: true,
        logLevel: 'info' // 'debug', 'info', 'warn', 'error'
    }
};

// Exportar configurações
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONDUCTOR_WEB_CONFIG;
} else {
    window.CONDUCTOR_WEB_CONFIG = CONDUCTOR_WEB_CONFIG;
}
