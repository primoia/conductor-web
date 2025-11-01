# Análise: Editor Markdown no Chat Input

## 📋 Visão Geral

O usuário identificou uma limitação importante na interface de chat: ao colar texto formatado em Markdown no textarea de input, toda a formatação é perdida, tornando-se texto simples. Isso é especialmente problemático porque:

1. **O retorno do chat é renderizado como Markdown** (usando a biblioteca `marked`)
2. **O screenplay central também usa Markdown** como formato base
3. **Os usuários frequentemente precisam colar conteúdo Markdown formatado** no chat

Esta análise investiga a viabilidade de substituir o textarea simples por um editor Markdown WYSIWYG, mantendo a consistência com o resto da aplicação.

---

## 🔍 Estado Atual da Implementação

### Componente de Input: `chat-input.component.ts`

**Localização**: `/mnt/ramdisk/primoia-main/conductor-community/src/conductor-web/src/app/shared/conductor-chat/components/chat-input/chat-input.component.ts`

**Implementação Atual**:
- **Elemento**: `<textarea>` nativo HTML (linhas 17-26)
- **Data Binding**: Two-way binding com `[(ngModel)]="message"` (string simples)
- **Funcionalidades**:
  - Auto-resize dinâmico (min 144px, max 200px)
  - Suporte a Enter para enviar / Shift+Enter para nova linha
  - Placeholder: "Digite ou fale sua mensagem... (Shift+Enter para nova linha)"
  - Integração com reconhecimento de voz
  - Seleção de AI Provider (Claude, Gemini, Cursor Agent)

**Problema Identificado**:
```typescript
// Linha 259
message: string = '';  // ← Armazena apenas texto plano

// Linha 306-309
this.messageSent.emit({
  message: this.message.trim(),  // ← Emite string sem formatação
  provider: this.selectedProvider || undefined
});
```

Quando o usuário cola Markdown formatado (exemplo: `**negrito**`, listas, código), o textarea recebe apenas os caracteres literais, sem preservar a intenção de formatação.

---

## 🎯 Como o Markdown é Usado Atualmente

### 1. Renderização de Mensagens do Chat

**Componente**: `chat-messages.component.ts` (linhas 295-303)

```typescript
formatMessage(content: string): SafeHtml {
  if (!content || typeof content !== 'string') {
    return '';
  }
  // Usa marked para converter Markdown → HTML
  const rawHtml = marked(content) as string;
  // Sanitiza o HTML antes de renderizar
  return this.sanitizer.bypassSecurityTrustHtml(rawHtml);
}
```

**Resultado**: Mensagens do bot são renderizadas com:
- Negrito, itálico, listas
- Blocos de código com syntax highlighting
- Parágrafos e quebras de linha
- Links e outros elementos Markdown

### 2. Screenplay Central (Documento Vivo)

**Componente**: `markdown-screenplay.ts` (linha 4)

```typescript
import { marked } from 'marked';
```

O screenplay central **carrega arquivos `.md`** e renderiza como HTML usando a mesma biblioteca `marked`.

### 3. Biblioteca Instalada

**package.json** (linha 47):
```json
"marked": "^16.3.0"
```

A aplicação já possui a biblioteca `marked` instalada e em uso.

---

## 💡 Solução Proposta: Integração com TipTap

### Por Que TipTap?

**Boa notícia**: O projeto **já possui o TipTap instalado**!

**package.json** (linhas 33-42):
```json
"@tiptap/core": "^3.4.6",
"@tiptap/extension-code-block-lowlight": "^3.4.6",
"@tiptap/extension-color": "^3.4.6",
"@tiptap/extension-placeholder": "^3.4.6",
"@tiptap/extension-task-item": "^3.4.6",
"@tiptap/extension-task-list": "^3.4.6",
"@tiptap/extension-text-style": "^3.4.6",
"@tiptap/pm": "^3.4.6",
"@tiptap/starter-kit": "^3.4.6",
"@tiptap/suggestion": "^3.4.6"
```

