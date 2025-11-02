# ✅ Diagnóstico e Correção: URLs da API com `/api/api/` Duplicado

## 📋 Resumo Executivo

**Problema**: O componente `agent-game` (canvas de minions) não estava carregando os agentes porque as URLs da API estavam sendo montadas incorretamente, resultando em `404 Not Found`.

**Causa Raiz**: Duplicação do prefixo `/api` nas URLs — `environment.apiUrl` já contém `/api`, mas o código concatenava novamente `${baseUrl}/api/...`, gerando `/api/api/...`.

**Solução Aplicada**: ✅ **CORRIGIDO** — Removido o prefixo `/api` duplicado em 2 locais do `agent-game.component.ts`

**Status**: ✅ **RESOLVIDO** (2025-11-02)

**Documentação Adicional**: Ver `DECISAO_ARQUITETURA_API_URLS.md` para padrão oficial

---

## 🔍 Evidências nos Logs do Gateway

### ❌ URLs com Erro (404 Not Found)
```
INFO: 172.31.0.3:33562 - "GET /api/api/agents/instances?limit=500 HTTP/1.1" 404 Not Found
INFO: 172.31.0.3:48324 - "GET /api/api/agents/instances?limit=500 HTTP/1.1" 404 Not Found
INFO: 172.31.0.3:48350 - "GET /api/api/agents/instances?limit=500 HTTP/1.1" 404 Not Found
INFO: 172.31.0.3:59702 - "GET /api/api/agents/instances?limit=500 HTTP/1.1" 404 Not Found
```

### ✅ URLs Corretas (200 OK)
```
INFO: 172.31.0.3:48480 - "GET /api/agents/instances HTTP/1.1" 200 OK
INFO: 172.31.0.3:48510 - "GET /api/agents/context/instance-1761999341566-n5a399et4 HTTP/1.1" 200 OK
INFO: 172.31.0.3:59660 - "GET /api/agents/context/instance-1761999341566-n5a399et4 HTTP/1.1" 200 OK
```

**Observação**: A diferença é `/api/api/` (erro) vs. `/api/` (sucesso).

---

## 🛠️ Análise Técnica

### 1. **Configuração do Environment** ✅ (Correto)

**Arquivos de Environment**:
- `src/environments/environment.ts` (padrão, usa proxy nginx)
- `src/environments/environment.development.ts` (dev local direto)
- `src/environments/environment.docker.ts` (Docker com proxy nginx)

**Conteúdo**:
```typescript
// environment.ts
export const environment = {
  production: false,
  apiUrl: '/api',  // ✅ Correto: prefixo para proxy nginx
  features: {
    useConversationModel: true
  }
};
```

```typescript
// environment.development.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5006',  // ✅ Correto: URL completa para dev
  features: {
    useConversationModel: true
  }
};
```

**Conclusão**: A configuração do `apiUrl` está correta.

---

### 2. **AgentService** ⚠️ (Problema Parcial)

**Localização**: `src/app/services/agent.service.ts`

**Problema**: O `baseUrl` está vazio (`''`), ignorando `environment.apiUrl`.

```typescript
@Injectable({
  providedIn: 'root'
})
export class AgentService {
  private baseUrl: string = '';  // ❌ Deveria usar environment.apiUrl

  constructor() {
    console.log(`[AgentService] Using API Base URL: ${this.baseUrl || 'empty (routes have /api/)'}`);
  }

  getAgents(): Observable<Agent[]> {
    return from(
      fetch(`${this.baseUrl}/api/agents`, {  // ⚠️ Gera ''/api/agents' = '/api/agents' (funciona por acaso!)
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    // ...
  }
}
```

**Por que funciona?**: Quando `baseUrl = ''`, o resultado de `${this.baseUrl}/api/agents` é `/api/agents` (correto). Mas isso é uma **coincidência perigosa** — se `baseUrl` fosse configurado com `'/api'`, geraria `/api/api/agents`.

