# Persona Edit Modal

## 📋 Visão Geral

Modal para edição de persona de agentes com suporte a markdown e preview em tempo real. Esta funcionalidade permite aos usuários personalizar a persona de agentes específicos, com validação robusta, persistência local e interface intuitiva.

## 🚀 Funcionalidades

### ✨ Principais
- **Editor Markdown**: Suporte completo a formatação markdown
- **Preview em Tempo Real**: Visualização instantânea da formatação
- **Validação Inteligente**: Validação de tamanho e conteúdo
- **Persistência Local**: Dados salvos no localStorage
- **Histórico de Edições**: Backup das últimas 5 edições
- **Interface Responsiva**: Adaptável a diferentes tamanhos de tela
- **Acessibilidade**: Suporte completo a tecnologias assistivas

### 🎨 Interface
- **Tabs Intuitivas**: Alternância entre edição e preview
- **Feedback Visual**: Indicadores de status e validação
- **Animações Suaves**: Transições fluidas e profissionais
- **Tema Adaptativo**: Suporte a tema claro e escuro
- **Design Consistente**: Integração perfeita com o tema existente

## 📖 Uso

### Uso Básico

```typescript
import { PersonaEditModalComponent } from './persona-edit-modal.component';

// No template
<app-persona-edit-modal
  [isVisible]="showModal"
  [instanceId]="currentInstanceId"
  [currentPersona]="originalPersona"
  (closeModal)="onModalClose()"
  (personaSaved)="onPersonaSaved($event)">
</app-persona-edit-modal>
```

### Uso Avançado

```typescript
// Abrir modal programaticamente
this.personaEditModal.open(instanceId, originalPersona);

// Escutar mudanças
this.personaEditModal.onSave.subscribe((persona) => {
  console.log('Persona salva:', persona);
  this.updateAgentPersona(persona);
});

// Verificar se há persona editada
const hasEdited = this.personaEditService.hasEditedPersona(instanceId);
if (hasEdited) {
  const editedPersona = this.personaEditService.loadPersona(instanceId);
  this.displayPersona(editedPersona);
}
```

## 🎯 Formatação Markdown Suportada

### Headers
```markdown
# Título Principal
## Subtítulo
### Seção
```

### Texto
```markdown
**Texto em negrito**
*Texto em itálico*
~~Texto riscado~~
```

### Listas
```markdown
- Item da lista
- Outro item
  - Subitem

1. Item numerado
2. Outro item numerado
```

### Código
```markdown
`código inline`

```
bloco de código
com múltiplas linhas
```
```

### Citações
```markdown
> Esta é uma citação
> que pode ter múltiplas linhas
```

### Links e Imagens
```markdown
[Link para site](https://exemplo.com)
![Imagem](caminho/para/imagem.jpg)
```

## ⚙️ Configuração

### Propriedades de Entrada

| Propriedade | Tipo | Padrão | Descrição |
|-------------|------|--------|-----------|
| `isVisible` | `boolean` | `false` | Controla a visibilidade do modal |
| `instanceId` | `string \| null` | `null` | ID da instância do agente |
| `currentPersona` | `string` | `''` | Persona original do agente |

### Eventos de Saída

| Evento | Tipo | Descrição |
|--------|------|-----------|
| `closeModal` | `EventEmitter<void>` | Emitido quando o modal é fechado |
| `personaSaved` | `EventEmitter<string>` | Emitido quando a persona é salva |

### Configurações Avançadas

```typescript
// Tamanho máximo da persona (padrão: 10KB)
component.maxLength = 15000; // 15KB

// Debounce para validação (padrão: 300ms)
// Configurado no construtor do componente
```

## 🔧 API do Serviço

### PersonaEditService

```typescript
// Salvar persona editada
this.personaEditService.savePersona(instanceId, persona);

// Carregar persona editada
const editedPersona = this.personaEditService.loadPersona(instanceId);

// Verificar se existe persona editada
const hasEdited = this.personaEditService.hasEditedPersona(instanceId);

// Limpar persona editada
this.personaEditService.clearPersona(instanceId);

// Validação avançada
const validation = this.personaEditService.validatePersonaAdvanced(persona);

// Backup da persona original
this.personaEditService.saveOriginalPersona(instanceId, originalPersona);

// Restaurar persona original
this.personaEditService.restoreOriginalPersona(instanceId);

// Histórico de edições
const history = this.personaEditService.getEditHistory(instanceId);

// Limpar todos os dados
this.personaEditService.clearAllData(instanceId);
```

## 🎨 Personalização

### Estilos Customizados

