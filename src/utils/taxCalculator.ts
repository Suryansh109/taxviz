import { Income, Deductions, TaxCalculation, TaxRegime } from '../types/tax';

export const OLD_REGIME_2024: TaxRegime = {
  name: 'Old Regime FY 2024-25',
  applicableYear: '2024-25',
  slabs: [
    { min: 0, max: 250000, rate: 0 },
    { min: 250001, max: 500000, rate: 5 },
    { min: 500001, max: 1000000, rate: 20 },
    { min: 1000001, max: Infinity, rate: 30 },
  ],
};

export const NEW_REGIME_2024: TaxRegime = {
  name: 'New Regime FY 2024-25',
  applicableYear: '2024-25',
  slabs: [
    { min: 0, max: 300000, rate: 0 },
    { min: 300001, max: 600000, rate: 5 },
    { min: 600001, max: 900000, rate: 10 },
    { min: 900001, max: 1200000, rate: 15 },
    { min: 1200001, max: 1500000, rate: 20 },
    { min: 1500001, max: Infinity, rate: 30 },
  ],
};

export function calculateTotalIncome(income: Income): number {
  return income.salary + income.businessIncome + income.rentalIncome + income.otherIncome;
}

export function calculateTotalDeductions(deductions: Deductions): number {
  return (
    deductions.section80C +
    deductions.section80D +
    deductions.section80TTA +
    deductions.hra +
    deductions.lta +
    deductions.nps
  );
}

export function calculateTaxForRegime(taxableIncome: number, regime: TaxRegime): number {
  let tax = 0;
  let remainingIncome = taxableIncome;

  for (const slab of regime.slabs) {
    if (remainingIncome <= 0) break;

    const slabAmount = Math.min(remainingIncome, slab.max - slab.min);
    tax += (slabAmount * slab.rate) / 100;
    remainingIncome -= slabAmount;
  }

  // Add surcharge and cess if applicable
  if (taxableIncome > 5000000) {
    const surcharge = tax * 0.10; // 10% surcharge for income > 50L
    tax += surcharge;
  }

  // Add health and education cess (4%)
  tax += tax * 0.04;

  return Math.round(tax);
}

export function calculateTax(income: Income, deductions: Deductions): TaxCalculation {
  const grossIncome = calculateTotalIncome(income);
  const totalDeductions = calculateTotalDeductions(deductions);
  const taxableIncome = Math.max(0, grossIncome - totalDeductions);

  const oldRegimeTax = calculateTaxForRegime(taxableIncome, OLD_REGIME_2024);
  const newRegimeTax = calculateTaxForRegime(taxableIncome, NEW_REGIME_2024);

  const taxAmount = Math.min(oldRegimeTax, newRegimeTax);
  const effectiveTaxRate = (taxAmount / grossIncome) * 100;

  return {
    grossIncome,
    totalDeductions,
    taxableIncome,
    taxAmount,
    effectiveTaxRate,
  };
}

export const TAX_SAVING_STRATEGIES = [
  {
    name: 'Section 80C Investments',
    description: 'Invest in PPF, ELSS, Life Insurance, etc.',
    maxDeduction: 150000,
    category: 'Investment',
    recommendation: 'Prioritize ELSS for tax saving with potential market returns',
  },
  {
    name: 'National Pension System (NPS)',
    description: 'Additional deduction under Section 80CCD(1B)',
    maxDeduction: 50000,
    category: 'Retirement',
    recommendation: 'Consider long-term retirement planning with tax benefits',
  },
  {
    name: 'Health Insurance Premium',
    description: 'Deduction under Section 80D',
    maxDeduction: 25000,
    category: 'Insurance',
    recommendation: 'Essential for health coverage and tax benefits',
  },
]; 