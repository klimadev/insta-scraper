# SPEC: Google Ultra-Stealth Upgrade

**Versão:** 1.0.0  
**Data:** 2026-02-19  
**Status:** Grounding + Plano Mestre

---

## 1. Objetivo

Transformar a base atual de scraping Google em um sistema de **Ultra-Stealth Scraper** com comportamento humano realista, redução de fingerprinting e protocolo robusto para CAPTCHA sem expiração de sessão durante intervenção manual.

---

## 2. Grounding da Codebase Atual

### 2.1 Onde User-Agent, Viewport e Headers são definidos hoje

| Item | Estado Atual | Local |
|------|-------------|-------|
| User-Agent | Não definido explicitamente (usa padrão do navegador) | `src/agents/google-search/scraper.ts` |
| Viewport | Definido como `null` (janela maximizada) | `src/engine/browser-config.ts:7` e `src/agents/google-search/scraper.ts:74` |
| Headers HTTP | Não definidos explicitamente (`setExtraHTTPHeaders` ausente) | `src/agents/google-search/scraper.ts` |

### 2.2 Resumo do fluxo atual de scraping

1. Browser inicia via `chromium.launch()` com fallback `chrome -> msedge`.
2. Contexto é criado com `viewport: null`.
3. Busca usa `fill()` direto no input + `Enter`.
4. CAPTCHA é detectado por palavras-chave no HTML (`page.content()`) e aguardado em loop.
5. Timeouts continuam padrão durante espera de CAPTCHA.

### 2.3 Lacunas para stealth

- Sem `playwright-extra` e sem plugin de stealth.
- Sem humanização de digitação, mouse e scroll.
- Sem mascaramento avançado de fingerprint (WebGL/Canvas/AudioContext/hardwareConcurrency).
- Sem protocolo formal de timeout zero com guardas de memória/processo.

---

## 3. Stack Obrigatória

## 3.1 Dependências mandatórias

- `playwright-extra`
- `puppeteer-extra-plugin-stealth` (stealth-plugin)

## 3.2 Regra de integração

- O runtime **MUST** instanciar Chromium via `playwright-extra`.
- O stealth plugin **MUST** ser aplicado antes de criar contexto/página.
- A implementação **MUST** manter CommonJS compatível com o projeto.

Exemplo alvo (referência arquitetural):

```ts
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

chromium.use(StealthPlugin());
```

---

## 4. Arquitetura Alvo

## 4.1 Componentes novos

1. `StealthBootstrap`
   - Configura `playwright-extra` + stealth-plugin.
   - Gera perfil consistente de fingerprint por sessão.

2. `HumanizationEngine`
   - Digitação com atraso variável e correções ocasionais.
   - Mouse com curva de Bézier + micro-jitter.
   - Scroll fluido com pausas de leitura.

3. `FingerprintShield`
   - `addInitScript` para WebGL, Canvas, AudioContext, `hardwareConcurrency`.
   - Consistência entre `userAgent`, viewport, idioma, plataforma e capacidade de CPU.

4. `CaptchaGuard`
   - Detecção por frames/DOM/texto.
   - Ativa modo `no-timeout` com wait manual assistido.
   - Mantém sessão viva com ciclo controlado e cleanup obrigatório.

---

## 5. Humanization Logic

## 5.1 Random Typing Delay

### Estratégia

- Modelo por caractere com distribuição mista (normal truncada + picos ocasionais de hesitação).
- Intervalo base: `45ms - 220ms`.
- Pausa cognitiva após separadores (`espaco`, `.`, `,`, `-`): `180ms - 650ms`.
- Taxa de erro controlada: `1.5% - 4%` de chance por palavra de inserir typo e corrigir com `Backspace`.

### Pseudocódigo

```ts
for (char of query) {
  delay(randomNormal(95, 35, 45, 220));
  keyboard.type(char);

  if (isWordBoundary(char)) {
    delay(randomBetween(180, 650));
  }

  if (shouldMakeTypo()) {
    keyboard.type(randomNeighborKey(char));
    delay(randomBetween(60, 160));
    keyboard.press('Backspace');
  }
}
```

