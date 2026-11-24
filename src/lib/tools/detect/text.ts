import type { Box, PageText, Span, TextLine } from './types';

/**
 * Pasa a minúsculas y quita tildes SIN cambiar la longitud del texto
 * (un carácter de entrada = un carácter de salida), para poder buscar
 * en el texto plegado y usar las mismas posiciones en el original.
 */
export function fold(text: string): string {
  let out = '';
  for (const ch of text) {
    const base = ch.normalize('NFD')[0] ?? ch;
    const lower = base.toLowerCase();
    // Si al bajar a minúsculas cambia la longitud (casos raros), se deja tal cual.
    out += lower.length === ch.length ? lower : ch;
  }
  return out;
}

/** Texto de un tramo de línea y posición [inicio, fin) de cada palabra en ese texto. */
export interface LineIndex {
  text: string;
  starts: number[];
  ends: number[];
}

export function indexLine(line: TextLine): LineIndex {
  let text = '';
  const starts: number[] = [];
  const ends: number[] = [];
  line.words.forEach((word, i) => {
    if (i > 0) text += ' ';
    starts.push(text.length);
    text += word.text;
    ends.push(text.length);
  });
  return { text, starts, ends };
}

export function indexPage(page: PageText): LineIndex[] {
  return page.lines.map(indexLine);
}

/**
 * Convierte un tramo de texto en una caja: une las cajas de las palabras que
 * toca y, si el tramo corta una palabra por la mitad (p. ej. «DNI:12345678Z»
 * en una sola palabra), estima la parte proporcional al número de caracteres.
 */
export function spanToBox(page: PageText, index: LineIndex[], span: Span): Box | null {
  const line = page.lines[span.line];
  const idx = index[span.line];
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  line.words.forEach((word, i) => {
    const ws = idx.starts[i];
    const we = idx.ends[i];
    if (we <= span.start || ws >= span.end) return;
    const len = Math.max(1, we - ws);
    const f0 = (Math.max(span.start, ws) - ws) / len;
    const f1 = (Math.min(span.end, we) - ws) / len;
    const bx0 = word.box.x + word.box.w * f0;
    const bx1 = word.box.x + word.box.w * f1;
    x0 = Math.min(x0, bx0);
    x1 = Math.max(x1, bx1);
    y0 = Math.min(y0, word.box.y);
    y1 = Math.max(y1, word.box.y + word.box.h);
  });
  if (!Number.isFinite(x0)) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Une varias cajas en la mínima caja que las contiene. */
export function unionBox(boxes: Box[]): Box {
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w));
  const y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Construye un PageText a partir de texto plano, con cajas ficticias
 * (una línea por fila, palabras de ancho proporcional). Pensado para tests
 * y para quien quiera usar el detector fuera del navegador.
 */
export function pageFromText(text: string): PageText {
  const rows = text.split('\n');
  const lineHeight = 1 / Math.max(rows.length, 1);
  const charWidth = 1 / 120;
  const lines = rows.map((row, r) => {
    const words: { text: string; box: Box }[] = [];
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(row))) {
      words.push({
        text: m[0],
        box: { x: m.index * charWidth, y: r * lineHeight, w: m[0].length * charWidth, h: lineHeight * 0.8 },
      });
    }
    const box = words.length ? unionBox(words.map((w) => w.box)) : { x: 0, y: r * lineHeight, w: 0, h: 0 };
    return { words, row: r, box };
  });
  return { lines: lines.filter((l) => l.words.length > 0) };
}
