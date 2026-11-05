export type Flag = 'Normal' | 'H' | 'L' | 'HH' | 'LL' | 'A' | '—';

export type RangeRecord = {
  gender: string | null;
  minAgeYears: number | null;
  maxAgeYears: number | null;
  low: number | null;
  high: number | null;
  lowInclusive: boolean;
  highInclusive: boolean;
  criticalLow: number | null;
  criticalHigh: number | null;
  criticalLowInclusive: boolean;
  criticalHighInclusive: boolean;
  display: string;
};

export type ParameterRecord = {
  id: number;
  name: string;
  unit: string | null;
  qualitativeExpected: string | null;
  previousValue: string | null;
  previousDate: string | null;
  ranges: RangeRecord[];
};

export type ItemRecord = {
  id: number;
  testName: string;
  externalLab: string | null;
  parameters: ParameterRecord[];
  capturedParameterIds: number[];
};

export type SampleRecord = {
  id: number;
  barcode: string;
  description: string | null;
  equipment: string | null;
  capturedByName: string | null;
  receivedAt: Date | null;
};

export type OrderRecord = {
  id: number;
  folio: string | null;
  patient: {
    id: number;
    firstName: string;
    lastName: string;
    patientCode: string | null;
    gender: string;
    birthDate: Date;
  };
  samples: SampleRecord[];
  items: ItemRecord[];
};

export type RangeRule = {
  low: number | null;
  high: number | null;
  lowInclusive: boolean;
  highInclusive: boolean;
  criticalLow: number | null;
  criticalHigh: number | null;
  criticalLowInclusive: boolean;
  criticalHighInclusive: boolean;
  expected: string | null;
};

export type PendingParameter = {
  orderItemId: number;
  parameterId: number;
  testName: string;
  parameterName: string;
  unit: string | null;
  rangeText: string | null;
  previous: string | null;
  rule: RangeRule | null;
};

export type WorklistOrder = {
  orderId: number;
  folio: string;
  receivedAt: Date | null;
  capturedCount: number;
  samples: { id: number; barcode: string; description: string | null; equipment: string | null; capturedByName: string | null }[];
  patient: {
    id: number;
    fullName: string;
    patientCode: string | null;
    gender: string;
    ageYears: number;
  };
  pending: PendingParameter[];
};

export type Worklist = {
  totalPending: number;
  withoutRange: number;
  orders: WorklistOrder[];
};

export type ResultEntry = {
  orderItemId: number;
  parameterId: number;
  value: string;
};

export type SaveEntry = ResultEntry & { flag: Flag };

export type SavedResult = {
  orderItemId: number;
  parameterId: number;
  value: string;
  flag: Flag;
};
