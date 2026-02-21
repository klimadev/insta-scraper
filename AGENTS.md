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
- `src/types/` - shared interfaces and error catalog
- `.github/workflows/release.yml` - official distribution pipeline

## Required Commands

Use these commands in this order after edits.

```bash
npm install
npm run build
```

Notes:
- There is currently no dedicated lint script in `package.json`.
- There is no unit-test framework configured (Jest/Vitest/etc).
- `npm run build` is the required validation gate.

## Development Commands

```bash
npm run dev
npm run dev:google
npm run test:stealth
```

When to use:
- `npm run dev`: interactive wizard flow
- `npm run dev:google`: quick local run for Google path
- `npm run test:stealth`: stealth smoke check against SannySoft

## Single-Test Guidance

Because there is no formal test runner yet, a "single test" means running the one dedicated script:

```bash
npm run test:stealth
```

If future scripts are added (for example `test:*`), run only the relevant script for the changed area.

## Release Workflow Commands

Do not recreate old `pkg` flows.
Distribution is handled by the GitHub Actions workflow.

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

Expected workflow behavior:
- builds TypeScript
- creates SEA portable package
- publishes a single release asset zip

## Code Style Rules

### Formatting

- Use 2 spaces indentation
- Use semicolons
- Prefer single quotes
- Keep lines readable; split long argument lists
- Add blank lines between logical blocks

### Imports

- Order groups: external packages -> internal modules
- Prefer named imports where applicable
- Keep relative path depth minimal and consistent
- Avoid unused imports

Example:

```ts
import { Browser, Page } from 'playwright';
import { logger } from '../../cli/logger';
import { ERROR_CODES } from '../../types';
```

### Types and TypeScript

- Keep `strict`-safe code (no implicit `any`)
- Always type public method params and returns
- Prefer interfaces/types in `src/types` or local `types.ts`
- Use union/narrowing instead of broad casts when possible
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
- Keep user-facing strings in Portuguese (current product convention)
- Keep error actions actionable (what user should do next)
- Avoid noisy debug logs in final code

### Playwright and Automation Patterns

- Keep browser launch fallback channels intact (Chrome -> Edge)
- Preserve stealth initialization order (fingerprint, context, page)
- Keep CAPTCHA handling resilient and resumable
- Avoid hard-coded waits when state-based waits are possible
- Prefer selector constants from `selectors.ts`

## Change Management Rules

- Make cohesive edits across related files in one pass
- Do not introduce parallel alternative packaging paths
- Prefer improving existing modules over adding duplicate helpers
- Keep CommonJS compatibility (project is not ESM)

## Validation Checklist (Manual)

After `npm run build`, review:
- command routing in `src/index.ts`
- google-search main flow and pagination
- session/proxy integration points
- obvious null-state paths for `page/context/browser`

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
- Do not change release semantics away from the current workflow without explicit request
