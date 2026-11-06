export type Channel = 'counter' | 'email' | 'portal' | 'print';

export interface Actor {
  tenantId: number;
  name: string;
  isAdmin: boolean;
}

export interface ReleaseOrder {
  id: number;
  status: string;
  discountPercent: number;
  resultsDeliveredAt: Date | null;
  itemPrices: number[];
  payments: { amount: number; cancelled: boolean }[];
}

export interface ReportItem {
  testName: string | null;
  profileName: string | null;
  referenceRange: string | null;
  resultValue: string | null;
  isAlert: boolean;
}

export interface ReportOrder {
  id: number;
  folio: string | null;
  createdAt: Date;
  tenantName: string;
  tenantSubdomain: string;
  patient: { id: number; firstName: string; lastName: string; birthDate: Date; gender: string };
  doctorName: string | null;
  items: ReportItem[];
}

export interface ReportTemplateData {
  id: number;
  primaryColor: string;
  logoUrl: string | null;
  signatureUrl: string | null;
  chemistName: string | null;
  chemistCedula: string | null;
}

export interface ReportPdfData {
  tenantName: string;
  subdomain: string;
  orderId: number;
  folio: string;
  createdAt: Date;
  patient: { fullName: string; ageYears: number; gender: string; patientId: number };
  doctorName: string;
  template: {
    primaryColor: string;
    logoUrl?: string;
    signatureUrl?: string;
    chemistName?: string;
    chemistCedula?: string;
  };
  resultsByArea: {
    areaName: string;
    items: {
      testName: string;
      resultValue: string;
      units: string;
      referenceRange: string;
      flag: 'NORMAL' | 'HIGH';
    }[];
  }[];
  qrToken: string;
}

export type ReleaseResult =
  | { kind: 'released'; buffer: Buffer }
  | { kind: 'blocked'; message: string; balance: string; paymentUrl: string };

export interface VerifiedReport {
  laboratory: string;
  patient: string;
  issuedAt: Date;
}