## 5.2 Bezier Curve Mouse Movements

### Estratégia

- Proibir trajetória linear constante.
- Gerar caminho cúbico com pontos de controle aleatórios entre origem e alvo.
- Interpolar `N` passos (`18-60`) com easing `easeInOutSine`.
- Aplicar jitter subpixel (`+-0.8px`) e variação temporal (`4-18ms`) por passo.

### Pseudocódigo

```ts
path = cubicBezier(P0, P1, P2, P3);
for (t in steps(0..1, N)) {
  p = path(easeInOutSine(t));
  mouse.move(p.x + jitter(), p.y + jitter());
  delay(randomBetween(4, 18));
}
mouse.down();
delay(randomBetween(35, 120));
mouse.up();
```

## 5.3 Scroll Fluido com Pausas de Leitura

- Scroll por lotes pequenos (`90-420px`) via `mouse.wheel` ou `window.scrollBy` incremental.
- Pausas de leitura variáveis (`350ms - 2600ms`) após blocos de resultado.
- Evento ocasional de micro-scroll reverso (`-40px` a `-120px`) para simular ajuste visual.

---

## 6. Anti-Fingerprinting

## 6.1 Princípio de consistência

Todas as superfícies de fingerprint **MUST** compartilhar o mesmo perfil sintético de sessão para evitar contradições internas.

Campos sincronizados:

- `userAgent`
- `platform`
- `viewport/screen`
- `locale` e `Accept-Language`
- `timezone`
- `hardwareConcurrency`

## 6.2 WebGL

- Interceptar `getParameter` para `UNMASKED_VENDOR_WEBGL` e `UNMASKED_RENDERER_WEBGL`.
- Expor combinação plausível e coerente com SO/UA.

## 6.3 Canvas

- Aplicar ruído mínimo determinístico por sessão em `toDataURL` e `getImageData`.
- O ruído **MUST** ser estável dentro da mesma sessão e variar entre sessões.

## 6.4 AudioContext

- Introduzir offset mínimo determinístico em `getChannelData`/`copyFromChannel`.
- Preservar integridade funcional de áudio para não quebrar páginas.

## 6.5 Hardware Concurrency

- `navigator.hardwareConcurrency` **MUST** refletir valor plausível (ex.: 4, 8, 12).
- Valor **MUST** ser coerente com `deviceMemory` e perfil de UA escolhido.

---

## 7. Captcha Protocol

## 7.1 Detecção

O sistema deve combinar sinais de:

1. Texto/DOM: `captcha`, `recaptcha`, `unusual traffic`, `verify you are human`.
2. Frames:
   - `recaptcha/api2/anchor`
   - `recaptcha/api2/bframe`
   - `hcaptcha.com`
   - `challenges.cloudflare.com` (Turnstile)
3. Selectors conhecidos de widgets.

## 7.2 Ação quando detectado

1. Emitir alerta visual no terminal + alerta sonoro (`\x07`).
2. Executar:
   - `page.setDefaultTimeout(0)`
   - `page.setDefaultNavigationTimeout(0)`
3. Entrar em estado `WAITING_MANUAL_CAPTCHA`.
4. Aguardar resolução com polling leve de sinais de CAPTCHA.

## 7.3 Política de sessão ativa

Durante `WAITING_MANUAL_CAPTCHA`, o sistema **MUST** manter o contexto aberto e válido sem timeout automático. Para reduzir risco de expiração por inatividade:

- Rodar keep-alive leve com intervalo aleatório (`20s - 45s`), sem ações agressivas.
- Revalidar se CAPTCHA sumiu em ciclos (`2s - 3.5s`).

## 7.4 Saída do modo CAPTCHA

- Requer `N` verificações consecutivas sem sinais (`N=3` recomendado).
- Restaurar timeouts padrão do scraper.
- Retomar fluxo normal do pipeline.

---

## 8. Segurança Operacional do No-Timeout

## 8.1 Riscos reais

