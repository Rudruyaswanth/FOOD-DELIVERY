export function formatRupees(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const rounded = Math.round(safe * 100) / 100;
  const hasPaise = Math.abs(rounded - Math.round(rounded)) > 0.001;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(rounded);
  return `₹${formatted}`;
}
