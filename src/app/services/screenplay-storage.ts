import { Injectable } from '@angular/core';
import { Observable, from, throwError, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';

/**
 * Screenplay list item (lightweight for listing)
 */
export interface ScreenplayListItem {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  working_directory?: string; // Working directory padrão para agentes (snake_case do backend)
  workingDirectory?: string; // DEPRECATED: Compatibilidade com versões antigas (camelCase)
  version: number;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string; // Timestamp da última vez que o screenplay foi usado
  isDeleted: boolean;
  filePath?: string; // Caminho do arquivo no disco (mantido para compatibilidade)
  importPath?: string; // Novo: caminho de importação
  exportPath?: string; // Novo: último caminho de exportação
  fileKey?: string; // Novo: chave única para detecção de duplicatas
}

/**
 * Complete screenplay document (includes content)
 */
export interface Screenplay extends ScreenplayListItem {
  content: string;
}

/**
 * Paginated list response
 */
export interface ScreenplayListResponse {
  items: ScreenplayListItem[];
  total: number;
  page: number;
  pages: number;
}

/**
 * Create/Update screenplay payload
 */
export interface ScreenplayPayload {
  name: string;
  description?: string;
  tags?: string[];
  content?: string;
  working_directory?: string; // Working directory padrão para agentes (snake_case para o backend)
  workingDirectory?: string; // DEPRECATED: Compatibilidade com versões antigas (camelCase)
  filePath?: string; // Caminho do arquivo no disco (mantido para compatibilidade)
  importPath?: string; // Novo: caminho de importação
  exportPath?: string; // Novo: último caminho de exportação
  fileKey?: string; // Novo: chave única para detecção de duplicatas
}

@Injectable({
  providedIn: 'root'
})
export class ScreenplayStorage {
  private baseUrl: string = '';

  constructor() {
    console.log(`[ScreenplayStorage] Using API Base URL: ${this.baseUrl || 'empty (routes have /api/)'}`);
  }

  /**
   * Get paginated list of screenplays with optional search
   * @param search Optional search query (searches in name, description, tags)
   * @param page Page number (default: 1)
   * @param limit Items per page (default: 20)
   */
  getScreenplays(search: string = '', page: number = 1, limit: number = 20): Observable<ScreenplayListResponse> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    params.append('page', page.toString());
    params.append('limit', limit.toString());

    const url = `${this.baseUrl}/api/screenplays?${params.toString()}`;

    return from(
      fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch screenplays: ${response.status} ${response.statusText}`);
        }
        return response.json();
      }).then((data: any) => {
        // 🔒 FIX: Transform snake_case from backend to camelCase for frontend
        if (data.items && Array.isArray(data.items)) {
          data.items = data.items.map((item: any) => {
            if (item.working_directory !== undefined) {
              item.workingDirectory = item.working_directory;
            }
            return item;
          });
        }
        return data as ScreenplayListResponse;
      })
    ).pipe(
      catchError(error => {
        console.error('[ScreenplayStorage] Error fetching screenplays:', error);
        return throwError(() => new Error('Failed to fetch screenplays'));
      })
    );
  }

  /**
   * Get a specific screenplay by ID (includes full content)
   * @param id Screenplay ID
   */
  getScreenplay(id: string): Observable<Screenplay> {
    return from(
      fetch(`${this.baseUrl}/api/screenplays/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch screenplay: ${response.status} ${response.statusText}`);
        }
        return response.json();
      }).then((data: any) => {
        // 🔍 DEBUG: Log raw data from backend
        console.log('🔍 [ScreenplayStorage] Raw data from backend:', {
          id: data.id,
          name: data.name,
          working_directory: data.working_directory,
          workingDirectory: data.workingDirectory
        });

        // 🔒 FIX: Transform snake_case from backend to camelCase for frontend
        if (data.working_directory !== undefined) {
          data.workingDirectory = data.working_directory;
          console.log('✅ [ScreenplayStorage] Transformed working_directory to workingDirectory:', data.workingDirectory);
        } else {
          console.warn('⚠️ [ScreenplayStorage] Backend não retornou working_directory! O campo pode não estar salvo no MongoDB ou o backend não está retornando esse campo.');
          // Garantir que workingDirectory seja null se não vier do backend
          if (data.workingDirectory === undefined) {
            data.workingDirectory = null;
          }
        }
        return data as Screenplay;
      })
    ).pipe(
      catchError(error => {
        console.error(`[ScreenplayStorage] Error fetching screenplay ${id}:`, error);
        return throwError(() => new Error('Failed to fetch screenplay'));
      })
    );
  }

  /**
   * Create a new screenplay
   * @param payload Screenplay data (name is required)
   */
  createScreenplay(payload: ScreenplayPayload): Observable<Screenplay> {
    return from(
      fetch(`${this.baseUrl}/api/screenplays`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      }).then(async response => {
        if (!response.ok) {
          // Try to get detailed error message from response body
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          try {
            const errorData = await response.json();
            if (errorData.detail) {
              errorMessage = errorData.detail;
            }
          } catch (e) {
            // If JSON parsing fails, keep the default message
          }
          throw new Error(errorMessage);
        }
        return response.json();
      })
    ).pipe(
      catchError(error => {
        console.error('[ScreenplayStorage] Error creating screenplay:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update an existing screenplay
   * @param id Screenplay ID
   * @param payload Updated screenplay data
   */
  updateScreenplay(id: string, payload: Partial<ScreenplayPayload>): Observable<Screenplay> {
    return from(
      fetch(`${this.baseUrl}/api/screenplays/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      }).then(response => {
        if (!response.ok) {
          throw new Error(`Failed to update screenplay: ${response.status} ${response.statusText}`);
        }
        return response.json();
      })
    ).pipe(
      catchError(error => {
        console.error(`[ScreenplayStorage] Error updating screenplay ${id}:`, error);
        return throwError(() => new Error('Failed to update screenplay'));
      })
    );
  }

  /**
   * Delete a screenplay (soft delete - sets isDeleted flag)
   * @param id Screenplay ID
   */
  deleteScreenplay(id: string): Observable<void> {
    return from(
      fetch(`${this.baseUrl}/api/screenplays/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(response => {
        if (!response.ok) {
          throw new Error(`Failed to delete screenplay: ${response.status} ${response.statusText}`);
        }
        // 204 No Content returns nothing
        return;
      })
    ).pipe(
      catchError(error => {
        console.error(`[ScreenplayStorage] Error deleting screenplay ${id}:`, error);
        return throwError(() => new Error('Failed to delete screenplay'));
      })
    );
  }

  /**
   * Update working directory for a screenplay
   * @param id Screenplay ID
   * @param workingDirectory Working directory path
   */
  updateWorkingDirectory(id: string, workingDirectory: string): Observable<any> {
    return from(
      fetch(`${this.baseUrl}/api/screenplays/${id}/working-directory`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ working_directory: workingDirectory })
      }).then(async response => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `Failed to update working directory: ${response.status}`);
        }
        return response.json();
      })
    ).pipe(
      catchError(error => {
        console.error(`[ScreenplayStorage] Error updating working directory for ${id}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Generate unique file key for duplicate detection
   */
  generateFileKey(filePath: string, fileName: string): string {
    const keyData = `${filePath}:${fileName}`;
    return btoa(keyData).replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * Check if a screenplay exists by file key
   */
  getByFileKey(fileKey: string): Observable<Screenplay | null> {
    return this.getScreenplays('', 1, 100).pipe(
      map(response => {
        const screenplay = response.items.find(s => s.fileKey === fileKey);
        return screenplay ? screenplay.id : null;
      }),
      switchMap(id => {
        if (id) {
          return this.getScreenplay(id).pipe(
            catchError(() => of(null))
          );
        }
        return of(null);
      }),
      catchError(() => of(null))
    );
  }

  /**
   * Check if a screenplay name exists
   */
  nameExists(name: string): Observable<boolean> {
    return this.getScreenplays('', 1, 100).pipe(
      map(response => response.items.some(s => s.name === name))
    );
  }

  /**
   * Sync file path (import or export)
   */
  syncFilePath(screenplayId: string, type: 'import' | 'export', path: string): Observable<Screenplay> {
    return this.getScreenplay(screenplayId).pipe(
      switchMap(screenplay => {
        const payload: Partial<ScreenplayPayload> = {
          filePath: path
        };

        if (type === 'import') {
          payload.importPath = path;
        } else {
          payload.exportPath = path;
        }

        return this.updateScreenplay(screenplayId, payload);
      }),
      catchError(error => {
        console.error(`[ScreenplayStorage] Error syncing file path:`, error);
        return throwError(() => new Error('Failed to sync file path'));
      })
    );
  }

  /**
   * Mark screenplay as used (updates lastUsedAt timestamp on backend)
   * @param id Screenplay ID
   */
  markScreenplayAsUsed(id: string): Observable<void> {
    return from(
      fetch(`${this.baseUrl}/api/screenplays/${id}/mark-as-used`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      }).then(response => {
        if (!response.ok) {
          throw new Error(`Failed to mark screenplay as used: ${response.status}`);
        }
      })
    ).pipe(
      catchError(error => {
        console.warn(`[ScreenplayStorage] mark-as-used failed for ${id}:`, error.message);
        return of(undefined);
      })
    );
  }
}
