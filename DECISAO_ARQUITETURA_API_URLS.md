# 🎯 Decisão de Arquitetura: Padrão de URLs da API

**Data**: 2025-11-02
**Status**: ✅ Decisão Finalizada
**Escopo**: Todos os arquivos TypeScript do projeto Conductor Web

---

## 📋 Problema Identificado

Existiam **duas formas inconsistentes** de construir URLs da API no projeto:

### ❌ **Padrão Errado** (Duplicação do `/api`)
```typescript
// agent-game.component.ts (ANTES - INCORRETO)
const baseUrl = environment.apiUrl;  // Retorna '/api'
const url = `${baseUrl}/api/agents/instances`;
//            ^^^^^^^^   ^^^^
//            '/api'  +  '/api'  = '/api/api/agents/instances' ❌
```

### ✅ **Padrão Correto** (Sem duplicação)
```typescript
// screenplay-interactive.ts (CORRETO)
const baseUrl = environment.apiUrl;  // Retorna '/api'
const url = `${baseUrl}/agents/instances`;
//            ^^^^^^^^   ^^^^^^^^^^^^^^^^
//            '/api'  +  '/agents/instances'  = '/api/agents/instances' ✅
```

---

## 🎯 Decisão de Arquitetura

### **REGRA OFICIAL**:

> **`environment.apiUrl` JÁ CONTÉM O PREFIXO `/api`**
> **Portanto, NÃO deve-se adicionar `/api` novamente na concatenação!**

---

## 📊 Evidências da Decisão

### 🔍 **1. Configuração de Ambiente**

#### **Arquivo**: `src/environments/environment.ts`
```typescript
export const environment = {
  production: false,
  apiUrl: '/api',  // ✅ Prefixo JÁ está aqui!
};
```

