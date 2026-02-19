# Especificação de Otimização Hiper: Instant Launch

## 1. Estratégia de Build

### 1.1 Migração de Bundler
- **Objetivo:** Substituir `tsc` + `caxa` por pipeline otimizado com `esbuild` ou `swc`
- **Justificativa:** `tsc` apenas compila, não faz tree-shaking nem minificação avançada
- **Implementação:**
  - Adotar `esbuild` para transpilação + bundling em modo production
  - Habilitar tree-shaking para eliminar dead code
  - Aplicar minificação/agressiva concatenação de módulos

### 1.2 Configuração de Compilador
- **Antes:** `tsc` com saída CommonJS pura
- **Depois:** `esbuild` com:
  - `--bundle`: Empacota tudo em um único arquivo
  - `--minify`: Minificação completa (whitespace, identifiers, syntax)
  - `--target=es2020`: Mantém compatibilidade atual
  - `--format=cjs`: Preserva formato CommonJS para caxa
  - `--platform=node`: Otimiza para ambiente Node.js
  - `--external:playwright`: Exclui playwright para manter compatibilidade com módulos nativos

### 1.3 Análise de Impacto em Módulos Nativos
- **Consideração crítica:** Playwright contém módulos nativos (.node) específicos para Windows
- **Validação:** `esbuild` suporta exclusão de dependências externas com `--external`
- **Estratégia:** Manter `playwright` como external dependency para preservar módulos nativos
- **Avaliação:** Após bundle, testar runtime em Windows para garantir integridade de módulos nativos

## 2. Otimização Caxa

### 2.1 Flags de Compressão
```
npx caxa --input . --output out/insta-launcher.exe \
  -- "{{caxa}}/node_modules/.bin/node" "{{caxa}}/dist/index.js"
```
- **Compressão:** Padrão (gzip) - não alterar algoritmo default do caxa
- **Observação:** Testar impacto de diferentes níveis de compressão mantendo tamanho extraído constante

### 2.2 Cache e Extração
- **Diretório estável:** Garantir path consistente para evitar re-extração
- **Estratégia:** Usar caminho de extração baseado em hash do próprio executável
- **Evitar duplicatas:** Verificar se já existe extração válida antes de reprocessar

### 2.3 Conteúdo de Entrada
- **Otimização:** Excluir arquivos desnecessários do bundle:
  - `*.map`, `LICENSE`, `CHANGELOG`
  - Documentação e testes
  - Outras dependências de desenvolvimento

## 3. Runtime V8

### 3.1 Flags de Otimização
Adicionar ao comando de execução via caxa:
```
--max-old-space-size=4096
--v8-cache-options=none
--jitless=false
```
- **Heap:** Aumentar limite de memória para evitar GC prematuro
- **Cache:** Desabilitar cache JIT para inicialização mais rápida (compensar com runtime otimizado)

### 3.2 Startup Optimization
- **Pré-compilação:** Considerar geração de bytecode pré-compilado
- **Lazy initialization:** Atrasar carregamento de módulos não-críticos

## 4. Windows I/O Optimization

### 4.1 Estratégia de Extração Temporária
- **Local padrão:** Pasta temporária do sistema (evitar disco C: se possível)
- **Exclusão AV:** Recomendar exclusão via GPO ou script para:
  - `%TEMP%\caxa-*`
  - Caminho do executável final
- **Performance:** Utilizar SSD como destino preferencial de extração

### 4.2 Registry Optimization
- **Associação:** Criar associação direta no registry para evitar buscas
- **Prefetch:** Considerar integração com Windows Prefetch para cargas frequentes

## 5. Critérios de Aceitação (RFC 2119)

### 5.1 Tamanho de Arquivo
- O binário final **MUST** ter no mínimo 30% de redução de tamanho em relação ao build atual
- Medição: Comparação direta entre `insta-launcher.exe` antigo vs novo

### 5.2 Tempo de Inicialização
- O tempo de boot **SHOULD** ser reduzido em 50% em relação ao build atual
- Medição: Desde clique duplo até mensagem de ready na CLI
- Ambiente: Windows clean boot com antivírus ativo

### 5.3 Funcionalidade
- O binário **MUST** manter toda funcionalidade original
- Testes: Validação completa do fluxo de scraping sem degradação