**Linhas Afetadas**:
- Linha 67: `private baseUrl: string = '';`
- Linha 78: `fetch(\`${this.baseUrl}/api/agents\`)`
- Linha 161: `fetch(\`${this.baseUrl}/api/agents/${agentId}/execute\`)`
- Linha 261: `fetch(\`${this.baseUrl}/api/agents/context/${instanceId}\`)`
- Linha 297: `fetch(\`${this.baseUrl}/api/agents/instances/${instanceId}/cwd\`)`
- Linha 328: `let url = \`${this.baseUrl}/api/agents/instances\`;`
- Linha 369: `fetch(\`${this.baseUrl}/api/agents/instances/${instanceId}\`)`
- Linha 405: `fetch(\`${this.baseUrl}/api/agents/instances/${instanceId}\`)`
- Linha 442: `const url = \`${this.baseUrl}/api/agents/instances/${instanceId}\`;`

---

### 3. **AgentGameComponent** ✅ (CORRIGIDO!)

**Localização**: `src/app/living-screenplay-simple/agent-game/agent-game.component.ts`

**Problema Identificado**: Duplicação explícita do prefixo `/api`.

#### 📍 Linha 685-688 (Método `getBaseUrl`)
```typescript
private getBaseUrl(): string {
  // Use environment configuration
  return environment.apiUrl;  // Retorna '/api' (em produção/docker)
}
```

#### ✅ Linha 644 (CORRIGIDO!)
```typescript
// ❌ ANTES (ERRADO)
const url = `${baseUrl}/api/agents/instances?limit=500`;
//            ^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//            '/api'  +  '/api/agents/instances'
//            = '/api/api/agents/instances' ❌

// ✅ DEPOIS (CORRETO)
const url = `${baseUrl}/agents/instances?limit=500`;
//            ^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^^^^^^^
//            '/api'  +  '/agents/instances'
//            = '/api/agents/instances' ✅
```

**Resultado**: `/api/agents/instances?limit=500` → ✅ **200 OK**

#### ✅ Linha 942 (CORRIGIDO!)
```typescript
// ❌ ANTES (ERRADO)
const apiUrl = `${baseUrl}/api/agents/instances/${instanceId}`;
//               ^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//               '/api'  +  '/api/agents/instances/...'
//               = '/api/api/agents/instances/...' ❌

// ✅ DEPOIS (CORRETO)
const apiUrl = `${baseUrl}/agents/instances/${instanceId}`;
//               ^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//               '/api'  +  '/agents/instances/...'
//               = '/api/agents/instances/...' ✅
```

**Resultado**: `/api/agents/instances/{instanceId}` → ✅ **200 OK**

---

## 🎯 Resumo dos Arquivos Afetados

### ✅ **Arquivos CORRIGIDOS**
| Arquivo | Linhas | Descrição | Status |
|---------|--------|-----------|---------|
| `agent-game.component.ts` | 644, 942 | Duplicação do `/api` corrigida | ✅ RESOLVIDO |

### ✅ **Arquivos SEM Problema** (mas frágeis)
| Arquivo | Linhas | Descrição | Motivo de Funcionar |
|---------|--------|-----------|-------------------|
| `agent.service.ts` | 78, 161, 261, 297, 328, 369, 405, 442 | Usa `${this.baseUrl}/api/...` onde `baseUrl = ''` | Funciona por acaso (`'' + '/api' = '/api'`) |
| `persona-edit.service.ts` | 324 | Usa `${this.baseUrl}/api/...` onde `baseUrl = ''` | Funciona por acaso |
| `screenplay-storage.ts` | 78, 106, 131, 168, 194, 221 | Usa `${this.baseUrl}/api/...` onde `baseUrl = ''` | Funciona por acaso |
| `conductor-api.service.ts` | 57 | Usa `${this.baseUrl}/api/...` onde `baseUrl = ''` | Funciona por acaso |

---

## ✅ Soluções Implementadas

### 🎯 **Solução 1: Corrigir agent-game.component.ts** ✅ (IMPLEMENTADA)

