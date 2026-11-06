export interface ReportTemplate {
  id: number;
  tenantId: number;
  name: string;
  studyType: string | null;
  branchId: number | null;
  version: number;
  isDefault: boolean;
  primaryColor: string;
  logoUrl: string | null;
  watermarkUrl: string | null;
  signatureUrl: string | null;
  chemistName: string | null;
  chemistCedula: string | null;
  headerText: string | null;
  footerText: string | null;
  disclaimer: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FallbackTemplate {
  name: string;
  headerText: string;
  disclaimer: string;
  chemistName: string;
  chemistCedula: string;
  version: number;
}

export interface NewTemplateData {
  tenantId: number;
  name: string;
  headerText?: string | null;
  disclaimer?: string | null;
  chemistName?: string | null;
  chemistCedula?: string | null;
  version: number;
  isDefault: boolean;
}

export interface TemplateInput {
  headerText?: string | null;
  disclaimer?: string | null;
  chemistName?: string | null;
  chemistCedula?: string | null;
}
