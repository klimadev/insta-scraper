# SPEC: Google Search Scraper Agent

**Versão:** 1.0.0  
**Data:** 2026-02-19  
**Status:** Definição Arquitetural

---

## 1. Visão Geral

Agente de scraping que realiza buscas no Google e extrai resultados (título, URL, descrição) de múltiplas páginas, preparando dados para consumo posterior pelo Instagram Agent.

### 1.1 Experiência do Usuário

```
C:\> insta-scraper google "marketing digital"

[██████████] Inicializando Engine...
[██████████] Conectando ao Google...
[██████████] Extraindo página 1...
[██████████] Extraindo página 2...
[██████████] Extraindo página 3...
✓ 87 resultados extraídos

Resultado salvo em: output/google-marketing-digital.json
```

---

## 2. Stack Tecnológica

| Componente | Tecnologia | Versão | Justificativa |
|------------|-----------|--------|---------------|
| Runtime | Node.js | 20.x LTS | Mesmo runtime do projeto |
| Linguagem | TypeScript | 5.x | Type safety, consistência |
| Module | CommonJS | - | OBRIGATÓRIO (compatibilidade pkg) |
| Automação | Playwright | 1.40+ | Já utilizado no projeto |
| CLI Colors | chalk | v4 | CommonJS, já no projeto |
| CLI Spinner | ora | v5 | CommonJS, já no projeto |

---

## 3. Arquitetura de Dados

### 3.1 Interface de Saída

```typescript
export interface SearchResult {
  title: string;
  url: string;
  description: string;
  source: 'google';
  status: 'pending_instagram';
  extractedAt: string;
  query: string;
  page: number;
}

export interface SearchOutput {
  query: string;
  totalPages: number;
  totalResults: number;
  extractedAt: string;
  results: SearchResult[];
}
```

### 3.2 Exemplo de Saída

```json
{
  "query": "marketing digital",
  "totalPages": 3,
  "totalResults": 87,
  "extractedAt": "2026-02-19T14:30:00.000Z",
  "results": [
    {
      "title": "O que é Marketing Digital - Guia Completo",
      "url": "https://exemplo.com/marketing-digital",
      "description": "Marketing digital é o conjunto de estratégias...",
      "source": "google",
      "status": "pending_instagram",
      "extractedAt": "2026-02-19T14:30:00.000Z",
      "query": "marketing digital",
      "page": 1
    }
  ]
}
```

---

## 4. Estrutura de Diretórios

```
src/
├── agents/
│   └── google-search/
│       ├── index.ts           # Entry point do agente
│       ├── scraper.ts         # Lógica principal de scraping
│       ├── selectors.ts       # Seletores CSS/Playwright
│       └── types.ts           # Interfaces específicas
├── output/                    # Resultados salvos (gitignore)
└── ...
```

---

## 5. Interface do Agente

### 5.1 Contrato de Entrada

```typescript
export interface GoogleSearchConfig {
  query: string;
  maxPages?: number;
  headless?: boolean;
  outputFile?: string;
}

// Defaults
const DEFAULT_CONFIG: Required<Omit<GoogleSearchConfig, 'query'>> = {
  maxPages: 3,
  headless: false,
  outputFile: ''
};
```

### 5.2 Contrato de Saída

```typescript
export interface GoogleSearchAgent {
  search(config: GoogleSearchConfig): Promise<SearchOutput>;
}
```

---

## 6. Lógica de Extração

### 6.1 Seletores (Validados Fev/2026)

| Elemento | Seletor Playwright |
|----------|-------------------|
| Campo de busca | `getByRole('combobox', { name: 'Pesquisar' })` |
| Botão pesquisar | `getByRole('button', { name: 'Pesquisa Google' })` |
| Container resultados | `#rso` ou `[role="main"]` |
| Cada resultado | `div[data-hveid]` |
| Título | `h3` dentro do container |
| Link | `a[href^="http"]` dentro do container |
| Descrição | `span` ou `div` com texto > 50 chars |

### 6.2 Função de Extração (evaluate)

