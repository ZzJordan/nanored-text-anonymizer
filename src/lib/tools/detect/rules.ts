/**
 * Reglas de detección. Cada regla recibe el texto de todos los tramos de
 * línea de una página y devuelve tramos (línea, inicio, fin).
 *
 * Para añadir una regla: escribe una función `find` que devuelva `Span[]`,
 * añádela a `RULES` en el orden adecuado (las validadas con dígito de control
 * van primero) y escribe sus tests en `detect.test.ts`.
 */
import { FIRST_NAMES, NAME_PARTICLES, SURNAMES } from './names-data';
import { fold, type LineIndex } from './text';
import type { Category, PageText, Span } from './types';
import {
  IBAN_LENGTHS,
  isValidCard,
  isValidCcc,
  isValidCif,
  isValidDni,
  isValidIban,
  isValidKlmNif,
  isValidNie,
  isValidPostalCode,
  isValidSpanishPhone,
  ocrDigits,
  realDigitCount,
} from './validators';

export interface RuleContext {
  page: PageText;
  index: LineIndex[];
  /** Texto de cada tramo en minúsculas y sin tildes (mismas posiciones). */
  folded: string[];
}

export interface Rule {
  id: string;
  category: Category;
  /**
   * Reglas «estrictas» (validadas con dígito de control o formato cerrado):
   * lo que encuentran no puede volver a detectarse dentro por otra regla
   * posterior (p. ej. un teléfono dentro de un IBAN).
   */
  strict: boolean;
  find(ctx: RuleContext): Span[];
}

/** Ni letra ni número inmediatamente antes / después. */
const BB = '(?<![\\p{L}\\p{N}])';
const BA = '(?![\\p{L}\\p{N}])';
/** Posición de dígito tolerante al OCR (O por 0, I/l/| por 1). */
const D = '[0-9OoIl|]';
const DASH = '[-‐–—]';

function eachMatch(text: string, re: RegExp, fn: (m: RegExpExecArray) => void): void {
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    fn(m);
    if (m[0].length === 0) re.lastIndex++;
  }
}

function regexRule(
  id: string,
  category: Category,
  pattern: string,
  accept: (m: RegExpExecArray, text: string) => { start: number; end: number } | boolean,
  flags = 'gu',
): Rule {
  return {
    id,
    category,
    strict: true,
    find(ctx) {
      const out: Span[] = [];
      ctx.index.forEach((idx, line) => {
        eachMatch(idx.text, new RegExp(pattern, flags), (m) => {
          const r = accept(m, idx.text);
          if (r === false) return;
          if (r === true) out.push({ line, start: m.index, end: m.index + m[0].length });
          else out.push({ line, ...r });
        });
      });
      return out;
    },
  };
}

// ── Documentos de identidad ────────────────────────────────────────────────

const nie = regexRule(
  'nie',
  'dni',
  `${BB}([XYZxyz])\\s?${DASH}?\\s?(${D}{7})\\s?${DASH}?\\s?([A-Za-z])${BA}`,
  (m) => realDigitCount(m[2]) >= 5 && isValidNie(`${m[1]}${ocrDigits(m[2])}${m[3]}`),
);

const klmNif = regexRule(
  'nif-klm',
  'dni',
  `${BB}([KLM])\\s?${DASH}?\\s?(${D}{7})\\s?${DASH}?\\s?([A-Z])${BA}`,
  (m) => realDigitCount(m[2]) >= 5 && isValidKlmNif(`${m[1]}${ocrDigits(m[2])}${m[3]}`),
);

const dni = regexRule(
  'dni',
  'dni',
  `${BB}(?:ES\\s?)?(${D}{1,2}\\.?${D}{3}\\.?${D}{3})\\s?${DASH}?\\s?([A-Za-z])${BA}`,
  (m) => {
    const digits = ocrDigits(m[1].replace(/\./g, ''));
    return realDigitCount(m[1]) >= 6 && isValidDni(`${digits}${m[2]}`);
  },
);

const cif = regexRule(
  'cif',
  'cif',
  `${BB}(?:ES\\s?)?([ABCDEFGHJNPQRSUVW])\\s?[-‐–—.]?\\s?(${D}{2}\\.?${D}{3}\\.?${D}{2})\\s?${DASH}?\\s?([0-9A-J])${BA}`,
  (m) => {
    const digits = ocrDigits(m[2].replace(/\./g, ''));
    return realDigitCount(m[2]) >= 5 && isValidCif(`${m[1]}${digits}${m[3]}`);
  },
);

