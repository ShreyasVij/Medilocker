import { normalizeVital } from '../apps/web/lib/vitalsProcessor';

// Example: List of raw vital labels from your data (replace with your actual data source)
const rawVitals = [
  'Testosterone',
  'TSH',
  'T3',
  'T4',
  'Blood Sugar Fasting',
  'Protein',
  'Ketones',
  'Leukocyte Esterase',
  'Nitrites',
  'Calcium',
  'Vitamin D',
  'Iron',
  'Ferritin',
  'CRP',
  'Procalcitonin',
  // Add more as needed
];

console.log('--- Vital Categorization Preview ---');
for (const label of rawVitals) {
  const result = normalizeVital(label);
  console.log(`${label} => type: ${result.type}, category: ${result.category}, normalizedLabel: ${result.normalizedLabel}`);
}

// To use with your real vitals data, replace rawVitals with your extracted labels.
// This script helps you audit and tune the normalization logic for better dashboard grouping.
