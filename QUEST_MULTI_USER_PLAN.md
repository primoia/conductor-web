# 🎮 Quest Adventure - Plano de Implementação com Lead Capture

## 📋 Visão Geral

**Objetivo Principal:** Capturar leads (nome + email) e permitir gameplay com progresso temporário.

**Requisitos Simplificados:**
- A cada entrada, usuário fornece nome + email (lead capture)
- Cria sessão temporária com 1 boneco inicial
- Progresso é salvo no backend durante a sessão
- Sessão expira após 24 horas ou ao limpar navegador
- Nova entrada = nova sessão (novo lead capture)
- Foco em simplicidade e coleta de contatos

**Vantagens:**
- ✅ Captura leads a cada acesso
- ✅ Progresso mantido durante sessão ativa
- ✅ UX boa (não perde progresso ao recarregar página)
- ✅ Backend simples (sem autenticação JWT)
- ✅ Analytics ricos (múltiplas sessões por email)

---

## 🔌 Endpoints de API Necessários

### 1. Criar Sessão (Lead Capture + Início de Jogo)

```http
POST /api/quest/sessions
Content-Type: application/json

Request:
{
  "name": "João Silva",
  "email": "joao@email.com"
}

Response (201):
{
  "session_id": "uuid-v4",
  "character_id": "char-uuid",
  "character_name": "Iniciado",
  "expires_at": "2025-11-10T15:00:00Z",  // 24 horas a partir de agora
  "initial_state": {
    "playerState": {
      "position": { "x": 512, "y": 400 },
      "level": 1,
      "xp": 0,
      "xpToNextLevel": 100,
      "title": "Iniciado",
      "inventory": [],
      "unlockedNPCs": ["elder_guide"],
      "completedObjectives": [],
      "dialogueFlags": {}
    },
    "questProgress": {
      "currentQuestId": "guild_banner",
      "currentObjectiveIndex": 0,
      "completedQuests": []
    },
    "npcStates": {}
  }
}

Response (400 - Email inválido):
{
  "error": "invalid_email",
  "message": "Email format is invalid"
}
```

**Notas:**
- Backend registra lead (nome + email + timestamp)
- Cria sessão temporária (expira em 24h)
- Retorna estado inicial do jogo
- Permite múltiplas sessões para mesmo email (analytics)

---

### 2. Obter Estado da Sessão

```http
GET /api/quest/sessions/{session_id}/state

Response (200):
{
  "session_id": "uuid-v4",
  "character_id": "char-uuid",
  "name": "João Silva",
  "email": "joao@email.com",
  "created_at": "2025-11-09T15:00:00Z",
  "expires_at": "2025-11-10T15:00:00Z",
  "version": 3,
  "state": {
    "playerState": {
      "position": { "x": 650, "y": 420 },
      "level": 2,
      "xp": 250,
      "xpToNextLevel": 50,
      "title": "Iniciado",
      "inventory": [
        {
          "id": "requirements_document",
          "name": "Plano do Estandarte",
          "description": "Um plano detalhado",
          "icon": "📋"
        }
      ],
      "unlockedNPCs": ["elder_guide", "requirements_scribe"],
      "completedObjectives": ["talk_to_guide"],
      "dialogueFlags": {
        "talked_to_elder_guide": true
      }
    },
    "questProgress": {
      "currentQuestId": "guild_banner",
      "currentObjectiveIndex": 1,
      "completedQuests": []
    },
    "npcStates": {
      "elder_guide": {
        "unlocked": true,
        "interactionCount": 1
      }
    }
  }
}

Response (404 - Sessão não encontrada):
{
  "error": "session_not_found",
  "message": "Session expired or does not exist"
}

Response (410 - Sessão expirada):
{
  "error": "session_expired",
  "message": "Session has expired after 24 hours"
}
```

---

### 3. Salvar Estado da Sessão (Auto-save)

```http
PUT /api/quest/sessions/{session_id}/state
Content-Type: application/json

Request:
{
  "version": 3,
  "state": {
    "playerState": {
      "position": { "x": 700, "y": 450 },
      "level": 2,
      "xp": 300,
      "xpToNextLevel": 0,
      "title": "Iniciado",
      "inventory": [ /* ... */ ],
      "unlockedNPCs": [ /* ... */ ],
      "completedObjectives": [ /* ... */ ],
      "dialogueFlags": { /* ... */ }
    },
    "questProgress": { /* ... */ },
    "npcStates": { /* ... */ }
  }
}

Response (200):
{
  "success": true,
  "version": 4,
  "saved_at": "2025-11-09T15:35:00Z"
}

Response (409 - Conflito de versão):
{
  "error": "version_conflict",
  "message": "State was modified by another session",
  "current_version": 5,
  "your_version": 3
}

Response (410 - Sessão expirada):
{
  "error": "session_expired",
  "message": "Cannot save to expired session"
}
```

