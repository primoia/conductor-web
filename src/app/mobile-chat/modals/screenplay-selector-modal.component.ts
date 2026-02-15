import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ScreenplayStorage, ScreenplayListItem } from '../../services/screenplay-storage';

@Component({
  selector: 'app-screenplay-selector-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" *ngIf="isVisible" (click)="onClose()">
      <div class="modal-container" (click)="$event.stopPropagation()" (touchstart)="$event.stopPropagation()" (touchend)="$event.stopPropagation()">
        <!-- Header -->
        <div class="modal-header">
          <h3 class="modal-title">Selecionar Roteiro</h3>
          <button class="header-btn" (click)="onCreate()" title="Novo roteiro">➕</button>
          <button class="close-btn" (click)="onClose()">✕</button>
        </div>

        <!-- Search -->
        <div class="search-bar">
          <input
            type="text"
            class="search-input"
            inputmode="text"
            placeholder="Buscar roteiro..."
            [(ngModel)]="searchQuery"
            (ngModelChange)="onSearchChange($event)"
            (touchend)="$event.stopPropagation()"
          />
        </div>

        <!-- Body -->
        <div class="modal-body" (scroll)="onScroll($event)">
          <div class="loading-state" *ngIf="isLoading && screenplays.length === 0">
            <div class="spinner"></div>
            <span>Carregando roteiros...</span>
          </div>

          <div class="empty-state" *ngIf="!isLoading && screenplays.length === 0">
            <span class="empty-icon">📝</span>
            <span>{{ searchQuery ? 'Nenhum roteiro encontrado.' : 'Nenhum roteiro disponivel.' }}</span>
          </div>

          <div
            *ngFor="let sp of screenplays"
            class="screenplay-card"
            [class.active]="sp.id === activeScreenplayId"
            (click)="onSelect(sp.id)">
            <div class="card-top-row">
              <div class="card-title">{{ sp.name }}</div>
              <div class="card-actions" (click)="$event.stopPropagation()">
                <button class="card-action-btn" (click)="onEdit(sp.id)" title="Editar">✎</button>
                <button class="card-action-btn delete" (click)="confirmDelete(sp)" title="Excluir">🗑️</button>
              </div>
            </div>
            <div class="card-meta">
              <span class="card-date">{{ formatDate(sp.updatedAt) }}</span>
              <span class="card-tags" *ngIf="sp.tags?.length">
                <span class="tag" *ngFor="let tag of sp.tags!.slice(0, 3)">{{ tag }}</span>
              </span>
            </div>
            <div class="card-path" *ngIf="sp.importPath">
              {{ getDisplayPath(sp) }}
            </div>
            <div class="card-description" *ngIf="sp.description">
              {{ sp.description | slice:0:120 }}{{ (sp.description?.length || 0) > 120 ? '...' : '' }}
            </div>
          </div>

          <!-- Loading more -->
          <div class="loading-more" *ngIf="isLoading && screenplays.length > 0">
            <div class="spinner small"></div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 2000;
      display: flex;
      align-items: stretch;
      justify-content: center;
      padding: 0;
    }

    .modal-container {
      width: 100%;
      height: 100%;
      background: #fff;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    @media (min-width: 768px) {
      .modal-backdrop {
        align-items: center;
        padding: 24px;
      }
      .modal-container {
        width: 90%;
        max-width: 800px;
        height: 85vh;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      }
    }

    .modal-header {
      display: flex;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      flex-shrink: 0;
      gap: 8px;
    }

    .modal-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      flex: 1;
    }

    .header-btn {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.2s;
    }

    .header-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .close-btn {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.2s;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .search-bar {
      padding: 12px 16px;
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
    }

    .search-input {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 15px;
      outline: none;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    .search-input:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
    }

    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 12px 16px;
      -webkit-overflow-scrolling: touch;
    }

    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 40px;
      color: #64748b;
    }

    .empty-icon {
      font-size: 40px;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #e2e8f0;
      border-top-color: #667eea;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .spinner.small {
      width: 20px;
      height: 20px;
      border-width: 2px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loading-more {
      display: flex;
      justify-content: center;
      padding: 16px;
    }

    .screenplay-card {
      padding: 14px 16px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      margin-bottom: 10px;
      cursor: pointer;
      transition: all 0.2s;
      background: #fff;
    }

    .screenplay-card:hover {
      border-color: #667eea;
      background: #f8faff;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.12);
    }

    .screenplay-card:active {
      transform: translateY(0);
    }

    .screenplay-card.active {
      border-color: #667eea;
      background: #eff3ff;
      box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
    }

    .card-top-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }

    .card-title {
      flex: 1;
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 6px;
      min-width: 0;
    }

    .card-actions {
      display: flex;
      gap: 2px;
      flex-shrink: 0;
      opacity: 0.5;
      transition: opacity 0.2s;
    }

    .screenplay-card:hover .card-actions {
      opacity: 1;
    }

    .card-action-btn {
      width: 28px;
      height: 28px;
      border: none;
      background: #f1f5f9;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }

    .card-action-btn:hover {
      background: #e2e8f0;
      transform: scale(1.1);
    }

    .card-action-btn.delete:hover {
      background: #fee2e2;
    }

    .card-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .card-date {
      font-size: 12px;
      color: #94a3b8;
    }

    .card-tags {
      display: flex;
      gap: 4px;
    }

    .tag {
      font-size: 11px;
      padding: 2px 6px;
      background: #f1f5f9;
      color: #64748b;
      border-radius: 4px;
    }

    .card-path {
      font-size: 12px;
      color: #94a3b8;
      margin-bottom: 4px;
      font-family: 'SF Mono', 'Consolas', monospace;
    }

    .card-description {
      font-size: 13px;
      color: #64748b;
      line-height: 1.4;
    }
  `]
})
export class ScreenplaySelectorModalComponent implements OnChanges, OnDestroy {
  @Input() isVisible = false;
  @Input() activeScreenplayId: string | null = null;
  @Output() screenplaySelected = new EventEmitter<string>();
  @Output() editScreenplay = new EventEmitter<string | null>(); // null = create new
  @Output() closeModal = new EventEmitter<void>();

  screenplays: ScreenplayListItem[] = [];
  searchQuery = '';
  isLoading = false;
  currentPage = 1;
  totalPages = 1;
  private searchSubject = new Subject<string>();
  private subscription = new Subscription();

  constructor(private screenplayStorage: ScreenplayStorage) {
    this.subscription.add(
      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(query => {
        this.currentPage = 1;
        this.screenplays = [];
        this.loadScreenplays(query);
      })
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible'] && this.isVisible) {
      this.currentPage = 1;
      this.screenplays = [];
      this.searchQuery = '';
      this.loadScreenplays('');
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  onSearchChange(query: string): void {
    this.searchSubject.next(query);
  }

  onScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const threshold = 100;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;

    if (atBottom && !this.isLoading && this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadScreenplays(this.searchQuery);
    }
  }

  private loadScreenplays(search: string): void {
    this.isLoading = true;

    this.screenplayStorage.getScreenplays(search, this.currentPage, 20).subscribe({
      next: (response) => {
        if (this.currentPage === 1) {
          this.screenplays = response.items;
        } else {
          this.screenplays = [...this.screenplays, ...response.items];
        }
        this.totalPages = response.pages;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        console.error('[ScreenplaySelector] Error loading screenplays:', err);
      }
    });
  }

  reloadList(): void {
    this.currentPage = 1;
    this.screenplays = [];
    this.loadScreenplays(this.searchQuery);
  }

  onCreate(): void {
    this.editScreenplay.emit(null);
  }

  onEdit(id: string): void {
    this.editScreenplay.emit(id);
  }

  confirmDelete(sp: ScreenplayListItem): void {
    if (confirm(`Excluir o roteiro "${sp.name}"?\n\nEsta acao nao pode ser desfeita.`)) {
      this.screenplayStorage.deleteScreenplay(sp.id).subscribe({
        next: () => {
          this.reloadList();
        },
        error: (err) => {
          console.error('[ScreenplaySelector] Error deleting screenplay:', err);
        }
      });
    }
  }

  onSelect(id: string): void {
    this.screenplaySelected.emit(id);
  }

  onClose(): void {
    this.closeModal.emit();
  }

  getDisplayPath(sp: ScreenplayListItem): string {
    if (!sp.importPath) return '';
    let path = sp.importPath;
    const prefixes = ['/mnt/ramdisk/primoia-main/', '/home/', '/Users/'];
    for (const prefix of prefixes) {
      const idx = path.indexOf(prefix);
      if (idx !== -1) {
        path = path.substring(idx + prefix.length);
        // Remove username segment for /home/ and /Users/
        if (prefix !== '/mnt/ramdisk/primoia-main/') {
          const slashIdx = path.indexOf('/');
          if (slashIdx !== -1) path = path.substring(slashIdx + 1);
        }
        break;
      }
    }
    return path;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
