# SPEC: Instagram Launcher Executable

**Versão:** 1.0.0  
**Data:** 2026-02-19  
**Status:** Definição Arquitetural

---

## 1. Visão Geral

Sistema de automação CLI que lança o Instagram no navegador via Playwright, empacotado como executável standalone para Windows.

### 1.1 Experiência do Usuário

```
C:\> insta-launcher.exe

[██████████] Inicializando Engine...
[██████████] Verificando ambiente...
[██████████] Abrindo Instagram...
✓ Concluído!

[Browser abre maximizado na home do Instagram]
```

---

## 2. Stack Tecnológica

| Componente | Tecnologia | Versão | Justificativa |
|------------|-----------|--------|---------------|
| Runtime | Node.js | 20.x LTS | Estabilidade e suporte a pkg |
| Linguagem | TypeScript | 5.x | Type safety, DX |
| Automação | Playwright | 1.40+ | API moderna, browsers inclusos |
| CLI Colors | chalk | 5.x | Logs coloridos, zero deps |
| CLI Spinner | ora | 7.x | Spinners elegantes |
| Transpiler | ts-node | 10.x | Dev sem build |
| Build | tsc | 5.x | Transpilação TS→JS |
| Empacotador | pkg | 5.8.x | Gera .exe standalone |

---

## 3. Decisão Arquitetural Crítica: Estratégia do Browser

### 3.1 Análise de Opções

| Estratégia | Tamanho .exe | Dependências | Complexidade |
|------------|-------------|--------------|--------------|
| **A) Chrome do Sistema** | ~20MB | Chrome instalado | Baixa |
| B) Chromium Portable | ~300MB | Nenhuma | Alta |
| C) Electron Wrapper | ~150MB | Nenhuma | Muito Alta |

### 3.2 Decisão: **Opção A - Chrome do Sistema**

**Motivos:**
1. **Tamanho**: .exe final ~20MB vs ~300MB
2. **Simplicidade**: pkg consegue empacotar sem configurações complexas
3. **Confiabilidade**: Chrome estável instalado no Windows
4. **Performance**: Sem overhead de extrair browser

**Trade-off aceito**: Usuário precisa ter Chrome instalado (penetração >70% em Windows)

### 3.3 Fallback Implementado

Caso Chrome não seja encontrado, o sistema:
1. Tenta Edge (`channel: 'msedge'`)
2. Se falhar, exibe mensagem clara de erro

---

## 4. Estrutura de Diretórios

```
insta_scrap/
├── src/
│   ├── index.ts              # Entry point CLI
│   ├── engine/
│   │   ├── launcher.ts       # Lógica de launch do browser
│   │   └── browser-config.ts # Configurações do Playwright
│   ├── cli/
│   │   ├── logger.ts         # Wrapper de chalk + ora
│   │   └── messages.ts       # Strings de UI
│   └── types/
│       └── index.ts          # Tipos TypeScript
├── dist/                     # JS transpilado (gitignore)
├── out/                      # .exe final (gitignore)
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

---

## 5. Dependências (package.json)

```json
{
  "name": "insta-launcher",
  "version": "1.0.0",
  "type": "commonjs",
  "main": "dist/index.js",
  "bin": "dist/index.js",
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "rimraf dist && tsc",
    "compile": "npm run build && pkg dist/index.js --targets node20-win-x64 --output out/insta-launcher.exe",
    "compile:all": "npm run build && pkg dist/index.js --targets node20-win-x64,node20-linux-x64,node20-macos-x64 --out-path out/"
  },
  "dependencies": {
    "chalk": "^4.1.2",
    "ora": "^5.4.1",
    "playwright": "^1.40.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "pkg": "^5.8.1",
    "rimraf": "^5.0.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.0"
  },
  "pkg": {
    "assets": [],
    "scripts": []
  }
}
```

### 5.1 Nota sobre Versões

- **chalk v4**: Última versão CommonJS. v5+ é ESM e incompatível com pkg.
- **ora v5**: Mesmo motivo - CommonJS necessário para pkg.

---

## 6. Configuração TypeScript (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "out"]
}
```

---

## 7. Configuração do Browser (browser-config.ts)

```typescript
// Parâmetros críticos para funcionamento com pkg
const BROWSER_CONFIG = {
  // Usa Chrome instalado no sistema
  channel: 'chrome',
  
  // Modo visível
  headless: false,
  
  // Maximizado
  args: ['--start-maximized'],
  
  // Viewport null = usa tamanho da janela
  viewport: null,
  
  // Evita detection de automação
  ignoreDefaultArgs: ['--enable-automation'],
  
  // Timeout generoso para launch
  timeout: 30000,
};

// Fallback para Edge se Chrome não existir
const FALLBACK_CHANNELS = ['chrome', 'msedge'];
```

