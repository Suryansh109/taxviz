'use client';

import { useState } from 'react';
import { Income, Deductions, TaxCalculation } from '../types/tax';
import { calculateTax, TAX_SAVING_STRATEGIES } from '../utils/taxCalculator';

export default function Home() {
  const [income, setIncome] = useState<Income>({
    salary: 0,
    businessIncome: 0,
    rentalIncome: 0,
    otherIncome: 0,
  });

  const [deductions, setDeductions] = useState<Deductions>({
    section80C: 0,
    section80D: 0,
    section80TTA: 0,
    hra: 0,
    lta: 0,
    nps: 0,
  });

  const [taxCalculation, setTaxCalculation] = useState<TaxCalculation | null>(null);

  const handleCalculate = () => {
    const result = calculateTax(income, deductions);
    setTaxCalculation(result);
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center text-blue-600">
          Tax Planning Assistant 2024-25
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Income Section */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Income Details</h2>
            <div className="space-y-4">
              {Object.entries(income).map(([key, value]) => (
                <div key={key} className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) =>
                      setIncome({ ...income, [key]: Number(e.target.value) })
                    }
                    className="border rounded-md p-2"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Deductions Section */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Deductions</h2>
            <div className="space-y-4">
              {Object.entries(deductions).map(([key, value]) => (
                <div key={key} className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) =>
                      setDeductions({ ...deductions, [key]: Number(e.target.value) })
                    }
                    className="border rounded-md p-2"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleCalculate}
          className="w-full mt-8 bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition-colors"
        >
          Calculate Tax
        </button>

        {/* Results Section */}
        {taxCalculation && (
          <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Tax Calculation Results</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600">Gross Income</p>
                <p className="text-xl font-semibold">₹{taxCalculation.grossIncome.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-600">Total Deductions</p>
                <p className="text-xl font-semibold">₹{taxCalculation.totalDeductions.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-600">Taxable Income</p>
                <p className="text-xl font-semibold">₹{taxCalculation.taxableIncome.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-600">Tax Amount</p>
                <p className="text-xl font-semibold">₹{taxCalculation.taxAmount.toLocaleString()}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-600">Effective Tax Rate</p>
                <p className="text-xl font-semibold">{taxCalculation.effectiveTaxRate.toFixed(2)}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Tax Saving Strategies */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Tax Saving Strategies</h2>
          <div className="space-y-4">
            {TAX_SAVING_STRATEGIES.map((strategy) => (
              <div key={strategy.name} className="border-b pb-4">
                <h3 className="font-semibold text-lg">{strategy.name}</h3>
                <p className="text-gray-600">{strategy.description}</p>
                <p className="text-sm text-blue-600 mt-1">
                  Maximum Deduction: ₹{strategy.maxDeduction.toLocaleString()}
                </p>
                {strategy.recommendation && (
                  <p className="text-sm text-green-600 mt-1">
                    Recommendation: {strategy.recommendation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
} 