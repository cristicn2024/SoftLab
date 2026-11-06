import type { PaymentMethod } from './cobro.types';

export const DISCOUNT_OPTIONS = [0, 5, 10, 15, 20];
export const TAX_RATE = 0;
export const RFC_PATTERN = /^([A-ZÑ&]{3,4})(\d{6})([A-Z\d]{3})$/;
export const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

export function toCents(value: unknown): number {
  return Math.round(Number(value) * 100);
}

export function toPesos(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function calculateTotal(subtotal: number, discountPercent: number) {
  const discount = Math.round((subtotal * discountPercent) / 100);
  const taxes = Math.round(((subtotal - discount) * TAX_RATE) / 100);
  return { discount, taxes, total: subtotal - discount + taxes };
}

export function ageFrom(birthDate: Date, today: Date): number {
  let age = today.getFullYear() - birthDate.getFullYear();
  const beforeBirthday =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}
