import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Editor } from '@tiptap/core';

// Tipos preliminares. Serão expandidos no futuro.
export interface ScreenplayState {
  // Por enquanto, pode ser o JSON do TipTap
  editorJson: any;
}

export interface EditorChange {
  // A intenção ou comando do usuário/IA
  intent: string;
  // Dados adicionais
  payload?: any;
}

export interface ScreenplayBackend {
  /**
   * Define o editor TipTap para o backend.
   */
  setEditor(editor: Editor): void;

  /**
   * Retorna um Observable que emite o estado atual do screenplay sempre que ele muda.
   */
  getState(): Observable<ScreenplayState>;

  /**
   * Aplica uma mudança ao screenplay.
   * @param change A mudança a ser aplicada.
   */
  applyChange(change: EditorChange): void;
}

export const SCREENPLAY_BACKEND = new InjectionToken<ScreenplayBackend>('screenplay.backend');
