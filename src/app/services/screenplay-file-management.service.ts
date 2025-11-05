/**
 * 🎯 Serviço de Gerenciamento de Arquivos de Roteiro
 *
 * Responsável por gerenciar operações de arquivo relacionadas a roteiros:
 * - Importação de arquivos .md do disco
 * - Exportação de roteiros para arquivos
 * - Sincronização entre disco e banco de dados
 * - Detecção e resolução de conflitos
 * - Operações de leitura/escrita de arquivos
 *
 * Extração: Reduz ~300-400 linhas do screenplay-interactive.ts
 * Complexidade: MÉDIA
 * Risco: MÉDIO (operações críticas de arquivo)
 *
 * @author Refatoração - 2025-11-03
 */

import { Injectable } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { LoggingService } from './logging.service';
import { Screenplay } from './screenplay-storage';

/**
 * Interface para resultado de importação
 */
export interface ImportResult {
  success: boolean;
  screenplay?: Screenplay;
  error?: string;
  conflictDetected?: boolean;
  existingScreenplay?: Screenplay;
}

/**
 * Interface para resultado de exportação
 */
export interface ExportResult {
  success: boolean;
  filename?: string;
  error?: string;
}

/**
 * Interface para informações de arquivo
 */
export interface FileInfo {
  filename: string;
  content: string;
  size: number;
  lastModified?: Date;
}

/**
 * Opções de resolução de conflito
 */
export type ConflictResolution = 'overwrite' | 'keep-both' | 'cancel';

@Injectable({
  providedIn: 'root'
})
export class ScreenplayFileManagementService {

  constructor(
    private logging: LoggingService
  ) {}

  // ==========================================
  // Importação de Arquivos
  // ==========================================

  /**
   * Lê arquivo do input de file
   *
   * @param file Arquivo HTML5 File
   * @returns Observable com informações do arquivo
   */
  readFile(file: File): Observable<FileInfo> {
    this.logging.info(
      `📖 [FILE-MGMT] Lendo arquivo: ${file.name}`,
      'ScreenplayFileManagementService',
      { size: file.size, type: file.type }
    );

    return from(this.readFileAsync(file)).pipe(
      map(content => ({
        filename: file.name,
        content,
        size: file.size,
        lastModified: new Date(file.lastModified)
      })),
      catchError(error => {
        this.logging.error(
          '❌ [FILE-MGMT] Erro ao ler arquivo:',
          error,
          'ScreenplayFileManagementService'
        );
        return throwError(() => new Error(`Erro ao ler arquivo: ${error.message}`));
      })
    );
  }

  /**
   * Lê arquivo de forma assíncrona usando FileReader
   */
  private readFileAsync(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(reader.result as string);
      };

      reader.onerror = () => {
        reject(new Error('Erro ao ler arquivo'));
      };

