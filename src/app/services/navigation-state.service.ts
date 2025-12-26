/**
 * NavigationStateService - Gerenciador Central de Estado de Navegação
 *
 * MODELO DE DADOS:
 * - Cada roteiro (screenplay) tem seu próprio registro no MongoDB
 * - Chave composta: user_id + screenplay_id
 * - Ao trocar de roteiro, recupera o estado salvo daquele roteiro
 *
 * FLUXOS:
 * - FLUXO 1 (Trocar Roteiro): Salvar estado atual → Buscar estado do novo roteiro → Aplicar
 * - FLUXO 2 (Trocar Conversa): Atualizar conversation_id e instance_id
 * - FLUXO 3 (Clicar Agente): Atualizar apenas instance_id
 *
 * Ref: docs/URL_STATE_REQUIREMENTS.md
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { BehaviorSubject, Observable, Subject, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

// ==========================================
// Interfaces
// ==========================================

export interface NavigationState {
  screenplayId: string | null;
  conversationId: string | null;
  instanceId: string | null;
}

export interface NavigationStateResponse {
  screenplay_id: string | null;
  conversation_id: string | null;
  instance_id: string | null;
  updated_at: string | null;
}

export interface LastScreenplayResponse {
  screenplay_id: string | null;
  updated_at: string | null;
}

// ==========================================
// Service
// ==========================================

@Injectable({
  providedIn: 'root'
})
export class NavigationStateService {
  private readonly apiUrl: string;

  // Estado atual
  private state: NavigationState = {
    screenplayId: null,
    conversationId: null,
    instanceId: null
  };

  // Observable para componentes se inscreverem
  private stateSubject = new BehaviorSubject<NavigationState>(this.state);
  public state$ = this.stateSubject.asObservable();

  // Fila de envio para MongoDB
  private saveQueue: Array<{screenplayId: string, conversationId: string | null, instanceId: string | null}> = [];
  private isProcessingQueue = false;

  // Flag para evitar loops ao aplicar estado da URL
  private isApplyingFromUrl = false;

  // Eventos para notificar mudanças
  private screenplayChangedSubject = new Subject<string | null>();
  private conversationChangedSubject = new Subject<string | null>();
  private instanceChangedSubject = new Subject<string | null>();

  public screenplayChanged$ = this.screenplayChangedSubject.asObservable();
  public conversationChanged$ = this.conversationChangedSubject.asObservable();
  public instanceChanged$ = this.instanceChangedSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.apiUrl = `${environment.apiUrl}/navigation`;
    console.log('🧭 [NAV-STATE] NavigationStateService initialized');
  }

  // ==========================================
  // Inicialização
  // ==========================================

  /**
   * Inicializa o estado de navegação.
   * Chamado uma vez quando a aplicação carrega.
   *
   * Prioridade:
   * 1. URL query params (se existirem)
   * 2. MongoDB - último roteiro acessado (se não houver params na URL)
   * 3. Estado vazio (fallback)
   */
  async initialize(route: ActivatedRoute): Promise<NavigationState> {
    console.log('🧭 [NAV-STATE] Initializing navigation state...');

    try {
      // 1. Verificar URL query params
      const params = route.snapshot.queryParamMap;
      const urlScreenplayId = params.get('screenplayId');
      const urlConversationId = params.get('conversationId');
      const urlInstanceId = params.get('instanceId');

      if (urlScreenplayId) {
        console.log('🧭 [NAV-STATE] URL has screenplayId:', urlScreenplayId);

        // Usar estado da URL
        this.state = {
          screenplayId: urlScreenplayId,
          conversationId: urlConversationId,
          instanceId: urlInstanceId
        };

        // Se URL tem apenas screenplayId, buscar conversation/instance do MongoDB
        if (!urlConversationId && !urlInstanceId) {
          try {
            const mongoState = await this.getStateForScreenplay(urlScreenplayId);
            if (mongoState.conversation_id || mongoState.instance_id) {
              console.log('🧭 [NAV-STATE] Found saved state for screenplay:', mongoState);
              this.state.conversationId = mongoState.conversation_id;
              this.state.instanceId = mongoState.instance_id;
              this.updateUrl();
            }
          } catch (error) {
            console.warn('🧭 [NAV-STATE] Failed to fetch state for screenplay:', error);
          }
        }

        // Salvar/atualizar estado no MongoDB
        this.enqueueSave(urlScreenplayId, this.state.conversationId, this.state.instanceId);

      } else {
        console.log('🧭 [NAV-STATE] No URL params, fetching last screenplay from MongoDB...');

        // 2. Buscar último roteiro acessado do MongoDB
        try {
          const lastScreenplay = await this.getLastScreenplay();

          if (lastScreenplay.screenplay_id) {
            console.log('🧭 [NAV-STATE] Last screenplay found:', lastScreenplay.screenplay_id);

            // Buscar estado completo desse roteiro
            const fullState = await this.getStateForScreenplay(lastScreenplay.screenplay_id);

            this.state = {
              screenplayId: fullState.screenplay_id,
              conversationId: fullState.conversation_id,
              instanceId: fullState.instance_id
            };

            // Atualizar URL para refletir estado
            this.updateUrl();
          } else {
            console.log('🧭 [NAV-STATE] No saved state in MongoDB, starting fresh');
          }
        } catch (error) {
          console.warn('🧭 [NAV-STATE] Failed to fetch from MongoDB:', error);
        }
      }

      // Notificar componentes
      this.stateSubject.next({ ...this.state });

      console.log('🧭 [NAV-STATE] Initialization complete:', this.state);
      return this.state;

    } catch (error) {
      console.error('🧭 [NAV-STATE] Initialization error:', error);
      return this.state;
    }
  }

  // ==========================================
  // Getters
  // ==========================================

  get currentState(): NavigationState {
    return { ...this.state };
  }

  get screenplayId(): string | null {
    return this.state.screenplayId;
  }

  get conversationId(): string | null {
    return this.state.conversationId;
  }

  get instanceId(): string | null {
    return this.state.instanceId;
  }

  // ==========================================
  // FLUXO 1: Trocar Roteiro
  // ==========================================

  /**
   * FLUXO 1: Mudar roteiro (Screenplay)
   *
   * Quando um novo roteiro é selecionado:
   * 1. Salvar estado atual do roteiro anterior (se existir)
   * 2. Buscar estado salvo do novo roteiro no MongoDB
   * 3. Aplicar estado (conversation_id, instance_id do novo roteiro)
   * 4. Atualizar URL
   *
   * Retorna Promise com o estado carregado do MongoDB (para aplicar seleções)
   */
  async setScreenplay(screenplayId: string | null): Promise<NavigationState | null> {
    console.log('🧭 [NAV-STATE] FLUXO 1: setScreenplay', screenplayId);

    const previousScreenplayId = this.state.screenplayId;

    // Se não há novo roteiro, apenas limpar
    if (!screenplayId) {
      this.state = {
        screenplayId: null,
        conversationId: null,
        instanceId: null
      };
      this.updateUrl();
      this.stateSubject.next({ ...this.state });
      this.screenplayChangedSubject.next(null);
      return null;
    }

    // 1. Salvar estado atual do roteiro anterior (se existir e for diferente)
    if (previousScreenplayId && previousScreenplayId !== screenplayId) {
      console.log('🧭 [NAV-STATE] Saving state of previous screenplay:', previousScreenplayId);
      this.enqueueSave(previousScreenplayId, this.state.conversationId, this.state.instanceId);
    }

    // 2. Buscar estado salvo do novo roteiro
    let savedState: NavigationStateResponse | null = null;
    try {
      savedState = await this.getStateForScreenplay(screenplayId);
      console.log('🧭 [NAV-STATE] Loaded state for new screenplay:', savedState);
    } catch (error) {
      console.warn('🧭 [NAV-STATE] No saved state for screenplay:', screenplayId);
    }

    // 3. Aplicar estado
    this.state = {
      screenplayId: screenplayId,
      conversationId: savedState?.conversation_id || null,
      instanceId: savedState?.instance_id || null
    };

    // 4. Atualizar URL
    this.updateUrl();

    // 5. Notificar componentes
    this.stateSubject.next({ ...this.state });

    if (screenplayId !== previousScreenplayId) {
      this.screenplayChangedSubject.next(screenplayId);
    }

    // 6. Salvar acesso ao novo roteiro (atualiza updated_at para tracking de "último acessado")
    this.enqueueSave(screenplayId, this.state.conversationId, this.state.instanceId);

    return this.state;
  }

  // ==========================================
  // FLUXO 2: Trocar Conversa
  // ==========================================

  /**
   * FLUXO 2: Mudar conversa (Conversation)
   *
   * Quando uma nova conversa é selecionada:
   * 1. Salvar estado da conversa anterior (se existir)
   * 2. Buscar instance_id salvo da nova conversa no MongoDB
   * 3. Aplicar estado e atualizar URL
   * 4. SEMPRE atualizar screenplay_states com a nova conversa ativa
   *
   * Retorna Promise com o instance_id salvo (ou null)
   */
  async setConversation(conversationId: string | null): Promise<string | null> {
    console.log('🧭 [NAV-STATE] FLUXO 2: setConversation', conversationId);

    if (!this.state.screenplayId) {
      console.warn('🧭 [NAV-STATE] Cannot set conversation without screenplay');
      return null;
    }

    const previousConversationId = this.state.conversationId;

    // 1. Salvar estado da conversa anterior (se existir e for diferente)
    if (previousConversationId && previousConversationId !== conversationId && this.state.instanceId) {
      console.log('🧭 [NAV-STATE] Saving state of previous conversation:', previousConversationId);
      this.enqueueSave(this.state.screenplayId, previousConversationId, this.state.instanceId);
    }

    // Se não há nova conversa, apenas limpar
    if (!conversationId) {
      this.state.conversationId = null;
      this.state.instanceId = null;
      this.updateUrl();
      this.stateSubject.next({ ...this.state });
      this.conversationChangedSubject.next(null);
      return null;
    }

    // 2. Buscar instance_id salvo da nova conversa
    let savedInstanceId: string | null = null;
    try {
      const savedState = await this.getStateForConversation(this.state.screenplayId, conversationId);
      savedInstanceId = savedState?.instance_id || null;
      console.log('🧭 [NAV-STATE] Loaded instance for conversation:', savedInstanceId);
    } catch (error) {
      console.warn('🧭 [NAV-STATE] No saved instance for conversation:', conversationId);
    }

    // 3. Aplicar estado
    this.state.conversationId = conversationId;
    this.state.instanceId = savedInstanceId;

    // 4. Atualizar URL
    this.updateUrl();
    this.stateSubject.next({ ...this.state });

    // 5. SEMPRE salvar no MongoDB para registrar a conversa ativa
    // Isso atualiza screenplay_states com a nova conversation_id
    // E cria/atualiza conversation_states (mantendo instance_id se já tinha)
    this.enqueueSave(this.state.screenplayId, conversationId, savedInstanceId);

    // 6. Notificar mudança
    if (conversationId !== previousConversationId) {
      this.conversationChangedSubject.next(conversationId);
    }
    if (savedInstanceId) {
      this.instanceChangedSubject.next(savedInstanceId);
    }

    return savedInstanceId;
  }

  /**
   * Atualiza conversationId e instanceId juntos.
   * Usado quando já sabemos qual instância selecionar.
   *
   * IMPORTANTE: Salva o estado da conversa anterior antes de trocar!
   */
  setConversationWithInstance(conversationId: string | null, instanceId: string | null): void {
    console.log('🧭 [NAV-STATE] setConversationWithInstance', { conversationId, instanceId });

    if (!this.state.screenplayId) {
      console.warn('🧭 [NAV-STATE] Cannot set conversation without screenplay');
      return;
    }

    const previousConversationId = this.state.conversationId;
    const previousInstanceId = this.state.instanceId;

    // CRÍTICO: Salvar estado da conversa anterior ANTES de trocar
    // Isso garante que ao voltar para a conversa anterior, o agente seja restaurado
    if (previousConversationId && previousConversationId !== conversationId) {
      console.log('🧭 [NAV-STATE] Saving previous conversation state:', {
        screenplayId: this.state.screenplayId,
        conversationId: previousConversationId,
        instanceId: previousInstanceId
      });
      this.enqueueSave(this.state.screenplayId, previousConversationId, previousInstanceId);
    }

    // Atualizar estado para a nova conversa
    this.state.conversationId = conversationId;
    this.state.instanceId = instanceId;

    // Persistir nova conversa e atualizar URL
    this.persistAndUpdateUrl();

    // Notificar mudanças
    if (conversationId !== previousConversationId) {
      this.conversationChangedSubject.next(conversationId);
    }
    if (instanceId !== previousInstanceId) {
      this.instanceChangedSubject.next(instanceId);
    }
  }

  // ==========================================
  // FLUXO 3: Clicar em Agente
  // ==========================================

  /**
   * FLUXO 3: Mudar agente instanciado (Instance)
   *
   * Quando um novo agente é selecionado:
   * - Atualiza instanceId
   * - Mantém screenplayId e conversationId
   * - Salva no MongoDB
   * - Atualiza URL
   * - NÃO recarrega histórico
   */
  setInstance(instanceId: string | null): void {
    console.log('🧭 [NAV-STATE] FLUXO 3: setInstance', instanceId);

    if (!this.state.screenplayId) {
      console.warn('🧭 [NAV-STATE] Cannot set instance without screenplay');
      return;
    }

    const previousInstanceId = this.state.instanceId;

    // Atualizar estado
    this.state.instanceId = instanceId;

    // Persistir e atualizar URL
    this.persistAndUpdateUrl();

    // Notificar mudança
    if (instanceId !== previousInstanceId) {
      this.instanceChangedSubject.next(instanceId);
    }
  }

  // ==========================================
  // Métodos auxiliares
  // ==========================================

  /**
   * Atualiza screenplayId mantendo conversation e instance.
   * Usado quando já temos o estado carregado e apenas sincronizamos o ID.
   */
  setScreenplayPreservingSelections(screenplayId: string | null): void {
    console.log('🧭 [NAV-STATE] setScreenplayPreservingSelections', screenplayId);

    if (!screenplayId) {
      return;
    }

    const previousScreenplayId = this.state.screenplayId;
    this.state.screenplayId = screenplayId;

    // Persistir e atualizar URL
    this.persistAndUpdateUrl();

    // Notificar mudança
    if (screenplayId !== previousScreenplayId) {
      this.screenplayChangedSubject.next(screenplayId);
    }
  }

  /**
   * Atualiza múltiplos campos de uma vez.
   * Usado na inicialização ou quando aplicando estado da URL.
   */
  setState(state: Partial<NavigationState>): void {
    console.log('🧭 [NAV-STATE] setState', state);

    const previousState = { ...this.state };

    if (state.screenplayId !== undefined) {
      this.state.screenplayId = state.screenplayId;
    }
    if (state.conversationId !== undefined) {
      this.state.conversationId = state.conversationId;
    }
    if (state.instanceId !== undefined) {
      this.state.instanceId = state.instanceId;
    }

    // Persistir e atualizar URL (se tiver screenplayId)
    if (this.state.screenplayId) {
      this.persistAndUpdateUrl();
    } else {
      // Apenas atualizar URL sem persistir
      this.updateUrl();
      this.stateSubject.next({ ...this.state });
    }

    // Notificar mudanças
    if (this.state.screenplayId !== previousState.screenplayId) {
      this.screenplayChangedSubject.next(this.state.screenplayId);
    }
    if (this.state.conversationId !== previousState.conversationId) {
      this.conversationChangedSubject.next(this.state.conversationId);
    }
    if (this.state.instanceId !== previousState.instanceId) {
      this.instanceChangedSubject.next(this.state.instanceId);
    }
  }

  // ==========================================
  // Persistência e URL
  // ==========================================

  private persistAndUpdateUrl(): void {
    if (!this.state.screenplayId) {
      console.warn('🧭 [NAV-STATE] Cannot persist without screenplayId');
      return;
    }

    // 1. Salvar no MongoDB (via fila)
    this.enqueueSave(this.state.screenplayId, this.state.conversationId, this.state.instanceId);

    // 2. Atualizar URL
    this.updateUrl();

    // 3. Notificar subscribers
    this.stateSubject.next({ ...this.state });
  }

  private updateUrl(): void {
    if (this.isApplyingFromUrl) {
      return; // Evitar loop
    }

    const queryParams: { [key: string]: string | null } = {};

    if (this.state.screenplayId) {
      queryParams['screenplayId'] = this.state.screenplayId;
    }
    if (this.state.conversationId) {
      queryParams['conversationId'] = this.state.conversationId;
    }
    if (this.state.instanceId) {
      queryParams['instanceId'] = this.state.instanceId;
    }

    // Atualizar URL sem recarregar página
    this.router.navigate([], {
      queryParams,
      queryParamsHandling: '', // Substituir todos os params
      replaceUrl: true         // Não adicionar ao histórico
    });

    console.log('🧭 [NAV-STATE] URL updated:', queryParams);
  }

  // ==========================================
  // Fila de envio para MongoDB
  // ==========================================

  private enqueueSave(screenplayId: string, conversationId: string | null, instanceId: string | null): void {
    // Verificar se a conversa está marcada para exclusão
    if (conversationId && this.deletedConversations.has(conversationId)) {
      console.log('🧭 [NAV-STATE] Ignorando save para conversa deletada:', conversationId);
      return;
    }

    this.saveQueue.push({ screenplayId, conversationId, instanceId });
    this.processQueue();
  }

  /**
   * Remove itens pendentes da fila para uma conversa específica
   */
  private clearQueueForConversation(conversationId: string): void {
    const before = this.saveQueue.length;
    this.saveQueue = this.saveQueue.filter(item => item.conversationId !== conversationId);
    const removed = before - this.saveQueue.length;
    if (removed > 0) {
      console.log(`🧭 [NAV-STATE] Removidos ${removed} saves pendentes para conversa:`, conversationId);
    }
  }

  // Set de conversas marcadas para exclusão (evita race condition)
  private deletedConversations = new Set<string>();

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.saveQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.saveQueue.length > 0) {
      const item = this.saveQueue.shift()!;

      // Double-check: não salvar conversas deletadas
      if (item.conversationId && this.deletedConversations.has(item.conversationId)) {
        console.log('🧭 [NAV-STATE] Pulando save para conversa deletada:', item.conversationId);
        continue;
      }

      try {
        await firstValueFrom(this.saveStateToMongo(item.screenplayId, item.conversationId, item.instanceId));
        console.log('🧭 [NAV-STATE] State saved to MongoDB for screenplay:', item.screenplayId);
      } catch (error) {
        console.error('🧭 [NAV-STATE] Failed to save to MongoDB:', error);
        // Continuar processando a fila mesmo com erro
      }
    }

    this.isProcessingQueue = false;
  }

  // ==========================================
  // API Calls
  // ==========================================

  private async getLastScreenplay(): Promise<LastScreenplayResponse> {
    return firstValueFrom(this.http.get<LastScreenplayResponse>(`${this.apiUrl}/last`));
  }

  private async getStateForScreenplay(screenplayId: string): Promise<NavigationStateResponse> {
    return firstValueFrom(
      this.http.get<NavigationStateResponse>(`${this.apiUrl}?screenplay_id=${screenplayId}`)
    );
  }

  private async getStateForConversation(screenplayId: string, conversationId: string): Promise<NavigationStateResponse> {
    return firstValueFrom(
      this.http.get<NavigationStateResponse>(`${this.apiUrl}?screenplay_id=${screenplayId}&conversation_id=${conversationId}`)
    );
  }

  private saveStateToMongo(screenplayId: string, conversationId: string | null, instanceId: string | null): Observable<NavigationStateResponse> {
    return this.http.put<NavigationStateResponse>(this.apiUrl, {
      screenplay_id: screenplayId,
      conversation_id: conversationId,
      instance_id: instanceId
    });
  }

  /**
   * Deleta o estado de uma conversa do MongoDB.
   * Chamado quando uma conversa é excluída.
   *
   * IMPORTANTE: Marca a conversa como deletada para evitar race condition
   * com saves pendentes na fila.
   */
  deleteConversationState(screenplayId: string, conversationId: string): void {
    console.log('🧭 [NAV-STATE] Deleting conversation state:', { screenplayId, conversationId });

    // 1. Marcar conversa como deletada (evita novos saves)
    this.deletedConversations.add(conversationId);

    // 2. Limpar saves pendentes para esta conversa
    this.clearQueueForConversation(conversationId);

    // 3. Fazer o DELETE no MongoDB
    this.http.delete(`${this.apiUrl}?screenplay_id=${screenplayId}&conversation_id=${conversationId}`)
      .subscribe({
        next: () => {
          console.log('🧭 [NAV-STATE] Conversation state deleted from MongoDB');
          // Limpar do set após um tempo (para evitar memory leak)
          setTimeout(() => {
            this.deletedConversations.delete(conversationId);
          }, 5000);
        },
        error: (error) => {
          console.error('🧭 [NAV-STATE] Failed to delete conversation state:', error);
          // Remover do set em caso de erro também
          this.deletedConversations.delete(conversationId);
        }
      });
  }

  // ==========================================
  // Utilitários
  // ==========================================

  /**
   * Limpa todo o estado de navegação.
   */
  clear(): void {
    console.log('🧭 [NAV-STATE] Clearing state');

    this.state = {
      screenplayId: null,
      conversationId: null,
      instanceId: null
    };

    this.updateUrl();
    this.stateSubject.next({ ...this.state });
  }

  /**
   * Retorna se há um roteiro selecionado.
   */
  hasScreenplay(): boolean {
    return !!this.state.screenplayId;
  }

  /**
   * Retorna se há uma conversa selecionada.
   */
  hasConversation(): boolean {
    return !!this.state.conversationId;
  }

  /**
   * Retorna se há um agente selecionado.
   */
  hasInstance(): boolean {
    return !!this.state.instanceId;
  }
}
