# Instagram Profile Scraping com Playwright - Documentação

## Visão Geral

Este documento descreve como usar Playwright para extrair dados de perfis públicos do Instagram (username, nome, bio, publicações, seguidores, seguindo).

---

## Estrutura HTML do Instagram (Testada em Fev/2026)

### Header do Perfil

```yaml
- header:
    - section:
        - div[0]:          # Username + botões
            - div:
              - h2: "username"
            - div: "Opções" # Botões de ação
        - div[1]:          # Nome de exibição
            - span: "Nome de Exibição"
        - div[2]:          # Estatísticas
            - ul:
              - li[0]: "327 publicações"
              - li[1]: "910 seguidores"
              - li[2]: "A seguir 2127"
        - div[3]:          # Bio
            - div:
              - span[dir="auto"]: "Texto da bio..."
```

**Seletores:**

| Elemento | Seletor |
|----------|---------|
| Header principal | `header` |
| Seção de perfil | `header section` |
| Divs internos | `header section > div` (4 divs) |
| Username | `div[0] > h2` |
| Nome | `div[1] > span` |
| Estatísticas | `div[2] > ul > li` |
| Bio | `div[3] > div > span` |

---

## Código Completo (Testado)

```javascript
const { chromium } = require('playwright');

async function scrapeInstagramProfile(username) {
  const browser = await chromium.launch({ 
    headless: false, 
    channel: 'chrome' 
  });
  
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  await page.goto(`https://www.instagram.com/${username}/?hl=pt`, { 
    waitUntil: 'domcontentloaded', 
    timeout: 60000 
  });

  await page.waitForSelector('header section', { timeout: 10000 });

  const profile = await page.evaluate(extractProfileData);

  await browser.close();
  return profile;
}

function extractProfileData() {
  const header = document.querySelector('header');
  const section = header?.querySelector('section');
  const divs = section?.querySelectorAll(':scope > div');
  
  if (!divs || divs.length < 4) {
    return { error: 'Estrutura HTML inesperada' };
  }
  
  const username = divs[0]?.querySelector('h2')?.textContent?.trim() || '';
  const name = divs[1]?.querySelector('span')?.textContent?.trim() || '';
  
  const listItems = divs[2]?.querySelectorAll('ul li');
  let publicacoes = 0, seguidores = 0, seguindo = 0;
  
  listItems?.forEach((li, i) => {
    const text = li.textContent || '';
    const num = parseInt(text.match(/[\d.]+/)?.[0]?.replace('.', '') || '0', 10);
    if (i === 0) publicacoes = num;
    if (i === 1) seguidores = num;
    if (i === 2) seguindo = num;
  });
  
  const bioDiv = divs[3]?.querySelector('div');
  const firstSpan = bioDiv?.querySelector('span');
  let bio = firstSpan?.textContent?.trim() || '';
  bio = bio.replace(/\.\.\.?\s*mais\s*$/, '').trim();
  
  return { username, name, publicacoes, seguidores, seguindo, bio };
}

module.exports = { scrapeInstagramProfile, extractProfileData };
```

---

## Função de Extração (Isolada)

```javascript
function extractProfileData() {
  const header = document.querySelector('header');
  const section = header?.querySelector('section');
  const divs = section?.querySelectorAll(':scope > div');
  
  if (!divs || divs.length < 4) {
    return { error: 'Estrutura HTML inesperada' };
  }
  
  const username = divs[0]?.querySelector('h2')?.textContent?.trim() || '';
  const name = divs[1]?.querySelector('span')?.textContent?.trim() || '';
  
  const listItems = divs[2]?.querySelectorAll('ul li');
  let publicacoes = 0, seguidores = 0, seguindo = 0;
  
  listItems?.forEach((li, i) => {
    const text = li.textContent || '';
    const num = parseInt(text.match(/[\d.]+/)?.[0]?.replace('.', '') || '0', 10);
    if (i === 0) publicacoes = num;
    if (i === 1) seguidores = num;
    if (i === 2) seguindo = num;
  });
  
  const bioDiv = divs[3]?.querySelector('div');
  const firstSpan = bioDiv?.querySelector('span');
  let bio = firstSpan?.textContent?.trim() || '';
  bio = bio.replace(/\.\.\.?\s*mais\s*$/, '').trim();
  
  return { username, name, publicacoes, seguidores, seguindo, bio };
}
```

---

## Extração Individual por Campo

### Username

```javascript
function extractUsername() {
  const header = document.querySelector('header');
  const section = header?.querySelector('section');
  const divs = section?.querySelectorAll(':scope > div');
  return divs?.[0]?.querySelector('h2')?.textContent?.trim() || '';
}
```

**Posição:** `header > section > div[0] > div > h2`

---

### Nome de Exibição

```javascript
function extractName() {
  const header = document.querySelector('header');
  const section = header?.querySelector('section');
  const divs = section?.querySelectorAll(':scope > div');
  return divs?.[1]?.querySelector('span')?.textContent?.trim() || '';
}
```

**Posição:** `header > section > div[1] > span`

---

### Publicações

```javascript
function extractPublicacoes() {
  const header = document.querySelector('header');
  const section = header?.querySelector('section');
  const divs = section?.querySelectorAll(':scope > div');
  const li = divs?.[2]?.querySelectorAll('ul li')[0];
  const text = li?.textContent || '';
  return parseInt(text.match(/[\d.]+/)?.[0]?.replace('.', '') || '0', 10);
}
```

**Posição:** `header > section > div[2] > ul > li[0]`

---

### Seguidores

```javascript
function extractSeguidores() {
  const header = document.querySelector('header');
  const section = header?.querySelector('section');
  const divs = section?.querySelectorAll(':scope > div');
  const li = divs?.[2]?.querySelectorAll('ul li')[1];
  const text = li?.textContent || '';
  return parseInt(text.match(/[\d.]+/)?.[0]?.replace('.', '') || '0', 10);
}
```

**Posição:** `header > section > div[2] > ul > li[1]`

---

### Seguindo

```javascript
function extractSeguindo() {
  const header = document.querySelector('header');
  const section = header?.querySelector('section');
  const divs = section?.querySelectorAll(':scope > div');
  const li = divs?.[2]?.querySelectorAll('ul li')[2];
  const text = li?.textContent || '';
  return parseInt(text.match(/[\d.]+/)?.[0]?.replace('.', '') || '0', 10);
}
```

**Posição:** `header > section > div[2] > ul > li[2]`

---

### Bio

```javascript
function extractBio() {
  const header = document.querySelector('header');
  const section = header?.querySelector('section');
  const divs = section?.querySelectorAll(':scope > div');
  const bioDiv = divs?.[3]?.querySelector('div');
  const firstSpan = bioDiv?.querySelector('span');
  let bio = firstSpan?.textContent?.trim() || '';
  return bio.replace(/\.\.\.?\s*mais\s*$/, '').trim();
}
```

**Posição:** `header > section > div[3] > div > span[dir="auto"]`

**Nota:** O texto pode conter "... mais" quando truncado. O `replace` remove esse sufixo.

---

## Fluxo Passo a Passo

### 1. Navegar para o Perfil

```javascript
await page.goto('https://www.instagram.com/odontoliderguaiba/?hl=pt', { 
  waitUntil: 'domcontentloaded', 
  timeout: 60000 
});
```

**Parâmetro `hl=pt`:** Força idioma português (útil para seletores baseados em texto).

---

### 2. Aguardar Header Carregar

```javascript
await page.waitForSelector('header section', { timeout: 10000 });
```

---

### 3. Extrair Dados

```javascript
const profile = await page.evaluate(extractProfileData);
```

---

## Tratamento de Diálogos

O Instagram pode exibir um diálogo de login/registro ao acessar perfis sem estar logado.

### Estrutura do Diálogo

```yaml
- dialog:
    - button "Fechar" [active]
    - generic:
      - text: "Ver mais de username"
      - link "Registar-se no Instagram"
      - button "Iniciar sessão"
