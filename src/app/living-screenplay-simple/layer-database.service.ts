import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of } from 'rxjs';
import {
  OverlayLayer,
  ScreenplayDocument,
  LayerDatabase,
  AgentLayer,
  RequirementLayer,
  CodeLayer,
  LayerEvent
} from './overlay-system.types';

@Injectable({
  providedIn: 'root'
})
export class LayerDatabaseService implements LayerDatabase {
  private layers: Map<string, OverlayLayer[]> = new Map();
  private documents: Map<string, ScreenplayDocument> = new Map();
  private layerEvents$ = new BehaviorSubject<LayerEvent[]>([]);

  constructor() {
    this.initializeMockData();
  }

  async getLayers(documentId: string): Promise<OverlayLayer[]> {
    return this.layers.get(documentId) || [];
  }

  async createLayer(layer: Omit<OverlayLayer, 'id'>): Promise<OverlayLayer> {
    const newLayer: OverlayLayer = {
      ...layer,
      id: this.generateId()
    };

    const existingLayers = this.layers.get(layer.documentId) || [];
    existingLayers.push(newLayer);
    this.layers.set(layer.documentId, existingLayers);

    this.emitEvent({
      type: 'layer-created',
      layerId: newLayer.id,
      documentId: layer.documentId,
      userId: layer.metadata.createdBy,
      timestamp: new Date(),
      data: newLayer
    });

    return newLayer;
  }

  async updateLayer(id: string, updates: Partial<OverlayLayer>): Promise<OverlayLayer> {
    for (const [documentId, layers] of this.layers.entries()) {
      const layerIndex = layers.findIndex(l => l.id === id);
      if (layerIndex !== -1) {
        const updatedLayer = { ...layers[layerIndex], ...updates };
        layers[layerIndex] = updatedLayer;

        this.emitEvent({
          type: 'layer-updated',
          layerId: id,
          documentId,
          userId: updatedLayer.metadata.createdBy,
          timestamp: new Date(),
          data: updatedLayer
        });

        return updatedLayer;
      }
    }
    throw new Error(`Layer ${id} not found`);
  }

  async deleteLayer(id: string): Promise<boolean> {
    for (const [documentId, layers] of this.layers.entries()) {
      const layerIndex = layers.findIndex(l => l.id === id);
      if (layerIndex !== -1) {
        const deletedLayer = layers[layerIndex];
        layers.splice(layerIndex, 1);

        this.emitEvent({
          type: 'layer-deleted',
          layerId: id,
          documentId,
          userId: deletedLayer.metadata.createdBy,
          timestamp: new Date(),
          data: deletedLayer
        });

        return true;
      }
    }
    return false;
  }

  async getDocument(id: string): Promise<ScreenplayDocument> {
    const doc = this.documents.get(id);
    if (!doc) throw new Error(`Document ${id} not found`);
    return doc;
  }

  async updateDocument(id: string, content: string): Promise<ScreenplayDocument> {
    const doc = this.documents.get(id);
    if (!doc) throw new Error(`Document ${id} not found`);

    const updatedDoc: ScreenplayDocument = {
      ...doc,
      content,
      version: doc.version + 1,
      lastModified: new Date(),
      checksum: this.calculateChecksum(content)
    };

    this.documents.set(id, updatedDoc);
    return updatedDoc;
  }

  async syncWithDisk(filePath: string): Promise<ScreenplayDocument> {
    try {
      const response = await fetch(filePath);
      const content = await response.text();

      const documentId = this.getDocumentIdFromPath(filePath);
      const existingDoc = this.documents.get(documentId);

      const document: ScreenplayDocument = {
        id: documentId,
        filePath,
        content,
        version: existingDoc ? existingDoc.version + 1 : 1,
        lastModified: new Date(),
        checksum: this.calculateChecksum(content)
      };

      this.documents.set(documentId, document);
      return document;
    } catch (error) {
      throw new Error(`Failed to sync document from ${filePath}: ${error}`);
    }
  }

  async getLayersByType(documentId: string, type: OverlayLayer['type']): Promise<OverlayLayer[]> {
    const layers = await this.getLayers(documentId);
    return layers.filter(layer => layer.type === type);
  }

  async getLayersByPosition(documentId: string, x: number, y: number, radius: number): Promise<OverlayLayer[]> {
    const layers = await this.getLayers(documentId);
    return layers.filter(layer => {
      const distance = Math.sqrt(
        Math.pow(layer.position.x - x, 2) + Math.pow(layer.position.y - y, 2)
      );
      return distance <= radius;
    });
  }

