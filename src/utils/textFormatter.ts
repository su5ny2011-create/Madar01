/**
 * Utility functions for formatting and beautifying Arabic and mixed Arabic/English text
 * especially for invoices, spare parts, and technical computer items.
 * Prevents overlapping, cleans OCR artifacts, and ensures elegant typography.
 */

// Common IT brands formatting map
const BRAND_CORRECTIONS: Record<string, string> = {
  'كينغستون': 'Kingston',
  'كنجستون': 'Kingston',
  'كنجستن': 'Kingston',
  'سامسونج': 'Samsung',
  'سامسونغ': 'Samsung',
  'توشيبا': 'Toshiba',
  'ويسترن': 'Western Digital',
  'سيجيت': 'Seagate',
  'سيغيت': 'Seagate',
  'ديل': 'Dell',
  'اتش بي': 'HP',
  'لينوفو': 'Lenovo',
  'اسوس': 'ASUS',
  'ايسوس': 'ASUS',
  'ايسر': 'Acer',
  'تي بي لينك': 'TP-Link',
  'دي لينك': 'D-Link',
  'هيكفيجن': 'Hikvision',
  'داهوا': 'Dahua',
  'لوجيتك': 'Logitech',
  'انتل': 'Intel',
  'رايزن': 'AMD Ryzen',
};

/**
 * Cleans raw OCR or typed text:
 * - Separates Arabic words from English letters and digits (prevents "SSD240GBكينغستون" overlapping)
 * - Removes repeated punctuation, weird OCR symbols (|, _, ~, ^, `, etc.)
 * - Normalizes multiple spaces into a single space
 * - Trims unnecessary quotes or trailing hyphens
 */
export function cleanAndFormatText(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text;

  // Remove common OCR junk characters
  cleaned = cleaned.replace(/[|~^`_\\«»[\]{}]/g, ' ');

  // Separate Arabic character followed immediately by English or number
  cleaned = cleaned.replace(/([\u0600-\u06FF])([A-Za-z0-9])/g, '$1 $2');

  // Separate English or number followed immediately by Arabic character
  cleaned = cleaned.replace(/([A-Za-z0-9])([\u0600-\u06FF])/g, '$1 $2');

  // Standardize spaces around dashes, slashes, and colons
  cleaned = cleaned.replace(/\s*-\s*/g, ' - ');
  cleaned = cleaned.replace(/\s*\/\s*/g, ' / ');
  cleaned = cleaned.replace(/\s*:\s*/g, ': ');

  // Fix common IT unit spacing (e.g., "240 gb" -> "240GB", "8 gb" -> "8GB", "500 w" -> "500W")
  cleaned = cleaned.replace(/(\d+)\s+(gb|tb|mb|ghz|mhz|w|v|ah)\b/gi, '$1$2');

  // Capitalize common units
  cleaned = cleaned
    .replace(/\bssd\b/gi, 'SSD')
    .replace(/\bhdd\b/gi, 'HDD')
    .replace(/\bram\b/gi, 'RAM')
    .replace(/\bddr(\d)\b/gi, 'DDR$1')
    .replace(/\b(\d+)gb\b/gi, '$1GB')
    .replace(/\b(\d+)tb\b/gi, '$1TB')
    .replace(/\b(\d+)mb\b/gi, '$1MB')
    .replace(/\bcat(\d+)\b/gi, 'Cat$1')
    .replace(/\bhdmi\b/gi, 'HDMI')
    .replace(/\bvga\b/gi, 'VGA')
    .replace(/\busb\b/gi, 'USB');

  // Collapse multiple spaces into one
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Remove leading or trailing junk punctuation
  cleaned = cleaned.replace(/^[\s,.\-–—:;|]+|[\s,.\-–—:;|]+$/g, '');

  return cleaned.trim();
}

/**
 * Cleans supplier names: removes phone numbers, tax IDs, or addresses accidentally caught in OCR
 */
export function cleanSupplierName(name: string): string {
  if (!name || typeof name !== 'string') return '';

  let cleaned = name;

  // Remove phone numbers e.g. 079XXXXXXX or +962...
  cleaned = cleaned.replace(/(\+?962|07\d)\s*\d{7,8}/g, '');

  // Remove tax ID prefixes e.g. "الرقم الضريبي: 123456"
  cleaned = cleaned.replace(/(الرقم الضريبي|رقم ضريبي|سجل تجاري|هاتف|تلفون|خلوي)\s*[:#]?\s*\d+/gi, '');

  return cleanAndFormatText(cleaned);
}

/**
 * Cleans invoice numbers: removes "رقم الفاتورة" or "#" or "No." prefixes
 */
export function cleanInvoiceNumber(inv: string): string {
  if (!inv || typeof inv !== 'string') return '';

  let cleaned = inv;
  cleaned = cleaned.replace(/^(فاتورة|رقم الفاتورة|سند رقم|فاتورة رقم|invoice|inv|no|bill|receipt|#|:|\s)+/i, '');
  cleaned = cleaned.replace(/[\s\-_]+$/, '');

  return cleaned.trim();
}

/**
 * Formats a part name or item description cleanly (separating Arabic/English, normalizing units & brands)
 */
export function formatPartName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  let formatted = cleanAndFormatText(name);
  for (const [arBrand, enBrand] of Object.entries(BRAND_CORRECTIONS)) {
    const regex = new RegExp(`(^|\\s)${arBrand}(?=\\s|$)`, 'g');
    formatted = formatted.replace(regex, `$1${enBrand}`);
  }
  return cleanAndFormatText(formatted);
}

/**
 * Formats multiline or inline technical notes and problem descriptions cleanly
 */
export function formatNotesText(notes: string): string {
  if (!notes || typeof notes !== 'string') return '';
  return notes
    .split(/\r?\n/)
    .map((line) => cleanAndFormatText(line))
    .filter(Boolean)
    .join('\n');
}

/**
 * Alias for cleanSupplierName for consistent naming across components
 */
export function formatSupplierName(name: string): string {
  return cleanSupplierName(name);
}

