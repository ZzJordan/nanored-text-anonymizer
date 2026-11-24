/**
 * Validadores con dígito de control. Reciben el valor ya compactado
 * (sin espacios, puntos ni guiones) y en mayúsculas, salvo que se diga otra cosa.
 */

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

/** Quita separadores habituales: espacios, puntos, guiones y barras. */
export function compact(value: string): string {
  return value.replace(/[\s.\-–—/]/g, '').toUpperCase();
}

/**
 * Corrige confusiones típicas del OCR en posiciones que deben ser dígitos:
 * O→0, I/l/|→1. Solo se usa sobre tramos que el patrón ya marca como numéricos.
 */
export function ocrDigits(value: string): string {
  return value.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
}

/** Cuenta los dígitos «de verdad» (sin correcciones de OCR). */
export function realDigitCount(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

/** DNI: 8 dígitos + letra (módulo 23). Acepta 7 dígitos (DNI antiguo sin el 0 inicial). */
export function isValidDni(raw: string): boolean {
  const v = compact(raw);
  const m = /^(\d{7,8})([A-Z])$/.exec(v);
  if (!m) return false;
  const num = Number.parseInt(m[1], 10);
  return DNI_LETTERS[num % 23] === m[2];
}

/** NIE: X/Y/Z + 7 dígitos + letra. La X/Y/Z vale 0/1/2. */
export function isValidNie(raw: string): boolean {
  const v = compact(raw);
  const m = /^([XYZ])(\d{7})([A-Z])$/.exec(v);
  if (!m) return false;
  const prefix = 'XYZ'.indexOf(m[1]);
  const num = Number.parseInt(`${prefix}${m[2]}`, 10);
  return DNI_LETTERS[num % 23] === m[3];
}

/** NIF especial de personas físicas: K, L o M + 7 dígitos + letra (módulo 23 sobre los 7 dígitos). */
export function isValidKlmNif(raw: string): boolean {
  const v = compact(raw);
  const m = /^([KLM])(\d{7})([A-Z])$/.exec(v);
  if (!m) return false;
  return DNI_LETTERS[Number.parseInt(m[2], 10) % 23] === m[3];
}

/**
 * CIF / NIF de entidad: letra + 7 dígitos + control (dígito o letra según el tipo).
 * Algoritmo oficial: suma de posiciones pares + dobles de impares (sumando sus cifras).
 */
export function isValidCif(raw: string): boolean {
  const v = compact(raw);
  const m = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(v);
  if (!m) return false;
  const [, type, digits, control] = m;
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const d = Number(digits[i]);
    if (i % 2 === 0) {
      const doubled = d * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    } else {
      sum += d;
    }
  }
  const controlDigit = (10 - (sum % 10)) % 10;
  const controlLetter = 'JABCDEFGHI'[controlDigit];
  if ('PQRSNW'.includes(type)) return control === controlLetter;
  if ('ABEH'.includes(type)) return control === String(controlDigit);
  return control === String(controlDigit) || control === controlLetter;
}

/** Longitudes de IBAN de los países más habituales. Para el resto se acepta 15-34. */
export const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AT: 20, BE: 16, CH: 21, CZ: 24, DE: 22, DK: 18, ES: 24, FI: 18, FR: 27,
  GB: 22, GI: 23, GR: 27, IE: 22, IT: 27, LU: 20, MT: 31, NL: 18, NO: 15, PL: 28,
  PT: 25, RO: 24, SE: 24, SK: 24, MC: 27, MA: 28, LT: 20, LV: 21, EE: 20, HR: 21,
  HU: 28, BG: 22, SI: 19, CY: 28, IS: 26, LI: 21, SM: 27, TR: 26,
};

/** IBAN: módulo 97 = 1 (ISO 13616). */
export function isValidIban(raw: string): boolean {
  const v = compact(raw);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(v)) return false;
  const expected = IBAN_LENGTHS[v.slice(0, 2)];
  if (expected !== undefined && v.length !== expected) return false;
  const rearranged = v.slice(4) + v.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    const chunk = code >= 65 ? String(code - 55) : ch;
    for (const digit of chunk) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

/** Cuenta bancaria española antigua (CCC, 20 dígitos) con sus dos dígitos de control. */
export function isValidCcc(raw: string): boolean {
  const v = compact(raw);
  if (!/^\d{20}$/.test(v)) return false;
  const weights = [1, 2, 4, 8, 5, 10, 9, 7, 3, 6];
  const control = (digits: string): number => {
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += Number(digits[i]) * weights[i];
    const r = 11 - (sum % 11);
    return r === 11 ? 0 : r === 10 ? 1 : r;
  };
  const first = control(`00${v.slice(0, 8)}`);
  const second = control(v.slice(10, 20));
  return first === Number(v[8]) && second === Number(v[9]);
}

/** Algoritmo de Luhn (tarjetas de pago). */
export function luhn(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Tarjeta: 13-19 dígitos, prefijo de red conocida (3, 4, 5, 6) y Luhn válido. */
export function isValidCard(raw: string): boolean {
  const v = compact(raw);
  if (!/^\d{13,19}$/.test(v)) return false;
  if (!/^[3456]/.test(v)) return false;
  if (/^(\d)\1+$/.test(v)) return false;
  return luhn(v);
}

/** Teléfono español: 9 dígitos que empiezan por 6, 7, 8 o 9 (prefijo +34/0034 opcional). */
export function isValidSpanishPhone(raw: string): boolean {
  let v = raw.replace(/[^\d+]/g, '');
  if (v.startsWith('+34')) v = v.slice(3);
  else if (v.startsWith('0034')) v = v.slice(4);
  if (!/^[6789]\d{8}$/.test(v)) return false;
  // 900/800 son números de empresa, pero siguen siendo teléfonos: se tapan igual.
  return !/^(\d)\1{8}$/.test(v);
}

/** Código postal español: 5 dígitos con provincia 01-52. */
export function isValidPostalCode(raw: string): boolean {
  if (!/^\d{5}$/.test(raw)) return false;
  const province = Number(raw.slice(0, 2));
  return province >= 1 && province <= 52;
}