```typescript
function extractResults(): Omit<SearchResult, 'source' | 'status' | 'extractedAt' | 'query' | 'page'>[] {
  const data = [];
  const main = document.querySelector('#rso, [role="main"]');
  if (!main) return data;
  
  const items = main.querySelectorAll('div[data-hveid]');
  
  items.forEach(item => {
    const h3 = item.querySelector('h3');
    const a = item.querySelector('a[href^="http"]');
    
    if (!h3 || !a) return;
    
    const title = h3.textContent.trim();
    let description = '';
    
    const spans = item.querySelectorAll('span, div');
    for (const span of spans) {
      const text = span.textContent.trim();
      if (text.length > 50 && text !== title) {
        description = text;
        break;
      }
    }
    
    data.push({
      title,
      url: a.href,
      description: description.substring(0, 300)
    });
  });
  
  return data.filter(r => 
    r.url && 
    !r.url.includes('google.com/search') &&
    !r.url.includes('accounts.google')
  );
}
```

---

## 7. Lógica de Paginação

### 7.1 Estratégia: Botão "Mais"

O botão "Mais" é o seletor mais universal para avançar páginas.

```typescript
const NEXT_PAGE_SELECTOR = 'getByRole("link", { name: "Mais", exact: true })';
```

### 7.2 Fluxo de Paginação

```
Página 1 → Extrair → Clicar "Mais" → Página 2 → Extrair → Clicar "Mais" → ...
```

### 7.3 Implementação

```typescript
async function scrapeMultiplePages(
  page: Page, 
  query: string, 
  maxPages: number
): Promise<SearchResult[]> {
  const allResults: SearchResult[] = [];
  
  for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
    await page.waitForSelector('h3', { timeout: 10000 });
    
    const results = await page.evaluate(extractResults);
    const enriched = results.map(r => ({
      ...r,
      source: 'google' as const,
      status: 'pending_instagram' as const,
      extractedAt: new Date().toISOString(),
      query,
      page: currentPage
    }));
    
    allResults.push(...enriched);
    
    if (currentPage < maxPages) {
      const nextButton = page.getByRole('link', { name: 'Mais', exact: true });
      if (await nextButton.count() === 0) break;
      
      await nextButton.click();
      await page.waitForLoadState('domcontentloaded');
    }
  }
  
  return allResults;
}
```

### 7.4 Alternativa: Paginação via URL

