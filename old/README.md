# 🌐 Conductor Web Chat

**Interface web para interagir com agentes de IA do Conductor via API**

## 📖 O que é?

O `conductor_web` é uma interface web moderna e responsiva que permite interagir com o Conductor Gateway através de um chat intuitivo. Ele se conecta à API do `conductor_gateway` e permite executar agentes de IA de forma visual e interativa.

## 🚀 Funcionalidades

### **💬 Chat Interativo**
- Interface de chat moderna e responsiva
- Histórico de conversas persistente
- Status de conexão em tempo real
- Botões de ação rápida

### **🤖 Integração com Conductor**
- Execução de agentes de IA
- Listagem de agentes disponíveis
- Backup e validação do sistema
- Comandos especiais

### **🎨 Interface Moderna**
- Design responsivo (mobile-friendly)
- Tema gradiente moderno
- Animações suaves
- Scrollbar personalizada

## 🏗️ Arquitetura

```
Browser (Frontend)
    ↓ HTTP POST
Conductor Gateway API
    ↓ MCP Protocol
Conductor Tools
    ↓ subprocess
Agentes IA (PC)
```

## 📁 Estrutura

```
conductor_web/
├── README.md          # Este arquivo
├── index.html         # Interface principal
├── style.css          # Estilos CSS
└── script.js          # Lógica JavaScript
```

## 🚀 Como usar

### **1. Iniciar o Conductor Gateway**
```bash
cd conductor_gateway
python main.py
```

### **2. Abrir o Chat Web**
```bash
# Opção 1: Abrir diretamente no navegador
open conductor_web/index.html

# Opção 2: Servir via HTTP (recomendado)
cd conductor_web
python -m http.server 8080
# Acessar: http://localhost:8080
```

### **3. Usar o Chat**
- Digite comandos em português
- Use os botões de ação rápida
- Acompanhe o status de conexão
- Veja o histórico de conversas

## 💬 Comandos Disponíveis

### **Comandos Básicos**
- `lista os agentes que vc tem?` - Lista agentes disponíveis
- `valida o sistema` - Valida o sistema Conductor
- `backup dos agentes` - Faz backup dos agentes

### **Execução de Agentes**
- `execute agente [nome] com [tarefa]` - Executa um agente específico
- `crie um agente para [função]` - Cria um novo agente
- `revise este código: [código]` - Usa agente de revisão

### **Comandos Especiais**
- `limpar` - Limpa o histórico do chat
- `status` - Verifica status da conexão

## ⚙️ Configuração

### **API Configuration (script.js)**
```javascript
const API_CONFIG = {
    baseUrl: 'http://localhost:5006',        // URL do Conductor Gateway
    endpoint: '/api/v1/execute',             // Endpoint da API
    apiKey: 'test-api-key-123'               // Chave de API
};
```

### **Personalização**
- **Cores**: Editar variáveis CSS em `style.css`
- **Comandos**: Adicionar novos em `script.js`
- **API**: Alterar configurações em `API_CONFIG`

## 🔧 Funcionalidades Técnicas

### **Frontend**
- ✅ **HTML5**: Estrutura semântica
- ✅ **CSS3**: Estilos modernos com gradientes
- ✅ **JavaScript ES6**: Lógica assíncrona
- ✅ **LocalStorage**: Persistência de histórico
- ✅ **Responsive**: Design mobile-first

### **Integração**
- ✅ **API REST**: Comunicação com Conductor Gateway
- ✅ **Autenticação**: API Key validation
- ✅ **Error Handling**: Tratamento de erros
- ✅ **Status Monitoring**: Verificação de conexão
- ✅ **Real-time**: Atualizações automáticas

### **UX/UI**
- ✅ **Loading States**: Indicadores de carregamento
- ✅ **Quick Actions**: Botões de ação rápida
- ✅ **Message History**: Histórico persistente
- ✅ **Auto-scroll**: Scroll automático
- ✅ **Keyboard Shortcuts**: Enter para enviar

## 🎨 Customização

### **Cores do Tema**
```css
/* Gradiente principal */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Cores dos botões */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

### **Adicionar Novos Comandos**
```javascript
// Em script.js
function handleSpecialCommands(message) {
    if (message.includes('novo comando')) {
        // Lógica do comando
        return true;
    }
    return false;
}
```

### **Personalizar Botões Rápidos**
```html
<!-- Em index.html -->
<button class="quick-btn" onclick="sendQuickMessage('seu comando')">
    🎯 Seu Botão
</button>
```

## 🚨 Troubleshooting

### **Erro de Conexão**
- Verificar se o Conductor Gateway está rodando
- Confirmar URL da API em `script.js`
- Verificar chave de API

### **CORS Issues**
- Usar servidor HTTP local
- Configurar CORS no Conductor Gateway
- Usar proxy se necessário

### **Comandos Não Funcionam**
- Verificar se está no modo avançado
- Confirmar se o Conductor está configurado
- Verificar logs do Conductor Gateway

## 🔒 Segurança

### **Medidas Implementadas**
- ✅ **API Key**: Autenticação obrigatória
- ✅ **Input Validation**: Sanitização de entrada
- ✅ **XSS Protection**: Escape de HTML
- ✅ **HTTPS Ready**: Preparado para SSL

### **Recomendações**
- Usar HTTPS em produção
- Configurar rate limiting
- Monitorar logs de acesso
- Implementar autenticação de usuários

## 📈 Próximos Passos

### **Funcionalidades Avançadas**
- [ ] **WebSocket**: Chat em tempo real
- [ ] **File Upload**: Envio de arquivos
- [ ] **User Authentication**: Login de usuários
- [ ] **Admin Dashboard**: Painel administrativo
- [ ] **Analytics**: Métricas de uso

### **Melhorias Técnicas**
- [ ] **PWA**: Progressive Web App
- [ ] **Offline Mode**: Funcionamento offline
- [ ] **Push Notifications**: Notificações push
- [ ] **Dark Mode**: Tema escuro
- [ ] **Multi-language**: Suporte a idiomas

## 🎯 Casos de Uso

### **Desenvolvimento**
- Executar agentes de revisão de código
- Gerar documentação automaticamente
- Validar configurações do sistema

### **Automação**
- Backup automático de agentes
- Monitoramento de sistema
- Execução de workflows

### **Integração**
- Slack/Discord bots
- CI/CD pipelines
- Ferramentas de desenvolvimento

---

**Interface**: HTML5 + CSS3 + JavaScript ES6  
**Backend**: Conductor Gateway (FastAPI + MCP)  
**Versão**: 1.0.0  
**Última atualização**: 2025-01-27