// ── Banca y pagos ──────────────────────────────────────────────────────────

/** Países cuyo BBAN es solo numérico: ahí se pueden corregir O/I del OCR. */
const NUMERIC_BBAN = new Set(['ES', 'PT', 'DE', 'AT', 'BE', 'PL', 'CZ', 'SK', 'SE', 'DK', 'FI', 'NO', 'SI', 'HR', 'EE', 'LT']);

const iban: Rule = {
  id: 'iban',
  category: 'iban',
  strict: true,
  find(ctx) {
    const out: Span[] = [];
    ctx.index.forEach((idx, line) => {
      const text = idx.text;
      eachMatch(text, new RegExp(`${BB}[A-Z]{2}\\s?[0-9OI]{2}(?:[\\s-]?[A-Z0-9|]){11,34}`, 'gu'), (m) => {
        // Posiciones de los caracteres alfanuméricos del candidato.
        const positions: number[] = [];
        let chars = '';
        for (let i = m.index; i < m.index + m[0].length; i++) {
          if (/[A-Z0-9|]/.test(text[i])) {
            positions.push(i);
            chars += text[i];
          }
        }
        const country = chars.slice(0, 2);
        const lengths = IBAN_LENGTHS[country]
          ? [IBAN_LENGTHS[country]]
          : Array.from({ length: Math.min(34, chars.length) - 14 }, (_, k) => Math.min(34, chars.length) - k);
        for (const len of lengths) {
          if (chars.length < len) continue;
          let candidate = chars.slice(0, len);
          let ok = isValidIban(candidate);
          if (!ok && NUMERIC_BBAN.has(country)) {
            candidate = country + ocrDigits(candidate.slice(2));
            ok = isValidIban(candidate);
          }
          if (ok) {
            const end = positions[len - 1] + 1;
            out.push({ line, start: m.index, end });
            return;
          }
        }
      });
    });
    return out;
  },
};

const ccc = regexRule('ccc', 'iban', `${BB}\\d{4}(?:[\\s-]?\\d){16}${BA}`, (m) => isValidCcc(m[0]));

const card = regexRule('tarjeta', 'tarjeta', `${BB}(?:\\d[\\s-]?){12,18}\\d${BA}`, (m) => isValidCard(m[0]));

// ── Contacto ───────────────────────────────────────────────────────────────

const email = regexRule(
  'email',
  'email',
  `${BB}[A-Za-z0-9._%+-]+\\s?\\(?[@©®]\\s?[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)*\\.[A-Za-z]{2,}${BA}`,
  () => true,
);

/** Dominios de primer nivel habituales para reconocer webs y emails mal leídos. */
const COMMON_TLDS = [
  'example', 'online', 'digital', 'global', 'email', 'legal', 'cloud', 'store', 'shop', 'tech', 'site', 'info',
  'club', 'com', 'net', 'org', 'cat', 'gal', 'eus', 'dev', 'app', 'biz', 'pro', 'web', 'gob', 'edu', 'gov',
  'xyz', 'es', 'eu', 'io', 'co', 'me', 'tv', 'fr', 'de', 'it', 'pt', 'uk', 'us', 'ai', 'mx', 'ar', 'cl', 'nl',
  'be', 'ch', 'at', 'ie',
];
/** Abreviaturas que, pegadas a la palabra siguiente, parecerían un dominio («Avda.de»). */
const DOMAIN_ABBREVIATIONS = new Set([
  'avda', 'avd', 'av', 'pza', 'plza', 'pl', 'c', 'cl', 'ctra', 'sr', 'sra', 'srta', 'd', 'dna', 'dr', 'dra', 'etc',
  'pag', 'ref', 'n', 'no', 'num', 'tel', 'telf', 'tlf', 'tfno', 'ud', 'uds', 'fra', 'fact', 'sl', 'sa', 'cia',
  'hnos', 'ed', 'esc', 'pta', 'urb', 'pol', 'ind', 'apdo', 'mov', 'ext', 'vto', 'dto', 'pº',
]);
/** Palabras que pueden ir delante de una web sin formar parte de un email. */
const NOT_LOCAL_PART = new Set([
  'en', 'web', 'visite', 'visita', 'visitenos', 'la', 'el', 'de', 'del', 'nuestra', 'nuestro', 'pagina', 'sitio',
  'y', 'o', 'a', 'e', 'por', 'para', 'consulte', 'www', 'http', 'https', 'url', 'dominio', 'mail', 'email',
  'correo', 'en:', 'via',
]);