```typescript
function getPageUrl(query: string, pageNumber: number): string {
  const start = (pageNumber - 1) * 10;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${start}`;
}
```

---

## 8. Fluxo de Execução

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI Entry (index.ts)                     │
│  - Parse argumentos: query, maxPages                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  logger.spinner('Inicializando Engine...')                  │
│  - Valida query (não vazia)                                 │
│  - Configura parâmetros                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  logger.spinner('Conectando ao Google...')                  │
│  - Launch browser (chrome/msedge fallback)                  │
│  - Navigate to google.com                                   │
│  - Fill search query                                        │
│  - Submit search                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Loop: logger.spinner('Extraindo página N...')              │
│  - Wait for results                                         │
│  - Extract data (evaluate)                                  │
│  - Click "Mais" if not last page                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  logger.success('N resultados extraídos')                   │
│  - Save to output/                                          │
│  - Close browser                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. URLs a Ignorar

```typescript
const IGNORE_PATTERNS = [
  'google.com/search',
  'accounts.google',
  'support.google',
  'maps.google',
  'policies.google',
  'youtube.com'
];
```

---

## 10. Tratamento de Erros

### 10.1 Códigos de Erro (Extensão de types/index.ts)

```typescript
export const ERROR_CODES = {
  // ... existentes ...
  
  GOOGLE_SEARCH_EMPTY_QUERY: {
    code: 'ERR_SEARCH_001',
    message: 'Query de busca não pode estar vazia.',
    action: 'Forneça um termo de busca válido.'
  },
  GOOGLE_SEARCH_NO_RESULTS: {
    code: 'ERR_SEARCH_002',
    message: 'Nenhum resultado encontrado.',
    action: 'Tente uma query diferente.'
  },
  GOOGLE_SEARCH_TIMEOUT: {
    code: 'ERR_SEARCH_003',
    message: 'Timeout ao aguardar resultados.',
    action: 'Verifique sua conexão ou tente novamente.'
  },
  GOOGLE_SEARCH_CAPTCHA: {
    code: 'ERR_SEARCH_004',
    message: 'CAPTCHA detectado pelo Google.',
    action: 'Execute em modo não-headless ou aguarde alguns minutos.'
  },
  GOOGLE_SEARCH_BLOCKED: {
    code: 'ERR_SEARCH_005',
    message: 'Acesso bloqueado pelo Google.',
    action: 'Mude de IP ou aguarde alguns minutos.'
  }
};
```

### 10.2 Detecção de CAPTCHA

```typescript
async function detectCaptcha(page: Page): Promise<boolean> {
  const captchaIndicators = [
    'recaptcha',
    'captcha',
    'unusual traffic',
    'verifique que você é humano'
  ];
  
  const content = await page.content();
  return captchaIndicators.some(indicator => 
    content.toLowerCase().includes(indicator)
  );
}
```

---

## 11. Critérios de Aceitação (RFC 2119)

### 11.1 Requisitos Obrigatórios (MUST)

| ID | Requisito |
|----|-----------|
| MUST-001 | O script MUST extrair URLs válidas (http/https) |
| MUST-002 | O script MUST seguir o padrão de erro definido em AGENTS.md |
| MUST-003 | O script MUST usar CommonJS module system |
| MUST-004 | O script MUST usar o padrão de fallback chrome/msedge |
| MUST-005 | O script MUST registrar erros via logger.error() |
| MUST-006 | O script MUST incluir campos `source: "google"` e `status: "pending_instagram"` |
| MUST-007 | O script MUST ignorar URLs do próprio Google |
| MUST-008 | O script MUST usar `viewport: null` para janela maximizada |
| MUST-009 | O script MUST usar `ignoreDefaultArgs: ['--enable-automation']` |

### 11.2 Requisitos Recomendados (SHOULD)

| ID | Requisito |
|----|-----------|
| SHOULD-001 | O script SHOULD ser modular para injetar resultados em fila futura |
| SHOULD-002 | O script SHOULD detectar CAPTCHA e reportar erro específico |
| SHOULD-003 | O script SHOULD salvar resultados em arquivo JSON |
| SHOULD-004 | O script SHOULD limitar descrições a 300 caracteres |
| SHOULD-005 | O script SHOULD validar se query está vazia antes de iniciar |

### 11.3 Requisitos Opcionais (MAY)

| ID | Requisito |
|----|-----------|
| MAY-001 | O script MAY suportar modo headless |
| MAY-002 | O script MAY permitir configurar número de páginas |
| MAY-003 | O script MAY suportar proxy |

---

## 12. Integração com Instagram Agent (Futuro)

### 12.1 Contrato de Integração

```typescript
// O campo status indica o estágio de processamento
type ResultStatus = 
  | 'pending_instagram'  // Extraído do Google, aguardando Instagram
  | 'processing'         // Sendo processado pelo Instagram
  | 'completed'          // Processado com sucesso
  | 'failed';            // Falhou no processamento

// Fila futura
interface QueueItem {
  url: string;
  source: 'google';
  status: ResultStatus;
  retries: number;
  createdAt: string;
  updatedAt: string;
}
```

### 12.2 Estrutura para Fila

```typescript
// O agente já prepara a estrutura para consumo posterior
const queueReadyResults = results.map(r => ({
  url: r.url,
  source: r.source,
  status: r.status,
  retries: 0,
  createdAt: r.extractedAt,
  updatedAt: r.extractedAt
}));
```

---

## 13. Comandos

```bash
npm run dev:google "termo de busca"           # Desenvolvimento
npm run dev:google "termo" -- --pages=5       # Com parâmetros
npm run build                                 # Build TypeScript
```

---

## 14. Checklist de Validação

- [ ] `npm run build` compila sem erros
- [ ] Extrai títulos corretamente
- [ ] Extrai URLs válidas
- [ ] Extrai descrições
- [ ] Paginação funciona (botão "Mais")
- [ ] Erros são tratados via ERROR_CODES
- [ ] Logger segue padrão do projeto
- [ ] Output JSON tem estrutura correta
- [ ] Fallback chrome/msedge funciona

---

## 15. Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| Google muda estrutura HTML | Média | Usar seletores baseados em role/name |
| CAPTCHA em modo headless | Alta | Executar em modo visível por padrão |
| Rate limiting | Média | Delay entre requisições, maxPages limitado |
| Timeout em conexões lentas | Baixa | Timeout generoso (60s) |

---

## 16. Referências

- [Google Search Playwright Docs](../docs/google-search-playwright.md)
- [AGENTS.md](../../AGENTS.md)
- [Playwright Selectors](https://playwright.dev/docs/selectors)
