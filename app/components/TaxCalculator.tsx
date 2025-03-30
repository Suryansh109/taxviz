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
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isCalculating, setIsCalculating] = useState(false);
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
    }
    
    return null;
  }, [formData.salary]);

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

  const calculateTax = () => {
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
    
    const totalDeductions = standardDeduction + 
                          Math.min(150000, values.section80C) + 
                          Math.min(25000, values.section80D) + 
                          Math.min(10000, values.section80TTA) + 
                          hraBreakdown.eligible + 
                          Math.min(values.lta, values.salary * 0.1) + // LTA limited to 10% of basic salary
                          Math.min(50000, values.nps);
    
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

    // Apply 4% cess
    oldRegimeTax = oldRegimeTax * 1.04;

    // Section 87A rebate
    if (grossIncome <= 500000) {
      oldRegimeTax = 0;
    }

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

    // Apply 4% cess
    newRegimeTax = newRegimeTax * 1.04;

    // Section 87A rebate for new regime
    if (grossIncome <= 700000) {
      newRegimeTax = 0;
    }

    const tdsAmount = values.tds;
    const remainingTaxOld = Math.max(0, oldRegimeTax - tdsAmount);
    const remainingTaxNew = Math.max(0, newRegimeTax - tdsAmount);

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
      hraBreakdown
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-center text-blue-600">
        Tax Planning Assistant 2024-25
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Income Section */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-6 text-gray-800">Income Details</h2>
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
              </div>
            </div>
          </div>
        </div>

        {/* Deductions Section */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-6 text-gray-800">Deductions</h2>
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

      <button
        onClick={calculateTax}
        className="w-full mt-8 bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition-colors text-lg font-semibold"
      >
        Calculate Tax
      </button>

      {result && (
        <>
          <div className="mt-8">
            {/* Regime Explanation */}
            <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-800 mb-3">Old Tax Regime</h3>
                <ul className="space-y-2 text-blue-700">
                  <li>• Allows tax deductions under various sections</li>
                  <li>• Higher tax rates but lower taxable income</li>
                  <li>• Better for those with significant investments/deductions</li>
                  <li>• Includes standard deduction of ₹50,000</li>
                </ul>
              </div>
              <div className="bg-purple-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-purple-800 mb-3">New Tax Regime</h3>
                <ul className="space-y-2 text-purple-700">
                  <li>• No tax deductions allowed</li>
                  <li>• Lower tax rates but on full income</li>
                  <li>• More slabs for gradual increase</li>
                  <li>• Simplified tax calculation</li>
                </ul>
              </div>
            </div>

            {/* Results */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-6 text-gray-800">Tax Calculation Results</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Old Regime Results */}
                <div className="space-y-4 p-6 border-2 rounded-lg bg-blue-50 border-blue-200">
                  <h3 className="text-xl font-semibold text-blue-800">Old Tax Regime</h3>
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

                {/* New Regime Results */}
                <div className="space-y-4 p-6 border-2 rounded-lg bg-purple-50 border-purple-200">
                  <h3 className="text-xl font-semibold text-purple-800">New Tax Regime</h3>
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

              {/* Recommendation Box */}
              <div className="mt-8 p-6 bg-green-50 border-2 border-green-200 rounded-lg">
                <h3 className="text-xl font-semibold text-green-800 mb-3">Your Tax Saving Recommendation</h3>
                <div className="space-y-4">
                  <p className="text-lg text-green-700">
                    The <span className="font-bold">{result.favorableRegime === 'old' ? 'Old' : 'New'} Tax Regime</span> is more favorable for you
                  </p>
                  <div className="flex items-center justify-between bg-white p-4 rounded-lg">
                    <div>
                      <p className="text-green-600">You can save</p>
                      <p className="text-3xl font-bold text-green-700">
                        ₹{Math.abs(result.taxAmount - result.newRegimeTax).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-600">By choosing</p>
                      <p className="text-xl font-semibold text-green-700">
                        {result.favorableRegime === 'old' ? 'Old Regime' : 'New Regime'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* HRA Breakdown */}
              {result.hraBreakdown && (
                <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">HRA Exemption Breakdown</h3>
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
            </div>

            {/* Tax Slab Tables with Darker Styling */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Old Regime Slabs */}
              <div className="bg-gray-900 p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-4 text-white">Old Regime Tax Slabs</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-700">
                    <thead>
                      <tr className="bg-gray-800">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Income Range</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Tax Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      <tr className="hover:bg-gray-800">
                        <td className="px-4 py-3 text-gray-300">Up to ₹2,50,000</td>
                        <td className="px-4 py-3 font-medium text-gray-300">0%</td>
                      </tr>
                      <tr className="hover:bg-gray-800">
                        <td className="px-4 py-3 text-gray-300">₹2,50,001 - ₹5,00,000</td>
                        <td className="px-4 py-3 font-medium text-gray-300">5%</td>
                      </tr>
                      <tr className="hover:bg-gray-800">
                        <td className="px-4 py-3 text-gray-300">₹5,00,001 - ₹7,50,000</td>
                        <td className="px-4 py-3 font-medium text-gray-300">10%</td>
                      </tr>
                      <tr className="hover:bg-gray-800">
                        <td className="px-4 py-3 text-gray-300">₹7,50,001 - ₹10,00,000</td>
                        <td className="px-4 py-3 font-medium text-gray-300">15%</td>
                      </tr>
                      <tr className="hover:bg-gray-800">
                        <td className="px-4 py-3 text-gray-300">₹10,00,001 - ₹12,50,000</td>
                        <td className="px-4 py-3 font-medium text-gray-300">20%</td>
                      </tr>
                      <tr className="hover:bg-gray-800">
                        <td className="px-4 py-3 text-gray-300">₹12,50,001 - ₹15,00,000</td>
                        <td className="px-4 py-3 font-medium text-gray-300">25%</td>
                      </tr>
                      <tr className="hover:bg-gray-800">
                        <td className="px-4 py-3 text-gray-300">Above ₹15,00,000</td>
                        <td className="px-4 py-3 font-medium text-gray-300">30%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* New Regime Slabs */}
              <div className="bg-gray-900 p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-4 text-white">New Regime Tax Slabs</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-700">
                    <thead>
                      <tr className="bg-gray-800">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Income Range</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Tax Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      <tr className="hover:bg-gray-800">
                        <td className="px-4 py-3 text-gray-300">Up to ₹3,00,000</td>
                        <td className="px-4 py-3 font-medium text-gray-300">0%</td>
                      </tr>
                      <tr className="hover:bg-gray-800">
                        <td className="px-4 py-3 text-gray-300">₹3,00,001 - ₹6,00,000</td>
                        <td className="px-4 py-3 font-medium text-gray-300">5%</td>
                      </tr>
                      <tr className="hover:bg-gray-800">
                        <td className="px-4 py-3 text-gray-300">₹6,00,001 - ₹9,00,000</td>
                        <td className="px-4 py-3 font-medium text-gray-300">10%</td>
                      </tr>
                      <tr className="hover:bg-gray-800">
                        <td className="px-4 py-3 text-gray-300">₹9,00,001 - ₹12,00,000</td>
                        <td className="px-4 py-3 font-medium text-gray-300">15%</td>
                      </tr>
                      <tr className="hover:bg-gray-800">
                        <td className="px-4 py-3 text-gray-300">₹12,00,001 - ₹15,00,000</td>
                        <td className="px-4 py-3 font-medium text-gray-300">20%</td>
                      </tr>
                      <tr className="hover:bg-gray-800">
                        <td className="px-4 py-3 text-gray-300">Above ₹15,00,000</td>
                        <td className="px-4 py-3 font-medium text-gray-300">30%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 