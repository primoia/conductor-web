// Exemplo prático de como usar o editor multi-camadas para desenvolvimento de software

export const SOFTWARE_DEVELOPMENT_EXAMPLE = {
  title: "Sistema de E-commerce - Carrinho de Compras",

  // Camada Base (Markdown limpo)
  baseContent: `
# Carrinho de Compras

## Objetivo
Implementar funcionalidade de carrinho de compras para nossa plataforma de e-commerce.

## Contexto
Os usuários precisam adicionar produtos, modificar quantidades e finalizar compras de forma intuitiva.

## Próximos Passos
- Definir requisitos
- Criar mockups
- Implementar backend
- Desenvolver frontend
- Testes e validação
  `,

  // Diferentes camadas de informação
  layers: {
    structure: [
      {
        id: 'architecture',
        content: `
          <div class="architecture-diagram">
            <h4>🏗️ Arquitetura do Sistema</h4>
            <div class="component-flow">
              <div class="component">Frontend (Angular)</div>
              <div class="arrow">↓</div>
              <div class="component">API Gateway</div>
              <div class="arrow">↓</div>
              <div class="component">Cart Service</div>
              <div class="arrow">↓</div>
              <div class="component">Database (PostgreSQL)</div>
            </div>
          </div>
        `
      },
      {
        id: 'user-flow',
        content: `
          <div class="user-flow">
            <h4>🏗️ Fluxo do Usuário</h4>
            <ol>
              <li>Browse produtos → Lista de produtos</li>
              <li>Add to cart → Carrinho atualizado</li>
              <li>View cart → Revisão de itens</li>
              <li>Modify quantities → Recálculo de totais</li>
              <li>Checkout → Processo de pagamento</li>
            </ol>
          </div>
        `
      }
    ],

    requirements: [
      {
        id: 'functional-requirements',
        content: `
          <div class="requirements-section">
            <h4>📋 Requisitos Funcionais</h4>
            <ul>
              <li><strong>RF01:</strong> Adicionar produto ao carrinho</li>
              <li><strong>RF02:</strong> Remover produto do carrinho</li>
              <li><strong>RF03:</strong> Alterar quantidade de produto</li>
              <li><strong>RF04:</strong> Calcular total automaticamente</li>
              <li><strong>RF05:</strong> Persistir carrinho entre sessões</li>
              <li><strong>RF06:</strong> Aplicar cupons de desconto</li>
            </ul>
          </div>
        `
      },
      {
        id: 'business-rules',
        content: `
          <div class="business-rules">
            <h4>📋 Regras de Negócio</h4>
            <ul>
              <li><strong>RN01:</strong> Máximo 10 unidades por item</li>
              <li><strong>RN02:</strong> Carrinho expira em 24h sem atividade</li>
              <li><strong>RN03:</strong> Frete grátis acima de R$ 100</li>
              <li><strong>RN04:</strong> Desconto não pode exceder 50%</li>
            </ul>
          </div>
        `
      }
    ],

    agents: [
      {
        id: 'backend-agent',
        content: `
          <div class="agent-call">
            <h4>🤖 Agente: @backend-specialist</h4>
            <p><strong>Contexto:</strong> E-commerce cart system</p>
            <p><strong>Tarefa:</strong> Generate REST API for shopping cart with CRUD operations</p>

            <div class="agent-config">
              <strong>Configurações:</strong>
              <ul>
                <li>Framework: Node.js + Express</li>
                <li>Database: PostgreSQL</li>
                <li>Auth: JWT tokens</li>
                <li>Validation: Joi schemas</li>
              </ul>
            </div>

            <button class="agent-execute-btn">🚀 Gerar Backend API</button>
          </div>
        `
      },
      {
        id: 'frontend-agent',
        content: `
          <div class="agent-call">
            <h4>🤖 Agente: @angular-specialist</h4>
            <p><strong>Contexto:</strong> Shopping cart frontend</p>
            <p><strong>Tarefa:</strong> Create Angular components for cart management</p>

            <div class="agent-config">
              <strong>Especificações:</strong>
              <ul>
                <li>Standalone components</li>
                <li>Signal-based state</li>
                <li>Material Design</li>
                <li>Responsive layout</li>
              </ul>
            </div>

            <button class="agent-execute-btn">🚀 Gerar Frontend Components</button>
          </div>
        `
      }
    ],

    code: [
      {
        id: 'cart-service-backend',
        content: `
          <div class="code-implementation">
            <h4>💻 Cart Service (Backend)</h4>
            <pre><code class="typescript">
// cart.service.ts
export class CartService {
  constructor(
    @InjectRepository(Cart) private cartRepo: Repository<Cart>,
    @InjectRepository(CartItem) private cartItemRepo: Repository<CartItem>
  ) {}

  async addItem(userId: string, productId: string, quantity: number) {
    let cart = await this.findByUserId(userId);

    if (!cart) {
      cart = this.cartRepo.create({ userId, items: [] });
      await this.cartRepo.save(cart);
    }

    const existingItem = cart.items.find(item => item.productId === productId);

    if (existingItem) {
      existingItem.quantity += quantity;
      if (existingItem.quantity > 10) throw new Error('Max quantity exceeded');
    } else {
      const newItem = this.cartItemRepo.create({ productId, quantity, cart });
      cart.items.push(newItem);
    }

    return this.cartRepo.save(cart);
  }

  async calculateTotal(cartId: string): Promise<number> {
    const cart = await this.cartRepo.findOne({
      where: { id: cartId },
      relations: ['items', 'items.product']
    });

    return cart.items.reduce((total, item) => {
      return total + (item.product.price * item.quantity);
    }, 0);
  }
}
            </code></pre>
          </div>
        `
      },
      {
        id: 'cart-component-frontend',
        content: `
          <div class="code-implementation">
            <h4>💻 Cart Component (Frontend)</h4>
            <pre><code class="typescript">
// cart.component.ts
@Component({
  selector: 'app-cart',
  standalone: true,
  template: \`
    <div class="cart-container">
      <h2>🛒 Seu Carrinho</h2>

      <div class="cart-items">
        @for (item of cartItems(); track item.id) {
          <div class="cart-item">
            <img [src]="item.product.image" [alt]="item.product.name">
            <div class="item-details">
              <h3>{{ item.product.name }}</h3>
              <p>{{ item.product.price | currency:'BRL' }}</p>
            </div>
            <div class="quantity-controls">
              <button (click)="decreaseQuantity(item)">-</button>
              <span>{{ item.quantity }}</span>
              <button (click)="increaseQuantity(item)">+</button>
            </div>
            <button (click)="removeItem(item)" class="remove-btn">🗑️</button>
          </div>
        }
      </div>

      <div class="cart-total">
        <h3>Total: {{ cartTotal() | currency:'BRL' }}</h3>
        <button class="checkout-btn" (click)="goToCheckout()">
          Finalizar Compra
        </button>
      </div>
    </div>
  \`
})
export class CartComponent {
  cartItems = signal<CartItem[]>([]);
  cartTotal = computed(() =>
    this.cartItems().reduce((total, item) =>
      total + (item.product.price * item.quantity), 0
    )
  );

  constructor(private cartService: CartService) {}

  increaseQuantity(item: CartItem) {
    if (item.quantity < 10) {
      this.cartService.updateQuantity(item.id, item.quantity + 1);
    }
  }

  decreaseQuantity(item: CartItem) {
    if (item.quantity > 1) {
      this.cartService.updateQuantity(item.id, item.quantity - 1);
    }
  }
}
            </code></pre>
          </div>
        `
      }
    ],

    tests: [
      {
        id: 'cart-service-tests',
        content: `
          <div class="test-implementation">
            <h4>🧪 Testes Unitários - Cart Service</h4>
            <pre><code class="typescript">
// cart.service.spec.ts
describe('CartService', () => {
  let service: CartService;
  let cartRepo: Repository<Cart>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CartService,
        { provide: getRepositoryToken(Cart), useClass: Repository },
        { provide: getRepositoryToken(CartItem), useClass: Repository }
      ]
    });
    service = TestBed.inject(CartService);
  });

  describe('addItem', () => {
    it('should add new item to cart', async () => {
      const result = await service.addItem('user1', 'product1', 2);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].quantity).toBe(2);
    });

    it('should increase quantity for existing item', async () => {
      await service.addItem('user1', 'product1', 2);
      const result = await service.addItem('user1', 'product1', 3);

      expect(result.items[0].quantity).toBe(5);
    });

    it('should throw error when max quantity exceeded', async () => {
      await expect(
        service.addItem('user1', 'product1', 11)
      ).rejects.toThrow('Max quantity exceeded');
    });
  });

  describe('calculateTotal', () => {
    it('should calculate correct total', async () => {
      const cart = createMockCart([
        { product: { price: 10 }, quantity: 2 },
        { product: { price: 5 }, quantity: 1 }
      ]);

      const total = await service.calculateTotal(cart.id);
      expect(total).toBe(25); // (10*2) + (5*1)
    });
  });
});
            </code></pre>
          </div>
        `
      }
    ],

    docs: [
      {
        id: 'api-documentation',
        content: `
          <div class="api-docs">
            <h4>📚 Documentação da API</h4>

            <div class="endpoint">
              <h5>POST /api/cart/items</h5>
              <p><strong>Descrição:</strong> Adiciona item ao carrinho</p>

              <div class="request-example">
                <strong>Request Body:</strong>
                <pre><code>{
  "productId": "550e8400-e29b-41d4-a716-446655440000",
  "quantity": 2
}</code></pre>
              </div>

              <div class="response-example">
                <strong>Response (201):</strong>
                <pre><code>{
  "id": "cart-uuid",
  "userId": "user-uuid",
  "items": [
    {
      "id": "item-uuid",
      "productId": "product-uuid",
      "quantity": 2,
      "product": {
        "name": "Produto Exemplo",
        "price": 29.99
      }
    }
  ],
  "total": 59.98
}</code></pre>
              </div>
            </div>

            <div class="endpoint">
              <h5>GET /api/cart/:userId</h5>
              <p><strong>Descrição:</strong> Recupera carrinho do usuário</p>
              <p><strong>Response:</strong> Mesmo formato do POST acima</p>
            </div>

            <div class="endpoint">
              <h5>DELETE /api/cart/items/:itemId</h5>
              <p><strong>Descrição:</strong> Remove item do carrinho</p>
              <p><strong>Response (204):</strong> No content</p>
            </div>
          </div>
        `
      }
    ]
  },

  // Configuração de zoom presets específicos para este projeto
  customZoomPresets: [
    {
      name: 'Visão Executiva',
      description: 'Apenas conceitos e objetivos principais',
      layers: ['base'],
      icon: '👔',
      useCase: 'Apresentação para stakeholders'
    },
    {
      name: 'Análise de Requisitos',
      description: 'Foco em requisitos e regras de negócio',
      layers: ['base', 'structure', 'requirements'],
      icon: '📊',
      useCase: 'Validação com product owner'
    },
    {
      name: 'Planejamento IA',
      description: 'Requisitos + chamadas para agentes',
      layers: ['base', 'requirements', 'agents'],
      icon: '🤖',
      useCase: 'Geração automatizada de código'
    },
    {
      name: 'Code Review',
      description: 'Código + testes + documentação',
      layers: ['base', 'code', 'tests', 'docs'],
      icon: '👨‍💻',
      useCase: 'Revisão técnica e qualidade'
    },
    {
      name: 'Handoff para QA',
      description: 'Requisitos + código + testes',
      layers: ['base', 'requirements', 'code', 'tests'],
      icon: '🔍',
      useCase: 'Preparação para testes'
    }
  ]
};

// Função para carregar exemplo no editor
export function loadSoftwareExample(): any {
  return SOFTWARE_DEVELOPMENT_EXAMPLE;
}