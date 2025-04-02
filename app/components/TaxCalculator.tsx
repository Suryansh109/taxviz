'use client';

import { useState, useCallback, useMemo } from 'react';

interface FormData {
  salary: string;
  businessIncome: string;
  rentalIncome: string;
  otherIncome: string;
  section80C: string;
  section80D: string;
  section80TTA: string;
  hra: string;
  actualRent: string;
  cityTier: 'metro' | 'non-metro';
  lta: string;
  nps: string;
  tds: string;
  homeLoanPrincipal: string;  // Principal repayment under 80C
  homeLoanInterest: string;   // Interest payment under 24(b)
  isFirstTimeBuyer: boolean;  // Additional deduction under 80EE
  propertyValue: string;      // For 80EE eligibility check
  loanSanctionDate: string;   // For 80EE eligibility check
}

interface TaxResult {
  grossIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  taxAmount: number;
  effectiveRate: number;
  newRegimeTax: number;
  newRegimeEffectiveRate: number;
  favorableRegime: 'old' | 'new';
  tdsAmount: number;
  remainingTaxOld: number;
  remainingTaxNew: number;
  hraBreakdown?: {
    actualHRA: number;
    rentPaid: number;
    excessRent: number;
    salaryPercent: number;
    eligible: number;
  };
  homeLoanBreakdown?: {
    principalDeduction: number;
    interestDeduction: number;
    additionalDeduction: number;
  };
}

interface ValidationErrors {
  [key: string]: string;
}

// Utility functions
const formatCurrency = (value: string): string => {
  // Remove any non-digit characters except decimal point
  const cleanValue = value.replace(/[^\d.]/g, '');
  
  // Ensure only one decimal point
  const parts = cleanValue.split('.');
  if (parts.length > 2) return parts[0] + '.' + parts.slice(1).join('');
  
  // Limit to 2 decimal places
  if (parts.length === 2) {
    return parts[0] + '.' + parts[1].slice(0, 2);
  }
  
  return cleanValue;
};

const formatIndianCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export default function TaxCalculator() {
  const [formData, setFormData] = useState<FormData>({
    salary: '',
    businessIncome: '',
    rentalIncome: '',
    otherIncome: '',
    section80C: '',
    section80D: '',
    section80TTA: '',
    hra: '',
    actualRent: '',
    cityTier: 'metro',
    lta: '',
    nps: '',
    tds: '',
    homeLoanPrincipal: '',
    homeLoanInterest: '',
    isFirstTimeBuyer: false,
    propertyValue: '',
    loanSanctionDate: '',
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isCalculating, setIsCalculating] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [result, setResult] = useState<TaxResult | null>(null);

  const validateInput = useCallback((name: string, value: string): string | null => {
    if (value === '') return null;
    
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 'Please enter a valid number';
    if (numValue < 0) return 'Amount cannot be negative';
    
    switch (name) {
      case 'section80C':
        if (numValue > 150000) return 'Maximum limit is ₹1,50,000';
        break;
      case 'section80D':
        if (numValue > 75000) return 'Maximum limit is ₹75,000';
        break;
      case 'section80TTA':
        if (numValue > 10000) return 'Maximum limit is ₹10,000';
        break;
      case 'nps':
        if (numValue > 50000) return 'Maximum limit is ₹50,000';
        break;
      case 'lta':
        if (numValue > 0 && !parseFloat(formData.salary)) 
          return 'LTA cannot be claimed without salary income';
        break;
      case 'homeLoanInterest':
        if (numValue > 200000) return 'Maximum interest deduction is ₹2,00,000';
        break;
      case 'propertyValue':
        if (formData.isFirstTimeBuyer && numValue > 5000000) 
          return 'Property value should not exceed ₹50,00,000 for 80EE benefit';
        break;
      case 'loanSanctionDate':
        if (formData.isFirstTimeBuyer && !value) 
          return 'Loan sanction date is required for first-time buyers';
        if (formData.isFirstTimeBuyer && new Date(value) < new Date('2019-04-01'))
          return 'Loan must be sanctioned after April 1, 2019 for 80EE benefit';
        break;
    }
    
    return null;
  }, [formData.salary, formData.isFirstTimeBuyer]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Format currency for number inputs
    const formattedValue = e.target.type === 'text' ? formatCurrency(value) : value;
    
    // Validate input
    const error = validateInput(name, formattedValue);
    
    setFormData(prev => ({
      ...prev,
      [name]: formattedValue
    }));
    
    setErrors(prev => ({
      ...prev,
      [name]: error || ''
    }));
  }, [validateInput]);

  const calculateHRAExemption = (
    salary: number,
    hra: number,
    rent: number,
    cityTier: 'metro' | 'non-metro'
  ): {
    actualHRA: number;
    rentPaid: number;
    excessRent: number;
    salaryPercent: number;
    eligible: number;
  } => {
    // HRA exemption is minimum of:
    // 1. Actual HRA received
    // 2. Rent paid in excess of 10% of salary
    // 3. 50% of salary (for metro) or 40% of salary (for non-metro)
    
    const actualHRA = hra;
    const excessRent = Math.max(0, rent - (0.1 * salary));
    const salaryPercent = salary * (cityTier === 'metro' ? 0.5 : 0.4);
    
    const eligible = Math.min(
      actualHRA,
      excessRent,
      salaryPercent
    );

    return {
      actualHRA,
      rentPaid: rent,
      excessRent,
      salaryPercent,
      eligible
    };
  };

  const calculateTax = async () => {
    setIsCalculating(true);
    setShowResults(false);
    
    // Simulate a small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const values = {
      salary: parseFloat(formData.salary) || 0,
      businessIncome: parseFloat(formData.businessIncome) || 0,
      rentalIncome: parseFloat(formData.rentalIncome) || 0,
      otherIncome: parseFloat(formData.otherIncome) || 0,
      section80C: parseFloat(formData.section80C) || 0,
      section80D: parseFloat(formData.section80D) || 0,
      section80TTA: parseFloat(formData.section80TTA) || 0,
      hra: parseFloat(formData.hra) || 0,
      actualRent: parseFloat(formData.actualRent) || 0,
      lta: parseFloat(formData.lta) || 0,
      nps: parseFloat(formData.nps) || 0,
      tds: parseFloat(formData.tds) || 0,
      homeLoanPrincipal: parseFloat(formData.homeLoanPrincipal) || 0,
      homeLoanInterest: parseFloat(formData.homeLoanInterest) || 0,
      propertyValue: parseFloat(formData.propertyValue) || 0,
    };

    const grossIncome = values.salary + values.businessIncome + 
                       values.rentalIncome + values.otherIncome;
    
    // Calculate HRA exemption
    const hraBreakdown = calculateHRAExemption(
      values.salary,
      values.hra,
      values.actualRent,
      formData.cityTier
    );

    // Standard deduction of ₹50,000 for salaried individuals (only in old regime)
    const standardDeduction = values.salary > 0 ? 50000 : 0;
    
    // Include home loan principal in 80C limit
    const section80CTotal = Math.min(150000, values.section80C + values.homeLoanPrincipal);
    
    // Calculate home loan interest deduction
    let homeLoanInterestDeduction = Math.min(200000, values.homeLoanInterest);
    
    // Additional deduction under 80EE for first-time home buyers
    if (formData.isFirstTimeBuyer && 
        values.propertyValue <= 5000000 && 
        new Date(formData.loanSanctionDate) >= new Date('2019-04-01')) {
      homeLoanInterestDeduction += 50000; // Fixed amount of ₹50,000
    }
    
    const totalDeductions = standardDeduction + 
                          section80CTotal + 
                          Math.min(25000, values.section80D) + 
                          Math.min(10000, values.section80TTA) + 
                          hraBreakdown.eligible + 
                          Math.min(values.lta, values.salary * 0.1) + 
                          Math.min(50000, values.nps) +
                          homeLoanInterestDeduction;
    
    const taxableIncome = Math.max(0, grossIncome - totalDeductions);
    
    // Calculate tax for old regime
    let oldRegimeTax = 0;

    // Old Regime Tax Calculation
    if (taxableIncome <= 250000) {
      oldRegimeTax = 0;
    } else if (taxableIncome <= 500000) {
      oldRegimeTax = (taxableIncome - 250000) * 0.05;
    } else if (taxableIncome <= 750000) {
      oldRegimeTax = 12500 + (taxableIncome - 500000) * 0.10;
    } else if (taxableIncome <= 1000000) {
      oldRegimeTax = 37500 + (taxableIncome - 750000) * 0.15;
    } else if (taxableIncome <= 1250000) {
      oldRegimeTax = 75000 + (taxableIncome - 1000000) * 0.20;
    } else if (taxableIncome <= 1500000) {
      oldRegimeTax = 125000 + (taxableIncome - 1250000) * 0.25;
    } else {
      oldRegimeTax = 187500 + (taxableIncome - 1500000) * 0.30;
    }

    // Apply Section 87A rebate for old regime
    if (taxableIncome <= 500000) {
      oldRegimeTax = Math.max(0, oldRegimeTax - 12500); // Rebate of ₹12,500
    }

    // Apply 4% cess
    oldRegimeTax = oldRegimeTax * 1.04;

    // Calculate tax for new regime
    let newRegimeTax = 0;
    
    // New Regime Tax Calculation
    if (grossIncome <= 300000) {
      newRegimeTax = 0;
    } else if (grossIncome <= 600000) {
      newRegimeTax = (grossIncome - 300000) * 0.05;
    } else if (grossIncome <= 900000) {
      newRegimeTax = 15000 + (grossIncome - 600000) * 0.10;
    } else if (grossIncome <= 1200000) {
      newRegimeTax = 45000 + (grossIncome - 900000) * 0.15;
    } else if (grossIncome <= 1500000) {
      newRegimeTax = 90000 + (grossIncome - 1200000) * 0.20;
    } else {
      newRegimeTax = 150000 + (grossIncome - 1500000) * 0.30;
    }

    // Apply Section 87A rebate for new regime
    if (grossIncome <= 700000) {
      newRegimeTax = Math.max(0, newRegimeTax - 25000); // Rebate of ₹25,000
    }

    // Apply 4% cess
    newRegimeTax = newRegimeTax * 1.04;

    const tdsAmount = values.tds;
    const remainingTaxOld = Math.max(0, oldRegimeTax - tdsAmount);
    const remainingTaxNew = Math.max(0, newRegimeTax - tdsAmount);

    // Calculate home loan breakdown
    const homeLoanBreakdown = {
      principalDeduction: Math.max(0, Math.min(150000 - values.section80C, values.homeLoanPrincipal)),
      interestDeduction: Math.min(200000, values.homeLoanInterest),
      additionalDeduction: formData.isFirstTimeBuyer && 
        values.propertyValue <= 5000000 && 
        new Date(formData.loanSanctionDate) >= new Date('2019-04-01')
        ? 50000 // Fixed amount of ₹50,000
        : 0
    };

    setResult({
      grossIncome,
      totalDeductions,
      taxableIncome,
      taxAmount: Math.round(oldRegimeTax),
      effectiveRate: grossIncome > 0 ? (oldRegimeTax / grossIncome) * 100 : 0,
      newRegimeTax: Math.round(newRegimeTax),
      newRegimeEffectiveRate: grossIncome > 0 ? (newRegimeTax / grossIncome) * 100 : 0,
      favorableRegime: oldRegimeTax <= newRegimeTax ? 'old' : 'new',
      tdsAmount,
      remainingTaxOld,
      remainingTaxNew,
      hraBreakdown,
      homeLoanBreakdown
    });
    
    setIsCalculating(false);
    setShowResults(true);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-gray-50 py-4 mb-8">
        <h1 className="text-3xl font-bold text-center text-blue-600">
          Tax Planning Assistant 2024-25
        </h1>
        <p className="text-center text-gray-600 mt-2">
          Calculate your tax liability and optimize your tax savings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Income Section */}
        <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-6 text-gray-800 flex items-center">
            <svg className="w-6 h-6 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Income Details
          </h2>
          <div className="space-y-6">
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Employment Income</h3>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">Salary</label>
                <input
                  type="text"
                  name="salary"
                  value={formData.salary}
                  onChange={handleInputChange}
                  className="border border-gray-300 rounded-md p-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
                {errors.salary && (
                  <p className="mt-1 text-sm text-red-600">{errors.salary}</p>
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">TDS Deducted</label>
                <input
                  type="text"
                  name="tds"
                  value={formData.tds}
                  onChange={handleInputChange}
                  className="border border-gray-300 rounded-md p-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
                {errors.tds && (
                  <p className="mt-1 text-sm text-red-600">{errors.tds}</p>
                )}
              </div>
            </div>

            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Other Income Sources</h3>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">Business Income</label>
                <input
                  type="text"
                  name="businessIncome"
                  value={formData.businessIncome}
                  onChange={handleInputChange}
                  className="border border-gray-300 rounded-md p-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
                {errors.businessIncome && (
                  <p className="mt-1 text-sm text-red-600">{errors.businessIncome}</p>
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">Rental Income</label>
                <input
                  type="text"
                  name="rentalIncome"
                  value={formData.rentalIncome}
                  onChange={handleInputChange}
                  className="border border-gray-300 rounded-md p-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
                {errors.rentalIncome && (
                  <p className="mt-1 text-sm text-red-600">{errors.rentalIncome}</p>
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">Other Income</label>
                <input
                  type="text"
                  name="otherIncome"
                  value={formData.otherIncome}
                  onChange={handleInputChange}
                  className="border border-gray-300 rounded-md p-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
                {errors.otherIncome && (
                  <p className="mt-1 text-sm text-red-600">{errors.otherIncome}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Deductions Section */}
        <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-6 text-gray-800 flex items-center">
            <svg className="w-6 h-6 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Deductions
          </h2>
          <div className="space-y-6">
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Standard Deductions</h3>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">Section 80C (Max: ₹1,50,000)</label>
                <input
                  type="text"
                  name="section80C"
                  value={formData.section80C}
                  onChange={handleInputChange}
                  className="border border-gray-300 rounded-md p-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">Section 80D (Max: ₹75,000)</label>
                <input
                  type="text"
                  name="section80D"
                  value={formData.section80D}
                  onChange={handleInputChange}
                  className="border border-gray-300 rounded-md p-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">Section 80TTA (Max: ₹10,000)</label>
                <input
                  type="text"
                  name="section80TTA"
                  value={formData.section80TTA}
                  onChange={handleInputChange}
                  className="border border-gray-300 rounded-md p-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Home Loan Details</h3>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">Principal Repayment (Part of 80C)</label>
                <input
                  type="text"
                  name="homeLoanPrincipal"
                  value={formData.homeLoanPrincipal}
                  onChange={handleInputChange}
                  className="border border-gray-300 rounded-md p-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
                {errors.homeLoanPrincipal && (
                  <p className="mt-1 text-sm text-red-600">{errors.homeLoanPrincipal}</p>
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">Interest Payment (Max: ₹2,00,000)</label>
                <input
                  type="text"
                  name="homeLoanInterest"
                  value={formData.homeLoanInterest}
                  onChange={handleInputChange}
                  className="border border-gray-300 rounded-md p-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
                {errors.homeLoanInterest && (
                  <p className="mt-1 text-sm text-red-600">{errors.homeLoanInterest}</p>
                )}
              </div>
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  name="isFirstTimeBuyer"
                  checked={formData.isFirstTimeBuyer}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    isFirstTimeBuyer: e.target.checked
                  }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 text-sm font-medium text-gray-700">
                  First-time Home Buyer
                </label>
              </div>
              {formData.isFirstTimeBuyer && (
                <>
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 mb-1">Property Value</label>
                    <input
                      type="text"
                      name="propertyValue"
                      value={formData.propertyValue}
                      onChange={handleInputChange}
                      className="border border-gray-300 rounded-md p-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0"
                    />
                    {errors.propertyValue && (
                      <p className="mt-1 text-sm text-red-600">{errors.propertyValue}</p>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 mb-1">Loan Sanction Date</label>
                    <input
                      type="date"
                      name="loanSanctionDate"
                      value={formData.loanSanctionDate}
                      onChange={handleInputChange}
                      className="border border-gray-300 rounded-md p-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </>
              )}
              <div className="mt-2 text-sm text-gray-600">
                <p>• Principal repayment is eligible under Section 80C (₹1.5L limit)</p>
                <p>• Interest payment is eligible under Section 24(b) (₹2L limit)</p>
                <p>• First-time buyers may get additional ₹50,000 deduction under Section 80EE</p>
              </div>
            </div>

            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">HRA Details</h3>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">HRA Received</label>
                <input
                  type="text"
                  name="hra"
                  value={formData.hra}
                  onChange={handleInputChange}
                  className="border border-gray-300 rounded-md p-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">Actual Rent Paid</label>
                <input
                  type="text"
                  name="actualRent"
                  value={formData.actualRent}
                  onChange={handleInputChange}
                  className="border border-gray-300 rounded-md p-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">City Type</label>
                <select
                  name="cityTier"
                  value={formData.cityTier}
                  onChange={handleInputChange}
                  className="border border-gray-300 rounded-md p-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="metro">Metro (50% of Basic)</option>
                  <option value="non-metro">Non-Metro (40% of Basic)</option>
                </select>
              </div>
            </div>

            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Other Deductions</h3>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">LTA</label>
                <input
                  type="text"
                  name="lta"
                  value={formData.lta}
                  onChange={handleInputChange}
                  className="border border-gray-300 rounded-md p-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">NPS (Max: ₹50,000)</label>
                <input
                  type="text"
                  name="nps"
                  value={formData.nps}
                  onChange={handleInputChange}
                  className="border border-gray-300 rounded-md p-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <button
          onClick={calculateTax}
          disabled={isCalculating}
          className={`w-full max-w-md py-4 px-6 rounded-lg text-lg font-semibold text-white 
            ${isCalculating 
              ? 'bg-blue-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            } 
            transition-all duration-300 transform hover:scale-105 active:scale-95
            flex items-center justify-center space-x-2`}
        >
          {isCalculating ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Calculating...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>Calculate Tax</span>
            </>
          )}
        </button>
      </div>

      {showResults && result && (
        <div className="mt-8 space-y-6 animate-fade-in">
          {/* Regime Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Old Regime Card */}
            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-blue-800">Old Tax Regime</h3>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  result.favorableRegime === 'old' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {result.favorableRegime === 'old' ? 'Recommended' : 'Alternative'}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-blue-700 font-medium">Gross Income</p>
                  <p className="text-2xl font-bold text-blue-900">₹{result.grossIncome.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-blue-700 font-medium">Total Deductions</p>
                  <p className="text-2xl font-bold text-blue-900">₹{result.totalDeductions.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-blue-700 font-medium">Taxable Income</p>
                  <p className="text-2xl font-bold text-blue-900">₹{result.taxableIncome.toLocaleString()}</p>
                </div>
                <div className="pt-4 border-t border-blue-200">
                  <p className="text-blue-700 font-medium">Total Tax</p>
                  <p className="text-3xl font-bold text-blue-900">₹{Math.round(result.taxAmount).toLocaleString()}</p>
                  <p className="text-blue-600 mt-1">Effective Rate: {result.effectiveRate.toFixed(2)}%</p>
                </div>
                <div className="pt-4 border-t border-blue-200">
                  <p className="text-blue-700 font-medium">TDS Paid</p>
                  <p className="text-2xl font-bold text-blue-900">₹{result.tdsAmount.toLocaleString()}</p>
                </div>
                <div className="pt-4 border-t border-blue-200">
                  <p className="text-blue-700 font-medium">Remaining Tax Payable</p>
                  <p className="text-3xl font-bold text-blue-900">₹{Math.round(result.remainingTaxOld).toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* New Regime Card */}
            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-purple-800">New Tax Regime</h3>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  result.favorableRegime === 'new' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {result.favorableRegime === 'new' ? 'Recommended' : 'Alternative'}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-purple-700 font-medium">Gross Income</p>
                  <p className="text-2xl font-bold text-purple-900">₹{result.grossIncome.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-purple-700 font-medium">Total Deductions</p>
                  <p className="text-2xl font-bold text-purple-900">₹0</p>
                </div>
                <div>
                  <p className="text-purple-700 font-medium">Taxable Income</p>
                  <p className="text-2xl font-bold text-purple-900">₹{result.grossIncome.toLocaleString()}</p>
                </div>
                <div className="pt-4 border-t border-purple-200">
                  <p className="text-purple-700 font-medium">Total Tax</p>
                  <p className="text-3xl font-bold text-purple-900">₹{Math.round(result.newRegimeTax).toLocaleString()}</p>
                  <p className="text-purple-600 mt-1">Effective Rate: {result.newRegimeEffectiveRate.toFixed(2)}%</p>
                </div>
                <div className="pt-4 border-t border-purple-200">
                  <p className="text-purple-700 font-medium">TDS Paid</p>
                  <p className="text-2xl font-bold text-purple-900">₹{result.tdsAmount.toLocaleString()}</p>
                </div>
                <div className="pt-4 border-t border-purple-200">
                  <p className="text-purple-700 font-medium">Remaining Tax Payable</p>
                  <p className="text-3xl font-bold text-purple-900">₹{Math.round(result.remainingTaxNew).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Home Loan Benefits Card */}
          {result.homeLoanBreakdown && (
            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
              <div className="flex items-center mb-4">
                <svg className="w-6 h-6 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-800">Home Loan Benefits</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Principal Repayment (80C)</span>
                  <span className="font-medium">{formatIndianCurrency(result.homeLoanBreakdown.principalDeduction)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Interest Payment (24b)</span>
                  <span className="font-medium">{formatIndianCurrency(result.homeLoanBreakdown.interestDeduction)}</span>
                </div>
                {result.homeLoanBreakdown.additionalDeduction > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Additional Deduction (80EE)</span>
                    <span className="font-medium">{formatIndianCurrency(result.homeLoanBreakdown.additionalDeduction)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="text-gray-700 font-medium">Total Home Loan Benefit</span>
                  <span className="font-semibold text-green-600">
                    {formatIndianCurrency(
                      result.homeLoanBreakdown.principalDeduction +
                      result.homeLoanBreakdown.interestDeduction +
                      result.homeLoanBreakdown.additionalDeduction
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* HRA Breakdown Card */}
          {result.hraBreakdown && (
            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
              <div className="flex items-center mb-4">
                <svg className="w-6 h-6 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-800">HRA Exemption Breakdown</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600">Actual HRA Received</p>
                  <p className="text-xl font-semibold text-gray-900">₹{result.hraBreakdown.actualHRA.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-600">Rent Paid</p>
                  <p className="text-xl font-semibold text-gray-900">₹{result.hraBreakdown.rentPaid.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-600">Excess of Rent over 10% of Salary</p>
                  <p className="text-xl font-semibold text-gray-900">₹{result.hraBreakdown.excessRent.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-600">{formData.cityTier === 'metro' ? '50%' : '40%'} of Salary</p>
                  <p className="text-xl font-semibold text-gray-900">₹{result.hraBreakdown.salaryPercent.toLocaleString()}</p>
                </div>
                <div className="col-span-2 pt-4 border-t">
                  <p className="text-gray-600">Eligible HRA Exemption</p>
                  <p className="text-2xl font-bold text-green-600">₹{result.hraBreakdown.eligible.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Tax Savings Summary Card */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-800">Tax Savings Summary</h3>
              <div className="px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                Save ₹{Math.abs(result.taxAmount - result.newRegimeTax).toLocaleString()}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg">
                <p className="text-gray-600">Recommended Regime</p>
                <p className="text-2xl font-bold text-green-600">
                  {result.favorableRegime === 'old' ? 'Old Regime' : 'New Regime'}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <p className="text-gray-600">Effective Tax Rate</p>
                <p className="text-2xl font-bold text-blue-600">
                  {result.favorableRegime === 'old' 
                    ? `${result.effectiveRate.toFixed(2)}%` 
                    : `${result.newRegimeEffectiveRate.toFixed(2)}%`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 