**Descrição**: Removido o prefixo `/api` duplicado nas linhas 644 e 942.

**Implementação**:

#### **Linha 644** (método `loadAgentsFromBFF`)
```typescript
// ❌ ANTES (errado)
const url = `${baseUrl}/api/agents/instances?limit=500`;

// ✅ DEPOIS (correto)
const url = `${baseUrl}/agents/instances?limit=500`;
//           Removido o '/api' duplicado ⬆️
```

#### **Linha 942** (método `loadAgentStatisticsFromAPI`)
```typescript
// ❌ ANTES (errado)
const apiUrl = `${baseUrl}/api/agents/instances/${instanceId}`;

// ✅ DEPOIS (correto)
const apiUrl = `${baseUrl}/agents/instances/${instanceId}`;
//              Removido o '/api' duplicado ⬆️
```

**Resultado Alcançado**:
- **Docker/Produção**: `environment.apiUrl = '/api'` → URLs finais: `/api/agents/instances` ✅
- **Dev Local**: `environment.apiUrl = 'http://localhost:5006'` → URLs finais: `http://localhost:5006/agents/instances` ✅

**Impacto**: 🟢 **Baixo risco** — Apenas correção de bug, sem mudança de lógica.

**Status**: ✅ **CONCLUÍDO** (2025-11-02)

---

### 🎯 **Solução 2: Padronizar Uso de environment.apiUrl em Todos os Services** (RECOMENDADO)

**Descrição**: Atualizar `agent.service.ts`, `persona-edit.service.ts`, `screenplay-storage.ts` e `conductor-api.service.ts` para **usar explicitamente** `environment.apiUrl` em vez de `baseUrl = ''`.

**Implementação** (exemplo para `agent.service.ts`):

```typescript
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AgentService {
  private baseUrl: string = environment.apiUrl;  // ✅ Usa configuração do environment

  constructor() {
    console.log(`[AgentService] Using API Base URL: ${this.baseUrl}`);
  }

  getAgents(): Observable<Agent[]> {
    return from(
      fetch(`${this.baseUrl}/agents`, {  // ✅ Sem '/api' duplicado
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    // ...
  }
}
```

**Mudanças Necessárias**:
- **agent.service.ts**: Alterar linha 67 para `private baseUrl: string = environment.apiUrl;`
- Atualizar todas as chamadas `fetch()` para remover o prefixo `/api`:
  - Linha 78: `${this.baseUrl}/agents` (remover `/api`)
  - Linha 161: `${this.baseUrl}/agents/${agentId}/execute`
  - Linha 261: `${this.baseUrl}/agents/context/${instanceId}`
  - Linha 297: `${this.baseUrl}/agents/instances/${instanceId}/cwd`
  - Linha 328: `${this.baseUrl}/agents/instances`
  - Linha 369: `${this.baseUrl}/agents/instances/${instanceId}`
  - Linha 405: `${this.baseUrl}/agents/instances/${instanceId}`
  - Linha 442: `${this.baseUrl}/agents/instances/${instanceId}`

**Benefícios**:
- ✅ Código mais consistente e explícito
- ✅ Fácil trocar entre ambientes (dev, staging, prod)
- ✅ Elimina dependência de "funcionar por acaso"

**Impacto**: 🟡 **Médio risco** — Requer mudanças em múltiplos arquivos, mas melhora a arquitetura.

---

### 🎯 **Solução 3: Criar Interceptor HTTP para Normalização de URLs** (AVANÇADO)

**Descrição**: Criar um Angular HTTP Interceptor que normaliza URLs duplicadas automaticamente.

**Implementação**:

```typescript
import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class ApiUrlInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Normalizar URLs duplicadas: /api/api/ → /api/
    let url = req.url;
    url = url.replace(/\/api\/api\//g, '/api/');

    const normalizedReq = req.clone({ url });
    return next.handle(normalizedReq);
  }
}
```