  async getLayersByUser(userId: string): Promise<OverlayLayer[]> {
    const allLayers: OverlayLayer[] = [];
    for (const layers of this.layers.values()) {
      allLayers.push(...layers.filter(layer => layer.metadata.createdBy === userId));
    }
    return allLayers;
  }

  async getDependentLayers(layerId: string): Promise<OverlayLayer[]> {
    const allLayers: OverlayLayer[] = [];
    for (const layers of this.layers.values()) {
      allLayers.push(...layers.filter(layer =>
        layer.metadata.dependencies.includes(layerId)
      ));
    }
    return allLayers;
  }

  getLayerEvents(): Observable<LayerEvent[]> {
    return this.layerEvents$.asObservable();
  }

  private initializeMockData(): void {
    const documentId = 'screenplay-main';

    const mockLayers: OverlayLayer[] = [
      {
        id: 'agent-auth-001',
        documentId,
        type: 'agent',
        position: {
          x: 450,
          y: 180,
          anchor: 'absolute'
        },
        data: {
          title: 'Agente JWT',
          description: 'Implementação de autenticação JWT',
          content: {
            agentType: 'code-generator',
            prompt: 'Gerar sistema completo de autenticação JWT com Express.js',
            parameters: {
              framework: 'express',
              database: 'mongodb',
              tokenExpiry: '15m',
              refreshTokenExpiry: '7d'
            }
          },
          status: 'ready',
          priority: 'high'
        },
        metadata: {
          createdBy: 'dev-001',
          createdAt: new Date('2025-01-20'),
          lastModified: new Date('2025-01-23'),
          tags: ['auth', 'jwt', 'security'],
          dependencies: []
        },
        visibility: {
          showInCleanMode: false,
          showInAgentMode: true,
          showInFullMode: true,
          showForRoles: ['dev', 'pm']
        },
        interactions: {
          clickAction: 'execute-agent',
          hoverTooltip: 'Clique para executar o agente de autenticação',
          doubleClickAction: 'open-modal'
        }
      } as AgentLayer,
      {
        id: 'req-auth-002',
        documentId,
        type: 'requirement',
        position: {
          x: 700,
          y: 180,
          anchor: 'absolute'
        },
        data: {
          title: 'RF001 - Token Expiry',
          description: 'Requisito de expiração de tokens',
          content: {
            requirementId: 'RF001',
            acceptanceCriteria: [
              'Tokens JWT devem expirar em 15 minutos',
              'Refresh tokens devem expirar em 7 dias',
              'Sistema deve alertar sobre expiração próxima'
            ],
            testCases: [
              'Verificar expiração de token após 15min',
              'Validar renovação automática com refresh token'
            ],
            definition: 'O sistema deve implementar tokens com tempo de vida limitado para segurança',
            businessRules: [
              'Tokens expirados devem ser rejeitados',
              'Renovação deve ser transparente ao usuário'
            ]
          },
          status: 'approved',
          priority: 'critical'
        },
        metadata: {
          createdBy: 'pm-001',
          createdAt: new Date('2025-01-18'),
          lastModified: new Date('2025-01-22'),
          tags: ['security', 'token', 'requirement'],
          dependencies: ['agent-auth-001']
        },
        visibility: {
          showInCleanMode: false,
          showInAgentMode: false,
          showInFullMode: true,
          showForRoles: ['pm', 'qa', 'dev']
        },
        interactions: {
          clickAction: 'open-modal',
          hoverTooltip: 'Ver detalhes do requisito RF001'
        }
      } as RequirementLayer,
      {
        id: 'agent-cart-003',
        documentId,
        type: 'agent',
        position: {
          x: 450,
          y: 320,
          anchor: 'absolute'
        },
        data: {
          title: 'Agente Carrinho',
          description: 'Implementar API REST para carrinho',
          content: {
            agentType: 'code-generator',
            prompt: 'Gerar APIs completas para carrinho de compras com persistência',
            parameters: {
              framework: 'express',
              database: 'mongodb',
              persistence: 'localStorage + backend'
            }
          },
          status: 'ready',
          priority: 'medium'
        },
        metadata: {
          createdBy: 'dev-002',
          createdAt: new Date('2025-01-21'),
          lastModified: new Date('2025-01-23'),
          tags: ['cart', 'api', 'persistence'],
          dependencies: ['agent-auth-001']
        },
        visibility: {
          showInCleanMode: false,
          showInAgentMode: true,
          showInFullMode: true,
          showForRoles: ['dev', 'pm']
        },
        interactions: {
          clickAction: 'execute-agent',
          hoverTooltip: 'Clique para gerar APIs do carrinho',
          doubleClickAction: 'open-modal'
        }
      } as AgentLayer,
      {
        id: 'code-cart-004',
        documentId,
        type: 'code',
        position: {
          x: 700,
          y: 320,
          anchor: 'absolute'
        },
        data: {
          title: 'cart.service.ts',
          description: 'Serviço do carrinho implementado',
          content: {
            filePath: 'src/services/cart.service.ts',
            language: 'typescript',
            snippet: 'class CartService { addItem(item: CartItem) { ... } }',
            fullCode: '// Implementação completa do carrinho',
            gitCommit: 'abc123',
            prUrl: 'https://github.com/repo/pull/42'
          },
          status: 'completed',
          priority: 'medium'
        },
        metadata: {
          createdBy: 'dev-002',
          createdAt: new Date('2025-01-22'),
          lastModified: new Date('2025-01-23'),
          tags: ['code', 'cart', 'service'],
          dependencies: ['agent-cart-003']
        },
        visibility: {
          showInCleanMode: false,
          showInAgentMode: false,
          showInFullMode: true,
          showForRoles: ['dev']
        },
        interactions: {
          clickAction: 'show-code',
          hoverTooltip: 'Ver código do carrinho',
          doubleClickAction: 'open-modal'
        }
      } as CodeLayer,
      {
        id: 'test-auth-005',
        documentId,
        type: 'test',
        position: {
          x: 950,
          y: 180,
          anchor: 'absolute'
        },
        data: {
          title: '🧪 Testes JWT',
          description: 'Suíte de testes para autenticação',
          content: {
            testFile: 'auth.test.ts',
            coverage: '95%',
            status: 'passing',
            lastRun: '2025-01-23'
          },
          status: 'completed',
          priority: 'high'
        },
        metadata: {
          createdBy: 'qa-001',
          createdAt: new Date('2025-01-22'),
          lastModified: new Date('2025-01-23'),
          tags: ['test', 'auth', 'jest'],
          dependencies: ['agent-auth-001']
        },
        visibility: {
          showInCleanMode: false,
          showInAgentMode: false,
          showInFullMode: true,
          showForRoles: ['qa', 'dev']
        },
        interactions: {
          clickAction: 'run-tests',
          hoverTooltip: 'Executar testes de autenticação',
          doubleClickAction: 'open-coverage'
        }
      },
      {
        id: 'note-payment-006',
        documentId,
        type: 'note',
        position: {
          x: 450,
          y: 460,
          anchor: 'absolute'
        },
        data: {
          title: '📝 Nota: Segurança',
          description: 'Lembrete sobre compliance PCI DSS',
          content: {
            text: 'IMPORTANTE: Implementar tokenização de cartão antes do deploy em produção. Revisar checklist de segurança.',
            author: 'security-team',
            urgent: true
          },
          status: 'active',
          priority: 'critical'
        },
        metadata: {
          createdBy: 'security-001',
          createdAt: new Date('2025-01-23'),
          lastModified: new Date('2025-01-23'),
          tags: ['security', 'pci-dss', 'payment'],
          dependencies: []
        },
        visibility: {
          showInCleanMode: false,
          showInAgentMode: true,
          showInFullMode: true,
          showForRoles: ['dev', 'security', 'pm']
        },
        interactions: {
          clickAction: 'open-note',
          hoverTooltip: 'Ver nota de segurança crítica',
          doubleClickAction: 'mark-resolved'
        }
      }
    ];

    this.layers.set(documentId, mockLayers);

    this.documents.set(documentId, {
      id: documentId,
      filePath: '/screenplay.md',
      content: '',
      version: 1,
      lastModified: new Date(),
      checksum: ''
    });
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private calculateChecksum(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  private getDocumentIdFromPath(filePath: string): string {
    return filePath.split('/').pop()?.replace('.md', '') || 'default';
  }

  private emitEvent(event: LayerEvent): void {
    const currentEvents = this.layerEvents$.value;
    this.layerEvents$.next([...currentEvents, event]);
  }
}