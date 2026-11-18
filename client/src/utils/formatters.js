export const UNIT_CONFIG = {
  kg: { baseUnit: 'g', multiplier: 1000, label: 'kg' },
  g: { baseUnit: 'g', multiplier: 1, label: 'g' },
  litre: { baseUnit: 'ml', multiplier: 1000, label: 'L' },
  ml: { baseUnit: 'ml', multiplier: 1, label: 'ml' },
  pcs: { baseUnit: 'pcs', multiplier: 1, label: 'pcs' },
  pack: { baseUnit: 'pack', multiplier: 1, label: 'pack' },
};

export function toBaseUnit(displayQty, unit) {
  const num = typeof displayQty === 'string' ? parseFloat(displayQty) : displayQty;
  if (isNaN(num)) return 0;
  const mult = UNIT_CONFIG[unit]?.multiplier || 1;
  return Math.round(num * mult);
}

export function fromBaseUnit(baseQty, unit) {
  if (baseQty == null || isNaN(baseQty)) return 0;
  const mult = UNIT_CONFIG[unit]?.multiplier || 1;
  const val = baseQty / mult;
  return Math.round(val * 1000) / 1000;
}

export function formatQuantity(baseQty, unit) {
  const val = fromBaseUnit(baseQty, unit);
  const formatted = Number.isInteger(val) ? val.toString() : val.toFixed(2).replace(/\.?0+$/, '');
  return `${formatted} ${unit}`;
}

export function fromPaise(paise) {
  if (paise == null || isNaN(paise)) return 0;
  return paise / 100;
}

export function toPaise(rupees) {
  const num = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

export function formatCurrency(paise) {
  if (paise == null || isNaN(paise)) return '₹0.00';
  const isNeg = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = (absPaise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${isNeg ? '-' : ''}₹${rupees}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