#### **Arquivo**: `src/environments/environment.development.ts`
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5006',  // ✅ Sem prefixo em dev
};
```

**Conclusão**: O `environment.apiUrl` é **responsável** por definir o prefixo base. Em produção, usa `/api` (proxy nginx). Em desenvolvimento local, aponta direto para o gateway.

---

### 🔍 **2. Padrões Corretos no Código Existente**

#### ✅ **Exemplo 1**: `screenplay-interactive.ts:552`
```typescript
const baseUrl = this.getBaseUrl();  // '/api'
const response = await fetch(`${baseUrl}/agents/instances`, {
//                             ^^^^^^^^   ^^^^^^^^^^^^^^^^^
//                             '/api'  +  '/agents/instances' = '/api/agents/instances' ✅
```

#### ✅ **Exemplo 2**: `conversation.service.ts:81`
```typescript
this.apiUrl = `${environment.apiUrl}/conversations`;
//             ^^^^^^^^^^^^^^^^^^^^^   ^^^^^^^^^^^^^^
//             '/api'              +   '/conversations' = '/api/conversations' ✅
```

#### ✅ **Exemplo 3**: `agent-catalog.component.ts:39`
```typescript
const gatewayUrl = environment.apiUrl;
this.http.get<Agent[]>(`${gatewayUrl}/api/agents`).subscribe({
//                       ^^^^^^^^^^^^   ^^^^^^^^^^^
//                       '/api'      +  '/api/agents'  ❌❌❌ DUPLICAÇÃO!
```

**⚠️ ATENÇÃO**: O `agent-catalog` também tem duplicação! Mas funciona **por acaso** porque usa `gatewayUrl` como fallback que pode não ter o prefixo.

---

### 🔍 **3. Logs do Gateway (Evidência de Produção)**

#### ❌ **URLs com Duplicação** (404 Not Found):
```
GET /api/api/agents/instances?limit=500 → 404
```

#### ✅ **URLs Corretas** (200 OK):
```
GET /api/agents/instances → 200
GET /api/conversations → 200
```

---

## 🛠️ Padrão Oficial a Seguir

### ✅ **Template Correto para Todos os Arquivos**

```typescript
// 1. Obter baseUrl (que JÁ contém '/api' em produção)
const baseUrl = environment.apiUrl;

// 2. Concatenar SEM adicionar '/api' novamente
const url = `${baseUrl}/agents/instances`;
const url2 = `${baseUrl}/conversations`;
const url3 = `${baseUrl}/council/run`;

// ✅ Resultado em produção (nginx proxy):
// '/api/agents/instances'
// '/api/conversations'
// '/api/council/run'

// ✅ Resultado em desenvolvimento:
// 'http://localhost:5006/agents/instances'
// 'http://localhost:5006/conversations'
// 'http://localhost:5006/council/run'
```

---

## 📝 Arquivos que Precisam de Correção

### 🔴 **PRIORITÁRIO** (Causando erro 404 agora):

#### **1. `agent-game.component.ts:644`**
```typescript
// ❌ ANTES
const url = `${baseUrl}/api/agents/instances?limit=500`;

// ✅ DEPOIS
const url = `${baseUrl}/agents/instances?limit=500`;
```

#### **2. `agent-game.component.ts:942`**
```typescript
// ❌ ANTES
const apiUrl = `${baseUrl}/api/agents/instances/${instanceId}`;

// ✅ DEPOIS
const apiUrl = `${baseUrl}/agents/instances/${instanceId}`;
```

---

### 🟡 **OPCIONAL** (Funciona por acaso, mas deve ser corrigido):

#### **3. `agent-catalog.component.ts:39`**
```typescript
// ❌ ANTES
const gatewayUrl = (environment as any).gatewayUrl || environment.apiUrl || 'http://localhost:3001';
this.http.get<Agent[]>(`${gatewayUrl}/api/agents`).subscribe({

// ✅ DEPOIS (duas opções)

// Opção A: Se environment.apiUrl já tem '/api', não adicionar novamente
const gatewayUrl = environment.apiUrl || 'http://localhost:3001';
this.http.get<Agent[]>(`${gatewayUrl}/agents`).subscribe({

// Opção B: Usar padrão consistente com outros services
this.http.get<Agent[]>(`${environment.apiUrl}/agents`).subscribe({
```

---

## 🎓 Conceitos-Chave

### **1. `environment.apiUrl`**
Variável de ambiente que define o **prefixo base** para todas as requisições HTTP da aplicação.

- **Produção** (`environment.ts`): `/api` → Usa proxy nginx do Docker
- **Desenvolvimento** (`environment.development.ts`): `http://localhost:5006` → Aponta direto para o gateway

### **2. Proxy Nginx**
Em produção, o Angular serve na porta 80 e o nginx redireciona todas as chamadas `/api/*` para o backend `conductor-gateway:5006`. Isso evita problemas de CORS.

### **3. Responsabilidade Única**
**`environment.apiUrl`** é responsável por:
- ✅ Definir se usa proxy (`/api`) ou URL completa (`http://...`)
- ✅ Centralizar a configuração de ambiente

**Código da aplicação** é responsável por:
- ✅ Concatenar apenas o **path do endpoint** (ex: `/agents/instances`)
- ❌ NÃO adicionar o prefixo `/api` novamente

---

## 📌 Checklist de Implementação

- [x] Analisar `environment.ts` e `environment.development.ts`
- [x] Mapear todos os usos de `environment.apiUrl` no projeto
- [x] Identificar duplicações do prefixo `/api`
- [ ] Corrigir `agent-game.component.ts:644`
- [ ] Corrigir `agent-game.component.ts:942`
- [ ] (Opcional) Corrigir `agent-catalog.component.ts:39`
- [ ] Testar em desenvolvimento local
- [ ] Testar em produção (Docker)
- [ ] Documentar padrão no README ou guia de contribuição

---

## 🚀 Impacto Esperado

### ✅ **Após Correção**:
1. Os minions do `game-canvas` voltarão a carregar corretamente
2. Todas as URLs seguirão o mesmo padrão consistente
3. Novos desenvolvedores não repetirão o erro
4. Logs do gateway mostrarão apenas URLs corretas (200 OK)

### 📊 **Testes de Validação**:
```bash
# 1. Recarregar Screenplay
# 2. Abrir DevTools → Network
# 3. Verificar chamadas:
✅ GET /api/agents/instances?limit=500 → 200 OK
✅ GET /api/agents/instances/{id} → 200 OK

# 4. Verificar logs do Docker:
docker logs conductor-gateway | grep "GET /api/"
```

---

## 📖 Referências

- **Arquivo de Configuração**: `src/environments/environment*.ts`
- **Exemplos Corretos**:
  - `screenplay-interactive.ts:552` (fetch de instâncias)
  - `conversation.service.ts:81` (service constructor)
- **Documentação Anterior**: `diagnostico_api_urls_duplicadas.md`

---

**✍️ Documentado por**: Requirements Engineer (Análise de Código)
**🔍 Contexto**: Correção de bug de carregamento de agentes minions no game-canvas