**Vantagens do TipTap**:
1. ✅ **Já está instalado** no projeto
2. ✅ Editor WYSIWYG baseado em ProseMirror
3. ✅ Suporte nativo a Markdown (input e output)
4. ✅ Extensões já instaladas: code blocks, task lists, placeholders
5. ✅ Altamente customizável e leve
6. ✅ Integração fácil com Angular

---

## 🏗️ Arquitetura da Solução

### Fluxo de Dados Proposto

```
Usuário cola Markdown
         ↓
TipTap Editor (WYSIWYG)
         ↓
Conversão HTML → Markdown (turndown)
         ↓
Emite string Markdown para backend
         ↓
Backend processa
         ↓
Retorna Markdown
         ↓
Renderiza com `marked` (já existente)
```

### Biblioteca Auxiliar: Turndown

**package.json** (linhas 45, 50, 58):
```json
"html-to-md": "^0.8.8",
"turndown": "^7.2.1",
"@types/turndown": "^5.0.5"
```

**Turndown já está instalado**! Essa biblioteca converte HTML → Markdown, perfeito para:
- Colar HTML rico e converter para Markdown
- Extrair Markdown do conteúdo do TipTap antes de enviar

---

## 🔄 Fluxo do Processo (Com Editor Markdown)

### 1. Inicialização do Chat
- Componente `chat-input.component.ts` é carregado
- Inicializa instância do **TipTap Editor**
- Configura extensões: `StarterKit`, `Placeholder`, `CodeBlockLowlight`, etc.
- Define placeholder: "Digite ou fale sua mensagem..."

### 2. Usuário Cola Conteúdo Markdown
**Cenário A: Cola Markdown puro**
```markdown
# Título
- Item 1
- Item 2
**Negrito**
```
- TipTap detecta Markdown e renderiza com formatação visual
- Usuário vê o conteúdo formatado (não código Markdown)

**Cenário B: Cola HTML rico (de um site)**
- TipTap renderiza o HTML
- Ao enviar, `turndown` converte HTML → Markdown
- Backend recebe Markdown limpo

### 3. Envio da Mensagem
```typescript
sendMessage(): void {
  if (this.message.trim() && !this.isLoading) {
    // Extrai Markdown do editor TipTap
    const markdownContent = this.editor.storage.markdown.getMarkdown();

    this.messageSent.emit({
      message: markdownContent,  // ← Markdown preservado
      provider: this.selectedProvider || undefined
    });

    // Limpa o editor
    this.editor.commands.clearContent();
  }
}
```

### 4. Recebimento da Resposta
- Backend retorna Markdown (comportamento atual)
- `chat-messages.component.ts` renderiza com `marked` (linha 300)
- **Nenhuma mudança necessária** neste componente

### 5. Integração com Voz
- `SpeechRecognitionService` retorna texto simples
- Insere como Markdown plain no TipTap
- Usuário pode formatar após a transcrição, se desejar

---

## 🎯 Requisitos Identificados

### Requisitos Funcionais

**RF1**: O editor de input deve suportar formatação Markdown visual (WYSIWYG)
- _Implementação_: Substituir textarea por instância do TipTap Editor

**RF2**: Ao colar conteúdo Markdown, a formatação deve ser preservada visualmente
- _Implementação_: TipTap com extensão `Markdown` nativa

**RF3**: Ao colar HTML rico, deve converter automaticamente para Markdown
- _Implementação_: Usar `turndown` (já instalado) no evento de paste

**RF4**: O conteúdo enviado ao backend deve ser Markdown puro (string)
- _Implementação_: `editor.storage.markdown.getMarkdown()` antes de emitir

**RF5**: Manter suporte a atalhos existentes (Enter = enviar, Shift+Enter = nova linha)
- _Implementação_: Configurar `keymap` personalizado no TipTap

**RF6**: Integração com reconhecimento de voz deve continuar funcionando
- _Implementação_: `editor.commands.setContent()` ao receber transcrição

