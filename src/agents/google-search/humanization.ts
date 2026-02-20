import { Page } from 'playwright';
import { createCursor, Cursor } from 'ghost-cursor-playwright';

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isPauseCharacter(char: string): boolean {
  return [' ', '.', ',', '-'].includes(char);
}

function shouldApplyTypo(char: string): boolean {
  if (!/[a-z0-9]/i.test(char)) {
    return false;
  }
  return Math.random() < 0.03;
}

function typoVariant(char: string): string {
  if (!/[a-z]/i.test(char)) {
    return char;
  }
  const offset = Math.random() > 0.5 ? 1 : -1;
  const code = char.toLowerCase().charCodeAt(0) + offset;
  if (code < 97 || code > 122) {
    return char;
  }
  return String.fromCharCode(code);
}

function gaussianRandom(min: number, max: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  const mean = (min + max) / 2;
  const stdDev = (max - min) / 4;
  let value = mean + z0 * stdDev;
  value = Math.max(min, Math.min(max, value));
  return Math.floor(value);
}

export async function createHumanCursor(page: Page): Promise<Cursor> {
  return createCursor(page, {
    overshootSpread: 10,
    overshootRadius: 120,
    debug: false
  });
}

export async function humanType(page: Page, selector: string, text: string): Promise<void> {
  const target = page.locator(selector).first();
  await target.click({ timeout: 5000 });

  await sleep(gaussianRandom(150, 400));

  for (const char of text) {
    if (shouldApplyTypo(char)) {
      await page.keyboard.type(typoVariant(char), { delay: gaussianRandom(35, 90) });
      await sleep(gaussianRandom(40, 110));
      await page.keyboard.press('Backspace');
      await sleep(gaussianRandom(30, 90));
    }

    await page.keyboard.type(char, { delay: gaussianRandom(30, 110) });

    if (isPauseCharacter(char)) {
      await sleep(gaussianRandom(90, 260));
    }
  }
}

export async function humanMove(cursor: Cursor, selector: string): Promise<void> {
  await cursor.actions.click({ target: selector });
}

export async function humanMoveTo(cursor: Cursor, x: number, y: number): Promise<void> {
  await cursor.actions.move({ x, y });
}

export async function humanScroll(page: Page, direction: 'down' | 'up' = 'down', distance: number = 300): Promise<void> {
  const delta = direction === 'down' ? distance : -distance;
  const steps = randomBetween(3, 6);
  const stepSize = Math.floor(delta / steps);

  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, stepSize);
    await sleep(randomBetween(50, 150));
  }
}
