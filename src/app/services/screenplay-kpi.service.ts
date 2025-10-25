import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ScreenplayKpiService {
  private investigationsActiveSubject = new BehaviorSubject<number>(0);
  public readonly investigationsActive$ = this.investigationsActiveSubject.asObservable();

  incrementInvestigations(): void {
    this.investigationsActiveSubject.next(this.investigationsActiveSubject.value + 1);
  }

  decrementInvestigations(): void {
    const next = Math.max(0, this.investigationsActiveSubject.value - 1);
    this.investigationsActiveSubject.next(next);
  }

  reset(): void {
    this.investigationsActiveSubject.next(0);
  }
}