**RF7**: Seleção de AI Provider deve permanecer visível e funcional
- _Implementação_: Manter dropdown abaixo do editor (layout atual)

**RF8**: Auto-resize do editor conforme conteúdo (min 144px, max 200px)
- _Implementação_: CSS com `.ProseMirror { min-height: 144px; max-height: 200px; }`

### Requisitos Não-Funcionais

**RNF1**: Performance - O editor não deve adicionar latência perceptível
- _Justificativa_: TipTap é leve, baseado em ProseMirror (usado por Notion, GitLab)

**RNF2**: Acessibilidade - Deve ser navegável por teclado
- _Justificativa_: TipTap tem suporte nativo a acessibilidade

**RNF3**: Compatibilidade - Deve funcionar em navegadores modernos (Chrome, Firefox, Safari, Edge)
- _Justificativa_: TipTap suporta todos os navegadores modernos

**RNF4**: Manutenibilidade - Código deve ser claro e seguir padrões Angular
- _Justificativa_: Criar componente standalone `tiptap-chat-input.component.ts`

---

## 💡 Regras de Negócio Identificadas

**Regra 1**: O formato de comunicação com o backend é sempre Markdown (não HTML)
- _Implementação_: Conversão HTML → Markdown antes de emitir evento `messageSent`
- _Localização_: `chat-input.component.ts:306-309`

**Regra 2**: Mensagens vazias ou apenas espaços não podem ser enviadas
- _Implementação_: Validação `!editor.isEmpty` antes de enviar
- _Localização_: `chat-input.component.ts:303`

**Regra 3**: Durante carregamento (`isLoading`), input e botões devem estar desabilitados
- _Implementação_: `editor.setEditable(!this.isLoading)`
- _Localização_: `chat-input.component.ts:23-24, 45-46`

**Regra 4**: Enter envia mensagem, Shift+Enter adiciona nova linha
- _Implementação_: Custom keymap no TipTap
- _Localização_: `chat-input.component.ts:319-326`

**Regra 5**: O provider selecionado deve persistir entre envios (não limpar após enviar)
- _Implementação_: Manter lógica atual (linha 311)
- _Localização_: `chat-input.component.ts:311`

**Regra 6**: Textarea deve ajustar altura dinamicamente baseado no conteúdo
- _Implementação_: CSS `overflow-y: auto` + height constraints
- _Localização_: `chat-input.component.ts:328-339`

---

## 🔗 Relacionamentos e Dependências

### Componentes Envolvidos

**1. ChatInputComponent** (a ser modificado)
- **Depende de**: `TipTap Editor`, `FormsModule`, `SpeechRecognitionService`
- **Comunica com**: Componente pai via `@Output() messageSent`
- **Recebe de**: Componente pai via `@Input() isLoading, mode`

**2. ChatMessagesComponent** (nenhuma mudança)
- **Renderiza**: Markdown recebido usando `marked`
- **Independente**: Não precisa saber se input é textarea ou TipTap

**3. ConductorChatComponent** (pai)
- **Orquestra**: Comunicação entre input e mensagens
- **Nenhuma mudança**: Continua recebendo string Markdown

### Bibliotecas

```
TipTap Editor
    ↓ (edição visual)
Turndown
    ↓ (HTML → Markdown)
Backend API
    ↓ (processamento)
Marked
    ↓ (Markdown → HTML)
Chat Messages (renderização)
```

---

## 🎓 Conceitos-Chave

### WYSIWYG (What You See Is What You Get)
Editores onde o conteúdo aparece formatado durante a edição, similar ao resultado final. Exemplo: Google Docs, Notion.

### ProseMirror
Framework JavaScript para construir editores ricos. Base do TipTap, usado por aplicações como Notion, Atlassian, GitLab.

### Markdown
Linguagem de marcação leve, legível em texto puro, convertível para HTML. Exemplo:
```markdown
**negrito** → <strong>negrito</strong>
# Título → <h1>Título</h1>
```

