export const environment = {
  production: true,
  apiUrl: '/api',  // Usa proxy nginx no Docker
  mediaStudioUrl: '',  // nginx proxy

  // 🔥 FEATURE FLAGS
  features: {
    useConversationModel: true  // Modelo de conversas globais
  }
};

