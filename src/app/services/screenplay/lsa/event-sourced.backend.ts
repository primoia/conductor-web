import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, scan, startWith } from 'rxjs';
import { map } from 'rxjs/operators';
import { Editor } from '@tiptap/core';
import { ScreenplayBackend, ScreenplayState, EditorChange } from '../screenplay-backend.interface';
import { EventStoreService } from './event-store.service';
import { createEvent, ScreenplayEvent } from './screenplay-events';

@Injectable({
  providedIn: 'root'
})
export class EventSourcedBackend implements ScreenplayBackend {
  private editor!: Editor;
  private state$: Observable<ScreenplayState>;

  constructor(private eventStore: EventStoreService) {
    console.log('🚀 EventSourcedBackend constructor');
    // O estado é uma projeção do stream de eventos
    this.state$ = this.eventStore.getNewEventStream().pipe(
      startWith(this.getInitialState()), // Começa com o estado inicial
      scan(this.projectState, this.getInitialState()), // Acumula eventos para projetar o estado
      map(projection => ({ editorJson: projection })) // Mapeia para o formato ScreenplayState
    );
  }

  setEditor(editor: Editor): void {
    this.editor = editor;

    // Conecta o estado projetado ao editor
    this.state$.subscribe(state => {
      if (this.editor && !this.editor.isDestroyed) {
        // Aqui garantimos que as mudanças de estado da LSA sejam renderizadas no TipTap
        // Nota: Uma lógica de diff seria mais otimizada no futuro, mas setContent valida o fluxo.
        const currentJson = JSON.stringify(this.editor.getJSON());
        const newJson = JSON.stringify(state.editorJson);
        if (currentJson !== newJson) {
            this.editor.commands.setContent(state.editorJson, { emitUpdate: false });
        }
      }
    });
  }

  applyChange(change: EditorChange): void {
    // Traduz a "intenção" em um "evento" e o armazena
    if (change.intent === 'add_title') {
      const event = createEvent('TITLE_ADDED', {
        title: '<h1>Título Inserido via LSA</h1><p></p>',
        position: 0
      });
      this.eventStore.append(event);
    }
    // Outros intents seriam traduzidos para outros eventos aqui
  }

  getState(): Observable<ScreenplayState> {
    return this.state$;
  }

  /**
   * A função de projeção: calcula o novo estado a partir do estado anterior e de um evento.
   */
  private projectState(currentState: any, event: ScreenplayEvent): any {
    console.log('[LSA Projection] Applying event:', event.type);
    switch (event.type) {
      case 'TITLE_ADDED':
        // Lógica para inserir o título no JSON do TipTap (simplificado para o MVP)
        const newContent = [...currentState.content];
        newContent.splice(event.payload.position, 0, {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Título Inserido via LSA' }]
        });
        return { ...currentState, content: newContent };

      // Outros tipos de eventos seriam tratados aqui

      default:
        return currentState;
    }
  }

  private getInitialState(): any {
    return { type: 'doc', content: [] };
  }
}
