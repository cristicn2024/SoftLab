import type { CatalogProfile, CatalogTest, Concept, NewOrderItem } from './ordenes.types';

interface RawItem {
  id?: unknown;
  type?: unknown;
  price?: unknown;
}

export function normalizeQuery(raw: unknown): string {
  return String(raw || '').trim();
}

export function buildConcepts(tests: CatalogTest[], profiles: CatalogProfile[]): Concept[] {
  const concepts: Concept[] = [];
  for (const test of tests) {
    concepts.push({
      id: test.id,
      type: 'TEST',
      code: test.code,
      name: test.name,
      price: test.price,
      genderRestriction: test.genderRestriction || 'BOTH',
      includedTestIds: [test.id],
    });
  }
  for (const profile of profiles) {
    concepts.push({
      id: profile.id,
      type: 'PROFILE',
      code: profile.code,
      name: profile.name,
      price: profile.price,
      genderRestriction: 'BOTH',
      includedTestIds: profile.includedTestIds,
    });
  }
  return concepts;
}

export function startOfDay(now: Date): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function buildFolioPrefix(now: Date): string {
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `ORD-${dateStr}-`;
}

export function buildFolio(now: Date, countToday: number): string {
  return `${buildFolioPrefix(now)}${(countToday + 1).toString().padStart(4, '0')}`;
}

export function buildOrderItems(rawItems: unknown): NewOrderItem[] {
  const list: unknown[] = Array.isArray(rawItems) ? rawItems : [];
  const items: NewOrderItem[] = [];
  for (const entry of list) {
    const item = entry as RawItem | null;
    if (!item || !(item.id || item.type)) continue;
    const price = Number(item.price || 0);
    if (item.type === 'PROFILE') {
      items.push({ price, profileId: Number(item.id) });
    } else {
      items.push({ price, testId: Number(item.id) });
    }
  }
  return items;
}

export function parseOpenOrderPatientId(raw: unknown): number | null {
  const patientId = Number(raw);
  if (!patientId) return null;
  return patientId;
}
