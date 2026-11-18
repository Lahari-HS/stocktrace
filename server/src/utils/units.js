/**
 * StockTrace Units & Currency Utilities
 * 
 * Quantities are stored as INTEGERS in the smallest base unit:
 * - kg -> g (1 kg = 1000 g)
 * - g -> g (1 g = 1 g)
 * - litre -> ml (1 litre = 1000 ml)
 * - ml -> ml (1 ml = 1 ml)
 * - pcs -> pcs (1 pc = 1 pc)
 * - pack -> pack (1 pack = 1 pack)
 * 
 * Money is stored as INTEGER PAISE (1 Rupee = 100 paise).
 */

export const UNIT_CONFIG = {
  kg: { baseUnit: 'g', multiplier: 1000, label: 'kg' },
  g: { baseUnit: 'g', multiplier: 1, label: 'g' },
  litre: { baseUnit: 'ml', multiplier: 1000, label: 'L' },
  ml: { baseUnit: 'ml', multiplier: 1, label: 'ml' },
  pcs: { baseUnit: 'pcs', multiplier: 1, label: 'pcs' },
  pack: { baseUnit: 'pack', multiplier: 1, label: 'pack' },
};

/**
 * Converts user display quantity (e.g. 2.5 kg) to integer base unit (2500 g).
 * @param {number|string} displayQty 
 * @param {string} unit 
 * @returns {number} Integer base quantity
 */
export function toBaseUnit(displayQty, unit) {
  const num = typeof displayQty === 'string' ? parseFloat(displayQty) : displayQty;
  if (isNaN(num)) return 0;
  const multiplier = UNIT_CONFIG[unit]?.multiplier || 1;
  return Math.round(num * multiplier);
}

/**
 * Converts integer base units (e.g. 2500 g) to display units (2.5 kg).
 * @param {number} baseQty 
 * @param {string} unit 
 * @returns {number}
 */
export function fromBaseUnit(baseQty, unit) {
  if (baseQty == null || isNaN(baseQty)) return 0;
  const multiplier = UNIT_CONFIG[unit]?.multiplier || 1;
  const val = baseQty / multiplier;
  // round to max 3 decimal places to eliminate IEEE float noise
  return Math.round(val * 1000) / 1000;
}

/**
 * Formats quantity with unit symbol
 * @param {number} baseQty 
 * @param {string} unit 
 * @returns {string} e.g. "95 kg" or "2.5 kg"
 */
export function formatQuantityWithUnit(baseQty, unit) {
  const qty = fromBaseUnit(baseQty, unit);
  const formatted = Number.isInteger(qty) ? qty.toString() : qty.toFixed(2).replace(/\.?0+$/, '');
  return `${formatted} ${unit}`;
}

/**
 * Converts rupees to integer paise
 * @param {number|string} rupees 
 * @returns {number}
 */
export function toPaise(rupees) {
  const num = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

/**
 * Converts paise to rupees
 * @param {number} paise 
 * @returns {number}
 */
export function fromPaise(paise) {
  if (paise == null || isNaN(paise)) return 0;
  return paise / 100;
}

/**
 * Formats paise as currency string
 * @param {number} paise 
 * @returns {string} e.g. "₹200.00" or "-₹50.00"
 */
export function formatCurrency(paise) {
  const val = fromPaise(paise);
  const isNeg = val < 0;
  const absVal = Math.abs(val).toFixed(2);
  return `${isNeg ? '-' : ''}₹${absVal}`;
}
