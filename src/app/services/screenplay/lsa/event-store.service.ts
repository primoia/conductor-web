import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { ScreenplayEvent } from './screenplay-events';

@Injectable({
  providedIn: 'root'
})
export class EventStoreService {
  constructor() {
    console.log('📦 EventStoreService constructor');
  }

  // Log de eventos privado e imutável
  private events: ScreenplayEvent[] = [];

  // Subject para notificar assinantes sobre novos eventos
  private newEvent$ = new Subject<ScreenplayEvent>();

  /**
   * Adiciona um novo evento ao log e notifica os assinantes.
   */
  append(event: ScreenplayEvent): void {
    this.events.push(event);
    this.newEvent$.next(event);
    console.log(`[EventStore] Event Appended: ${event.type}`, event);
  }

  /**
   * Retorna uma cópia de todos os eventos no log.
   */
  getAllEvents(): ScreenplayEvent[] {
    return [...this.events];
  }

  /**
   * Permite que outros serviços observem novos eventos sendo adicionados.
   */
  getNewEventStream(): Observable<ScreenplayEvent> {
    return this.newEvent$.asObservable();
  }
}
