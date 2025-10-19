import { Injectable } from '@angular/core';
import { Observable, from, catchError, of } from 'rxjs';

/**
 * Interfaces para validação e estado de salvamento
 */
export interface ValidationState {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SaveState {
  status: 'idle' | 'saving' | 'saved' | 'error';
  message: string;
  timestamp?: Date;
}

/**
 * Serviço para gerenciamento de edição de persona
 * SAGA-008: Integração com Backend
 */
@Injectable({
  providedIn: 'root'
})
export class PersonaEditService {
  private readonly baseUrl = 'http://localhost:3000';
  private readonly STORAGE_PREFIX = 'persona-edit-';
  private readonly ORIGINAL_PREFIX = 'persona-original-';
  private readonly HISTORY_PREFIX = 'persona-history-';
  private readonly MAX_PERSONA_SIZE = 10 * 1024; // 10KB
  private readonly MAX_HISTORY_SIZE = 5;

  /**
   * Salva a persona editada para uma instância específica
   * @param instanceId - ID da instância do agente
   * @param persona - Texto da persona editada
   */
  savePersona(instanceId: string, persona: string): void {
    if (!instanceId || !persona) {
      console.warn('⚠️ [PersonaEditService] Tentativa de salvar persona com dados inválidos');
      return;
    }

    try {
      const key = this.STORAGE_PREFIX + instanceId;
      localStorage.setItem(key, persona);
      console.log('✅ [PersonaEditService] Persona salva:', { instanceId, personaLength: persona.length });
    } catch (error) {
      console.error('❌ [PersonaEditService] Erro ao salvar persona:', error);
    }
  }

  /**
   * Carrega a persona editada para uma instância específica
   * @param instanceId - ID da instância do agente
   * @returns Persona editada ou null se não existir
   */
  loadPersona(instanceId: string): string | null {
    if (!instanceId) {
      console.warn('⚠️ [PersonaEditService] Tentativa de carregar persona sem instanceId');
      return null;
    }

    try {
      const key = this.STORAGE_PREFIX + instanceId;
      const persona = localStorage.getItem(key);
      
      if (persona) {
        console.log('✅ [PersonaEditService] Persona carregada:', { instanceId, personaLength: persona.length });
        return persona;
      } else {
        console.log('ℹ️ [PersonaEditService] Nenhuma persona editada encontrada para:', instanceId);
        return null;
      }
    } catch (error) {
      console.error('❌ [PersonaEditService] Erro ao carregar persona:', error);
      return null;
    }
  }

  /**
   * Remove a persona editada para uma instância específica
   * @param instanceId - ID da instância do agente
   */
  clearPersona(instanceId: string): void {
    if (!instanceId) {
      console.warn('⚠️ [PersonaEditService] Tentativa de limpar persona sem instanceId');
      return;
    }

    try {
      const key = this.STORAGE_PREFIX + instanceId;
      localStorage.removeItem(key);
      console.log('✅ [PersonaEditService] Persona removida:', instanceId);
    } catch (error) {
      console.error('❌ [PersonaEditService] Erro ao remover persona:', error);
    }
  }

  /**
   * Verifica se existe uma persona editada para uma instância específica
   * @param instanceId - ID da instância do agente
   * @returns true se existe persona editada, false caso contrário
   */
  hasEditedPersona(instanceId: string): boolean {
    if (!instanceId) {
      return false;
    }

    try {
      const key = this.STORAGE_PREFIX + instanceId;
      const persona = localStorage.getItem(key);
      return persona !== null && persona.trim().length > 0;
    } catch (error) {
      console.error('❌ [PersonaEditService] Erro ao verificar persona:', error);
      return false;
    }
  }

  /**
   * Valida se o texto da persona é válido
   * @param persona - Texto da persona para validar
   * @returns true se válido, false caso contrário
   */
  validatePersona(persona: string): boolean {
    return Boolean(persona && persona.trim().length > 0);
  }