const DOMAIN_RE = new RegExp(
  `(?<![\\p{L}\\p{N}@._%+/-])(?:https?:\\/\\/)?(?:www\\.)?[a-z0-9][a-z0-9-]*(?:\\.[a-z0-9-]+)*\\.(?:${COMMON_TLDS.join('|')})(?![\\p{L}\\p{N}-])(?:\\/[^\\s]*)?`,
  'giu',
);

/**
 * Respaldo para emails que el OCR ha leído mal y para webs sueltas: busca algo
 * con forma de dominio («talleres-imaginarios.example», «www.empresa.es») y, si
 * delante hay algo que parece la parte local de un email separada por lo que el
 * OCR suele poner en vez de la arroba («Q», «a», «e», «0», «O», sus mayúsculas
 * o minúsculas, «&», «€», espacio o nada),
 * lo incluye. No toca importes ni fechas (el dominio exige letras) ni «S.L.».
 */
const emailOrWeb: Rule = {
  id: 'email-web',
  category: 'email',
  strict: false,
  find(ctx) {
    const out: Span[] = [];
    ctx.index.forEach((idx, line) => {
      const text = idx.text;
      eachMatch(text, DOMAIN_RE, (m) => {
        const host = m[0].replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/^www\./i, '');
        const labels = host.split('.');
        const name = fold(labels[labels.length - 2] ?? '');
        if (name.length < 2 || DOMAIN_ABBREVIATIONS.has(name) || !/[a-z]/i.test(name)) return;
        let start = m.index;
        const end = m.index + m[0].length;
        const before = text.slice(0, start);
        const startsLikeAt = /^[QqaAeEO0&]/.test(m[0]);
        const local =
          // «lucia.ejemplar e correo.example», «info Q empresa.es» (también E, A, q, &, €)
          /(?<![\p{L}\p{N}])([\p{Ll}\d._%+-]{2,})\s[QqaAeEO0&€]\s$/u.exec(before) ??
          // «facturacionO talleres.example», «lucia.ejemplare correo.example»
          /(?<![\p{L}\p{N}])([\p{Ll}\d._%+-]{2,}[QAEO0&€]|[\p{Ll}\d_%+-]*[._\d][\p{Ll}\d._%+-]*[ae])\s$/u.exec(before) ??
          // «facturacion Otalleres.example» (la arroba leída como letra pegada al dominio)
          (startsLikeAt ? /(?<![\p{L}\p{N}])([\p{Ll}\d._%+-]{2,})\s$/u.exec(before) : null) ??
          // «lucia.ejemplar correo.example» (la arroba desaparecida)
          /(?<![\p{L}\p{N}])([\p{Ll}\d._%+-]{2,})\s$/u.exec(before);
        // La parte local tiene que tener letras y no venir pegada a un número («590,30 €»).
        const prev = local ? text[local.index - 1] : undefined;
        if (local && /\p{Ll}/u.test(local[1]) && !(prev && /[\d,.]/.test(prev)) && !NOT_LOCAL_PART.has(fold(local[1]))) {
          start = local.index;
        }
        out.push({ line, start, end: text[end - 1] === '.' ? end - 1 : end });
      });
    });
    return out;
  },
};

const phoneEs = regexRule(
  'telefono',
  'telefono',
  `(?<![\\p{L}\\p{N}+])(?:\\(?(?:\\+|00)\\s?34\\)?[\\s.-]?)?[6789](?:[\\s.-]?\\d){8}(?![\\p{L}\\p{N}]|[.,]\\d)`,
  (m, text) => {
    if (!isValidSpanishPhone(m[0])) return false;
    const after = text.slice(m.index + m[0].length).trimStart();
    const before = text.slice(0, m.index).trimEnd();
    // Importes: «612.345.678 €», «€ 912345678».
    if (/^(€|eur\b|euros?\b)/i.test(after) || /[€$]$/.test(before)) return false;
    return true;
  },
);

const phoneIntl = regexRule(
  'telefono-int',
  'telefono',
  `${BB}\\+(?!34)\\d{1,3}(?:[\\s.-]?\\(?\\d\\)?){7,12}(?![\\p{L}\\p{N}]|[.,]\\d)`,
  (m) => (m[0].match(/\d/g) ?? []).length >= 9,
);

