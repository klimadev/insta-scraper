# AGENTS.md - Guia de Desenvolvimento Insta Launcher

## Comandos

```bash
npm run dev        # Desenvolvimento com ts-node (sem build)
npm run build      # Compilar TypeScript → JavaScript (tsc)
npm run compile    # Build + gerar executável .exe com caxa
```

**Sem testes configurados.**

## Eficiência de Tokens

- **Sempre prefira múltiplas edições/ações em uma única resposta**
- Editar múltiplos arquivos em paralelo quando independente
- Ler múltiplos arquivos em paralelo quando necessário
- Executar comandos bash em paralelo quando não há dependência
- Isso economiza tokens significativamente

## Stack

- **Runtime**: Node.js 20.x LTS | **Linguagem**: TypeScript 5.x
- **Module**: CommonJS (OBRIGATÓRIO) | **Automação**: Playwright
- **CLI**: chalk v4 + ora v5 (versões CommonJS apenas)

## Estrutura

```
src/
├── index.ts           # Entry point
├── engine/launcher.ts # Lógica principal do browser
├── engine/browser-config.ts  # Configurações Playwright
├── cli/logger.ts      # Wrapper chalk + ora (singleton)
├── cli/messages.ts    # Strings de UI em português
└── types/index.ts     # Interfaces e constantes de erro
```

## Convenções de Código

### Imports

```typescript
import { Browser, Page } from 'playwright';
import { BROWSER_CONFIG } from './browser-config';
import { logger } from '../cli/logger';
import { ERROR_CODES } from '../types';
```

Imports externos primeiro, internos depois.

### Nomenclatura

| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| Classes/Interfaces | PascalCase | `Launcher`, `BrowserConfig` |
| Métodos/variáveis | camelCase | `launchBrowser` |
| Constantes | UPPER_SNAKE_CASE | `BROWSER_CONFIG` |
| Arquivos | kebab-case | `browser-config.ts` |

### Classes

```typescript
export class Launcher {
  private browser: Browser | null = null;

  async launch(): Promise<void> { }
  private async launchBrowser(): Promise<void> { }
}
```

### Singleton Pattern

```typescript
export const logger = new Logger();
// Uso: import { logger } from './logger'
```

### Tratamento de Erros

```typescript
export const ERROR_CODES: Record<string, ErrorInfo> = {
  CHROME_NOT_FOUND: {
    code: 'ERR_BROWSER_001',
    message: 'Chrome não encontrado.',
    action: 'Download: https://chrome.google.com'
  }
};
```

- Erros centralizados em `ERROR_CODES` com `{ code, message, action }`
- Códigos: `ERR_<CATEGORIA>_<NUMERO>`
- Mensagens de UI centralizadas em `src/cli/messages.ts` (português brasileiro)

### Logger

```typescript
logger.header();              // Banner inicial
logger.start('Texto...');     // Inicia spinner
logger.update('Novo texto');  // Atualiza spinner
logger.succeed('Sucesso!');   // Para spinner com sucesso
logger.fail('Falhou');        // Para spinner com erro
logger.warn('Aviso');         // Aviso amarelo
logger.error(code, msg, action); // Box de erro estilizado
```

## TypeScript

```json
{ "target": "ES2020", "module": "CommonJS", "strict": true, "esModuleInterop": true }
```

## Estilo de Código

- **Sem comentários** no código | **Sem emojis**
- Indentação: 2 espaços | Aspas simples | Ponto e vírgula obrigatório
- Linhas em branco entre blocos lógicos

### Box UI Pattern

```typescript
console.log('╔══════════════════════════════════════════╗');
console.log('║           ERRO CRÍTICO                   ║');
console.log('╠══════════════════════════════════════════╣');
console.log('║' + chalk.white(` Mensagem`.padEnd(43)) + '║');
console.log('╚══════════════════════════════════════════╝');
```

## Browser (Playwright)

```typescript
const browser = await chromium.launch({ ...BROWSER_CONFIG, channel: 'chrome' });
const context = await browser.newContext({ viewport: null });
const page = await context.newPage();

await page.goto(INSTAGRAM_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
```

- `viewport: null` para janela maximizada
- `ignoreDefaultArgs: ['--enable-automation']` para evitar detection

## Fallback Pattern

```typescript
const FALLBACK_CHANNELS = ['chrome', 'msedge'];

for (const channel of FALLBACK_CHANNELS) {
  try {
    // tenta lançar com channel
    return;
  } catch (error) {
    lastError = error as Error;
    continue;
  }
}
throw lastError;
```

## Entry Point

```typescript
async function main(): Promise<void> {
  const launcher = new Launcher();
  try {
    await launcher.launch();
  } catch (error) {
    process.exit(1);
  }
}

main();
```

## Armadilhas Conhecidas

1. **NUNCA usar ESM** - chalk v5+ e ora v6+ quebram o build. Usar v4 e v5.
2. **pkg não empacota browsers** - Sempre usar `channel: 'chrome'` ou `'msedge'`.
3. **Anti-padrão**: Rodar `npm run dev` em agents - é comando interativo.
4. **Anti-padrão**: Usar `.env` - configurações são hardcoded.

## Fluxo de Validação

1. `npm run build` - verificar compilação TypeScript
2. Revisão lógica do código

## Idioma

- Código: **sem comentários**
- Mensagens de UI/erro: **Português brasileiro**