      reader.readAsText(file, 'UTF-8');
    });
  }

  /**
   * Valida se o arquivo é um arquivo Markdown válido
   */
  validateMarkdownFile(filename: string, content: string): { valid: boolean; error?: string } {
    // Verificar extensão
    if (!filename.toLowerCase().endsWith('.md')) {
      return {
        valid: false,
        error: 'Arquivo deve ter extensão .md'
      };
    }

    // Verificar se não está vazio
    if (!content || content.trim().length === 0) {
      return {
        valid: false,
        error: 'Arquivo não pode estar vazio'
      };
    }

    // Verificar tamanho máximo (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (content.length > maxSize) {
      return {
        valid: false,
        error: 'Arquivo muito grande (máximo 10MB)'
      };
    }

    return { valid: true };
  }

  // ==========================================
  // Exportação de Arquivos
  // ==========================================

  /**
   * Exporta roteiro para arquivo .md
   *
   * @param screenplay Roteiro a ser exportado
   * @param filename Nome do arquivo (opcional, usa o nome do roteiro)
   * @returns Observable com resultado da exportação
   */
  exportToFile(screenplay: Screenplay, filename?: string): Observable<ExportResult> {
    const exportFilename = filename || this.sanitizeFilename(screenplay.name) + '.md';

    this.logging.info(
      `💾 [FILE-MGMT] Exportando roteiro: ${exportFilename}`,
      'ScreenplayFileManagementService',
      { screenplayId: screenplay.id }
    );

    return from(this.exportFileAsync(screenplay.content, exportFilename)).pipe(
      map(() => ({
        success: true,
        filename: exportFilename
      })),
      catchError(error => {
        this.logging.error(
          '❌ [FILE-MGMT] Erro ao exportar arquivo:',
          error,
          'ScreenplayFileManagementService'
        );
        return throwError(() => ({
          success: false,
          error: `Erro ao exportar arquivo: ${error.message}`
        }));
      })
    );
  }

  /**
   * Exporta arquivo usando download do navegador
   */
  private exportFileAsync(content: string, filename: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Criar blob com o conteúdo
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });

        // Criar URL temporária
        const url = URL.createObjectURL(blob);

        // Criar link de download
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;

        // Adicionar ao DOM temporariamente (necessário para Firefox)
        document.body.appendChild(link);

        // Trigger download
        link.click();

        // Limpar
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.logging.info(
          `✅ [FILE-MGMT] Arquivo exportado com sucesso: ${filename}`,
          'ScreenplayFileManagementService'
        );

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Sanitiza nome de arquivo removendo caracteres inválidos
   */
  sanitizeFilename(filename: string): string {
    // Remove ou substitui caracteres inválidos
    return filename
      .replace(/[<>:"/\\|?*]/g, '_') // Substitui caracteres inválidos por underscore
      .replace(/\s+/g, '_') // Substitui espaços por underscore
      .replace(/_{2,}/g, '_') // Remove underscores duplicados
      .substring(0, 200); // Limita tamanho do nome
  }

  // ==========================================
  // Detecção e Resolução de Conflitos
  // ==========================================

  /**
   * Detecta conflito entre arquivo do disco e banco de dados
   *
   * @param diskContent Conteúdo do arquivo do disco
   * @param dbScreenplay Roteiro existente no banco
   * @returns true se houver conflito
   */
  detectConflict(diskContent: string, dbScreenplay: Screenplay): boolean {
    // Normalizar conteúdos para comparação
    const normalizedDisk = this.normalizeContent(diskContent);
    const normalizedDb = this.normalizeContent(dbScreenplay.content);

    // Considerar conflito se conteúdos forem diferentes
    const hasConflict = normalizedDisk !== normalizedDb;

    if (hasConflict) {
      this.logging.warn(
        `⚠️ [FILE-MGMT] Conflito detectado: ${dbScreenplay.name}`,
        'ScreenplayFileManagementService',
        {
          diskLines: diskContent.split('\n').length,
          dbLines: dbScreenplay.content.split('\n').length
        }
      );
    }

    return hasConflict;
  }

  /**
   * Normaliza conteúdo para comparação
   * Remove espaços extras, linhas vazias no final, etc.
   */
  private normalizeContent(content: string): string {
    return content
      .trim()
      .replace(/\r\n/g, '\n') // Normaliza line endings
      .replace(/\t/g, '  ') // Normaliza tabs para espaços
      .replace(/[ ]+$/gm, ''); // Remove espaços no final das linhas
  }

  /**
   * Gera informações de comparação entre dois conteúdos
   */
  generateConflictInfo(diskContent: string, dbContent: string) {
    const diskLines = diskContent.split('\n').length;
    const dbLines = dbContent.split('\n').length;
    const diskSize = new Blob([diskContent]).size;
    const dbSize = new Blob([dbContent]).size;

    return {
      disk: {
        lines: diskLines,
        size: diskSize,
        sizeFormatted: this.formatBytes(diskSize)
      },
      db: {
        lines: dbLines,
        size: dbSize,
        sizeFormatted: this.formatBytes(dbSize)
      },
      diff: {
        lines: diskLines - dbLines,
        size: diskSize - dbSize
      }
    };
  }

  /**
   * Formata bytes para formato legível
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Resolve conflito aplicando a estratégia escolhida
   *
   * @param resolution Estratégia de resolução
   * @param diskContent Conteúdo do disco
   * @param dbScreenplay Roteiro do banco
   * @returns Resultado com screenplay atualizado
   */
  resolveConflict(
    resolution: ConflictResolution,
    diskContent: string,
    dbScreenplay: Screenplay
  ): { screenplay: Screenplay; action: string } {
    switch (resolution) {
      case 'overwrite':
        this.logging.info(
          `🔄 [FILE-MGMT] Resolvendo conflito: substituir banco com disco`,
          'ScreenplayFileManagementService'
        );

        return {
          screenplay: {
            ...dbScreenplay,
            content: diskContent,
            updatedAt: new Date().toISOString()
          },
          action: 'overwrite'
        };

      case 'keep-both':
        this.logging.info(
          `➕ [FILE-MGMT] Resolvendo conflito: manter ambos`,
          'ScreenplayFileManagementService'
        );

        // Criar novo screenplay com nome modificado
        const newName = `${dbScreenplay.name} (Importado ${new Date().toLocaleString()})`;

        return {
          screenplay: {
            ...dbScreenplay,
            id: '', // Será gerado novo ID
            name: newName,
            content: diskContent,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          action: 'keep-both'
        };

      case 'cancel':
        this.logging.info(
          `❌ [FILE-MGMT] Resolvendo conflito: cancelar importação`,
          'ScreenplayFileManagementService'
        );

        return {
          screenplay: dbScreenplay,
          action: 'cancel'
        };

      default:
        throw new Error(`Resolução de conflito inválida: ${resolution}`);
    }
  }

  // ==========================================
  // Operações de Sincronização
  // ==========================================

  /**
   * Cria informação de path de arquivo para exibição
   */
  generateFilePathInfo(
    origin: 'database' | 'disk' | 'new',
    identifier: string | null
  ): string {
    switch (origin) {
      case 'database':
        return `💾 MongoDB: ${identifier || 'unknown'}`;
      case 'disk':
        return `📁 Disco: ${identifier || 'unknown'}`;
      case 'new':
        return `✨ Novo roteiro (não salvo)`;
      default:
        return `❓ Origem desconhecida`;
    }
  }

  /**
   * Extrai nome base do arquivo (sem extensão)
   */
  extractBaseName(filename: string): string {
    return filename.replace(/\.md$/i, '');
  }

  /**
   * Verifica se nome do arquivo é válido
   */
  isValidFilename(filename: string): boolean {
    // Não pode estar vazio
    if (!filename || filename.trim().length === 0) {
      return false;
    }

    // Não pode conter caracteres inválidos
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(filename)) {
      return false;
    }

    // Deve ter extensão .md
    if (!filename.toLowerCase().endsWith('.md')) {
      return false;
    }

    return true;
  }

  /**
   * Gera nome de arquivo automaticamente baseado no título
   */
  generateFilename(title: string): string {
    const baseName = this.sanitizeFilename(title);
    return `${baseName}.md`;
  }

  /**
   * Gera nome de arquivo com timestamp
   */
  generateTimestampedFilename(title: string): string {
    const baseName = this.sanitizeFilename(title);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    return `${baseName}_${timestamp}.md`;
  }

  // ==========================================
  // Utilitários
  // ==========================================

  /**
   * Cria um preview truncado do conteúdo
   */
  createContentPreview(content: string, maxLength: number = 200): string {
    if (content.length <= maxLength) {
      return content;
    }

    return content.substring(0, maxLength) + '...';
  }

  /**
   * Conta estatísticas do conteúdo
   */
  getContentStats(content: string) {
    const lines = content.split('\n').length;
    const words = content.split(/\s+/).filter(w => w.length > 0).length;
    const characters = content.length;
    const size = new Blob([content]).size;

    return {
      lines,
      words,
      characters,
      size,
      sizeFormatted: this.formatBytes(size)
    };
  }

  /**
   * Extrai emojis do conteúdo
   */
  extractEmojis(content: string): string[] {
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const matches = content.match(emojiRegex);
    return matches ? [...new Set(matches)] : [];
  }

  /**
   * Valida estrutura Markdown básica
   */
  validateMarkdownStructure(content: string): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    // Verificar se tem pelo menos um heading
    if (!/^#+ /m.test(content)) {
      warnings.push('Conteúdo não possui headings (títulos)');
    }

    // Verificar links quebrados (sintaxe básica)
    const brokenLinks = content.match(/\[([^\]]+)\]\(\s*\)/g);
    if (brokenLinks && brokenLinks.length > 0) {
      warnings.push(`${brokenLinks.length} link(s) vazio(s) detectado(s)`);
    }

    // Verificar blocos de código não fechados
    const codeBlocks = content.match(/```/g);
    if (codeBlocks && codeBlocks.length % 2 !== 0) {
      warnings.push('Bloco de código não fechado detectado');
    }

    return {
      valid: warnings.length === 0,
      warnings
    };
  }
}
