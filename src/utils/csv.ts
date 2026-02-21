function normalizeCsvCell(value: string): string {
  if (value.includes('"')) {
    return value.replace(/"/g, '""');
  }

  return value;
}

export function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const raw = String(value);
  const normalized = normalizeCsvCell(raw);

  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized}"`;
  }

  return normalized;
}

export function toCsvRow(values: unknown[]): string {
  return values.map(toCsvCell).join(',');
}
