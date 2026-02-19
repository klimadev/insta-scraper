# Google Search com Playwright - Documentação

## Visão Geral

Este documento descreve como usar Playwright para realizar pesquisas no Google e extrair resultados (título, URL, descrição).

---

## Estrutura HTML do Google (Testada em Fev/2026)

### Barra de Pesquisa

```yaml
- search:
    - generic:
      - combobox "Pesquisar" [active]
```

**Seletor:** `getByRole('combobox', { name: 'Pesquisar' })` ou `input[name="q"]`

### Resultados de Pesquisa

```yaml
- generic [data-hveid]:  # Container de cada resultado
    - generic:
      - link "Título do resultado":
        - /url: https://exemplo.com
        - heading "Título do resultado" [level=3]
    - generic:  # Descrição
      - text: "Descrição do resultado..."
```

**Seletores:**

| Elemento | Seletor |
|----------|---------|
| Container de resultados | `#rso` ou `[role="main"]` |
| Cada resultado individual | `div[data-hveid]` ou `.g` |
| Título | `h3` dentro do container |
| Link | `a[href^="http"]` dentro do container |
| Descrição | `span` ou `div` com texto > 50 caracteres |

---

## Código Completo (Testado)

```javascript
const { chromium } = require('playwright');

async function searchGoogle(query) {
  const browser = await chromium.launch({ 
    headless: false, 
    channel: 'chrome' 
  });
  
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  await page.goto('https://www.google.com', { 
    waitUntil: 'domcontentloaded', 
    timeout: 60000 
  });

  await page.getByRole('combobox', { name: 'Pesquisar' }).fill(query);
  await page.getByRole('button', { name: 'Pesquisa Google' }).click();

  await page.waitForSelector('h3', { timeout: 10000 });

  const results = await page.evaluate(extractResults);

  await browser.close();
  return results;
}

function extractResults() {
  const data = [];
  const main = document.querySelector('#rso, [role="main"]');
  if (!main) return data;
  
  const items = main.querySelectorAll('div[data-hveid]');
  
  items.forEach(item => {
    const h3 = item.querySelector('h3');
    const a = item.querySelector('a[href^="http"]');
    
    if (!h3 || !a) return;
    
    const titulo = h3.textContent.trim();
    let descricao = '';
    
    const spans = item.querySelectorAll('span, div');
    for (const span of spans) {
      const text = span.textContent.trim();
      if (text.length > 50 && text !== titulo) {
        descricao = text;
        break;
      }
    }
    
    data.push({
      titulo,
      url: a.href,
      descricao: descricao.substring(0, 300)
    });
  });
  
  return data.filter(r => 
    r.url && 
    !r.url.includes('google.com/search') &&
    !r.url.includes('accounts.google')
  );
}

module.exports = { searchGoogle, extractResults };
```

---

## Função de Extração (Isolada)

```javascript
function extractResults() {
  const data = [];
  const main = document.querySelector('#rso, [role="main"]');
  if (!main) return data;
  
  const items = main.querySelectorAll('div[data-hveid]');
  
  items.forEach(item => {
    const h3 = item.querySelector('h3');
    const a = item.querySelector('a[href^="http"]');
    
    if (!h3 || !a) return;
    
    const titulo = h3.textContent.trim();
    let descricao = '';
    
    const spans = item.querySelectorAll('span, div');
    for (const span of spans) {
      const text = span.textContent.trim();
      if (text.length > 50 && text !== titulo) {
        descricao = text;
        break;
      }
    }
    
    data.push({
      titulo,
      url: a.href,
      descricao: descricao.substring(0, 300)
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

## Fluxo Passo a Passo

### 1. Navegar para o Google

```javascript
await page.goto('https://www.google.com', { 
  waitUntil: 'domcontentloaded', 
  timeout: 60000 
});
```

### 2. Preencher campo de pesquisa

```javascript
await page.getByRole('combobox', { name: 'Pesquisar' }).fill('termo de busca');
```

### 3. Submeter pesquisa

**Opção A - Botão:**
```javascript
await page.getByRole('button', { name: 'Pesquisa Google' }).click();
```

**Opção B - Enter:**
```javascript
await page.keyboard.press('Enter');
```

### 4. Aguardar resultados

```javascript
await page.waitForSelector('h3', { timeout: 10000 });
```

### 5. Extrair dados

```javascript
const results = await page.evaluate(extractResults);
```

---

## URLs a Ignorar

```javascript
const ignorePatterns = [
  'google.com/search',
  'accounts.google',
  'support.google',
  'maps.google'
];

