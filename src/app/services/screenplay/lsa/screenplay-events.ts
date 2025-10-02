// Interface base para todos os eventos do screenplay
export interface ScreenplayEvent {
  id: string; // UUID para o evento
  timestamp: number;
  type: string; // Ex: 'TITLE_ADDED', 'TEXT_CHANGED'
  payload: any;
}

// Exemplo de um evento específico para o nosso MVP
export interface TitleAddedEventPayload {
  title: string;
  position: number;
}

// Função helper para criar um evento tipado
export function createEvent<T>(
  type: string,
  payload: T
): ScreenplayEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    type,
    payload,
  };
}
