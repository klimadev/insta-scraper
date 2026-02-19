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

### Resultados

Os resultados sao salvos em `output/google-{query}-{timestamp}.json`:

```json
{
  "query": "termo de busca",
  "totalPages": 3,
  "totalResults": 45,
  "extractedAt": "2026-02-19T14:30:00.000Z",
  "results": [
    {
      "title": "Titulo do resultado",
      "url": "https://exemplo.com",
      "description": "Descricao do resultado...",
      "source": "google",
      "status": "pending_instagram",
      "extractedAt": "2026-02-19T14:30:00.000Z",
      "query": "termo de busca",
      "page": 1
    }
  ]
}
```

O campo `status: "pending_instagram"` indica que o resultado esta pronto para ser processado pelo futuro Instagram Agent.

## Desenvolvimento

```bash
npm install           # Instalar dependencias
npm run dev           # Instagram (desenvolvimento)
npm run dev:google    # Google Search (desenvolvimento)
npm run build         # Compilar TypeScript
npm run compile       # Gerar .exe
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
2. Gerar o executavel Windows
3. Criar uma Release com o .exe anexado

**Importante**: Apenas tags no formato `v*` (ex: `v1.0.0`, `v1.1.0`) disparam o workflow de release.

## Stack

- Node.js 20 + TypeScript 5
- Playwright (automacao browser)
- chalk v4 + ora v5 (CLI)
- bun (empacotamento .exe)

## Pre-requisitos

- Google Chrome ou Microsoft Edge instalado
- Windows 10/11
- Bun 1.x (para gerar o .exe via `npm run compile`)

## Licenca

MIT