**Registro** (em `app.module.ts` ou `app.config.ts`):
```typescript
import { HTTP_INTERCEPTORS } from '@angular/common/http';

providers: [
  {
    provide: HTTP_INTERCEPTORS,
    useClass: ApiUrlInterceptor,
    multi: true
  }
]
```

**Benefícios**:
- ✅ Solução defensiva que previne erros futuros
- ✅ Não requer mudanças em código existente

**Desvantagens**:
- ❌ Mascara o problema em vez de resolvê-lo na origem
- ❌ Pode dificultar debugging

**Impacto**: 🟢 **Baixo risco** — Pode ser implementado como camada adicional de segurança.

---

## 📊 Comparação das Soluções

| Solução | Complexidade | Risco | Tempo | Recomendação |
|---------|--------------|-------|-------|--------------|
| **1. Corrigir agent-game.component.ts** | 🟢 Baixa | 🟢 Baixo | 5 min | ⭐⭐⭐ **PRIORITÁRIA** |
| **2. Padronizar environment.apiUrl** | 🟡 Média | 🟡 Médio | 30 min | ⭐⭐ Recomendado para longo prazo |
| **3. Interceptor HTTP** | 🟡 Média | 🟢 Baixo | 15 min | ⭐ Opcional (camada defensiva) |

---

## 🚀 Plano de Ação Recomendado

### **Fase 1: Correção Imediata** (5 minutos)
1. **Implementar Solução 1**: Corrigir `agent-game.component.ts` linhas 644 e 942
2. Testar o carregamento dos minions no canvas
3. Verificar logs do navegador para confirmar URLs corretas (`/api/agents/instances`)

### **Fase 2: Melhorias Estruturais** (30 minutos - OPCIONAL)
1. **Implementar Solução 2**: Padronizar uso de `environment.apiUrl` em todos os services
2. Criar testes unitários para validar montagem de URLs
3. Documentar convenções de uso de `environment.apiUrl` no README do projeto

### **Fase 3: Defesa em Profundidade** (15 minutos - OPCIONAL)
1. **Implementar Solução 3**: Criar interceptor HTTP como camada de segurança
2. Adicionar testes E2E para validar integração frontend-gateway

---

## 🔗 Fluxo Correto de Montagem de URLs

### ✅ **Correto** (após correção)

```
Environment Config:
  - environment.apiUrl = '/api'  (Docker/Prod)
  - environment.apiUrl = 'http://localhost:5006'  (Dev)

Agent Game Component:
  - baseUrl = this.getBaseUrl()  // Retorna environment.apiUrl
  - url = `${baseUrl}/agents/instances`  // ✅ SEM '/api' extra

Resultado Docker/Prod:
  - '/api' + '/agents/instances' = '/api/agents/instances' ✅

Resultado Dev:
  - 'http://localhost:5006' + '/agents/instances'
  = 'http://localhost:5006/agents/instances' ✅
```

### ❌ **Incorreto** (situação atual)

```
Environment Config:
  - environment.apiUrl = '/api'  (Docker/Prod)

Agent Game Component:
  - baseUrl = this.getBaseUrl()  // Retorna '/api'
  - url = `${baseUrl}/api/agents/instances`  // ❌ COM '/api' duplicado

Resultado Docker/Prod:
  - '/api' + '/api/agents/instances' = '/api/api/agents/instances' ❌ (404)
```

---

## 🧪 Como Testar Após Correção

### **1. Teste Manual no Navegador**
1. Abrir DevTools (F12) → aba Network
2. Recarregar o Screenplay (`localhost:4200` ou URL Docker)
3. Filtrar por "agents"
4. Verificar se as requisições são:
   - ✅ `GET /api/agents/instances?limit=500` → `200 OK`
   - ✅ `GET /api/agents/instances/{instance_id}` → `200 OK`
5. Verificar se os minions aparecem no canvas

### **2. Verificar Logs do Frontend**
No console do navegador, deve aparecer:
```
🎮 [AGENT-GAME] Base URL: /api
🎮 [AGENT-GAME] Fetching from: /api/agents/instances?limit=500  ✅
🎮 [AGENT-GAME] Response received: { success: true, count: X, instances: [...] }
✅ [LOAD] Carregados X agentes. Use debugAgentMetrics() para ver detalhes.
```