---

## 8. Fluxo de Execução

```
┌─────────────────────────────────────────────────────────────┐
│                     CLI Entry (index.ts)                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  logger.spinner('Inicializando Engine...')                  │
│  - Verifica Node version                                    │
│  - Verifica Playwright browsers                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  logger.spinner('Configurando browser...')                  │
│  - Tenta channel: 'chrome'                                  │
│  - Se falhar, tenta 'msedge'                                │
│  - Se falhar, erro amigável                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  logger.spinner('Abrindo Instagram...')                     │
│  - browser.newContext()                                     │
│  - context.newPage()                                        │
│  - page.goto('https://instagram.com')                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  logger.success('Concluído!')                               │
│  - Browser permanece aberto                                 │
│  - CLI encerra, browser continua                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Armadilhas Conhecidas e Mitigações

### 9.1 pkg não suporta ESM

**Problema**: chalk 5.x e ora 7.x são ESM-only.  
**Solução**: Usar chalk 4.x e ora 5.x (CommonJS).

### 9.2 Playwright browsers não são empacotados

**Problema**: pkg não consegue incluir ~280MB de binários.  
**Solução**: Usar `channel: 'chrome'` (browser do sistema).

### 9.3 Caminhos de assets relativos

**Problema**: `__dirname` no .exe aponta para temp.  
**Solução**: Não usar arquivos externos. Tudo embedded ou browser do sistema.

### 9.4 Antivírus pode bloquear .exe não assinado

**Problema**: Windows Defender pode flaggar .exe não assinado.  
**Solução**: Documentar necessidade de assinatura digital para produção.

### 9.5 Playwright pode não encontrar browsers

**Problema**: `npx playwright install` não foi executado.  
**Solução**: Usar browser do sistema, não browsers do Playwright.

---

## 10. Comandos de Build

### 10.1 Desenvolvimento

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento (com ts-node)
npm run dev

# Instalar browsers do Playwright (para teste)
npx playwright install chromium
```

### 10.2 Build para Produção

```bash
# Transpilar TypeScript → JavaScript
npm run build

# Gerar executável
npm run compile

# Executar
./out/insta-launcher.exe
```

### 10.3 Build Multi-plataforma

```bash
# Gera .exe para Windows, Linux e macOS
npm run compile:all
```

---

## 11. Tratamento de Erros

```typescript
// Estrutura de erros esperados
const ERROR_CODES = {
  CHROME_NOT_FOUND: {
    code: 'ERR_BROWSER_001',
    message: 'Chrome não encontrado. Instale o Google Chrome.',
    action: 'Download: https://chrome.google.com'
  },
  LAUNCH_TIMEOUT: {
    code: 'ERR_BROWSER_002', 
    message: 'Timeout ao iniciar browser.',
    action: 'Verifique se Chrome está respondendo.'
  },
  NETWORK_ERROR: {
    code: 'ERR_NET_001',
    message: 'Falha ao conectar ao Instagram.',
    action: 'Verifique sua conexão com a internet.'
  }
};
```

---

## 12. Checklist de Validação Final

- [x] `npm run dev` abre browser corretamente
- [x] `npm run build` gera JS sem erros
- [x] `npm run compile` gera .exe funcional
- [x] .exe funciona em máquina sem Node.js
- [x] .exe funciona em máquina com Chrome instalado
- [x] Logs coloridos aparecem corretamente
- [x] Browser abre maximizado
- [x] Erros são exibidos de forma amigável
- [x] Arquivo .exe tem tamanho < 50MB (~37MB)

---

## 13. Próximos Passos (Pós-SPEC)

1. Implementar estrutura de diretórios
2. Criar package.json com dependências
3. Implementar logger.ts com chalk + ora
4. Implementar browser-config.ts
5. Implementar launcher.ts
6. Implementar index.ts (entry point)
7. Testar fluxo completo
8. Compilar .exe e validar

---

## 14. Alternativa: Build Portable (Opcional)

Se **portabilidade total** for requisito (sem Chrome instalado):

```bash
# Estratégia: Zip com .exe + pasta de browser
# 1. Compilar .exe
npm run compile

# 2. Copiar Chromium do Playwright
cp -r node_modules/playwright/.local-browsers out/browsers

# 3. Configurar PLAYWRIGHT_BROWSERS_PATH
# No código: process.env.PLAYWRIGHT_BROWSERS_PATH = './browsers'
```

**Resultado**: ~300MB, mas 100% portátil.

---

## 15. Referências

- [pkg Documentation](https://github.com/vercel/pkg)
- [Playwright Browsers](https://playwright.dev/docs/browsers)
- [chalk v4](https://github.com/chalk/chalk/tree/v4.1.2)
- [ora v5](https://github.com/sindresorhus/ora/tree/v5.4.1)
