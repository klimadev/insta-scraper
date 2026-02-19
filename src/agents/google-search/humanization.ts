import { Page } from 'playwright';

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

function easeInOutSine(value: number): number {
  return -(Math.cos(Math.PI * value) - 1) / 2;
}

function cubicBezierPoint(
  t: number,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number }
): { x: number; y: number } {
  const k = 1 - t;
  const x = (k ** 3 * p0.x) + (3 * k ** 2 * t * p1.x) + (3 * k * t ** 2 * p2.x) + (t ** 3 * p3.x);
  const y = (k ** 3 * p0.y) + (3 * k ** 2 * t * p1.y) + (3 * k * t ** 2 * p2.y) + (t ** 3 * p3.y);
  return { x, y };
}

export async function humanType(page: Page, selector: string, text: string): Promise<void> {
  const target = page.locator(selector).first();
  await target.click({ timeout: 5000 });

  for (const char of text) {
    if (shouldApplyTypo(char)) {
      await page.keyboard.type(typoVariant(char), { delay: randomBetween(35, 90) });
      await sleep(randomBetween(40, 110));
      await page.keyboard.press('Backspace');
      await sleep(randomBetween(30, 90));
    }

    await page.keyboard.type(char, { delay: randomBetween(30, 110) });

    if (isPauseCharacter(char)) {
      await sleep(randomBetween(90, 260));
    }
  }
}

export async function humanMove(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector).first();
  const box = await target.boundingBox();

  if (!box) {
    return;
  }

  const viewportSize = page.viewportSize() || { width: 1366, height: 768 };
  const start = {
    x: randomBetween(Math.floor(viewportSize.width * 0.1), Math.floor(viewportSize.width * 0.9)),
    y: randomBetween(Math.floor(viewportSize.height * 0.1), Math.floor(viewportSize.height * 0.9))
  };
  const end = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  };
  const spreadX = Math.abs(end.x - start.x) * 0.35;
  const spreadY = Math.abs(end.y - start.y) * 0.35;
  const controlA = {
    x: start.x + randomBetween(-Math.floor(spreadX), Math.floor(spreadX)),
    y: start.y + randomBetween(-Math.floor(spreadY), Math.floor(spreadY))
  };
  const controlB = {
    x: end.x + randomBetween(-Math.floor(spreadX), Math.floor(spreadX)),
    y: end.y + randomBetween(-Math.floor(spreadY), Math.floor(spreadY))
  };
  const steps = randomBetween(14, 32);

  await page.mouse.move(start.x, start.y);

  for (let step = 1; step <= steps; step++) {
    const linear = step / steps;
    const eased = easeInOutSine(linear);
    const point = cubicBezierPoint(eased, start, controlA, controlB, end);
    const jitterX = (Math.random() - 0.5) * 1.6;
    const jitterY = (Math.random() - 0.5) * 1.6;

    await page.mouse.move(point.x + jitterX, point.y + jitterY);
    await sleep(randomBetween(2, 10));
  }
}
