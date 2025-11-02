export const environment = {
  production: false,
  apiUrl: '',  // Usa proxy nginx - rotas já têm /api/

  // 🔥 FEATURE FLAGS
  features: {
    // Usar modelo de conversas globais (conversation_id) em vez de históricos isolados (instance_id)
    // Ref: PLANO_REFATORACAO_CONVERSATION_ID.md - Fase 2
    useConversationModel: true  // true = novo modelo, false = modelo legado
  }
};