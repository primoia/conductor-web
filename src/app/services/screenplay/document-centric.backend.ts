import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Editor } from '@tiptap/core';
import { ScreenplayBackend, ScreenplayState, EditorChange } from './screenplay-backend.interface';

@Injectable({
  providedIn: 'root'
})
export class DocumentCentricBackend implements ScreenplayBackend {

  private editor!: Editor;
  private state$: BehaviorSubject<ScreenplayState>;

  constructor() {
    console.log('🛸 DocumentCentricBackend constructor');
    // O estado inicial pode ser um documento vazio.
    const initialState: ScreenplayState = {
      editorJson: { type: 'doc', content: [] }
    };
    this.state$ = new BehaviorSubject<ScreenplayState>(initialState);
  }

  /**
   * Associa uma instância do editor TipTap a este backend.
   */
  setEditor(editor: Editor) {
    this.editor = editor;
    // Ouve as atualizações do editor para manter o estado sincronizado.
    this.editor.on('update', () => {
      this.state$.next({ editorJson: this.editor.getJSON() });
    });
  }

  getState(): Observable<ScreenplayState> {
    return this.state$.asObservable();
  }

  applyChange(change: EditorChange): void {
    if (!this.editor) {
      console.error('Editor não inicializado no backend.');
      return;
    }

    // Lógica do MVP: um comando hardcoded
    if (change.intent === 'add_title') {
      this.editor.chain().focus().insertContentAt(0, '<h1>Título Inserido via Agente</h1><p></p>').run();
    }

    // Futuramente, aqui teremos a lógica para interpretar diferentes 'intents'.
  }
}
