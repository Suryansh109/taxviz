'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const TaxCalculator = dynamic(() => import('./TaxCalculator'), {
  loading: () => <div>Loading...</div>
});

export default function TaxCalculatorWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TaxCalculator />
    </Suspense>
  );
} 