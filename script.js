// Configurações da API - usar config.js se disponível
const API_CONFIG = window.CONDUCTOR_WEB_CONFIG?.api || {
    baseUrl: 'http://192.168.0.119:5006', // IP atual da máquina
    endpoint: '/api/v1/execute-direct',  // Endpoint direto (fallback)
    streamEndpoint: '/api/v1/stream-execute',    // Novo endpoint SSE híbrido
    apiKey: 'test-api-key-123' // Em produção, usar variável de ambiente
};

// Feature flags
const FEATURE_FLAGS = {
    enableSSE: true,  // Habilitar SSE streaming por padrão
    fallbackToHTTP: true  // Fallback automático para HTTP se SSE falhar
};

// Estado do chat
let isConnected = false;
let messageHistory = [];

// Estado do reconhecimento de voz
let recognition = null;
let isRecording = false;
let recognitionTimeout = null;

// Elementos DOM
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const sendButtonText = document.getElementById('sendButtonText');
const sendButtonSpinner = document.getElementById('sendButtonSpinner');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const micButton = document.getElementById('micButton');
const micIcon = document.getElementById('micIcon');

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeChat();
    setupEventListeners();
    checkConnection();
    setupMobileOptimizations();
});

// Configurar event listeners
function setupEventListeners() {
    // Enter para enviar mensagem
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize do input
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    });
}

// Inicializar chat
function initializeChat() {
    updateStatus('connecting', 'Conectando...');

    // Carregar histórico do localStorage
    loadMessageHistory();

    // Verificar conexão
    checkConnection();

    // Inicializar reconhecimento de voz
    initializeSpeechRecognition();
}

// Verificar conexão com a API
async function checkConnection() {
    try {
        const response = await fetch(`${API_CONFIG.baseUrl}/health`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            updateStatus('connected', 'Conectado');
            isConnected = true;
        } else {
            updateStatus('disconnected', 'Erro de conexão');
            isConnected = false;
        }
    } catch (error) {
        updateStatus('disconnected', 'Servidor offline');
        isConnected = false;
        console.error('Erro de conexão:', error);
    }
}

// Atualizar status da conexão
function updateStatus(status, text) {
    statusIndicator.className = `status-indicator ${status}`;
    statusText.textContent = text;
}

// Enviar mensagem - Plan2 Hybrid REST + EventSource implementation
async function sendMessage() {
    const message = messageInput.value.trim();

    if (!message) return;

    if (!isConnected) {
        addMessage('bot', '❌ Erro: Não conectado ao servidor. Verifique se o Conductor Gateway está rodando.');
        return;
    }

    // Adicionar mensagem do usuário
    addMessage('user', message);
    messageInput.value = '';

    // Tentar SSE streaming primeiro, depois fallback para HTTP
    if (FEATURE_FLAGS.enableSSE && isEventSourceSupported()) {
        try {
            await sendMessageSSE(message);
        } catch (error) {
            console.warn('SSE failed, falling back to HTTP:', error);
            if (FEATURE_FLAGS.fallbackToHTTP) {
                await sendMessageHTTP(message);
            } else {
                addMessage('bot', `❌ Erro SSE: ${error.message}`);
            }
        }
    } else {
        await sendMessageHTTP(message);
    }
}

// Nova implementação SSE seguindo Plan2 - Hybrid REST + EventSource
async function sendMessageSSE(message) {
    setLoading(true);

    try {
        const payload = {
            uid: Date.now().toString(),
            title: "Stream Message",
            textEntries: [{
                uid: "1",
                content: message
            }],
            targetType: "conductor",
            isTemplate: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        // ETAPA 1: POST para iniciar execução e obter job_id
        console.log('Iniciando execução streaming...');
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.streamEndpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_CONFIG.apiKey
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const { job_id, stream_url } = await response.json();

        if (!job_id) {
            throw new Error('Não foi possível obter job_id do servidor');
        }

        console.log(`Job iniciado: ${job_id}, conectando ao stream...`);

        // ETAPA 2: EventSource para receber stream de eventos
        const eventSource = new EventSource(`${API_CONFIG.baseUrl}/api/v1/stream/${job_id}`);

        let streamStarted = false;
        let fullBotMessage = '';
        let lastBotMessageElement = null;

        eventSource.onopen = function() {
            console.log(`SSE connection opened for job ${job_id}`);
            updateStatus('connected', 'Streaming conectado');
        };

        eventSource.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                console.log('SSE Event received:', data.event, data);

                if (!streamStarted) {
                    setLoading(false);
                    streamStarted = true;
                }

                handleStreamEvent(data);

            } catch (e) {
                console.error('Erro ao processar evento SSE:', e);
            }
        };

        eventSource.onerror = function(error) {
            console.error('SSE connection error:', error);
            eventSource.close();
            setLoading(false);

            if (!streamStarted) {
                addMessage('bot', '❌ Erro de conexão SSE. Tentando fallback...');
                throw new Error('SSE connection failed');
            }
        };

        // Listener específico para end_of_stream
        eventSource.addEventListener('end_of_stream', function() {
            console.log(`End of stream reached for job ${job_id}`);
            eventSource.close();
            setLoading(false);
            saveMessageHistory();
        });

    } catch (error) {
        setLoading(false);
        throw error;
    }
}