```

### Fechar Diálogo

```javascript
const closeButton = page.getByRole('button', { name: 'Fechar' });
if (await closeButton.count() > 0) {
  await closeButton.click();
}
```

### Verificar se Diálogo Existe

```javascript
async function hasLoginDialog(page) {
  const dialog = await page.$('dialog');
  return dialog !== null;
}
```

---

## Validações

```javascript
function isValidProfile(profile) {
  return (
    profile.username &&
    profile.username.length > 0 &&
    !profile.error &&
    typeof profile.publicacoes === 'number' &&
    typeof profile.seguidores === 'number' &&
    typeof profile.seguindo === 'number'
  );
}
```

---

## Exemplo de Uso

```javascript
const { scrapeInstagramProfile } = require('./instagram-profile');

(async () => {
  const profile = await scrapeInstagramProfile('odontoliderguaiba');
  
  console.log(`Username: @${profile.username}`);
  console.log(`Nome: ${profile.name}`);
  console.log(`Publicações: ${profile.publicacoes}`);
  console.log(`Seguidores: ${profile.seguidores}`);
  console.log(`Seguindo: ${profile.seguindo}`);
  console.log(`Bio: ${profile.bio}`);
})();
```

---

## Saída Esperada

```javascript
{
  username: 'odontoliderguaiba',
  name: 'Odonto Líder',
  publicacoes: 327,
  seguidores: 910,
  seguindo: 2127,
  bio: 'Clínica Odontológica Guaíba/RS Aparelhos Ortodônticos, Implantes, Próteses, Restaurações, etc.'
}
```

---

## Números Grandes (K, M)

Para perfis com muitos seguidores, o Instagram usa abreviações:

| Texto | Valor Real |
|-------|------------|
| "1K" | 1.000 |
| "10K" | 10.000 |
| "1M" | 1.000.000 |
| "1,5M" | 1.500.000 |

### Função para Converter

```javascript
function parseInstagramNumber(text) {
  const clean = text.replace(/\s/g, '').toUpperCase();
  const match = clean.match(/[\d.,]+/);
  if (!match) return 0;
  
  let num = parseFloat(match[0].replace(',', '.'));
  
  if (clean.includes('K')) num *= 1000;
  else if (clean.includes('M')) num *= 1000000;
  
  return Math.round(num);
}
```

---

## Notas Importantes

- **Estrutura estável:** `header > section > div[0-3]` é consistente entre perfis
- **Índices fixos:** `div[0]` = username, `div[1]` = nome, `div[2]` = stats, `div[3]` = bio
- **Estatísticas por índice:** `li[0]` = publicações, `li[1]` = seguidores, `li[2]` = seguindo
- **Não depender de texto:** Usar posição/índice, não conteúdo textual como "Clínica" ou "seguidores"
- **Bio truncada:** Pode conter "... mais" - usar regex para remover
- **`viewport: null`:** Para janela maximizada
- **`hl=pt`:** Força idioma português
- **Diálogo de login:** Pode aparecer - verificar e fechar se necessário