1. Espera infinita caso usuário abandone a execução.
2. Timers órfãos gerando vazamento de memória.
3. Processo zumbi se browser/context não for encerrado em sinais do sistema.

## 8.2 Mitigações mandatórias

- Um único loop de espera por CAPTCHA por página (mutex/flag).
- Todos os `setInterval`/`setTimeout` com handle rastreado e `clear*` em `finally`.
- `process.on('SIGINT'|'SIGTERM'|'uncaughtException')` com rotina de shutdown graciosa.
- Encerramento ordenado: `page -> context -> browser`.
- Telemetria de vida útil: tempo em espera, memória RSS, status do loop.

## 8.3 Conclusão de viabilidade

A estratégia de `no-timeout` é viável **sem vazamento de memória ou processos zumbis**, desde que as mitigações acima sejam implementadas integralmente e validadas em teste de longa duração (>= 30 min em estado de CAPTCHA).

---

## 9. Plano de Implementação (Master Plan)

1. Integrar `playwright-extra` + stealth-plugin no bootstrap de browser.
2. Introduzir `FingerprintShield` via `context.addInitScript`.
3. Substituir `fill()` por `HumanizationEngine.typeLikeHuman()`.
4. Adicionar mouse Bézier para foco/click no input de busca.
5. Introduzir scroll fluido com pausas de leitura durante paginação/extração.
6. Reescrever `waitForCaptchaResolution()` para `CaptchaGuard` com timeout zero e keep-alive.
7. Adicionar lifecycle cleanup robusto e métricas de espera.
8. Rodar validações de stealth e estabilidade.

---

## 10. Critérios de Aceitação (RFC 2119)

### 10.1 MUST

- O sistema **MUST** usar `playwright-extra` com stealth-plugin ativo em runtime.
- O sistema **MUST** simular digitação humana com delay variável e correções ocasionais.
- O sistema **MUST** simular movimento de mouse por curva de Bézier com jitter temporal/espacial.
- O sistema **MUST** implementar mascaramento de WebGL, Canvas, AudioContext e `hardwareConcurrency` de forma consistente por sessão.
- O sistema **MUST** detectar CAPTCHA por DOM + frames (reCAPTCHA/Turnstile/hCaptcha).
- Ao detectar CAPTCHA, o sistema **MUST** desabilitar timeout global com `page.setDefaultTimeout(0)` e `page.setDefaultNavigationTimeout(0)`.
- O sistema **MUST** manter a sessão ativa sem expirar enquanto aguarda resolução manual do CAPTCHA.
- O sistema **MUST** passar no teste de detecção em `https://bot.sannysoft.com` com resultado compatível com perfil stealth (sem sinais críticos de automação).

### 10.2 SHOULD

- O sistema **SHOULD** registrar métricas de humanização (latência média de teclas, distância de mouse, padrão de scroll).
- O sistema **SHOULD** ter perfis de fingerprint rotativos por execução.
- O sistema **SHOULD** suportar modo de diagnóstico para comparar comportamento stealth vs baseline.

### 10.3 MAY

- O sistema **MAY** incluir pool de proxies residenciais como camada opcional.
- O sistema **MAY** incluir warm-up navigation antes da busca principal.

---

## 11. Validação Técnica

## 11.1 Testes funcionais

1. Busca Google completa com extração de múltiplas páginas.
2. Captcha detectado -> pausa manual -> retomada automática.
3. Espera manual prolongada (> 30 min) sem crash, sem crescimento anormal de memória, sem zombie.

## 11.2 Testes stealth

1. Executar contra `https://bot.sannysoft.com`.
2. Registrar evidências: screenshot + campos críticos reportados.
3. Repetir em Chrome e Edge (fallback channels).

---

## 12. Entregáveis

1. Refatoração do scraper com arquitetura modular (`StealthBootstrap`, `HumanizationEngine`, `FingerprintShield`, `CaptchaGuard`).
2. Configuração de runtime stealth em CommonJS.
3. Protocolos de observabilidade e cleanup para no-timeout.
4. Relatório de validação SannySoft + estabilidade de sessão em CAPTCHA.