results.filter(r => !ignorePatterns.some(p => r.url.includes(p)));
```

---

## Validações

```javascript
function isValidResult(result) {
  return (
    result.titulo && 
    result.titulo.length > 0 &&
    result.url && 
    result.url.startsWith('http') &&
    result.descricao &&
    result.descricao.length > 50
  );
}
```

---

## Exemplo de Uso

```javascript
const { searchGoogle } = require('./google-search');

(async () => {
  const results = await searchGoogle('Playwright automação browser');
  
  results.forEach((r, i) => {
    console.log(`${i + 1}. ${r.titulo}`);
    console.log(`   URL: ${r.url}`);
    console.log(`   ${r.descricao.substring(0, 100)}...`);
    console.log();
  });
})();
```

---

## Saída Esperada

```javascript
[
  {
    titulo: "Playwright: Fast and reliable end-to-end testing for modern...",
    url: "https://playwright.dev/",
    descricao: "Cross-browser. Playwright supports all modern rendering engines including Chromium, WebKit, and Firefox. Cross-platform. Test on Windows, Linux, and macOS..."
  },
  {
    titulo: "Browsers",
    url: "https://playwright.dev/docs/browsers",
    descricao: "Playwright can run tests on Chromium, WebKit and Firefox browsers as well as branded browsers such as Google Chrome and Microsoft Edge."
  }
]
```

---

## Navegação entre Páginas

### Estrutura da Paginação

```yaml
- navigation:
    - heading "Anterior":
        - link "Anterior" [cursor=pointer]
    - link "Page 1" [cursor=pointer]
    - link "Page 2" [cursor=pointer]
    - text: "3"  # Página atual (não é link)
    - link "Page 4" [cursor=pointer]
    - heading "Mais":
        - link "Mais" [cursor=pointer]
```

### Seletor Universal: "Mais"

O botão "Mais" é o seletor mais universal para avançar páginas, pois sempre existe independentemente da página atual.

```javascript
await page.getByRole('link', { name: 'Mais', exact: true }).click();
```

### Navegar para Página Específica

```javascript
async function goToPage(page, pageNumber) {
  if (pageNumber === 1) {
    return;
  }
  
  const pageLink = page.getByRole('link', { name: `Page ${pageNumber}` });
  
  if (await pageLink.count() > 0) {
    await pageLink.click();
    await page.waitForSelector('h3', { timeout: 10000 });
    return true;
  }
  
  return false;
}
```

### Rolar até o Final da Página

```javascript
await page.evaluate(() => {
  window.scrollTo(0, document.body.scrollHeight);
});
```

### Paginação via URL

O Google usa o parâmetro `start` para paginação:

| Página | Valor de `start` |
|--------|------------------|
| 1 | 0 |
| 2 | 10 |
| 3 | 20 |
| N | (N-1) * 10 |

```javascript
function getPageUrl(query, pageNumber) {
  const start = (pageNumber - 1) * 10;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${start}`;
}
```

### Exemplo: Extrair Múltiplas Páginas

```javascript
async function searchMultiplePages(query, maxPages = 3) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });
  await page.getByRole('combobox', { name: 'Pesquisar' }).fill(query);
  await page.getByRole('button', { name: 'Pesquisa Google' }).click();
  await page.waitForSelector('h3');

  const allResults = [];

  for (let i = 1; i <= maxPages; i++) {
    await page.waitForSelector('h3', { timeout: 10000 });
    const results = await page.evaluate(extractResults);
    allResults.push(...results);

    if (i < maxPages) {
      await page.getByRole('link', { name: 'Mais', exact: true }).click();
      await page.waitForLoadState('domcontentloaded');
    }
  }

  await browser.close();
  return allResults;
}
```

### Voltar para Página Anterior

```javascript
await page.getByRole('link', { name: 'Anterior' }).click();
```

---

## Scroll Infinito (Alternativa)

```javascript
async function scrollToLoadMore(page, maxScrolls = 5) {
  for (let i = 0; i < maxScrolls; i++) {
    const previousHeight = await page.evaluate(() => document.body.scrollHeight);
    
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    
    await page.waitForTimeout(2000);
    
    const newHeight = await page.evaluate(() => document.body.scrollHeight);
    
    if (newHeight === previousHeight) {
      break;
    }
  }
}
```

---

## Notas Importantes

- O Google pode mudar a estrutura HTML - usar seletores baseados em `role` e `name` é mais robusto
- O atributo `data-hveid` é estável para identificar resultados individuais
- Sempre usar `waitForSelector('h3')` antes de extrair dados
- Descrição válida tem > 50 caracteres
- `viewport: null` para janela maximizada
- O botão "Mais" é mais confiável que números de página específicos
- Aguardar `domcontentloaded` após navegar entre páginas