// ── Vehículos ──────────────────────────────────────────────────────────────

/** Combinaciones de tres consonantes que suelen ser unidades o monedas, no matrículas. */
const PLATE_STOPWORDS = new Set([
  'KGS', 'LTS', 'MTS', 'PCS', 'CMS', 'MMS', 'GRS', 'CHF', 'GBP', 'PLN', 'CZK', 'HKD', 'MXN',
  'BRL', 'KWH', 'MWH', 'GWH', 'PVP', 'CTS', 'NRL', 'SRL', 'SLL', 'BCN', 'MDZ',
]);
const PROVINCES =
  'A|AB|AL|AV|B|BA|BI|BU|C|CA|CC|CE|CO|CR|CS|CU|GC|GE|GI|GR|GU|H|HU|IB|J|L|LE|LO|LU|M|MA|ML|MU|NA|O|OR|OU|P|PM|PO|S|SA|SE|SG|SO|SS|T|TE|TF|TO|V|VA|VI|Z|ZA';

const plate = regexRule(
  'matricula',
  'matricula',
  `${BB}(?:\\d{4}[\\s-]?([BCDFGHJKLMNPRSTVWXYZ]{3})|(?:${PROVINCES})[\\s-]\\d{4}[\\s-][A-Z]{1,2})${BA}`,
  (m) => !(m[1] && PLATE_STOPWORDS.has(m[1])),
);

// ── Direcciones ────────────────────────────────────────────────────────────

/** Etiquetas que cortan un valor («Juan Pérez  NIF: …» → se corta en NIF). */
const STOP_LABEL =
  /\s(?:nif|cif|dni|nie|n\.i\.f\.|c\.i\.f\.|tel|tlf|telf|telefono|movil|fax|e-?mail|correo|web|www|fecha|factura|n[º°]|num\.|cp|c\.p\.|iban|cuenta)\b\.?\s*:?/u;

function cutAtStopLabel(folded: string, start: number, end: number): number {
  const slice = folded.slice(start, end);
  const m = STOP_LABEL.exec(` ${slice}`);
  if (!m) return end;
  return start + Math.max(0, m.index - 1);
}

function trimSpan(text: string, start: number, end: number): { start: number; end: number } {
  while (start < end && /[\s,;:·\-–—]/.test(text[start])) start++;
  while (end > start && /[\s,;:·\-–—]/.test(text[end - 1])) end--;
  return { start, end };
}

const STREET =
  '(?:c\\s?\\/|c\\.\\s?\\/|calle|cl\\.|c\\.(?=\\s\\S)|avda\\.?|avd\\.|av\\.|avenida|plaza|pza\\.?|plza\\.?|pl\\.|paseo|p[º°]\\.?|pso\\.|ctra\\.?|carretera|camino|cmno\\.?|ronda|rda\\.|travesia|trav\\.|urb\\.|urbanizacion|pol\\.?\\s?ind\\.?|poligono(?:\\s+industrial)?|glorieta|pasaje|rambla|via|callejon|partida|apartado de correos|apdo\\.?|bulevar|costanilla|cuesta|parque empresarial|parque tecnologico)';

const STREET_RE = new RegExp(`(?:^|[:,;]\\s*|\\s{2,})(${STREET})(?=[\\s./º°]|$)`, 'gu');

const address: Rule = {
  id: 'direccion',
  category: 'direccion',
  strict: false,
  find(ctx) {
    const out: Span[] = [];
    ctx.folded.forEach((folded, line) => {
      eachMatch(folded, STREET_RE, (m) => {
        const start = m.index + m[0].length - m[1].length;
        // «C.» solo cuenta si no es «C.P.», «C.I.F.»…
        if (/^c\.$/.test(m[1]) && /^c\.\s?(p|i|b)\./.test(folded.slice(start))) return;
        const end = cutAtStopLabel(folded, start, folded.length);
        const span = trimSpan(ctx.index[line].text, start, end);
        // Tiene que haber algo después de la palabra clave.
        if (span.end - start <= m[1].length + 1) return;
        out.push({ line, ...span });
      });
    });
    return out;
  },
};

// ── Código postal ──────────────────────────────────────────────────────────