// Função original mantida como fallback
async function sendMessageHTTP(message) {
    setLoading(true);

    try {
        console.log('Using HTTP fallback...');
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_CONFIG.apiKey
            },
            body: JSON.stringify({
                uid: Date.now().toString(),
                title: "Chat Message",
                textEntries: [{
                    uid: "1",
                    content: message
                }],
                targetType: "conductor",
                isTemplate: false,
                createdAt: Date.now(),
                updatedAt: Date.now()
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        // Processar resposta do endpoint direto
        let botMessage = '';

        if (result.message) {
            botMessage = result.message;
        } else if (result.response) {
            botMessage = result.response;
        } else if (result.error) {
            botMessage = `❌ Erro: ${result.error}`;
        } else if (result.result) {
            botMessage = result.result;
        } else {
            botMessage = '✅ Comando executado com sucesso!';
        }

        addMessage('bot', botMessage);
        saveMessageHistory();

    } catch (error) {
        console.error('Erro ao enviar mensagem HTTP:', error);
        addMessage('bot', `❌ Erro: ${error.message}`);
    } finally {
        setLoading(false);
    }
}

// Handler para processar eventos SSE em tempo real
function handleStreamEvent(eventData) {
    const { event, data, timestamp, job_id } = eventData;

    switch (event) {
        case 'job_started':
            addProgressMessage('🚀 Iniciando execução...');
            break;

        case 'status_update':
            updateProgressMessage(data.message);
            break;

        case 'on_llm_start':
            updateProgressMessage('🤖 LLM iniciando análise...');
            break;

        case 'on_llm_new_token':
            // Streaming de tokens do LLM
            if (data && data.chunk) {
                appendToLastBotMessage(data.chunk);
            }
            break;

        case 'on_tool_start':
            if (data && data.tool) {
                updateProgressMessage(`🔧 Usando ferramenta: ${data.tool.name || data.tool}...`);
            }
            break;

        case 'on_tool_end':
            if (data && data.output) {
                addMessage('system', `⚙️ Ferramenta concluída: ${data.output.substring(0, 100)}...`);
            }
            break;

        case 'result':
            clearProgressMessage();
            if (data && data.result) {
                addMessage('bot', data.result);
            }
            break;

        case 'error':
            clearProgressMessage();
            addMessage('bot', `❌ Erro: ${data.error || data.message}`);
            break;

        case 'end_of_stream':
            clearProgressMessage();
            break;

        default:
            console.log('Unhandled SSE event:', event, data);
    }
}

// Utility functions for SSE support
function isEventSourceSupported() {
    return typeof(EventSource) !== "undefined";
}

let progressMessageElement = null;

function addProgressMessage(text) {
    clearProgressMessage(); // Remove anterior
    progressMessageElement = document.createElement('div');
    progressMessageElement.className = 'message bot-message progress-message';
    progressMessageElement.innerHTML = `<div class="message-content"><em>${escapeHtml(text)}</em></div>`;
    chatMessages.appendChild(progressMessageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateProgressMessage(text) {
    if (progressMessageElement) {
        progressMessageElement.innerHTML = `<div class="message-content"><em>${escapeHtml(text)}</em></div>`;
    } else {
        addProgressMessage(text);
    }
}

function clearProgressMessage() {
    if (progressMessageElement) {
        progressMessageElement.remove();
        progressMessageElement = null;
    }
}

let lastBotMessageElement = null;

function appendToLastBotMessage(token) {
    // Encontrar ou criar última mensagem do bot
    if (!lastBotMessageElement) {
        lastBotMessageElement = document.createElement('div');
        lastBotMessageElement.className = 'message bot-message';
        lastBotMessageElement.innerHTML = '<div class="message-content"><strong>Conductor:</strong> </div>';
        chatMessages.appendChild(lastBotMessageElement);
    }

    // Adicionar token
    const contentDiv = lastBotMessageElement.querySelector('.message-content');
    contentDiv.innerHTML += escapeHtml(token);

    // Scroll automático
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Enviar mensagem rápida
function sendQuickMessage(message) {
    messageInput.value = message;
    sendMessage();
}

// Adicionar mensagem ao chat
function addMessage(type, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (type === 'user') {
        contentDiv.innerHTML = `<strong>Você:</strong> ${escapeHtml(content)}`;
    } else {
        contentDiv.innerHTML = `<strong>Conductor:</strong> ${formatBotMessage(content)}`;
    }
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    
    // Scroll para baixo
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Salvar no histórico
    messageHistory.push({ type, content, timestamp: Date.now() });
}

// Formatar mensagem do bot
function formatBotMessage(content) {
    // Escapar HTML
    content = escapeHtml(content);
    
    // Converter quebras de linha
    content = content.replace(/\n/g, '<br>');
    
    // Destacar códigos
    content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Destacar comandos
    content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    return content;
}

// Escapar HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Mostrar/ocultar loading
function setLoading(loading) {
    sendButton.disabled = loading;
    sendButtonText.style.display = loading ? 'none' : 'inline';
    sendButtonSpinner.style.display = loading ? 'inline' : 'none';
}

// Salvar histórico no localStorage
function saveMessageHistory() {
    try {
        localStorage.setItem('conductorChatHistory', JSON.stringify(messageHistory));
    } catch (error) {
        console.error('Erro ao salvar histórico:', error);
    }
}

// Carregar histórico do localStorage
function loadMessageHistory() {
    try {
        const saved = localStorage.getItem('conductorChatHistory');
        if (saved) {
            messageHistory = JSON.parse(saved);
            
            // Mostrar apenas as últimas 10 mensagens
            const recentMessages = messageHistory.slice(-10);
            
            // Limpar chat atual
            chatMessages.innerHTML = '';
            
            // Adicionar mensagens do histórico
            recentMessages.forEach(msg => {
                addMessage(msg.type, msg.content);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
    }
}

// Limpar histórico
function clearHistory() {
    if (confirm('Tem certeza que deseja limpar o histórico do chat?')) {
        messageHistory = [];
        localStorage.removeItem('conductorChatHistory');
        chatMessages.innerHTML = '';
        addMessage('bot', 'Histórico limpo! Como posso ajudar?');
    }
}

// Verificar conexão periodicamente
setInterval(checkConnection, 30000); // A cada 30 segundos

// Comandos especiais
function handleSpecialCommands(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('limpar') || lowerMessage.includes('clear')) {
        clearHistory();
        return true;
    }
    
    if (lowerMessage.includes('status') || lowerMessage.includes('conexão')) {
        checkConnection();
        return true;
    }
    
    return false;
}

// Adicionar comandos especiais ao input
messageInput.addEventListener('input', function() {
    const message = this.value.toLowerCase();
    
    if (message.includes('limpar') || message.includes('clear')) {
        this.style.borderColor = '#e74c3c';
    } else {
        this.style.borderColor = '#e9ecef';
    }
});

// ====================================
// RECONHECIMENTO DE VOZ (Web Speech API)
// ====================================

function initializeSpeechRecognition() {
    // Verificar se o navegador suporta Web Speech API
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.warn('Web Speech API não suportada neste navegador');
        hideMicrophoneButton();
        return;
    }

    // Verificar se é mobile e o suporte é limitado
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOSMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroidMobile = /Android/i.test(navigator.userAgent);

    // iOS não suporta Web Speech API no Safari
    if (isIOSMobile) {
        console.warn('Web Speech API não suportada no iOS Safari');
        hideMicrophoneButton();
        return;
    }

    // Firefox mobile tem suporte limitado
    const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
    if (isMobile && isFirefox) {
        console.warn('Web Speech API limitada no Firefox mobile');
        hideMicrophoneButton();
        return;
    }

    // Chrome mobile Android tem problemas de permissão e funcionamento
    const isChromeMobile = isMobile && navigator.userAgent.toLowerCase().indexOf('chrome') > -1;
    if (isChromeMobile && isAndroidMobile) {
        console.warn('Web Speech API problemática no Chrome Android - ocultando microfone');
        hideMicrophoneButton();
        return;
    }

    // Criar instância do reconhecimento
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    try {
        recognition = new SpeechRecognition();
    } catch (error) {
        console.error('Erro ao criar instância do SpeechRecognition:', error);
        hideMicrophoneButton();
        return;
    }

    // Configurar reconhecimento
    recognition.lang = 'pt-BR'; // Português brasileiro
    recognition.continuous = false; // Para quando detecta pausa
    recognition.interimResults = true; // Mostra resultados parciais
    recognition.maxAlternatives = 1;

    // Event listeners
    recognition.onstart = function() {
        isRecording = true;
        micButton.classList.add('recording');
        micIcon.textContent = '🔴';
        micButton.title = 'Gravando... Clique para parar';
        console.log('Reconhecimento de voz iniciado');

        // Timeout de segurança - parar após 15 segundos no mobile
        if (recognitionTimeout) {
            clearTimeout(recognitionTimeout);
        }
        recognitionTimeout = setTimeout(() => {
            if (isRecording) {
                console.log('Timeout do reconhecimento de voz - parando automaticamente');
                try {
                    recognition.stop();
                } catch (e) {
                    console.error('Erro ao parar reconhecimento por timeout:', e);
                }
            }
        }, 15000);
    };

    recognition.onresult = function(event) {
        let transcript = '';

        // Processar resultados
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) {
                transcript += result[0].transcript;
            } else {
                // Resultado parcial - mostrar em tempo real
                transcript += result[0].transcript;
            }
        }

        // Atualizar input com texto reconhecido
        if (transcript.trim()) {
            messageInput.value = transcript.trim();

            // Auto-resize do input
            messageInput.style.height = 'auto';
            messageInput.style.height = messageInput.scrollHeight + 'px';
        }
    };

    recognition.onend = function() {
        isRecording = false;
        micButton.classList.remove('recording');
        micIcon.textContent = '🎤';
        micButton.title = 'Clique para falar';
        console.log('Reconhecimento de voz finalizado');

        // Limpar timeout
        if (recognitionTimeout) {
            clearTimeout(recognitionTimeout);
            recognitionTimeout = null;
        }

        // Se há texto no input, focar nele para possível edição
        if (messageInput.value.trim()) {
            messageInput.focus();
        }
    };

    recognition.onerror = function(event) {
        isRecording = false;
        micButton.classList.remove('recording');
        micIcon.textContent = '🎤';
        micButton.title = 'Clique para falar';

        // Limpar timeout
        if (recognitionTimeout) {
            clearTimeout(recognitionTimeout);
            recognitionTimeout = null;
        }

        console.error('Erro no reconhecimento de voz:', event.error);

        // Mostrar mensagem de erro amigável
        let errorMessage = 'Erro no reconhecimento de voz';
        switch (event.error) {
            case 'no-speech':
                errorMessage = '🎤 Nenhuma fala detectada. Tente novamente.';
                break;
            case 'audio-capture':
                errorMessage = '🎤 Erro no microfone. Verifique as permissões.';
                break;
            case 'not-allowed':
                errorMessage = '🎤 Permissão negada. Permita acesso ao microfone.';
                break;
            case 'network':
                errorMessage = '🎤 Erro de rede. Verifique sua conexão.';
                break;
        }

        // Mostrar temporariamente no placeholder
        const originalPlaceholder = messageInput.placeholder;
        messageInput.placeholder = errorMessage;
        setTimeout(() => {
            messageInput.placeholder = originalPlaceholder;
        }, 3000);
    };

    console.log('Reconhecimento de voz inicializado com sucesso');
}

function toggleSpeechRecognition() {
    if (!recognition) {
        // Verificar se o microfone deve estar visível
        if (micButton.style.display !== 'none') {
            console.log('Tentando reinicializar reconhecimento de voz...');
            initializeSpeechRecognition();

            if (!recognition) {
                micButton.title = 'Reconhecimento de voz não disponível';
                micButton.disabled = true;
                micButton.style.opacity = '0.5';
                return;
            }
        } else {
            return;
        }
    }

    if (isRecording) {
        // Parar gravação
        try {
            recognition.stop();
        } catch (error) {
            console.error('Erro ao parar reconhecimento:', error);
            isRecording = false;
            micButton.classList.remove('recording');
            micIcon.textContent = '🎤';
        }
    } else {
        // Verificar permissões antes de iniciar
        if (navigator.permissions) {
            navigator.permissions.query({ name: 'microphone' }).then(function(result) {
                if (result.state === 'denied') {
                    micButton.title = 'Permissão do microfone negada';
                    const originalPlaceholder = messageInput.placeholder;
                    messageInput.placeholder = '🎤 Permissão do microfone negada';
                    setTimeout(() => {
                        messageInput.placeholder = originalPlaceholder;
                    }, 3000);
                    return;
                }
                startRecognition();
            }).catch(() => {
                // Fallback se permissions API não estiver disponível
                startRecognition();
            });
        } else {
            startRecognition();
        }
    }
}

function startRecognition() {
    try {
        recognition.start();
    } catch (error) {
        console.error('Erro ao iniciar reconhecimento:', error);

        // Feedback visual
        const originalPlaceholder = messageInput.placeholder;
        let errorMsg = '🎤 Erro no reconhecimento de voz';

        if (error.name === 'InvalidStateError') {
            errorMsg = '🎤 Reconhecimento já em andamento';
        } else if (error.name === 'NotAllowedError') {
            errorMsg = '🎤 Permissão do microfone negada';
        }

        messageInput.placeholder = errorMsg;
        setTimeout(() => {
            messageInput.placeholder = originalPlaceholder;
        }, 3000);
    }
}

function hideMicrophoneButton() {
    const micButton = document.getElementById('micButton');
    if (micButton) {
        micButton.style.display = 'none';
        console.log('Botão do microfone ocultado - Web Speech API não suportada');

        // Ajustar layout quando microfone está oculto
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');

        if (messageInput && sendButton) {
            // Aumentar espaço do input quando microfone está oculto
            messageInput.style.maxWidth = 'calc(100vw - 90px)';
            sendButton.style.width = '70px';
        }
    }
}

// Função para envio rápido após reconhecimento de voz
function quickSendAfterSpeech() {
    if (messageInput.value.trim()) {
        sendMessage();
    }
}

// Atalho de teclado para microfone (Ctrl + M ou Cmd + M)
document.addEventListener('keydown', function(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'm') {
        event.preventDefault();
        toggleSpeechRecognition();
    }
});

// ====================================
// OTIMIZAÇÕES MOBILE
// ====================================

function setupMobileOptimizations() {
    // Detectar se é mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (!isMobile) return;

    console.log('Aplicando otimizações mobile');

    // Prevenir zoom ao focar no input
    messageInput.addEventListener('focus', function() {
        // Scroll para cima para garantir que o input seja visível
        setTimeout(() => {
            this.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    });

    // Ajustar viewport ao mostrar/ocultar teclado
    let initialViewportHeight = window.innerHeight;

    window.addEventListener('resize', function() {
        const currentHeight = window.innerHeight;
        const heightDifference = initialViewportHeight - currentHeight;

        // Se a altura diminuiu muito, provavelmente o teclado apareceu
        if (heightDifference > 150) {
            console.log('Teclado virtual detectado');
            document.body.style.height = currentHeight + 'px';

            // Ajustar área de chat
            const chatContainer = document.querySelector('.chat-container');
            if (chatContainer) {
                chatContainer.style.height = 'calc(100vh - 160px)';
            }
        } else {
            // Teclado foi ocultado
            document.body.style.height = '100vh';

            const chatContainer = document.querySelector('.chat-container');
            if (chatContainer) {
                chatContainer.style.height = 'calc(100vh - 120px)';
            }
        }
    });

    // Prevenir scroll da página quando teclado aparece
    document.addEventListener('touchmove', function(e) {
        if (e.target === messageInput) return;
        e.preventDefault();
    }, { passive: false });

    // Forçar scroll para baixo após enviar mensagem
    const originalSendMessage = window.sendMessage;
    window.sendMessage = function() {
        originalSendMessage();
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 100);
    };
}

// Exportar funções para uso global
window.sendMessage = sendMessage;
window.sendQuickMessage = sendQuickMessage;
window.clearHistory = clearHistory;
window.toggleSpeechRecognition = toggleSpeechRecognition;