---

### 4. Analytics (Opcional - para administração)

```http
GET /api/quest/admin/leads
Authorization: Bearer {admin_token}
Query Params: ?limit=50&skip=0&email=joao@email.com

Response (200):
{
  "total": 152,
  "leads": [
    {
      "id": "lead-uuid-1",
      "name": "João Silva",
      "email": "joao@email.com",
      "first_seen": "2025-11-08T14:00:00Z",
      "last_seen": "2025-11-09T15:00:00Z",
      "total_sessions": 3,
      "total_playtime_minutes": 45,
      "highest_level_reached": 3,
      "quest_completed": false
    },
    {
      "id": "lead-uuid-2",
      "name": "Maria Santos",
      "email": "maria@email.com",
      "first_seen": "2025-11-09T10:00:00Z",
      "last_seen": "2025-11-09T10:30:00Z",
      "total_sessions": 1,
      "total_playtime_minutes": 15,
      "highest_level_reached": 1,
      "quest_completed": false
    }
  ]
}
```

```http
GET /api/quest/admin/sessions/{session_id}
Authorization: Bearer {admin_token}

Response (200):
{
  "session_id": "uuid",
  "name": "João Silva",
  "email": "joao@email.com",
  "created_at": "2025-11-09T15:00:00Z",
  "expires_at": "2025-11-10T15:00:00Z",
  "last_activity": "2025-11-09T15:35:00Z",
  "is_expired": false,
  "current_level": 2,
  "current_objective": "talk_to_scribe",
  "total_playtime_minutes": 35
}
```

---

## 🏗️ Arquitetura Frontend

### ♻️ Reutilização de Recursos Existentes

**Padrões do Projeto a Seguir:**
- ✅ `HttpClient` já em uso (ex: `ConversationService`)
- ✅ `environment.apiUrl` já configurado como `/api`
- ✅ Padrão de Observable/RxJS estabelecido
- ✅ Estrutura de models com interfaces TypeScript

**Simplificações vs Plano Original:**
- ❌ **SEM autenticação JWT** (apenas sessionStorage simples)
- ❌ **SEM gerenciamento de múltiplos bonecos** (1 boneco por sessão)
- ❌ **SEM login/logout** (apenas lead capture)
- ❌ **SEM HTTP Interceptor** (não necessário)
- ❌ **SEM Route Guards** (validação simples nos componentes)
- ✅ **COM sessões temporárias** (24 horas)

### Estrutura de Serviços

```
src/app/quest-adventure/
├── services/
│   ├── quest-session.service.ts       (NOVO - gerencia sessão temporária)
│   ├── quest-state.service.ts         (REFATORAR - usar session_id)
│   ├── npc-manager.service.ts         (MANTER)
│   ├── player-movement.service.ts     (MANTER)
│   └── dialogue.service.ts            (MANTER)
├── components/
│   ├── quest-welcome/                 (NOVO - lead capture screen)
│   ├── quest-canvas/                  (MANTER)
│   ├── quest-chat-modal/              (MANTER)
│   └── quest-tracker/                 (MANTER)
├── models/
│   └── quest.models.ts                (ATUALIZAR - adicionar QuestSession)
└── quest-adventure.component.ts       (REFATORAR)
```

---

## 📦 Novos Modelos de Dados

```typescript
// models/quest.models.ts

export interface QuestSession {
  session_id: string;
  character_id: string;
  character_name: string;
  name: string;            // Nome do lead
  email: string;           // Email do lead
  created_at: string;
  expires_at: string;
  version: number;
}

export interface CreateSessionRequest {
  name: string;
  email: string;
}

export interface CreateSessionResponse {
  session_id: string;
  character_id: string;
  character_name: string;
  expires_at: string;
  initial_state: SaveGameState;
}

export interface SessionState {
  session_id: string;
  character_id: string;
  name: string;
  email: string;
  created_at: string;
  expires_at: string;
  version: number;
  state: SaveGameState;
}

// Reutiliza SaveGameState existente (sem mudanças)
export interface SaveGameState {
  playerState: PlayerState;
  questProgress: {
    currentQuestId: string;
    currentObjectiveIndex: number;
    completedQuests: string[];
  };
  npcStates: Record<string, {
    unlocked: boolean;
    interactionCount: number;
    lastDialogueNode?: string;
  }>;
}

// ... PlayerState, QuestObjective, etc mantêm os mesmos
```

---

## 🔧 Implementação por Fases

### **FASE 1: Lead Capture e Sessão** (4-6 horas)