const CITY_STOPWORDS = new Set([
  'euros', 'euro', 'eur', 'unidades', 'uds', 'ud', 'kg', 'kilos', 'litros', 'metros', 'km', 'horas',
  'dias', 'minutos', 'puntos', 'pts', 'iva', 'total', 'base', 'importe', 'cantidad', 'precio',
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre',
  'octubre', 'noviembre', 'diciembre', 'x', 'por', 'pagina', 'pag',
]);
const CITY_STOP_LABEL = /^(tel|tlf|telf|telefono|movil|fax|e-?mail|correo|nif|cif|dni|nie|web|www|iban)\b/u;

const postalCode: Rule = {
  id: 'cp',
  category: 'cp',
  strict: false,
  find(ctx) {
    const out: Span[] = [];
    ctx.index.forEach((idx, line) => {
      const text = idx.text;
      const folded = ctx.folded[line];
      eachMatch(text, /(?<![\p{L}\p{N}.,€$/-])(\d{5})(?![\p{N}]|[.,/-]\d)/gu, (m) => {
        if (!isValidPostalCode(m[1])) return;
        const before = folded.slice(Math.max(0, m.index - 30), m.index);
        const hasLabel = /(?:c\.\s?p\.?|\bcp|cod(?:igo)?\.?\s*postal|cod\.\s*post\.?)\s*:?\s*$/u.test(before);
        const negative =
          /(?:n[º°o]\.?|num(?:ero)?\.?|ref(?:erencia)?\.?|factura|pedido|albaran|cliente|codigo|cod\.?|id|€|\$|eur|euros|total|importe|x)\s*:?\s*#?\s*$/u.test(
            before,
          );
        const lineHasStreet = new RegExp(STREET_RE.source, 'u').test(folded);
        // Ciudad detrás: palabras con mayúscula inicial, sin dígitos.
        let end = m.index + m[1].length;
        let cityEnd = end;
        const cityRe = /\s*[-,]?\s*(\(?[\p{Lu}][\p{L}'’·.-]*\)?|de|del|la|las|los|el|l'|d')(?=\s|$|,)/uy;
        cityRe.lastIndex = end;
        let words = 0;
        let firstWordOk = false;
        let cm: RegExpExecArray | null;
        while ((cm = cityRe.exec(text))) {
          const word = fold(cm[1]).replace(/[().]/g, '');
          if (CITY_STOP_LABEL.test(word)) break;
          if (words === 0) {
            if (!/^[\p{Lu}(]/u.test(cm[1]) || CITY_STOPWORDS.has(word)) break;
            firstWordOk = true;
          }
          words++;
          cityEnd = cityRe.lastIndex;
          if (words >= 6) break;
        }
        if (!(hasLabel || (!negative && (firstWordOk || lineHasStreet)))) return;
        if (firstWordOk) end = cityEnd;
        out.push({ line, ...trimSpan(text, m.index, end) });
      });
    });
    return out;
  },
};

// ── Nombres y razón social ─────────────────────────────────────────────────

interface LabelDef {
  re: RegExp;
  category: Category;
}

/** Etiquetas cuyo valor (resto de la línea o línea de debajo) es un dato personal. */
const LABELS: LabelDef[] = [
  {
    re: /(?:^|\s)(datos del cliente|datos de facturacion|facturar a|factura a|facturado a|emitida a|nombre y apellidos|nombre completo|apellidos y nombre|nombre|apellidos|razon social|denominacion social|titular(?: de la cuenta)?|cliente|destinatario|comprador|adquirente|paciente|alumno|alumna|huesped|propietario|propietaria|beneficiario|beneficiaria|conductor|conductora|tomador|tomadora|asegurado|asegurada|empleado|empleada|trabajador|trabajadora|interesado|interesada|solicitante|arrendatario|arrendataria|inquilino|inquilina|contacto|persona de contacto|representante|a la atencion de|att\.|atn\.|attn\.)\s*:/gu,
    category: 'nombre',
  },
  {
    re: /(?:^|\s)(datos del cliente|facturar a|factura a|facturado a|cliente|destinatario)\s*$/gu,
    category: 'nombre',
  },
  {
    re: /(?:^|\s)(direccion(?: fiscal| postal| de entrega| de envio)?|domicilio(?: fiscal| social)?|dir\.)\s*:/gu,
    category: 'direccion',
  },
];

/** Tramo de la misma fila a la derecha, o el primero de debajo alineado con la etiqueta. */
function valueLineAfter(ctx: RuleContext, line: number, labelX: number): number | null {
  const lines = ctx.page.lines;
  const current = lines[line];
  const right = lines.findIndex(
    (l, i) => i !== line && l.row === current.row && l.box.x > current.box.x + current.box.w - 1e-6,
  );
  if (right >= 0) return right;
  const h = current.box.h;
  let best: number | null = null;
  let bestY = Number.POSITIVE_INFINITY;
  lines.forEach((l, i) => {
    if (l.row <= current.row) return;
    const dy = l.box.y - (current.box.y + current.box.h);
    if (dy < -h * 0.3 || dy > h * 2.5) return;
    const aligned = Math.abs(l.box.x - labelX) < h * 4 || (l.box.x <= labelX + h && l.box.x + l.box.w >= labelX);
    if (aligned && l.box.y < bestY) {
      best = i;
      bestY = l.box.y;
    }
  });
  return best;
}

function labelValueSpan(ctx: RuleContext, line: number, from: number, category: Category): Span | null {
  const text = ctx.index[line].text;
  const folded = ctx.folded[line];
  let end = cutAtStopLabel(folded, from, folded.length);
  // Otra etiqueta con «:» más adelante en la misma línea también corta.
  const nextLabel = /\s[\p{L}.]+(?:\s[\p{L}.]+)?\s*:/u.exec(folded.slice(from + 1, end));
  if (nextLabel) end = from + 1 + nextLabel.index;
  const span = trimSpan(text, from, end);
  const value = text.slice(span.start, span.end);
  if (!/\p{L}{2,}/u.test(value)) return null;
  // Códigos de cliente («C-00123») no son nombres.
  if (category === 'nombre' && /^[\p{L}]{0,3}[-\s]?\d+$/u.test(value)) return null;
  return { line, ...span };
}

export function findLabelled(ctx: RuleContext): { category: Category; span: Span }[] {
  const out: { category: Category; span: Span }[] = [];
  ctx.folded.forEach((folded, line) => {
    for (const def of LABELS) {
      eachMatch(folded, new RegExp(def.re.source, def.re.flags), (m) => {
        const valueStart = m.index + m[0].length;
        let span = labelValueSpan(ctx, line, valueStart, def.category);
        if (!span && folded.slice(valueStart).trim() === '') {
          const labelX = ctx.page.lines[line].words[0]?.box.x ?? 0;
          const below = valueLineAfter(ctx, line, labelX);
          // Si la línea de debajo empieza por su propia etiqueta («Cliente: …»), ya se trata sola.
          if (below !== null && !/^[\p{L} .]{2,30}:/u.test(ctx.folded[below])) {
            span = labelValueSpan(ctx, below, 0, def.category);
          }
        }
        if (span) out.push({ category: def.category, span });
      });
    }
  });
  return out;
}

const HONORIFIC_RE = /(?:^|[\s,(])(sr\.|sra\.|srta\.|d\.|dna\.|d\.ª|don|dona)\s+/gu;
const TOKEN_RE = /[\p{L}][\p{L}'’·-]*/gu;

function isCapitalized(word: string): boolean {
  return /^\p{Lu}(?:[\p{Ll}'’·-]*|[\p{Lu}'’·-]*)$/u.test(word) && word.length >= 2;
}

const honorific: Rule = {
  id: 'tratamiento',
  category: 'nombre',
  strict: false,
  find(ctx) {
    const out: Span[] = [];
    ctx.folded.forEach((folded, line) => {
      const text = ctx.index[line].text;
      eachMatch(folded, HONORIFIC_RE, (m) => {
        let start = -1;
        let end = -1;
        let count = 0;
        const tokenRe = /\s*([\p{L}][\p{L}'’·-]*)/uy;
        tokenRe.lastIndex = m.index + m[0].length;
        let tm: RegExpExecArray | null;
        while ((tm = tokenRe.exec(text)) && count < 5) {
          const word = tm[1];
          const f = fold(word);
          if (isCapitalized(word)) {
            if (start < 0) start = tokenRe.lastIndex - word.length;
            end = tokenRe.lastIndex;
            count++;
          } else if (!(NAME_PARTICLES.has(f) && count > 0)) {
            break;
          }
        }
        if (start < 0) return;
        const first = fold(text.slice(start).match(/^[\p{L}]+/u)?.[0] ?? '');
        // «D.» es ambiguo: exige nombre conocido o al menos dos palabras.
        if (/^d\.$/.test(m[1]) && !FIRST_NAMES.has(first) && count < 2) return;
        out.push({ line, start, end });
      });
    });
    return out;
  },
};

/**
 * Nombres sin etiqueta: secuencias de palabras con mayúscula inicial que
 * contienen un nombre de pila conocido y al menos un apellido conocido,
 * o un nombre de pila seguido de dos palabras con mayúscula («María Zubizarreta Etxeberria»).
 * También «GARCÍA LÓPEZ, JUAN».
 */
const dictionaryNames: Rule = {
  id: 'nombres-frecuentes',
  category: 'nombre',
  strict: false,
  find(ctx) {
    const out: Span[] = [];
    ctx.index.forEach((idx, line) => {
      const text = idx.text;
      const tokens: { word: string; f: string; start: number; end: number }[] = [];
      eachMatch(text, TOKEN_RE, (m) => {
        tokens.push({ word: m[0], f: fold(m[0]), start: m.index, end: m.index + m[0].length });
      });
      // Partir en tandas de palabras capitalizadas (con partículas y como mucho una coma).
      let i = 0;
      while (i < tokens.length) {
        if (!isCapitalized(tokens[i].word)) {
          i++;
          continue;
        }
        const run = [tokens[i]];
        let commas = 0;
        let j = i + 1;
        while (j < tokens.length) {
          const between = text.slice(tokens[j - 1].end, tokens[j].start);
          const sepOk = /^\s+$/.test(between) || (/^\s*,\s*$/.test(between) && commas === 0 && (commas = 1));
          if (!sepOk) break;
          const t = tokens[j];
          if (isCapitalized(t.word) || (NAME_PARTICLES.has(t.f) && j + 1 < tokens.length && isCapitalized(tokens[j + 1].word))) {
            run.push(t);
            j++;
          } else break;
        }
        i = j;
        const caps = run.filter((t) => isCapitalized(t.word));
        const firstIdx = caps.findIndex((t) => FIRST_NAMES.has(t.f));
        const surnames = caps.filter((t, k) => SURNAMES.has(t.f) && k !== firstIdx);
        if (firstIdx < 0) continue;
        let ok = surnames.length >= 1;
        if (!ok) {
          const after = caps.slice(firstIdx + 1).filter((t) => !FIRST_NAMES.has(t.f));
          ok = after.length >= 2;
        }
        if (!ok || caps.length > 6) continue;
        // Recortar a palabras de nombre: desde la primera conocida hasta el final de la tanda.
        const known = caps.filter((t) => FIRST_NAMES.has(t.f) || SURNAMES.has(t.f));
        const startTok = run.indexOf(known[0]) <= run.indexOf(caps[firstIdx]) ? known[0] : caps[firstIdx];
        out.push({ line, start: startTok.start, end: run[run.length - 1].end });
      }
    });
    return out;
  },
};

const COMPANY_SUFFIX =
  /(?<![\p{L}])(s\.?\s?l\.?\s?u\.?|s\.?\s?l\.?\s?l\.?|s\.?\s?l\.?\s?n\.?\s?e\.?|s\.?\s?l\.?|s\.?\s?a\.?\s?u\.?|s\.?\s?a\.?|s\.?\s?coop\.?(?:\s?and\.?)?|s\.?\s?a\.?\s?t\.?|c\.\s?b\.?|s\.\s?c\.?)(?![\p{L}])/gu;
const COMPANY_CONNECTORS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', '&', 'i']);

const company: Rule = {
  id: 'razon-social',
  category: 'nombre',
  strict: false,
  find(ctx) {
    const out: Span[] = [];
    ctx.index.forEach((idx, line) => {
      const text = idx.text;
      const folded = ctx.folded[line];
      eachMatch(folded, COMPANY_SUFFIX, (m) => {
        const suffixRaw = text.slice(m.index, m.index + m[0].length);
        // Sufijo en mayúsculas («S.L.», «SL»), no «sa» dentro de una frase.
        if (!/^[A-Z]/.test(suffixRaw)) return;
        const before = text.slice(0, m.index);
        const words = [...before.matchAll(/[\p{L}\p{N}&][\p{L}\p{N}'’·&.-]*/gu)];
        let start = -1;
        let caps = 0;
        for (let k = words.length - 1, n = 0; k >= 0 && n < 6; k--, n++) {
          const w = words[k];
          const gap = text.slice(w.index! + w[0].length, k === words.length - 1 ? m.index : words[k + 1].index);
          if (/[:;]/.test(gap)) break;
          const f = fold(w[0]);
          if (/^\p{Lu}/u.test(w[0]) || /^\d/.test(w[0])) {
            if (STOP_LABEL.test(` ${f}`)) break;
            start = w.index!;
            if (/^\p{Lu}/u.test(w[0])) caps++;
          } else if (!COMPANY_CONNECTORS.has(f)) break;
        }
        if (start < 0 || caps === 0) return;
        out.push({ line, start, end: m.index + m[0].length });
      });
    });
    return out;
  },
};

/**
 * Datos con etiqueta explícita («DNI:», «IBAN», «Tel.:», «Email:») aunque no
 * pasen la validación. Pensado para el OCR: si lee «DNI: 128456787» (un 3 por
 * un 8), el dígito de control falla, pero la etiqueta deja claro qué es.
 */
const ID_LABEL_RULES: { label: RegExp; value: RegExp; category: (value: string, label: string) => Category; minDigits: number }[] = [
  {
    label: /(?:^|[\s(])(d\.?\s?n\.?\s?i\.?|n\.?\s?i\.?\s?f\.?|n\.?\s?i\.?\s?e\.?|c\.?\s?i\.?\s?f\.?|pasaporte|documento)\s*(?:n[º°o]\.?)?\s*[:;.,]?\s*/gu,
    value: /^(?:ES\s?)?[A-Za-z0-9](?:[\s.-]?[A-Za-z0-9]){6,10}(?![\p{L}\p{N}])/u,
    category: (value, label) => {
      if (/^c/.test(label)) return 'cif';
      return /^(?:ES\s?)?[ABCDEFGHJNPQRSUVW]/.test(value) ? 'cif' : 'dni';
    },
    minDigits: 5,
  },
  {
    label: /(?:^|\s)(iban|cuenta|c\/c|ccc|n[º°]\s?(?:de\s)?cuenta)\s*[:;.,]?\s*/gu,
    value: /^(?:[A-Z]{2}[0-9OI]{2}(?:[\s-]?[A-Z0-9]{2,4}){3,8}|\d{4}(?:[\s-]?\d){14,26})(?![\p{L}\p{N}])/u,
    category: () => 'iban',
    minDigits: 12,
  },
  {
    label: /(?:^|\s)(telefono|tel|tlf|telf|movil|fax|whatsapp)\.?\s*[:;,]?\s*/gu,
    value: /^\+?\(?\d[\d\s.\-()]{7,17}\d(?![\p{L}\p{N}])/u,
    category: () => 'telefono',
    minDigits: 9,
  },
  {
    label: /(?:^|\s)(e-?mail|correo(?: electronico)?)\s*[:;,]?\s*/gu,
    value: /^\S+(?:\s\S+){0,2}\.[A-Za-z]{2,}(?![\p{L}\p{N}])/u,
    category: () => 'email',
    minDigits: 0,
  },
];

export function findLabelledIds(ctx: RuleContext): { category: Category; span: Span }[] {
  const out: { category: Category; span: Span }[] = [];
  ctx.folded.forEach((folded, line) => {
    const text = ctx.index[line].text;
    for (const rule of ID_LABEL_RULES) {
      eachMatch(folded, new RegExp(rule.label.source, rule.label.flags), (m) => {
        let target = line;
        let start = m.index + m[0].length;
        // Etiqueta al final del tramo: el valor está a la derecha (tabulado) o debajo.
        if (text.slice(start).trim() === '') {
          const next = valueLineAfter(ctx, line, ctx.page.lines[line].box.x);
          if (next === null) return;
          target = next;
          start = 0;
        }
        const vm = rule.value.exec(ctx.index[target].text.slice(start));
        if (!vm) return;
        const value = vm[0];
        if ((value.match(/\d/g) ?? []).length < rule.minDigits) return;
        out.push({ category: rule.category(value, m[1]), span: { line: target, start, end: start + value.length } });
      });
    }
  });
  return out;
}

/** Orden de aplicación: primero lo validado con dígito de control. */
export const RULES: Rule[] = [
  email,
  iban,
  ccc,
  card,
  nie,
  klmNif,
  dni,
  cif,
  phoneIntl,
  phoneEs,
  plate,
  postalCode,
  address,
  honorific,
  company,
  dictionaryNames,
  emailOrWeb,
];
