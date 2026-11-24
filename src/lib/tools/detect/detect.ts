import { RULES, findLabelled, findLabelledIds, type RuleContext } from './rules';
import { fold, indexPage, spanToBox } from './text';
import { CATEGORIES, type Box, type Category, type DetectOptions, type Detection, type PageText, type Span } from './types';

function makeContext(page: PageText): RuleContext {
  const index = indexPage(page);
  return { page, index, folded: index.map((i) => fold(i.text)) };
}

interface Found {
  category: Category;
  span: Span;
  strict: boolean;
}

function overlaps(a: Span, b: Span): boolean {
  return a.line === b.line && a.start < b.end && b.start < a.end;
}

function contains(a: Span, b: Span): boolean {
  return a.line === b.line && a.start <= b.start && a.end >= b.end;
}

/**
 * Detecta datos personales en una página. Devuelve una detección por tramo
 * encontrado, con su caja (o cajas) en coordenadas normalizadas.
 */
export function detectPage(page: PageText, options: DetectOptions = {}): Detection[] {
  const enabled = new Set<Category>(options.categories ?? CATEGORIES);
  const ctx = makeContext(page);
  const found: Found[] = [];

  const add = (category: Category, span: Span, strict: boolean) => {
    if (span.end <= span.start) return;
    // Lo que ya encontró una regla estricta no se vuelve a detectar por dentro.
    if (found.some((f) => f.strict && contains(f.span, span))) return;
    // Una regla de respaldo no repite (más larga o más corta) lo ya validado de su tipo.
    if (!strict && found.some((f) => f.strict && f.category === category && overlaps(f.span, span))) return;
    if (found.some((f) => f.category === category && contains(f.span, span))) return;
    found.push({ category, span, strict });
  };

  // Todas las reglas se ejecutan aunque su categoría esté desactivada, para que
  // p. ej. un IBAN desactivado no acabe detectado como teléfono.
  for (const rule of RULES) {
    for (const span of rule.find(ctx)) add(rule.category, span, rule.strict);
  }
  // Datos con etiqueta que no pasan la validación (típico del OCR): solo si no
  // se solapan con algo ya validado de la misma categoría.
  for (const { category, span } of findLabelledIds(ctx)) {
    if (found.some((f) => f.category === category && overlaps(f.span, span))) continue;
    add(category, span, false);
  }
  for (const { category, span } of findLabelled(ctx)) add(category, span, false);

  const detections: Detection[] = [];
  for (const f of found) {
    if (!enabled.has(f.category)) continue;
    const box = spanToBox(page, ctx.index, f.span);
    if (!box) continue;
    detections.push({
      category: f.category,
      text: ctx.index[f.span.line].text.slice(f.span.start, f.span.end),
      spans: [f.span],
      boxes: [box],
    });
  }
  return detections;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Busca un texto en la página (sin distinguir mayúsculas ni tildes) y devuelve
 * la caja de cada aparición. Con 5 caracteres o más tolera espacios, puntos o
 * guiones intercalados, para encontrar «ES9121000418…» aunque esté agrupado.
 */
export function findText(page: PageText, query: string): { text: string; box: Box; span: Span }[] {
  const q = fold(query.trim()).replace(/\s+/g, ' ');
  if (!q) return [];
  const flexible = q.replace(/\s/g, '').length >= 5;
  const chars = [...q];
  const body = chars
    .map((ch, i) => {
      if (ch === ' ') return '\\s+';
      const sep = flexible && i < chars.length - 1 && chars[i + 1] !== ' ' ? '[\\s.\\-]?' : '';
      return escapeRegExp(ch) + sep;
    })
    .join('');
  const startB = /^[\p{L}\p{N}]/u.test(q) ? '(?<![\\p{L}\\p{N}])' : '';
  const endB = /[\p{L}\p{N}]$/u.test(q) ? '(?![\\p{L}\\p{N}])' : '';
  const re = new RegExp(`${startB}${body}${endB}`, 'gu');
  const ctx = makeContext(page);
  const out: { text: string; box: Box; span: Span }[] = [];
  ctx.folded.forEach((folded, line) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(folded))) {
      const span = { line, start: m.index, end: m.index + m[0].length };
      const box = spanToBox(page, ctx.index, span);
      if (box) out.push({ text: ctx.index[line].text.slice(span.start, span.end), box, span });
      if (m[0].length === 0) re.lastIndex++;
    }
  });
  return out;
}
