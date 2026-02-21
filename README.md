# Insta Launcher

Ferramenta de automacao para Instagram e Google Search.

## Instalacao

Baixe o executavel na pagina de [Releases](https://github.com/klimadev/insta-scraper/releases).

## Uso

```bash
# Abre Instagram no browser
insta-launcher

# Busca no Google e extrai resultados
insta-launcher google "termo de busca"

# Com paginacao (padrao: 3 paginas)
insta-launcher google "termo de busca" --pages=5
```

### CAPTCHA

Se o Google detectar automatizacao, o programa exibira um aviso. Resolva o CAPTCHA manualmente no browser aberto e a extracao continuara automaticamente.

### Instagram sem login (melhor esforco)

Quando um resultado do Google for perfil do Instagram, a extracao agora processa **todos os perfis unicos** encontrados (ate 25 por execucao), com ritmo conservador entre requisicoes para evitar deteccao.

O scraper:
1. Deduplica perfis por username (mesma pessoa nao e processada duas vezes)
2. Aplica delay de 3.5s + jitter aleatorio (ate 3s) entre cada perfil
3. Tenta primeiro o endpoint interno `web_profile_info` para reduzir redirecionamento ao login
4. Faz fallback para extracao via DOM se a API falhar

Status disponiveis no campo `status`:
- `not_instagram` - resultado nao e perfil do Instagram
- `instagram_ok` - perfil extratido com sucesso
- `instagram_failed` - falha na extracao do perfil
- `duplicate_instagram` - perfil duplicado (ja processado)
- `instagram_skipped_limit` - perfil ignorado por limite de 25 por execucao

Opcionalmente, voce pode informar um cookie de sessao para aumentar a chance de sucesso:

```bash
set INSTAGRAM_SESSIONID=seu_sessionid_aqui
insta-launcher google "sua busca"
```

Observacao: nao e garantia de 100%. Dependendo do risco da conexao/IP, o Instagram ainda pode exigir login manual.

No teste individual de perfil, tambem e possivel passar direto por argumento:

```bash
npm run test:instagram:url -- "https://www.instagram.com/nike/" --sessionid=seu_sessionid_aqui
```

### Resultados

Os resultados sao salvos em `output/google-{query}-{timestamp}.csv`:

```csv
query,totalPages,totalResults,outputExtractedAt,title,url,description,source,status,resultExtractedAt,page,instagramUsername,instagramName,instagramPublicacoes,instagramSeguidores,instagramSeguindo,instagramBio,instagramLink,instagramExtractedAt
termo de busca,3,45,2026-02-21T10:00:00.000Z,Titulo do resultado,https://www.instagram.com/nike/,Descricao...,google,instagram_ok,2026-02-21T10:00:05.000Z,1,nike,Nike,5000000,300000000,1000,"Just Do It",https://nike.com,2026-02-21T10:00:05.000Z
```

Campos de status:
- `not_instagram` - resultado nao e perfil do Instagram
- `instagram_ok` - perfil extratido com sucesso
- `instagram_failed` - falha na extracao
- `duplicate_instagram` - perfil ja processado
- `instagram_skipped_limit` - ignorado por limite

## Desenvolvimento

```bash
npm install           # Instalar dependencias
npm run dev           # Instagram (desenvolvimento)
npm run dev:google    # Google Search (desenvolvimento)
npm run build         # Compilar TypeScript
```

## Criar Release

Para criar uma nova release oficial:

```bash
# Criar tag com versao
git tag v1.0.0

# Enviar tag para o remote
git push origin v1.0.0
```

O GitHub Actions ira automaticamente:
1. Compilar o projeto
2. Gerar pacote de distribuicao Windows (Node SEA + deps)
3. Criar uma Release com o .zip anexado

**Importante**: Apenas tags no formato `v*` (ex: `v1.0.0`, `v1.1.0`) disparam o workflow de release.

## Stack

- Node.js 20 + TypeScript 5
- Playwright (automacao browser)
- chalk v4 + ora v5 (CLI)
- Node SEA + postject (distribuicao)

## Pre-requisitos

- Google Chrome ou Microsoft Edge instalado
- Windows 10/11

## Licenca

MIT