#### 1.1. Criar `QuestSessionService`

**Arquivo:** `src/app/quest-adventure/services/quest-session.service.ts`

**⚠️ IMPORTANTE: Seguir padrão do `ConversationService`**

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { QuestSession, CreateSessionRequest, CreateSessionResponse, SessionState } from '../models/quest.models';

@Injectable({ providedIn: 'root' })
export class QuestSessionService {
  private readonly apiUrl: string;
  private readonly SESSION_KEY = 'quest_session_id';

  private sessionSubject = new BehaviorSubject<QuestSession | null>(null);
  session$ = this.sessionSubject.asObservable();

  constructor(private http: HttpClient) {
    this.apiUrl = `${environment.apiUrl}/quest/sessions`;
    this.loadSessionFromStorage();
  }

  /**
   * Cria nova sessão (lead capture)
   */
  createSession(name: string, email: string): Observable<CreateSessionResponse> {
    return this.http.post<CreateSessionResponse>(this.apiUrl, { name, email })
      .pipe(tap(response => {
        // Salva session_id no sessionStorage
        sessionStorage.setItem(this.SESSION_KEY, response.session_id);

        // Atualiza observable
        const session: QuestSession = {
          session_id: response.session_id,
          character_id: response.character_id,
          character_name: response.character_name,
          name,
          email,
          created_at: new Date().toISOString(),
          expires_at: response.expires_at,
          version: 0
        };
        this.sessionSubject.next(session);
      }));
  }

  /**
   * Obtém estado da sessão atual
   */
  getSessionState(): Observable<SessionState> {
    const sessionId = this.getSessionId();
    if (!sessionId) {
      throw new Error('No active session');
    }

    return this.http.get<SessionState>(`${this.apiUrl}/${sessionId}/state`)
      .pipe(tap(sessionState => {
        // Atualiza session com dados do backend
        const session: QuestSession = {
          session_id: sessionState.session_id,
          character_id: sessionState.character_id,
          character_name: sessionState.state.playerState.title,
          name: sessionState.name,
          email: sessionState.email,
          created_at: sessionState.created_at,
          expires_at: sessionState.expires_at,
          version: sessionState.version
        };
        this.sessionSubject.next(session);
      }));
  }

  /**
   * Salva estado da sessão
   */
  saveSessionState(state: SaveGameState, version: number): Observable<any> {
    const sessionId = this.getSessionId();
    if (!sessionId) {
      throw new Error('No active session');
    }

    return this.http.put(
      `${this.apiUrl}/${sessionId}/state`,
      { version, state }
    ).pipe(tap((response: any) => {
      // Atualiza versão
      const currentSession = this.sessionSubject.value;
      if (currentSession) {
        currentSession.version = response.version;
        this.sessionSubject.next(currentSession);
      }
    }));
  }

  /**
   * Obtém session_id atual
   */
  getSessionId(): string | null {
    return sessionStorage.getItem(this.SESSION_KEY);
  }

  /**
   * Verifica se há sessão ativa
   */
  hasActiveSession(): boolean {
    return !!this.getSessionId();
  }

  /**
   * Limpa sessão atual (logout)
   */
  clearSession(): void {
    sessionStorage.removeItem(this.SESSION_KEY);
    this.sessionSubject.next(null);
  }

  /**
   * Carrega sessão do sessionStorage (ao recarregar página)
   */
  private loadSessionFromStorage(): void {
    const sessionId = this.getSessionId();
    if (sessionId) {
      // Tenta carregar estado da sessão do backend
      this.getSessionState().subscribe({
        next: () => {
          console.log('Session restored from storage');
        },
        error: (err) => {
          console.error('Failed to restore session:', err);
          // Sessão expirou ou não existe mais
          this.clearSession();
        }
      });
    }
  }

  /**
   * Obtém sessão atual
   */
  getCurrentSession(): QuestSession | null {
    return this.sessionSubject.value;
  }
}
```

#### 1.2. Criar `QuestWelcomeComponent` (Lead Capture)

**Arquivo:** `src/app/quest-adventure/components/quest-welcome/quest-welcome.component.ts`

```typescript
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuestSessionService } from '../../services/quest-session.service';

