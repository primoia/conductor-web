import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Screenplay } from '../../services/screenplay-storage';

@Component({
  selector: 'app-file-path-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-path-info.component.html',
  styleUrl: './file-path-info.component.scss'
})
export class FilePathInfoComponent {
  @Input() screenplay: Screenplay | null = null;

  get hasPathInfo(): boolean {
    return !!(this.screenplay?.importPath || this.screenplay?.exportPath || this.screenplay?.filePath);
  }

  get displayImportPath(): string {
    return this.screenplay?.importPath || this.screenplay?.filePath || '';
  }

  get displayExportPath(): string {
    return this.screenplay?.exportPath || '';
  }

  /**
   * Get short filename from full path
   */
  getShortPath(path: string): string {
    if (!path) return '';

    // Extract just the filename from the path
    const parts = path.split(/[\\/]/);
    return parts[parts.length - 1] || path;
  }

  /**
   * Copy path to clipboard
   */
  copyPath(path: string, event: Event): void {
    event.stopPropagation();

    if (navigator.clipboard) {
      navigator.clipboard.writeText(path).then(() => {
        console.log('Path copied to clipboard:', path);
      }).catch(err => {
        console.error('Failed to copy path:', err);
      });
    }
  }
}
