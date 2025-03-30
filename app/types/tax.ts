export interface Income {
  salary: number;
  businessIncome: number;
  rentalIncome: number;
  otherIncome: number;
}

export interface Deductions {
  section80C: number;  // PPF, ELSS, Life Insurance, etc.
  section80D: number;  // Health Insurance
  section80TTA: number;  // Savings Account Interest
  hra: number;  // House Rent Allowance
  lta: number;  // Leave Travel Allowance
  nps: number;  // National Pension System
}

export interface TaxRegime {
  name: string;
  slabs: TaxSlab[];
  applicableYear: string;
}

export interface TaxSlab {
  min: number;
  max: number;
  rate: number;
}

export interface TaxCalculation {
  grossIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  taxAmount: number;
  effectiveTaxRate: number;
}

export interface TaxPlanningStrategy {
  name: string;
  description: string;
  maxDeduction: number;
  category: string;
  recommendation?: string;
} 