  /**
   * Validação avançada da persona com detalhes de erros e warnings
   * @param persona - Texto da persona para validar
   * @returns Estado de validação com erros e warnings
   */
  validatePersonaAdvanced(persona: string): ValidationState {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validação básica
    if (!persona || persona.trim().length === 0) {
      errors.push('Persona não pode estar vazia');
      return { isValid: false, errors, warnings };
    }

    // Validação de tamanho
    const size = this.getPersonaSize(persona);
    if (size > this.MAX_PERSONA_SIZE) {
      errors.push(`Persona muito grande (${Math.round(size / 1024)}KB). Máximo: ${this.MAX_PERSONA_SIZE / 1024}KB`);
    }

    // Warnings
    if (size > this.MAX_PERSONA_SIZE * 0.8) {
      warnings.push('Persona está próxima do limite de tamanho');
    }

    if (persona.length < 50) {
      warnings.push('Persona muito curta. Considere adicionar mais detalhes');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Obtém o tamanho em bytes da persona
   * @param persona - Texto da persona
   * @returns Tamanho em bytes
   */
  getPersonaSize(persona: string): number {
    return new Blob([persona]).size;
  }

  /**
   * Salva a persona original (backup)
   * @param instanceId - ID da instância do agente
   * @param originalPersona - Persona original para backup
   */
  saveOriginalPersona(instanceId: string, originalPersona: string): void {
    if (!instanceId || !originalPersona) {
      console.warn('⚠️ [PersonaEditService] Tentativa de salvar persona original com dados inválidos');
      return;
    }

    try {
      const key = this.ORIGINAL_PREFIX + instanceId;
      localStorage.setItem(key, originalPersona);
      console.log('✅ [PersonaEditService] Persona original salva:', { instanceId });
    } catch (error) {
      console.error('❌ [PersonaEditService] Erro ao salvar persona original:', error);
    }
  }

  /**
   * Obtém a persona original (backup)
   * @param instanceId - ID da instância do agente
   * @returns Persona original ou null se não existir
   */
  getOriginalPersona(instanceId: string): string | null {
    if (!instanceId) {
      return null;
    }

    try {
      const key = this.ORIGINAL_PREFIX + instanceId;
      return localStorage.getItem(key);
    } catch (error) {
      console.error('❌ [PersonaEditService] Erro ao carregar persona original:', error);
      return null;
    }
  }

  /**
   * Restaura a persona original
   * @param instanceId - ID da instância do agente
   */
  restoreOriginalPersona(instanceId: string): void {
    if (!instanceId) {
      console.warn('⚠️ [PersonaEditService] Tentativa de restaurar persona sem instanceId');
      return;
    }

    try {
      const originalPersona = this.getOriginalPersona(instanceId);
      if (originalPersona) {
        this.savePersona(instanceId, originalPersona);
        console.log('✅ [PersonaEditService] Persona original restaurada:', instanceId);
      } else {
        console.warn('⚠️ [PersonaEditService] Nenhuma persona original encontrada para:', instanceId);
      }
    } catch (error) {
      console.error('❌ [PersonaEditService] Erro ao restaurar persona original:', error);
    }
  }

  /**
   * Adiciona edição ao histórico
   * @param instanceId - ID da instância do agente
   * @param persona - Persona editada
   */
  private addToHistory(instanceId: string, persona: string): void {
    if (!instanceId || !persona) {
      return;
    }

    try {
      const key = this.HISTORY_PREFIX + instanceId;
      const history = this.getEditHistory(instanceId);
      
      // Adiciona nova edição no início
      history.unshift(persona);
      
      // Mantém apenas as últimas N edições
      const trimmedHistory = history.slice(0, this.MAX_HISTORY_SIZE);
      
      localStorage.setItem(key, JSON.stringify(trimmedHistory));
      console.log('✅ [PersonaEditService] Edição adicionada ao histórico:', { instanceId, historySize: trimmedHistory.length });
    } catch (error) {
      console.error('❌ [PersonaEditService] Erro ao adicionar ao histórico:', error);
    }
  }

  /**
   * Obtém o histórico de edições
   * @param instanceId - ID da instância do agente
   * @returns Array com histórico de edições
   */
  getEditHistory(instanceId: string): string[] {
    if (!instanceId) {
      return [];
    }

    try {
      const key = this.HISTORY_PREFIX + instanceId;
      const historyJson = localStorage.getItem(key);
      return historyJson ? JSON.parse(historyJson) : [];
    } catch (error) {
      console.error('❌ [PersonaEditService] Erro ao carregar histórico:', error);
      return [];
    }
  }

  /**
   * Salva a persona editada com histórico
   * @param instanceId - ID da instância do agente
   * @param persona - Texto da persona editada
   */
  savePersonaWithHistory(instanceId: string, persona: string): void {
    if (!instanceId || !persona) {
      console.warn('⚠️ [PersonaEditService] Tentativa de salvar persona com dados inválidos');
      return;
    }

    try {
      // Salva a persona
      this.savePersona(instanceId, persona);

      // Adiciona ao histórico
      this.addToHistory(instanceId, persona);

      console.log('✅ [PersonaEditService] Persona salva com histórico:', { instanceId, personaLength: persona.length });
    } catch (error) {
      console.error('❌ [PersonaEditService] Erro ao salvar persona com histórico:', error);
    }
  }

  /**
   * Salva a persona editada no backend (MongoDB)
   * @param agentId - ID do agente
   * @param persona - Texto da persona editada
   * @returns Observable com a resposta da API
   */
  savePersonaToBackend(agentId: string, persona: string): Observable<any> {
    if (!agentId || !persona) {
      console.warn('⚠️ [PersonaEditService] Tentativa de salvar persona no backend com dados inválidos');
      return of({ success: false, error: 'Dados inválidos' });
    }

    console.log('🌐 [PersonaEditService] Salvando persona no backend:', { agentId, personaLength: persona.length });

    return from(
      fetch(`${this.baseUrl}/api/agents/${agentId}/persona`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: persona,
          reason: 'Edição manual via interface'
        })
      }).then(async response => {
        console.log('📥 [PersonaEditService] Resposta do backend:', response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to save persona: ${response.status} ${errorText}`);
        }

        return response.json();
      })
    ).pipe(
      catchError(error => {
        console.error('❌ [PersonaEditService] Erro ao salvar persona no backend:', error);
        return of({ success: false, error: error.message });
      })
    );
  }

  /**
   * Limpa todo o histórico de uma instância
   * @param instanceId - ID da instância do agente
   */
  clearHistory(instanceId: string): void {
    if (!instanceId) {
      return;
    }

    try {
      const key = this.HISTORY_PREFIX + instanceId;
      localStorage.removeItem(key);
      console.log('✅ [PersonaEditService] Histórico limpo:', instanceId);
    } catch (error) {
      console.error('❌ [PersonaEditService] Erro ao limpar histórico:', error);
    }
  }

  /**
   * Limpa todos os dados de uma instância (persona editada, original e histórico)
   * @param instanceId - ID da instância do agente
   */
  clearAllData(instanceId: string): void {
    if (!instanceId) {
      return;
    }

    try {
      this.clearPersona(instanceId);
      this.clearHistory(instanceId);
      
      const originalKey = this.ORIGINAL_PREFIX + instanceId;
      localStorage.removeItem(originalKey);
      
      console.log('✅ [PersonaEditService] Todos os dados limpos:', instanceId);
    } catch (error) {
      console.error('❌ [PersonaEditService] Erro ao limpar todos os dados:', error);
    }
  }
}