@Component({
  selector: 'app-quest-welcome',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="welcome-overlay">
      <div class="welcome-content">
        <h1 class="welcome-title">🎮 Quest Adventure</h1>
        <p class="welcome-subtitle">Bem-vindo à Jornada do Iniciado</p>

        <div class="welcome-form" *ngIf="!isLoading">
          <p class="welcome-description">
            Para começar sua aventura, precisamos saber quem você é:
          </p>

          <div class="input-group">
            <label for="name">Seu Nome</label>
            <input
              type="text"
              id="name"
              [(ngModel)]="name"
              placeholder="Digite seu nome"
              maxlength="50"
              (keyup.enter)="onSubmit()"
              [disabled]="isLoading"
              required>
          </div>

          <div class="input-group">
            <label for="email">Seu Email</label>
            <input
              type="email"
              id="email"
              [(ngModel)]="email"
              placeholder="seu@email.com"
              (keyup.enter)="onSubmit()"
              [disabled]="isLoading"
              required>
          </div>

          <div class="error-message" *ngIf="errorMessage">
            {{ errorMessage }}
          </div>

          <button
            class="start-button"
            (click)="onSubmit()"
            [disabled]="!isValid() || isLoading">
            Começar Aventura
          </button>

          <p class="privacy-note">
            Seus dados serão usados apenas para melhorar sua experiência.
          </p>
        </div>

        <div class="loading-state" *ngIf="isLoading">
          <div class="spinner"></div>
          <p>Preparando sua jornada...</p>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./quest-welcome.component.scss']
})
export class QuestWelcomeComponent {
  name = '';
  email = '';
  isLoading = false;
  errorMessage = '';

  constructor(private sessionService: QuestSessionService) {}

  isValid(): boolean {
    return this.name.trim().length > 0 &&
           this.email.trim().length > 0 &&
           this.isValidEmail(this.email);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  onSubmit(): void {
    if (!this.isValid() || this.isLoading) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.sessionService.createSession(this.name.trim(), this.email.trim())
      .subscribe({
        next: (response) => {
          console.log('Session created:', response.session_id);
          // Componente pai vai detectar via observable e iniciar o jogo
        },
        error: (err) => {
          console.error('Failed to create session:', err);
          this.errorMessage = 'Erro ao iniciar sessão. Tente novamente.';
          this.isLoading = false;
        }
      });
  }
}
```

**Arquivo:** `src/app/quest-adventure/components/quest-welcome/quest-welcome.component.scss`

```scss
.welcome-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  animation: fadeIn 0.5s ease-in;
}

.welcome-content {
  text-align: center;
  color: white;
  max-width: 500px;
  padding: 40px;
  background: linear-gradient(135deg, rgba(74, 144, 226, 0.1), rgba(123, 104, 238, 0.1));
  border-radius: 20px;
  border: 2px solid rgba(255, 215, 0, 0.3);
}