```scss
// Personalizar cores do tema
.persona-edit-modal {
  .modal-content {
    --primary-color: #your-color;
    --error-color: #your-error-color;
    --warning-color: #your-warning-color;
  }
}

// Personalizar animações
.persona-edit-modal {
  .modal-content {
    animation: customSlideIn 0.5s ease-out;
  }
}

@keyframes customSlideIn {
  // Sua animação personalizada
}
```

### Tema Escuro

O componente suporta automaticamente tema escuro baseado na preferência do sistema:

```css
@media (prefers-color-scheme: dark) {
  /* Estilos automáticos aplicados */
}
```

## 🧪 Testes

### Executar Testes

```bash
# Testes unitários
ng test persona-edit-modal

# Testes com cobertura
ng test --code-coverage

# Testes específicos
ng test --include="**/persona-edit-modal.component.spec.ts"
```

### Cenários de Teste

- ✅ Abertura e fechamento do modal
- ✅ Edição e salvamento de persona
- ✅ Validação de entrada
- ✅ Preview de markdown
- ✅ Restauração de persona original
- ✅ Persistência de dados
- ✅ Responsividade em diferentes tamanhos
- ✅ Acessibilidade com screen readers

## 🐛 Troubleshooting

### Problemas Comuns

#### Modal não abre
```typescript
// Verificar se isVisible está true
console.log('Modal visible:', this.showModal);

// Verificar se instanceId está definido
console.log('Instance ID:', this.currentInstanceId);
```

#### Persona não salva
```typescript
// Verificar validação
const validation = this.personaEditService.validatePersonaAdvanced(persona);
console.log('Validation:', validation);

// Verificar localStorage
console.log('LocalStorage:', localStorage.getItem('persona-edit-' + instanceId));
```

#### Preview não funciona
```typescript
// Verificar se o texto contém markdown válido
console.log('Persona text:', this.personaText);

// Verificar conversão HTML
const html = this.getPreviewHtml();
console.log('Preview HTML:', html);
```

### Logs de Debug

O componente inclui logs detalhados para debugging:

```typescript
// Ativar logs no console
localStorage.setItem('debug-persona-edit', 'true');
```

## 📊 Limitações Conhecidas

### Técnicas
- **Tamanho máximo**: 10KB por persona (configurável)
- **Histórico**: Máximo de 5 edições por instância
- **Markdown**: Suporte básico (não inclui tabelas, diagramas)
- **Colaboração**: Sem suporte a edição simultânea
- **Sincronização**: Dados locais apenas (sem sync em nuvem)

### Navegadores
- **IE**: Não suportado (requer ES6+)
- **Safari**: Suporte completo
- **Chrome**: Suporte completo
- **Firefox**: Suporte completo
- **Edge**: Suporte completo

## 🚀 Roadmap Futuro

### Próximas Versões

#### v2.0 - Funcionalidades Avançadas
- [ ] Editor de markdown com toolbar
- [ ] Suporte a tabelas e diagramas
- [ ] Temas personalizáveis
- [ ] Exportação para PDF/HTML
- [ ] Importação de arquivos markdown

#### v2.1 - Colaboração
- [ ] Edição simultânea
- [ ] Comentários e sugestões
- [ ] Histórico de versões detalhado
- [ ] Sincronização em tempo real

#### v2.2 - Integração
- [ ] API REST para persistência
- [ ] Integração com sistemas de versionamento
- [ ] Webhooks para notificações
- [ ] Analytics de uso

### Contribuições

Para contribuir com melhorias:

1. Fork o repositório
2. Crie uma branch para sua feature
3. Implemente com testes
4. Submeta um Pull Request

## 📚 Recursos Adicionais

### Documentação Relacionada
- [Angular Material](https://material.angular.io/)
- [Markdown Guide](https://www.markdownguide.org/)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

### Exemplos de Uso
- [Exemplo Básico](./examples/basic-usage.md)
- [Exemplo Avançado](./examples/advanced-usage.md)
- [Exemplo de Integração](./examples/integration-example.md)

## 📄 Licença

Este componente é parte do projeto Conductor Community e está licenciado sob a licença MIT.

## 🤝 Suporte

Para suporte técnico ou dúvidas:

- **Issues**: [GitHub Issues](https://github.com/conductor-community/issues)
- **Documentação**: [Wiki do Projeto](https://github.com/conductor-community/wiki)
- **Discussões**: [GitHub Discussions](https://github.com/conductor-community/discussions)

---

**Versão**: 1.0.0  
**Última Atualização**: 2024-01-19  
**Mantenedor**: Equipe Conductor Community