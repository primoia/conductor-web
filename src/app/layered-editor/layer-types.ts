// Definição dos tipos de camadas e seus metadados
export interface LayerDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  zIndex: number;
  dependencies?: string[]; // camadas que precisam estar ativas
}

export interface LayerContent {
  layerId: string;
  blockId: string;
  content: string;
  metadata?: any;
  position?: 'inline' | 'sidebar' | 'overlay' | 'expandable';
}

export interface DocumentLayer {
  baseContent: string; // Markdown limpo
  layers: Map<string, LayerContent[]>;
  activeLayers: Set<string>;
}

// Definições das camadas do sistema
export const LAYER_DEFINITIONS: LayerDefinition[] = [
  {
    id: 'base',
    name: 'Markdown Base',
    description: 'Texto limpo, conceitos principais',
    icon: '📝',
    color: '#6c757d',
    zIndex: 0
  },
  {
    id: 'structure',
    name: 'Estrutura',
    description: 'Organização, hierarquia, relacionamentos',
    icon: '🏗️',
    color: '#17a2b8',
    zIndex: 1,
    dependencies: ['base']
  },
  {
    id: 'requirements',
    name: 'Requisitos',
    description: 'Specs funcionais, regras de negócio',
    icon: '📋',
    color: '#ffc107',
    zIndex: 2,
    dependencies: ['base', 'structure']
  },
  {
    id: 'agents',
    name: 'Agentes IA',
    description: 'Chamadas para agentes, prompts, automações',
    icon: '🤖',
    color: '#6f42c1',
    zIndex: 3,
    dependencies: ['requirements']
  },
  {
    id: 'code',
    name: 'Código',
    description: 'Implementação, snippets, arquivos',
    icon: '💻',
    color: '#28a745',
    zIndex: 4,
    dependencies: ['requirements']
  },
  {
    id: 'tests',
    name: 'Testes',
    description: 'Unit tests, validação, coverage',
    icon: '🧪',
    color: '#dc3545',
    zIndex: 5,
    dependencies: ['code']
  },
  {
    id: 'docs',
    name: 'Documentação',
    description: 'API docs, guides, exemplos',
    icon: '📚',
    color: '#fd7e14',
    zIndex: 6,
    dependencies: ['code']
  }
];

// Presets de zoom (combinações de camadas)
export const ZOOM_PRESETS = [
  {
    name: 'Visão Executiva',
    description: 'Apenas conceitos principais',
    layers: ['base'],
    icon: '👔'
  },
  {
    name: 'Visão Arquitetural',
    description: 'Estrutura e requisitos',
    layers: ['base', 'structure', 'requirements'],
    icon: '🏛️'
  },
  {
    name: 'Visão Desenvolvedor',
    description: 'Código e implementação',
    layers: ['base', 'structure', 'requirements', 'code'],
    icon: '👨‍💻'
  },
  {
    name: 'Visão QA',
    description: 'Testes e validação',
    layers: ['base', 'requirements', 'code', 'tests'],
    icon: '🔍'
  },
  {
    name: 'Visão Completa',
    description: 'Todas as camadas',
    layers: ['base', 'structure', 'requirements', 'agents', 'code', 'tests', 'docs'],
    icon: '🌐'
  }
];

export class LayerService {
  getLayerDefinition(layerId: string): LayerDefinition | undefined {
    return LAYER_DEFINITIONS.find(layer => layer.id === layerId);
  }

  validateLayerDependencies(activeLayers: Set<string>): string[] {
    const errors: string[] = [];

    for (const layerId of activeLayers) {
      const layer = this.getLayerDefinition(layerId);
      if (layer?.dependencies) {
        for (const dep of layer.dependencies) {
          if (!activeLayers.has(dep)) {
            errors.push(`Camada "${layer.name}" requer "${this.getLayerDefinition(dep)?.name}"`);
          }
        }
      }
    }

    return errors;
  }

  getLayersByZIndex(layerIds: string[]): LayerDefinition[] {
    return layerIds
      .map(id => this.getLayerDefinition(id))
      .filter(layer => layer !== undefined)
      .sort((a, b) => a!.zIndex - b!.zIndex) as LayerDefinition[];
  }
}