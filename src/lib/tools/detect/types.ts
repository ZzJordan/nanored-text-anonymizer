/**
 * Tipos del módulo de detección. Es código puro: no toca el DOM ni la red,
 * así que se puede probar con Vitest sin navegador.
 *
 * Todas las coordenadas van normalizadas a la página (0..1), con origen
 * arriba a la izquierda. Así da igual a qué resolución se pinte o exporte.
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Una palabra con su caja, tal como sale de pdf.js o del OCR. */
export interface TextWord {
  text: string;
  box: Box;
}

/**
 * Un tramo de línea: palabras seguidas en horizontal, sin huecos grandes.
 * Una fila visual con dos columnas (emisor | cliente) se parte en dos tramos.
 */
export interface TextLine {
  words: TextWord[];
  /** Fila visual a la que pertenece (los tramos de la misma fila comparten índice). */
  row: number;
  box: Box;
}

export interface PageText {
  lines: TextLine[];
}

export const CATEGORIES = [
  'dni',
  'cif',
  'iban',
  'tarjeta',
  'email',
  'telefono',
  'cp',
  'matricula',
  'direccion',
  'nombre',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Un tramo de texto encontrado dentro de un tramo de línea. */
export interface Span {
  line: number;
  start: number;
  end: number;
}

export interface Detection {
  category: Category;
  /** Texto detectado (para la lista de revisión y los tests). */
  text: string;
  spans: Span[];
  /** Una caja por tramo de línea afectado. */
  boxes: Box[];
}

export interface DetectOptions {
  /** Categorías activas. Si se omite, todas. */
  categories?: Iterable<Category>;
}
