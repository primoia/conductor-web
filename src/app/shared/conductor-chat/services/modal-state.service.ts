import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Estados de todos os modais do sistema
 */
export interface ModalState {
  personaModal: boolean;
  personaEditModal: boolean;
  cwdModal: boolean;
  contextEditor: boolean;
  contextEditorModal: boolean;
  agentOptionsMenu: boolean;
  dockInfoModal: boolean;
}

/**
 * Tipos de modais disponíveis
 */
export type ModalType = keyof ModalState;

/**
 * 🔥 FASE 1.2: ModalStateService
 *
 * Serviço responsável por centralizar o gerenciamento de estado de todos os modais.
 *
 * Remove ~70 linhas de flags espalhadas pelo componente principal e centraliza
 * a lógica de abertura/fechamento de modais.
 *
 * Benefícios:
 * - Estado centralizado e reativo
 * - Facilita testes unitários
 * - Previne bugs de estado inconsistente
 * - Facilita adicionar novos modais no futuro
 */
@Injectable({
  providedIn: 'root'
})
export class ModalStateService {

  /**
   * Estado inicial de todos os modais (todos fechados)
   */
  private readonly initialState: ModalState = {
    personaModal: false,
    personaEditModal: false,
    cwdModal: false,
    contextEditor: false,
    contextEditorModal: false,
    agentOptionsMenu: false,
    dockInfoModal: false
  };

  /**
   * BehaviorSubject que mantém o estado atual de todos os modais
   */
  private readonly modalsState$ = new BehaviorSubject<ModalState>(this.initialState);

  /**
   * Observable público para componentes assinarem
   */
  readonly state$: Observable<ModalState> = this.modalsState$.asObservable();

  constructor() {
    console.log('🔧 [MODAL-SERVICE] Serviço de estado de modais inicializado');
  }

  /**
   * Obter o estado atual de todos os modais (snapshot)
   */
  getState(): ModalState {
    return this.modalsState$.value;
  }

  /**
   * Obter o estado de um modal específico
   */
  isOpen(modalType: ModalType): boolean {
    return this.modalsState$.value[modalType];
  }

  /**
   * Observable para observar o estado de um modal específico
   */
  isOpen$(modalType: ModalType): Observable<boolean> {
    return this.state$.pipe(
      map(state => state[modalType])
    );
  }

  /**
   * Abrir um modal específico
   */
  open(modalType: ModalType): void {
    const currentState = this.modalsState$.value;

    // Fechar menu de opções se abrindo outro modal (comportamento UX)
    const shouldCloseMenu = modalType !== 'agentOptionsMenu' && currentState.agentOptionsMenu;

    this.modalsState$.next({
      ...currentState,
      [modalType]: true,
      ...(shouldCloseMenu && { agentOptionsMenu: false })
    });

    console.log(`✅ [MODAL-SERVICE] Modal aberto: ${modalType}`);
  }

  /**
   * Fechar um modal específico
   */
  close(modalType: ModalType): void {
    const currentState = this.modalsState$.value;

    this.modalsState$.next({
      ...currentState,
      [modalType]: false
    });

    console.log(`✅ [MODAL-SERVICE] Modal fechado: ${modalType}`);
  }

  /**
   * Alternar (toggle) estado de um modal
   */
  toggle(modalType: ModalType): void {
    const currentState = this.modalsState$.value;
    const newState = !currentState[modalType];

    if (newState) {
      this.open(modalType);
    } else {
      this.close(modalType);
    }

    console.log(`🔄 [MODAL-SERVICE] Modal alternado: ${modalType} -> ${newState}`);
  }

  /**
   * Fechar todos os modais de uma vez
   */
  closeAll(): void {
    this.modalsState$.next(this.initialState);
    console.log('🚪 [MODAL-SERVICE] Todos os modais fechados');
  }

  /**
   * Verificar se algum modal está aberto
   */
  isAnyModalOpen(): boolean {
    const state = this.modalsState$.value;
    return Object.values(state).some(isOpen => isOpen);
  }

  /**
   * Observable para verificar se algum modal está aberto
   */
  isAnyModalOpen$(): Observable<boolean> {
    return this.state$.pipe(
      map(state => Object.values(state).some(isOpen => isOpen))
    );
  }

  /**
   * Obter lista de modais abertos atualmente
   */
  getOpenModals(): ModalType[] {
    const state = this.modalsState$.value;
    return (Object.keys(state) as ModalType[]).filter(key => state[key]);
  }

  /**
   * Fechar modal ao pressionar ESC (helper para componentes)
   */
  handleEscapeKey(): void {
    const openModals = this.getOpenModals();

    // Fechar o último modal aberto (stack behavior)
    if (openModals.length > 0) {
      const lastOpenModal = openModals[openModals.length - 1];
      this.close(lastOpenModal);
      console.log(`⌨️ [MODAL-SERVICE] ESC pressionado, fechando: ${lastOpenModal}`);
    }
  }

  /**
   * Resetar todos os modais ao estado inicial
   */
  reset(): void {
    this.modalsState$.next(this.initialState);
    console.log('🔄 [MODAL-SERVICE] Estado resetado ao inicial');
  }
}
