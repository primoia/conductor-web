# 🌐 Conductor Web Chat

**Modern web interface for interacting with Conductor AI agents via API**

## 📖 What is it?

`conductor-web` is a modern, responsive web interface that allows you to interact with the Conductor Gateway through an intuitive chat interface. It connects to the `conductor_gateway` API and enables visual and interactive execution of AI agents.

## 🚀 Features

### **💬 Interactive Chat**
- Modern and responsive chat interface
- Persistent conversation history
- Real-time connection status
- Quick action buttons
- Voice recognition support (Portuguese)

### **🤖 Conductor Integration**
- AI agent execution
- List available agents
- System backup and validation
- Special commands support

### **🎨 Modern Interface**
- Responsive design (mobile-friendly)
- Modern gradient theme
- Smooth animations
- Custom scrollbar
- TypeScript support

## 🏗️ Architecture

This project is built with modern web technologies:

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **Custom Hooks** - Reusable logic
- **Component Architecture** - Modular design

## 🛠️ Prerequisites

- **Node.js** >= 16.0.0
- **npm** >= 8.0.0
- **Conductor Gateway** running on port 5006

## 📦 Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd conductor-web
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure the API:**
   Edit `config.js` to set your Conductor Gateway URL:
   ```javascript
   const CONDUCTOR_WEB_CONFIG = {
     api: {
       baseUrl: 'http://localhost:5006', // Your gateway URL
       apiKey: 'your-api-key'
     }
   };
   ```

## 🚀 Usage

### **Development Mode**
```bash
npm run dev
```
Access: http://localhost:3000

### **Production Build**
```bash
npm run build
npm run preview
```

### **Type Checking**
```bash
npm run typecheck
```

### **Linting**
```bash
npm run lint
npm run lint:fix
```

## 📱 Available Commands

### **Agent Commands**
- `lista os agentes que vc tem?` - List available agents
- `execute agente [name] com [task]` - Execute an agent
- `backup dos agentes` - Backup agents
- `valida o sistema` - Validate system

### **Special Commands**
- `limpar` - Clear chat history
- `status` - Check connection status
- `ajuda` - Show help

## 🔧 Configuration

The application can be configured via `config.js`:

```javascript
const CONDUCTOR_WEB_CONFIG = {
  api: {
    baseUrl: 'http://localhost:5006',
    endpoint: '/execute',
    apiKey: 'your-api-key',
    timeout: 600000 // 10 minutes for long-running AI operations
  },
  ui: {
    theme: 'gradient',
    animations: true,
    autoScroll: true,
    maxMessages: 100
  },
  chat: {
    welcomeMessage: 'Hello! I am Conductor Chat...',
    maxHistory: 50,
    saveHistory: true
  }
};
```

## 🌐 Browser Support

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## 📱 Mobile Support

The interface is fully responsive and optimized for:
- iOS Safari
- Android Chrome
- Progressive Web App (PWA) capabilities

## 🔒 Security

- API key authentication
- CORS configuration
- Input sanitization
- TypeScript type safety

## 🛣️ Project Structure

```
conductor-web/
├── src/
│   ├── components/     # React components
│   ├── hooks/          # Custom hooks
│   ├── types/          # TypeScript definitions
│   ├── utils/          # Utility functions
│   ├── App.tsx         # Main application
│   └── main.tsx        # Entry point
├── public/             # Static assets
├── config.js           # Configuration
└── package.json        # Dependencies
```

## 🔄 API Integration

The application integrates with Conductor Gateway via:

- **REST API** - Direct execution
- **WebSocket** - Real-time updates (future)
- **SSE** - Server-sent events (future)

## 🚀 Deployment

### **Static Hosting**
```bash
npm run build
# Deploy 'dist' folder to your hosting service
```

### **Docker** (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

## 🧪 Testing

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Build test
npm run build
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- [Conductor Gateway](../conductor-gateway) - Backend API
- [Conductor Core](../conductor-core) - Core agent system

## 📞 Support

For support and questions:
- Create an issue in this repository
- Check the [documentation](https://docs.conductor.ai)
- Join our [Discord community](https://discord.gg/conductor)

---

**Built with ❤️ by the Primoia Team**

*Powered by FastAPI + MCP + React*