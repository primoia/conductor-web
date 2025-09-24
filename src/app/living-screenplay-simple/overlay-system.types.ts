// Tipos para o sistema de camadas inteligentes

export interface ScreenplayDocument {
  id: string;
  filePath: string;
  content: string;
  version: number;
  lastModified: Date;
  checksum: string;
}

export interface OverlayLayer {
  id: string;
  documentId: string;
  type: 'agent' | 'requirement' | 'code' | 'test' | 'note' | 'modal';
  position: {
    x: number;
    y: number;
    anchor: 'absolute' | 'relative-to-line' | 'relative-to-word';
    lineNumber?: number;
    wordIndex?: number;
  };
  data: {
    title: string;
    description: string;
    content: any; // JSON flexível para diferentes tipos
    status: string; // Flexible status field for different layer types
    priority: 'low' | 'medium' | 'high' | 'critical';
  };
  metadata: {
    createdBy: string;
    createdAt: Date;
    lastModified: Date;
    tags: string[];
    dependencies: string[]; // IDs de outras camadas
  };
  visibility: {
    showInCleanMode: boolean;
    showInAgentMode: boolean;
    showInFullMode: boolean;
    showForRoles: string[]; // ['dev', 'pm', 'qa']
  };
  interactions: {
    clickAction?: string; // 'open-modal' | 'execute-agent' | 'show-code'
    hoverTooltip?: string;
    doubleClickAction?: string;
  };
}

export interface AgentLayer extends OverlayLayer {
  type: 'agent';
  data: {
    title: string;
    description: string;
    content: {
      agentType: 'code-generator' | 'requirement-analyzer' | 'test-creator' | 'security-scanner';
      prompt: string;
      parameters: Record<string, any>;
      lastExecution?: {
        timestamp: Date;
        result: any;
        success: boolean;
        error?: string;
      };
    };
    status: 'ready' | 'running' | 'completed' | 'error';
    priority: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface RequirementLayer extends OverlayLayer {
  type: 'requirement';
  data: {
    title: string;
    description: string;
    content: {
      requirementId: string;
      acceptanceCriteria: string[];
      testCases: string[];
      definition: string;
      businessRules: string[];
    };
    status: 'draft' | 'approved' | 'implemented' | 'tested';
    priority: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface CodeLayer extends OverlayLayer {
  type: 'code';
  data: {
    title: string;
    description: string;
    content: {
      filePath: string;
      language: string;
      snippet: string;
      fullCode?: string;
      gitCommit?: string;
      prUrl?: string;
    };
    status: 'planned' | 'in-progress' | 'completed' | 'needs-review';
    priority: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface ModalConfirmation {
  id: string;
  type: 'agent-execution' | 'requirement-change' | 'code-generation' | 'file-modification';
  title: string;
  message: string;
  data: any;
  actions: {
    confirm: {
      label: string;
      action: 'execute-agent' | 'update-file' | 'create-layer' | 'modify-markdown';
      parameters: any;
    };
    cancel: {
      label: string;
    };
    alternative?: {
      label: string;
      action: string;
      parameters: any;
    };
  };
  position: { x: number; y: number };
}

export interface LayerDatabase {
  // Operações de camadas
  getLayers(documentId: string): Promise<OverlayLayer[]>;
  createLayer(layer: Omit<OverlayLayer, 'id'>): Promise<OverlayLayer>;
  updateLayer(id: string, updates: Partial<OverlayLayer>): Promise<OverlayLayer>;
  deleteLayer(id: string): Promise<boolean>;

  // Operações de documento
  getDocument(id: string): Promise<ScreenplayDocument>;
  updateDocument(id: string, content: string): Promise<ScreenplayDocument>;
  syncWithDisk(filePath: string): Promise<ScreenplayDocument>;

  // Queries inteligentes
  getLayersByType(documentId: string, type: OverlayLayer['type']): Promise<OverlayLayer[]>;
  getLayersByPosition(documentId: string, x: number, y: number, radius: number): Promise<OverlayLayer[]>;
  getLayersByUser(userId: string): Promise<OverlayLayer[]>;
  getDependentLayers(layerId: string): Promise<OverlayLayer[]>;
}

export interface LayerEvent {
  type: 'layer-created' | 'layer-updated' | 'layer-deleted' | 'agent-executed' | 'markdown-updated';
  layerId?: string;
  documentId: string;
  userId: string;
  timestamp: Date;
  data: any;
}

export interface ViewConfiguration {
  userId: string;
  documentId: string;
  mode: 'clean' | 'agents' | 'full' | 'custom';
  visibleTypes: OverlayLayer['type'][];
  opacity: Record<OverlayLayer['type'], number>;
  showOnlyMyLayers: boolean;
  filters: {
    status?: string[];
    priority?: string[];
    tags?: string[];
    assignedTo?: string[];
  };
}