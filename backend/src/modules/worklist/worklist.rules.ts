import type { Flag, RangeRecord, RangeRule } from './worklist.types';

export type PreparedValue = { ok: true; value: string } | { ok: false; message: string };

const NUMERIC = /^-?\d+(\.\d+)?$/;

export function calculateAge(birthDate: Date, today: Date): number {
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();
  const birthdayNotYet = monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate());
  if (birthdayNotYet) {
    age = age - 1;
  }
  return age;
}

export function pickRange(ranges: RangeRecord[], gender: string, ageYears: number): RangeRecord | null {
  for (const range of ranges) {
    const genderMatches = range.gender === null || range.gender === gender;
    const fromMatches = range.minAgeYears === null || ageYears >= range.minAgeYears;
    const toMatches = range.maxAgeYears === null || ageYears <= range.maxAgeYears;
    if (genderMatches && fromMatches && toMatches) {
      return range;
    }
  }
  return null;
}

export function buildRule(range: RangeRecord | null, expected: string | null): RangeRule | null {
  if (range === null && expected === null) {
    return null;
  }

  const rule: RangeRule = {
    low: null,
    high: null,
    lowInclusive: true,
    highInclusive: true,
    criticalLow: null,
    criticalHigh: null,
    criticalLowInclusive: false,
    criticalHighInclusive: false,
    expected,
  };

  if (range !== null) {
    rule.low = range.low;
    rule.high = range.high;
    rule.lowInclusive = range.lowInclusive;
    rule.highInclusive = range.highInclusive;
    rule.criticalLow = range.criticalLow;
    rule.criticalHigh = range.criticalHigh;
    rule.criticalLowInclusive = range.criticalLowInclusive;
    rule.criticalHighInclusive = range.criticalHighInclusive;
  }

  return rule;
}

export function describeRange(range: RangeRecord | null, expected: string | null): string | null {
  if (range !== null) {
    return range.display;
  }
  return expected;
}

export function describePrevious(value: string | null, date: string | null): string | null {
  if (value === null) {
    return null;
  }
  if (date === null) {
    return value;
  }
  return `${value} (${date})`;
}

export function buildFolio(folio: string | null, orderId: number): string {
  if (folio !== null) {
    return folio;
  }
  return `ORD-${String(orderId).padStart(6, '0')}`;
}

export function interpretValue(value: string, rule: RangeRule | null): Flag {
  if (value === '' || rule === null) {
    return '—';
  }

  if (rule.expected) {
    if (value.trim().toLowerCase() === rule.expected.trim().toLowerCase()) {
      return 'Normal';
    }
    return 'A';
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return '—';
  }

  if (rule.criticalLow !== null && (number < rule.criticalLow || (rule.criticalLowInclusive && number === rule.criticalLow))) {
    return 'LL';
  }
  if (rule.criticalHigh !== null && (number > rule.criticalHigh || (rule.criticalHighInclusive && number === rule.criticalHigh))) {
    return 'HH';
  }
  if (rule.low !== null && (number < rule.low || (!rule.lowInclusive && number === rule.low))) {
    return 'L';
  }
  if (rule.high !== null && (number > rule.high || (!rule.highInclusive && number === rule.high))) {
    return 'H';
  }
  return 'Normal';
}

export function prepareValue(raw: string, rule: RangeRule | null): PreparedValue {
  const text = raw.trim();
  if (text === '') {
    return { ok: false, message: 'Escribe un resultado.' };
  }
  if (rule === null || rule.expected) {
    return { ok: true, value: text };
  }

  const numeric = text.replace(',', '.');
  if (!NUMERIC.test(numeric)) {
    return { ok: false, message: 'Este estudio lleva un valor numérico.' };
  }
  return { ok: true, value: numeric };
}
