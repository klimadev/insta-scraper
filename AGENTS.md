# AGENTS.md - Repository Guide for Coding Agents

## Purpose

This file defines how agents should work in this repository.
Follow these conventions to keep behavior consistent with maintainers.

## Project Snapshot

- Name: `insta-launcher`
- Runtime: Node.js 20 (CommonJS)
- Language: TypeScript (strict)
- Browser automation: Playwright
- CLI style: chalk + ora
- Build output: `dist/`
- Release packaging: GitHub Actions (Node SEA portable zip)

## Source Layout

- `src/index.ts` - CLI entrypoint and command routing
- `src/agents/google-search/` - Google scraping flow
- `src/agents/instagram-profile/` - Instagram profile extraction helpers
- `src/engine/` - browser/proxy/session infrastructure
- `src/cli/` - logger, messages, wizard, metrics
- `src/utils/` - shared utilities (CSV, etc.)
- `src/types/` - shared interfaces and error catalog
- `src/scripts/` - standalone debug/test scripts
- `.github/workflows/release.yml` - official distribution pipeline

## Required Commands

Run these commands in order after any edits:

```bash
npm install
npm run build
```

Notes:
- No dedicated lint script exists in `package.json`
- No unit-test framework configured (Jest/Vitest/etc)
- `npm run build` is the required validation gate

## Development Commands

```bash
npm run dev                    # Interactive wizard flow
npm run dev:google            # Quick local run for Google path
npm run test:stealth          # Stealth smoke check against SannySoft
npm run test:instagram:url    # Test Instagram profile extraction
```

## Single-Test Guidance

No formal test runner exists. "Single test" means running the relevant script:

```bash
# Run specific test script based on changed area
npm run test:instagram:url -- "https://www.instagram.com/nasa/"
npm run test:stealth
```

## Debug Mode for Instagram

```bash
npm run test:instagram:url -- "https://www.instagram.com/user/" --raw
npm run test:instagram:url -- "https://www.instagram.com/user/" --debug
npm run test:instagram:url -- "https://www.instagram.com/user/" --sessionid=YOUR_SESSION_ID
```

Options:
- `--raw`: Save raw API response to `output/debug/`
- `--debug`: Enable Playwright debug logs (DEBUG=pw:api)
- `--sessionid=SESSION_ID`: Pass Instagram session ID directly

## Release Workflow

Do not recreate old `pkg` flows. Distribution via GitHub Actions:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

## Code Style Rules

### Formatting

- Use 2 spaces indentation
- Use semicolons
- Prefer single quotes
- Keep lines readable; split long argument lists
- Add blank lines between logical blocks

### Imports

Order groups: external packages -> internal modules.
Prefer named imports where applicable.
Keep relative path depth minimal and consistent.
Avoid unused imports.

```ts
import { Browser, Page } from 'playwright';
import { logger } from '../../cli/logger';
import { ERROR_CODES } from '../../types';
```

### Types and TypeScript

- Keep `strict`-safe code (no implicit `any`)
- Always type public method params and returns
- Prefer interfaces/types in `src/types` or local `types.ts`
- Use union/narrowing instead of broad casts
- Use `Error | null` state when deferring throws across retries

### Naming

- Files: kebab-case (`browser-config.ts`)
- Classes/interfaces/types: PascalCase (`GoogleSearchConfig`)
- Variables/functions/methods: camelCase (`performSearch`)
- Constants: UPPER_SNAKE_CASE (`ERROR_CODES`)
- Error identifiers: stable uppercase tokens (`EMPTY_QUERY`)

### Error Handling

- Prefer fail-fast input validation at boundaries
- Map user-facing failures through `ERROR_CODES`
- Use `logger.error(code, message, action)` for UX-visible failures
- Throw explicit `Error` values after logging when execution must stop
- In retry loops, collect `lastError` and throw at the end
- Use `finally` for cleanup paths (`closeBrowser`, resource disposal)

### Logging and UX

- Use `logger.start/update/succeed/fail` for long operations
- Keep user-facing strings in Portuguese
- Keep error actions actionable (what user should do next)
- Avoid noisy debug logs in final code

### Playwright Patterns

- Keep browser launch fallback channels intact (Chrome -> Edge)
- Preserve stealth initialization order (fingerprint, context, page)
- Keep CAPTCHA handling resilient and resumable
- Avoid hard-coded waits when state-based waits are possible
- Prefer selector constants

### CSV Output Conventions

When adding CSV output:
- Use `toCsvRow()` from `src/utils/csv.ts`
- Include `extractedAt` timestamp column
- Escape quotes properly using `toCsvCell()`
- Consider flexible schema for unknown fields (use JSON column for extensibility)

Example for Instagram profile with bio links:
```ts
const bioLinksJson = profile.bioLinks ? JSON.stringify(profile.bioLinks) : '';
// Columns: username, bioLinksCount, bioLinksUrls, bioLinksJson, ...
```

## Change Management Rules

- Make cohesive edits across related files in one pass
- Do not introduce parallel alternative packaging paths
- Prefer improving existing modules over adding duplicate helpers
- Keep CommonJS compatibility (project is not ESM)

## Validation Checklist

After `npm run build`, manually review:
- Command routing in `src/index.ts`
- Google-search main flow and pagination
- Instagram API-first extraction and fallback flow
- Session/proxy integration points
- Null-state paths for `page/context/browser`

## Rules Discovery

Checked for additional agent rules:
- `.cursor/rules/`: not present
- `.cursorrules`: not present
- `.github/copilot-instructions.md`: not present

If those files are added later, merge their guidance into this document.

## What Not To Do

- Do not reintroduce legacy `compile`/`pkg` scripts
- Do not assume a lint command exists when it does not
- Do not run persistent dev servers in CI validation loops
- Do not bypass type safety with broad `any` casts
- Do not change release semantics away from current workflow without explicit request
- Do not add unit tests without configuring a test framework first