### TipTap
Editor headless (sem UI padrão) baseado em ProseMirror. Vantagens:
- Altamente customizável
- Suporte nativo a Markdown
- Extensível via plugins
- Leve e performático

### Turndown
Biblioteca JavaScript que converte HTML → Markdown. Inverso do `marked`.

---

## 📌 Observações e Próximos Passos

### ✅ Viabilidade CONFIRMADA

**Pontos Positivos**:
1. **TipTap já está instalado** (todas as extensões necessárias presentes)
2. **Turndown já está instalado** (conversão HTML → Markdown)
3. **Marked já está em uso** (renderização Markdown → HTML)
4. **Arquitetura atual é compatível** (backend espera Markdown)
5. **Nenhuma mudança no backend necessária**

### 🚀 Implementação Recomendada

**Fase 1: Componente Base**
1. Criar `tiptap-chat-input.component.ts` (pode ser renomeação do atual)
2. Importar `Editor` do `@tiptap/core`
3. Configurar extensões: `StarterKit`, `Placeholder`, `CodeBlockLowlight`, `TaskList`, `TaskItem`
4. Adicionar botão de toggle "Markdown Raw" (opcional, para usuários avançados)

**Fase 2: Integração com Sistema Existente**
1. Manter mesmos `@Input()` e `@Output()`
2. Converter output do editor para Markdown antes de emitir
3. Testar integração com reconhecimento de voz
4. Validar que `isLoading` desabilita editor corretamente

**Fase 3: UX e Polimento**
1. Adicionar toolbar mínima (negrito, itálico, código, lista)
2. Estilizar para manter consistência visual com design atual
3. Adicionar feedback visual ao colar conteúdo rico
4. Testar acessibilidade (navegação por teclado, screen readers)

**Fase 4: Testes**
1. Testar colagem de Markdown de diferentes fontes
2. Testar colagem de HTML rico (sites, Google Docs, etc.)
3. Validar que backend continua recebendo Markdown correto
4. Testar em diferentes navegadores

### 🔧 Exemplo de Código Mínimo

```typescript
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

export class TipTapChatInputComponent implements OnInit {
  editor!: Editor;

  ngOnInit(): void {
    this.editor = new Editor({
      extensions: [
        StarterKit,
        Placeholder.configure({
          placeholder: 'Digite ou fale sua mensagem... (Shift+Enter para nova linha)'
        })
      ],
      editorProps: {
        attributes: {
          class: 'tiptap-editor'
        }
      }
    });
  }

  sendMessage(): void {
    if (!this.editor.isEmpty && !this.isLoading) {
      const markdown = this.editor.storage.markdown.getMarkdown();
      this.messageSent.emit({
        message: markdown,
        provider: this.selectedProvider || undefined
      });
      this.editor.commands.clearContent();
    }
  }
}
```

### ⚠️ Pontos de Atenção

1. **Compatibilidade com Speech Recognition**: Garantir que texto transcrito seja inserido corretamente
2. **Performance em mensagens longas**: TipTap performa bem até ~10k caracteres
3. **Markdown flavors**: Backend pode ter extensões customizadas (verificar)
4. **Mobile**: Testar em telas menores (TipTap é mobile-friendly)

---

## 🎯 Conclusão

**A substituição do textarea por um editor Markdown TipTap é TOTALMENTE VIÁVEL e RECOMENDADA** pelas seguintes razões:

1. ✅ Todas as dependências já estão instaladas
2. ✅ Arquitetura atual é compatível (backend espera Markdown)
3. ✅ Melhora significativa na experiência do usuário
4. ✅ Consistência com o resto da aplicação (que já usa Markdown)
5. ✅ Baixo risco de regressão (interface `messageSent` permanece igual)
6. ✅ Permite futuras melhorias (colaboração em tempo real, templates, etc.)

**Próximo Passo Sugerido**: Implementar Fase 1 (Componente Base) e validar com usuários.
