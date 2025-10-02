import { Injectable, Inject } from '@angular/core';
import { Editor } from '@tiptap/core';
import { Observable } from 'rxjs';
import { ScreenplayBackend, ScreenplayState, EditorChange, SCREENPLAY_BACKEND } from './screenplay-backend.interface';

@Injectable({
  providedIn: 'root'
})
export class ScreenplayService {

  // O backend agora é injetado de forma abstrata
  constructor(@Inject(SCREENPLAY_BACKEND) private backend: ScreenplayBackend) {
    console.log('✅ ScreenplayService constructor');
  }

  /**
   * Conecta o serviço a uma instância do editor TipTap.
   */
  initialize(editor: Editor) {
    // A chamada agora é genérica e funciona para qualquer backend
    this.backend.setEditor(editor);
  }

  /**
   * Expõe o estado do backend para os componentes.
   */
  getState(): Observable<ScreenplayState> {
    return this.backend.getState();
  }

  /**
   * Recebe uma intenção da UI e a repassa para o backend.
   */
  dispatch(change: EditorChange): void {
    this.backend.applyChange(change);
  }
}