.welcome-title {
  font-size: 3rem;
  font-weight: bold;
  margin-bottom: 10px;
  background: linear-gradient(45deg, #FFD700, #FFA500);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.welcome-subtitle {
  font-size: 1.5rem;
  color: #FFD700;
  margin-bottom: 30px;
  opacity: 0.9;
}

.welcome-description {
  font-size: 1.1rem;
  margin-bottom: 30px;
  color: rgba(255, 255, 255, 0.9);
}

.input-group {
  margin-bottom: 20px;
  text-align: left;

  label {
    display: block;
    font-size: 1rem;
    color: #FFD700;
    margin-bottom: 8px;
    font-weight: bold;
  }

  input {
    width: 100%;
    padding: 12px 20px;
    font-size: 1.1rem;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 215, 0, 0.3);
    border-radius: 10px;
    color: white;
    outline: none;
    transition: all 0.3s ease;

    &::placeholder {
      color: rgba(255, 255, 255, 0.5);
    }

    &:focus {
      background: rgba(255, 255, 255, 0.15);
      border-color: #FFD700;
      box-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.error-message {
  color: #ff4444;
  background: rgba(255, 68, 68, 0.1);
  padding: 10px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 0.9rem;
}

.start-button {
  width: 100%;
  padding: 15px 40px;
  font-size: 1.2rem;
  font-weight: bold;
  color: #1a252f;
  background: linear-gradient(45deg, #FFD700, #FFA500);
  border: none;
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3);
  margin-bottom: 20px;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(255, 215, 0, 0.5);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
}

.privacy-note {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 10px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;

  .spinner {
    width: 60px;
    height: 60px;
    border: 4px solid rgba(255, 215, 0, 0.1);
    border-top-color: #FFD700;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  p {
    color: #FFD700;
    font-size: 1.2rem;
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

// Mobile
@media (max-width: 768px) {
  .welcome-content {
    padding: 20px;
    margin: 20px;
    max-width: 90%;
  }

  .welcome-title {
    font-size: 2rem;
  }

  .welcome-subtitle {
    font-size: 1.2rem;
  }
}
```

---

### **FASE 2: Refatoração do Quest State** (6-8 horas)

#### 2.1. Refatorar `QuestStateService`

**Arquivo:** `src/app/quest-adventure/services/quest-state.service.ts`

**Mudanças principais:**

```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { PlayerState, Quest, QuestObjective, SaveGameState } from '../models/quest.models';
import { QuestSessionService } from './quest-session.service';

@Injectable({ providedIn: 'root' })
export class QuestStateService {
  // ❌ REMOVER: localStorage
  // private readonly SAVE_KEY = 'conductor_quest_save';

  private stateVersion: number = 0;
  private autoSaveInterval: any;

  // Estado do Player (mantém mesma estrutura)
  private playerState: PlayerState = {
    position: { x: 512, y: 400 },
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    title: 'Iniciado',
    inventory: [],
    unlockedNPCs: ['elder_guide'],
    completedObjectives: [],
    dialogueFlags: {}
  };

  // Quest Principal (mantém mesma estrutura)
  private mainQuest: Quest = { /* ... mesmo código ... */ };

  // Observables (mantém mesmos)
  private playerStateSubject = new BehaviorSubject<PlayerState>(this.playerState);
  private objectivesSubject = new BehaviorSubject<QuestObjective[]>(this.mainQuest.objectives);
  private playerLevelSubject = new BehaviorSubject<number>(this.playerState.level);
  private playerXPSubject = new BehaviorSubject<number>(this.playerState.xp);
  private xpToNextLevelSubject = new BehaviorSubject<number>(this.playerState.xpToNextLevel);

  playerState$ = this.playerStateSubject.asObservable();
  objectives$ = this.objectivesSubject.asObservable();
  playerLevel$ = this.playerLevelSubject.asObservable();
  playerXP$ = this.playerXPSubject.asObservable();
  xpToNextLevel$ = this.xpToNextLevelSubject.asObservable();

  private readonly XP_PER_LEVEL = [0, 100, 300, 600, 1000];

  constructor(private sessionService: QuestSessionService) {
    // ✅ NOVO: Observa mudanças de sessão
    this.sessionService.session$.subscribe(session => {
      if (session) {
        this.loadStateFromSession();
        this.startAutoSave();
      } else {
        this.stopAutoSave();
      }
    });
  }

  /**
   * ✅ NOVO: Carrega estado inicial ou existente da sessão
   */
  async loadOrInitialize(): Promise<boolean> {
    if (!this.sessionService.hasActiveSession()) {
      return false;
    }

    try {
      const sessionState = await this.sessionService.getSessionState().toPromise();
      if (sessionState) {
        this.loadStateFromSessionData(sessionState);
        return true;
      }
    } catch (error) {
      console.error('Failed to load session state:', error);
    }

    return false;
  }

  /**
   * ✅ NOVO: Carrega estado da sessão atual
   */
  private async loadStateFromSession(): Promise<void> {
    try {
      const sessionState = await this.sessionService.getSessionState().toPromise();
      if (sessionState) {
        this.loadStateFromSessionData(sessionState);
      }
    } catch (error) {
      console.error('Failed to load state from session:', error);
      // Se falhar, inicia com estado padrão
      this.initializeNewGame();
    }
  }

  /**
   * ✅ NOVO: Carrega dados da sessão para o estado local
   */
  private loadStateFromSessionData(sessionState: any): void {
    this.stateVersion = sessionState.version;

    // Restaura estado
    this.playerState = sessionState.state.playerState;
    this.mainQuest.currentObjective = sessionState.state.questProgress.currentObjectiveIndex;

    // Restaura objetivos completados
    sessionState.state.playerState.completedObjectives.forEach((objId: string) => {
      const objective = this.mainQuest.objectives.find(o => o.id === objId);
      if (objective) {
        objective.completed = true;
      }
    });

    this.updateObservables();
    console.log('Quest state loaded from session');
  }

  /**
   * Inicia novo jogo (mantém mesma lógica)
   */
  startNewQuest() {
    this.initializeNewGame();
    this.saveState();
  }

  private initializeNewGame() {
    this.playerState = {
      position: { x: 512, y: 400 },
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      title: 'Iniciado',
      inventory: [],
      unlockedNPCs: ['elder_guide'],
      completedObjectives: [],
      dialogueFlags: {}
    };

    this.mainQuest.currentObjective = 0;
    this.mainQuest.objectives.forEach(obj => obj.completed = false);

    this.updateObservables();
  }

  /**
   * ✅ REFATORADO: Salva no backend via sessão
   */
  saveState() {
    if (!this.sessionService.hasActiveSession()) {
      console.warn('No active session to save');
      return;
    }

    const saveData: SaveGameState = {
      playerState: this.playerState,
      questProgress: {
        currentQuestId: this.mainQuest.id,
        currentObjectiveIndex: this.mainQuest.currentObjective,
        completedQuests: this.mainQuest.completed ? [this.mainQuest.id] : []
      },
      npcStates: this.getNPCStates()
    };

    this.sessionService.saveSessionState(saveData, this.stateVersion)
      .subscribe({
        next: (response) => {
          this.stateVersion = response.version;
          console.log('Quest state saved successfully');
        },
        error: (err) => {
          console.error('Failed to save quest state:', err);
          // TODO: Implementar retry logic
        }
      });
  }

  /**
   * ✅ NOVO: Auto-save a cada 30 segundos
   */
  private startAutoSave(): void {
    this.stopAutoSave();

    this.autoSaveInterval = setInterval(() => {
      this.saveState();
    }, 30000);
  }

  private stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  // ❌ REMOVER: Métodos de localStorage
  // private loadState(): boolean { ... }

  // ✅ MANTER: Todos os outros métodos (completeObjective, grantXP, etc)
  // ... resto do código permanece igual
}
```

---

### **FASE 3: Integração no Componente Principal** (3-4 horas)

#### 3.1. Atualizar `QuestAdventureComponent`

**Arquivo:** `src/app/quest-adventure/quest-adventure.component.ts`

```typescript
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuestCanvasComponent } from './components/quest-canvas/quest-canvas.component';
import { QuestChatModalComponent } from './components/quest-chat-modal/quest-chat-modal.component';
import { QuestTrackerComponent } from './components/quest-tracker/quest-tracker.component';
import { QuestWelcomeComponent } from './components/quest-welcome/quest-welcome.component';
import { QuestStateService } from './services/quest-state.service';
import { QuestSessionService } from './services/quest-session.service';
import { NpcManagerService } from './services/npc-manager.service';
import { PlayerMovementService } from './services/player-movement.service';
import { DialogueService } from './services/dialogue.service';
import { NPC, Position, QuestObjective, DialogueOption } from './models/quest.models';
import { Subject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';

@Component({
  selector: 'app-quest-adventure',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    QuestCanvasComponent,
    QuestChatModalComponent,
    QuestTrackerComponent,
    QuestWelcomeComponent
  ],
  template: `
    <div class="quest-container" [class.mobile]="isMobile">
      <!-- ✅ NOVO: Tela de Welcome (Lead Capture) -->
      <app-quest-welcome
        *ngIf="!hasActiveSession">
      </app-quest-welcome>

      <!-- Jogo (apenas quando tem sessão ativa) -->
      <ng-container *ngIf="hasActiveSession">
        <!-- Canvas Principal (Mapa do Salão) -->
        <app-quest-canvas
          [npcs]="npcs$ | async"
          [playerPosition]="playerPosition$ | async"
          [isPlayerMoving]="isMoving$ | async"
          [playerName]="playerName"
          [focusTarget]="focusTarget"
          (onCanvasClick)="handleCanvasClick($event)"
          (onCanvasResize)="handleCanvasResize($event)">
        </app-quest-canvas>

        <!-- Quest Tracker (Objetivos) -->
        <app-quest-tracker
          [questTitle]="currentQuestTitle"
          [objectives]="questObjectives$ | async"
          [playerLevel]="playerLevel$ | async"
          [playerXP]="playerXP$ | async"
          [xpToNextLevel]="xpToNextLevel$ | async"
          (onReset)="handleReset()">
        </app-quest-tracker>

        <!-- Chat Modal (Diálogos com NPCs) -->
        <app-quest-chat-modal
          *ngIf="activeDialogue$ | async as dialogue"
          [npc]="dialogue.npc"
          [message]="dialogue.message"
          [options]="dialogue.options"
          [isTyping]="dialogue.isTyping"
          (onOptionSelect)="handleDialogueChoice($event)"
          (onClose)="closeDialogue()">
        </app-quest-chat-modal>

        <!-- Loading Screen -->
        <div class="loading-overlay" *ngIf="isLoading">
          <div class="loading-spinner"></div>
          <p class="loading-text">Preparando o Salão da Guilda...</p>
        </div>
      </ng-container>
    </div>
  `,
  styleUrls: ['./quest-adventure.component.scss']
})
export class QuestAdventureComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // ✅ NOVO: Estado da sessão
  hasActiveSession = false;

  // Estado Observable (mantém mesmos)
  npcs$;
  playerPosition$;
  isMoving$;
  questObjectives$;
  playerLevel$;
  playerXP$;
  xpToNextLevel$;
  activeDialogue$;

  // Estado Local (mantém mesmos)
  currentQuestTitle = "O Estandarte da Guilda";
  isLoading = false;
  isMobile = false;
  focusTarget: string | null = null;
  playerName = '';

  constructor(
    private questState: QuestStateService,
    private sessionService: QuestSessionService,  // ✅ NOVO
    private npcManager: NpcManagerService,
    private movement: PlayerMovementService,
    private dialogue: DialogueService
  ) {
    // Inicializa observables
    this.npcs$ = this.npcManager.npcs$;
    this.playerPosition$ = this.movement.position$;
    this.isMoving$ = this.movement.isMoving$;
    this.questObjectives$ = this.questState.objectives$;
    this.playerLevel$ = this.questState.playerLevel$;
    this.playerXP$ = this.questState.playerXP$;
    this.xpToNextLevel$ = this.questState.xpToNextLevel$;
    this.activeDialogue$ = this.dialogue.activeDialogue$;

    this.checkMobileDevice();
  }

  ngOnInit() {
    // ✅ NOVO: Observa mudanças de sessão
    this.sessionService.session$
      .pipe(takeUntil(this.destroy$))
      .subscribe(session => {
        if (session) {
          this.hasActiveSession = true;
          this.playerName = session.name;
          this.initializeQuest();
        } else {
          this.hasActiveSession = false;
        }
      });

    // Verifica se já tem sessão ativa ao iniciar
    if (this.sessionService.hasActiveSession()) {
      this.hasActiveSession = true;
    }

    this.setupEventListeners();
  }

  ngOnDestroy() {
    // Salva antes de sair
    if (this.hasActiveSession) {
      this.questState.saveState();
    }

    this.destroy$.next();
    this.destroy$.complete();
  }

  private async initializeQuest() {
    this.isLoading = true;

    try {
      // Carrega estado da sessão
      await this.questState.loadOrInitialize();

      // Inicializa NPCs
      await this.npcManager.loadNPCs();

      // Setup inicial do mapa
      this.setupInitialState();

    } catch (error) {
      console.error('Erro ao inicializar quest:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private setupInitialState() {
    // Posiciona player no centro
    this.movement.setPosition({ x: 512, y: 400 });

    // Desbloqueia o Guia e a Biblioteca inicialmente
    this.npcManager.unlockNPC('elder_guide');
    this.npcManager.unlockNPC('librarian');
  }

  private setupEventListeners() {
    // Escuta mudanças de objetivos
    this.questState.objectives$
      .pipe(takeUntil(this.destroy$))
      .subscribe(objectives => {
        this.updateFocusTarget(objectives);
      });

    // Auto-save gerenciado pelo QuestStateService
  }

  handleReset() {
    // ✅ NOVO: Limpa sessão e volta para welcome screen
    this.sessionService.clearSession();
    this.hasActiveSession = false;

    // Reseta estado do jogo
    this.questState.startNewQuest();

    // Recarrega a página para limpar tudo
    window.location.reload();
  }

  // ... resto dos métodos mantém mesma implementação
  // handleCanvasClick, handleNpcInteract, handleDialogueChoice, etc
}
```

---

### **FASE 4: Rotas (Opcional)** (1-2 horas)

**Nota:** Como é uma única tela, rotas são opcionais.

```typescript
// Se quiser separar em rotas:
const routes: Routes = [
  {
    path: 'quest',
    component: QuestAdventureComponent
    // Sem guards - validação de sessão dentro do componente
  }
];
```

---

## 🔄 Fluxos Principais

### Fluxo 1: Primeira Visita

```
1. Usuário acessa /quest
2. sessionStorage está vazio → mostra QuestWelcomeComponent
3. Usuário preenche nome + email
4. Clica "Começar Aventura"
5. POST /api/quest/sessions → cria sessão
6. session_id salvo em sessionStorage
7. QuestWelcomeComponent desaparece
8. Jogo inicia com estado inicial
9. Auto-save a cada 30 segundos
```

### Fluxo 2: Recarregar Página (mesma sessão)

```
1. Usuário recarrega página
2. sessionStorage tem session_id válido
3. GET /api/quest/sessions/{id}/state → carrega progresso
4. Jogo continua de onde parou
5. Não pede nome/email novamente
```

### Fluxo 3: Nova Aba / Sessão Expirada

```
1. Usuário abre nova aba ou volta depois de 24h
2. sessionStorage vazio OU sessão expirada (410)
3. Mostra QuestWelcomeComponent novamente
4. Pede nome + email (novo lead capture)
5. Cria nova sessão
6. Começa jogo do zero
```

### Fluxo 4: Reset Manual

```
1. Usuário clica em "Resetar"
2. sessionStorage é limpo
3. Volta para QuestWelcomeComponent
4. Processo recomeça (novo lead capture)
```

---

## 📊 Estimativa de Esforço

| Fase | Descrição | Horas | Prioridade |
|------|-----------|-------|------------|
| 1 | Lead Capture e Sessão | 4-6 | ALTA |
| 2 | Refatoração Quest State | 6-8 | ALTA |
| 3 | Integração Componente Principal | 3-4 | ALTA |
| 4 | Rotas (opcional) | 1-2 | BAIXA |
| **TOTAL** | | **14-20 horas** | |

**Complexidade:** BAIXA-MÉDIA

---

## ✅ Checklist de Implementação

### Backend
- [ ] Endpoint: POST /api/quest/sessions (criar sessão + lead capture)
- [ ] Endpoint: GET /api/quest/sessions/{id}/state (carregar estado)
- [ ] Endpoint: PUT /api/quest/sessions/{id}/state (salvar estado)
- [ ] Endpoint: GET /api/quest/admin/leads (analytics - opcional)
- [ ] Lógica de expiração de sessão (24 horas)
- [ ] Registro de leads no banco de dados

### Serviços
- [ ] Criar `QuestSessionService`
- [ ] Refatorar `QuestStateService` (remover localStorage, usar session)
- [ ] Manter `NpcManagerService`
- [ ] Manter `PlayerMovementService`
- [ ] Manter `DialogueService`

### Componentes
- [ ] Criar `QuestWelcomeComponent` (lead capture)
- [ ] Atualizar `QuestAdventureComponent` (integrar sessão)
- [ ] Manter `QuestCanvasComponent`
- [ ] Manter `QuestChatModalComponent`
- [ ] Manter `QuestTrackerComponent`

### Modelos
- [ ] Adicionar `QuestSession` interface
- [ ] Adicionar `CreateSessionRequest` interface
- [ ] Adicionar `CreateSessionResponse` interface
- [ ] Adicionar `SessionState` interface
- [ ] Manter `SaveGameState` (sem mudanças)

### Integração
- [ ] Implementar tratamento de sessão expirada (410)
- [ ] Implementar tratamento de conflitos de versão (409)
- [ ] Adicionar loading states
- [ ] Adicionar error handling
- [ ] Auto-save a cada 30 segundos
- [ ] Save ao fechar aba (onBeforeUnload)

### Testes
- [ ] Testar lead capture (nome + email)
- [ ] Testar criação de sessão
- [ ] Testar save/load do estado
- [ ] Testar recarregar página (sessão ativa)
- [ ] Testar sessão expirada
- [ ] Testar nova aba (sem sessão)
- [ ] Testar reset manual
- [ ] Testar auto-save

---

## 🎯 Próximos Passos

1. **Backend:** Implementar 3 endpoints principais
2. **Frontend:** Fase 1 (Lead Capture + Sessão)
3. **Frontend:** Fase 2 (Refatoração Quest State)
4. **Frontend:** Fase 3 (Integração)
5. **Testes:** Validar todos os fluxos
6. **Analytics:** Verificar leads no banco

---

## 📝 Notas Importantes

### Lead Capture
- **Objetivo:** Coletar nome + email a cada acesso
- Permite múltiplas sessões para mesmo email (analytics)
- Sem validação de duplicidade (propositalmente)
- Backend registra todos os acessos

### Sessão Temporária
- **Duração:** 24 horas a partir da criação
- Armazenada em `sessionStorage` (limpa ao fechar navegador)
- Progresso salvo no backend durante a sessão
- Expiração gerenciada pelo backend

### Progresso
- ✅ Mantido ao recarregar página (mesma sessão)
- ❌ Perdido ao fechar navegador
- ❌ Perdido após 24 horas
- ✅ Salvo automaticamente a cada 30 segundos

### Analytics
- Backend tem histórico de todas as sessões
- Pode rastrear: quantas vezes um email jogou, tempo médio, nível alcançado
- Dados valiosos para marketing e produto

### ♻️ Reutilização de Código

**✅ Seguir padrões existentes:**
- `ConversationService` como referência para estrutura de serviços
- `environment.apiUrl` para base URL da API
- Observable/RxJS para gerenciamento de estado
- Injeção de dependências Angular padrão

**✅ Mantidos sem mudanças:**
- Todos os componentes de UI do jogo (canvas, chat, tracker)
- Sistema de NPCs
- Sistema de diálogo
- Sistema de movimento
- Modelos de quest/player/npc

**❌ Removido vs Plano Original:**
- Sistema de autenticação JWT
- Gerenciamento de múltiplos bonecos
- Login/logout tradicional
- HTTP Interceptors
- Route Guards
- Persistência entre sessões

---

**Documento criado em:** 2025-11-09
**Versão:** 2.0 (Modelo Híbrido - Lead Capture + Sessão Temporária)
**Autor:** Claude Code Assistant