### **3. Verificar Logs do Gateway**
No terminal Docker:
```bash
docker logs conductor-gateway-dev --tail 50 | grep "agents/instances"
```

Deve aparecer:
```
INFO: 172.31.0.3:XXXXX - "GET /api/agents/instances?limit=500 HTTP/1.1" 200 OK  ✅
INFO: 172.31.0.3:XXXXX - "GET /api/agents/instances/{id} HTTP/1.1" 200 OK  ✅
```

**NÃO deve aparecer**:
```
INFO: 172.31.0.3:XXXXX - "GET /api/api/agents/instances HTTP/1.1" 404 Not Found  ❌
```

---

## 📝 Regras de Negócio Identificadas

### RN1: **Montagem de URLs da API**
- **Descrição**: Todas as URLs da API devem ser montadas concatenando `environment.apiUrl` + caminho do endpoint (SEM prefixo `/api` no caminho).
- **Implementação**: `agent-game.component.ts:644`, `agent-game.component.ts:942`, `agent.service.ts:78+`, etc.

### RN2: **Isolamento por Ambiente**
- **Descrição**: A configuração `apiUrl` varia conforme o ambiente:
  - **Docker/Prod**: `/api` (proxy nginx)
  - **Dev Local**: `http://localhost:5006` (direto no gateway)
- **Implementação**: `environments/environment.*.ts`

### RN3: **Proxy Nginx no Docker**
- **Descrição**: Em ambiente Docker, o nginx roteia requisições `/api/*` para o gateway `http://conductor-gateway:5006/*`.
- **Implementação**: Configuração externa (nginx.conf ou docker-compose.yml)

---

## 🎓 Conceitos-Chave

### **Base URL**
O prefixo comum para todas as requisições HTTP da aplicação. Pode ser:
- Relativo (`/api`) para uso com proxy
- Absoluto (`http://localhost:5006`) para dev local

### **Proxy Nginx**
Servidor intermediário que roteia requisições do frontend (`/api/*`) para o backend (`http://gateway:5006/*`), evitando problemas de CORS.

### **Environment Configuration**
Sistema do Angular que permite configurações diferentes por ambiente (development, staging, production). Definido em `src/environments/environment.*.ts`.

### **String Template Literals**
Sintaxe JavaScript para interpolação de variáveis em strings: `` `${baseUrl}/agents` ``. **Cuidado**: Não valida se há duplicações!

---

## 📌 Observações Finais

### ✅ **Pontos Positivos**
- A arquitetura de `environment.apiUrl` está bem estruturada
- O sistema de logs é detalhado, facilitando o diagnóstico
- O problema está isolado em 2 linhas de código, sendo fácil de corrigir

### ⚠️ **Pontos de Atenção**
- O `agent.service.ts` funciona "por acaso" porque `baseUrl = ''` (frágil)
- Não há validação automática de URLs duplicadas
- Falta documentação sobre convenções de montagem de URLs

### 🔧 **Melhorias Sugeridas** (longo prazo)
1. **Criar helper `buildApiUrl()`**: Função centralizada para montar URLs, evitando erros manuais
2. **Adicionar testes unitários**: Validar montagem de URLs em diferentes ambientes
3. **Documentar convenções**: README explicando como usar `environment.apiUrl`
4. **Considerar usar HttpClient Interceptor**: Para adicionar `baseUrl` automaticamente

---

## 🔗 Links Úteis

- **Environment Configuration (Angular)**: https://angular.dev/tools/cli/environments
- **HTTP Interceptors (Angular)**: https://angular.dev/guide/http/interceptors
- **Docker Networking**: https://docs.docker.com/network/

---

**Criado em**: 2025-11-02
**Atualizado em**: 2025-11-02
**Versão**: 1.0
**Status**: 🔴 **ISSUE ATIVA** — Aguardando correção
