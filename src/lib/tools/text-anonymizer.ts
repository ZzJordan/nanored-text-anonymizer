/**
 * Anonimizador de texto para usar ChatGPT sin dar datos (/herramientas/anonimizar-texto-chatgpt).
 *
 * Código puro (sin DOM ni red): detecta datos personales en texto plano, los sustituye por etiquetas
 * coherentes ([PERSONA_1], [DNI_1]…) y devuelve la tabla de equivalencias, que la página guarda solo
 * en memoria. Reutiliza las reglas del anonimizador de documentos (copiadas en ./detect desde
 * ZzJordan/nanored-anonimizador, MIT) y añade lo propio del texto corrido: fechas de nacimiento,
 * nombres tras un saludo y nombres frecuentes sueltos.
 */
import { detectPage } from './detect/detect'
import { FIRST_NAMES, SURNAMES } from './detect/names-data'
import { fold } from './detect/text'
import type { Category, PageText, TextLine } from './detect/types'

export type TextCategory = Category | 'fecha' | 'otro'

export const TEXT_CATEGORIES: readonly TextCategory[] = ['nombre', 'dni', 'cif', 'iban', 'tarjeta', 'email', 'telefono', 'direccion', 'cp', 'matricula', 'fecha', 'otro']

export interface TextEntity {
  category: TextCategory
  start: number
  end: number
  text: string
  /** true si lo añadió la persona a mano. */
  manual?: boolean
}

export type TagLanguage = 'es' | 'en'

const TAGS: Record<TagLanguage, Record<TextCategory | 'empresa', string>> = {
  es: { nombre: 'PERSONA', empresa: 'EMPRESA', dni: 'DNI', cif: 'CIF', iban: 'IBAN', tarjeta: 'TARJETA', email: 'EMAIL', telefono: 'TELEFONO', direccion: 'DIRECCION', cp: 'CODIGO_POSTAL', matricula: 'MATRICULA', fecha: 'FECHA_NACIMIENTO', otro: 'DATO' },
  en: { nombre: 'PERSON', empresa: 'COMPANY', dni: 'ID', cif: 'COMPANY_ID', iban: 'IBAN', tarjeta: 'CARD', email: 'EMAIL', telefono: 'PHONE', direccion: 'ADDRESS', cp: 'POSTCODE', matricula: 'PLATE', fecha: 'BIRTH_DATE', otro: 'DATA' },
}

/** Máximo de caracteres que se analizan (un correo o contrato largo cabe de sobra). */
export const MAX_TEXT_LENGTH = 60000

interface LineMap {
  offset: number
  wordStarts: number[]
}

/** Construye la «página» que esperan las reglas, guardando dónde empieza cada palabra en el texto original. */
function toPage(text: string): { page: PageText; maps: LineMap[] } {
  const lines: TextLine[] = []
  const maps: LineMap[] = []
  let offset = 0
  const rows = text.split('\n')
  rows.forEach((row, r) => {
    const words: TextLine['words'] = []
    const wordStarts: number[] = []
    const re = /\S+/g
    let m: RegExpExecArray | null
    while ((m = re.exec(row))) {
      words.push({ text: m[0], box: { x: m.index / 1000, y: r / Math.max(rows.length, 1), w: m[0].length / 1000, h: 0.5 / Math.max(rows.length, 1) } })
      wordStarts.push(m.index)
    }
    if (words.length) {
      const first = words[0].box
      const last = words[words.length - 1].box
      lines.push({ words, row: r, box: { x: first.x, y: first.y, w: last.x + last.w - first.x, h: first.h } })
      maps.push({ offset, wordStarts })
    }
    offset += row.length + 1
  })
  return { page: { lines }, maps }
}

/** Posición en el texto de la línea (palabras unidas por un espacio) → posición en el texto original. */
function mapOffset(line: TextLine, map: LineMap, pos: number, isEnd: boolean): number {
  let cursor = 0
  const n = line.words.length
  for (let i = 0; i < n; i++) {
    const len = line.words[i].text.length
    if (isEnd ? pos > cursor && pos <= cursor + len : pos >= cursor && pos < cursor + len) return map.offset + map.wordStarts[i] + (pos - cursor)
    if (isEnd && pos <= cursor && i > 0) return map.offset + map.wordStarts[i - 1] + line.words[i - 1].text.length
    cursor += len + 1
    if (!isEnd && pos < cursor && i + 1 < n) return map.offset + map.wordStarts[i + 1]
  }
  return map.offset + map.wordStarts[n - 1] + line.words[n - 1].text.length
}

const MONTHS = '(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december)'
const DATE = `(?:\\d{1,2}[/.\\-]\\d{1,2}[/.\\-](?:19|20)?\\d{2}|\\d{1,2}\\s+de\\s+${MONTHS}\\s+(?:de\\s+|del\\s+)?\\d{4}|\\d{1,2}\\s+${MONTHS}\\s+\\d{4}|${MONTHS}\\s+\\d{1,2},?\\s+\\d{4}|(?:19|20)\\d{2}-\\d{2}-\\d{2})`
const BIRTH_LABEL = '(?:fecha\\s+de\\s+nacimiento|f\\.?\\s*(?:de\\s+)?nac(?:imiento)?\\.?|nacid[oa]\\s+(?:el\\s+(?:d[ií]a\\s+)?)?|naci[oó]\\s+el|nacimiento|date\\s+of\\s+birth|d\\.?o\\.?b\\.?|born\\s+(?:on\\s+)?)'

/** Fechas de nacimiento: solo una fecha que va con su etiqueta («Fecha de nacimiento:», «nacida el»…). */
export function findBirthDates(text: string): TextEntity[] {
  const re = new RegExp(`${BIRTH_LABEL}\\s*[:\\-]?\\s*(${DATE})`, 'giu')
  const out: TextEntity[] = []
  for (const m of text.matchAll(re)) {
    const start = m.index! + m[0].length - m[1].length
    out.push({ category: 'fecha', start, end: start + m[1].length, text: m[1] })
  }
  return out
}

/** Nombres de pila que también son palabras corrientes o lugares: sueltos no se marcan. */
const AMBIGUOUS_FIRST = new Set(['rosa', 'victoria', 'pilar', 'aurora', 'gloria', 'mercedes', 'santiago', 'salvador', 'angel', 'jesus', 'consuelo', 'amparo', 'dolores', 'rosario', 'concepcion', 'encarnacion', 'martin', 'mateo', 'lucas', 'domingo', 'julio', 'clara', 'alba', 'marina', 'esperanza', 'paz', 'luz', 'mar', 'reyes', 'inmaculada', 'ines', 'sol', 'cesar', 'hector', 'oscar', 'jordan', 'paco', 'pepe', 'lola', 'pepa', 'marc', 'pau', 'joan', 'nacho', 'xavi'])
const CAP_WORD = "\\p{Lu}[\\p{Ll}'’]+(?:-\\p{Lu}[\\p{Ll}'’]+)?"
const NAME_CONNECTOR = '(?:\\s+(?:de|del|de\\s+la|de\\s+los|y|i)\\s+|\\s+)'

/**
 * Nombres en texto corrido:
 * - «Nombre Apellido(s)» cuando el nombre de pila está en la lista de frecuentes y le sigue otra palabra con mayúscula;
 * - un nombre frecuente suelto (Marta, Javier) salvo los que también son palabras corrientes;
 * - el nombre que va detrás de un saludo o despedida («Hola Lucía», «Estimado Sr. Pérez», «Dear John»).
 */
export function findNames(text: string): TextEntity[] {
  const out: TextEntity[] = []
  const nameRe = new RegExp(`(?<![\\p{L}\\p{N}])(${CAP_WORD})((?:${NAME_CONNECTOR}${CAP_WORD}){0,3})(?![\\p{L}\\p{N}])`, 'gu')
  for (const m of text.matchAll(nameRe)) {
    const first = fold(m[1])
    if (!FIRST_NAMES.has(first)) continue
    const rest = m[2]
    if (rest) {
      // Recorta palabras finales que no parecen apellido si no están en la lista y van tras punto.
      out.push({ category: 'nombre', start: m.index!, end: m.index! + m[0].length, text: m[0] })
    } else if (!AMBIGUOUS_FIRST.has(first)) {
      out.push({ category: 'nombre', start: m.index!, end: m.index! + m[1].length, text: m[1] })
    }
  }
  // Apellido frecuente tras tratamiento sin nombre («Sr. Pérez», «Dña. García»), por si la regla de tratamientos no lo cubre.
  const honorRe = new RegExp(`(?<![\\p{L}])(?:Sr|Sra|Srta|Dr|Dra|D|Dña|Don|Doña|Mr|Mrs|Ms|Miss)\\.?\\s+(${CAP_WORD}(?:${NAME_CONNECTOR}${CAP_WORD}){0,2})`, 'gu')
  for (const m of text.matchAll(honorRe)) {
    const start = m.index! + m[0].length - m[1].length
    out.push({ category: 'nombre', start, end: start + m[1].length, text: m[1] })
  }
  const greetRe = new RegExp(`(?<![\\p{L}])(?:Hola|Buenas|Buenos\\s+d[ií]as|Estimad[oa]s?|Querid[oa]s?|Apreciad[oa]s?|Dear|Hi|Hello)\\s*,?\\s+(${CAP_WORD}(?:${NAME_CONNECTOR}${CAP_WORD}){0,2})`, 'gu')
  for (const m of text.matchAll(greetRe)) {
    const value = m[1]
    if (/^(?:Sr|Sra|Srta|Dr|Dra|Don|Doña|Equipo|Señor|Señora|Señores|Sir|Madam|Team|All|Todos|Compañeros)$/u.test(value.split(/\s+/)[0])) continue
    const start = m.index! + m[0].length - value.length
    out.push({ category: 'nombre', start, end: start + value.length, text: value })
  }
  // Apellidos frecuentes en pareja («García López») aunque no haya nombre de pila delante.
  const pairRe = new RegExp(`(?<![\\p{L}\\p{N}])(${CAP_WORD})\\s+(${CAP_WORD})(?![\\p{L}\\p{N}])`, 'gu')
  for (const m of text.matchAll(pairRe)) {
    if (SURNAMES.has(fold(m[1])) && SURNAMES.has(fold(m[2]))) out.push({ category: 'nombre', start: m.index!, end: m.index! + m[0].length, text: m[0] })
  }
  return out
}

/** Firma tras una despedida («Un saludo,\nLucía Ejemplar»). */
export function findSignatures(text: string): TextEntity[] {
  const re = new RegExp(`(?:Un saludo|Saludos(?:\\s+cordiales)?|Atentamente|Un abrazo|Muchas gracias|Gracias|Cordialement|Best regards|Kind regards|Regards|Best|Cheers|Thanks|Many thanks)\\s*[,.!]?[ \\t]*\\n[ \\t]*(${CAP_WORD}(?:[ \\t]+${CAP_WORD}){0,3})[ \\t]*(?=\\n|$)`, 'gu')
  const out: TextEntity[] = []
  for (const m of text.matchAll(re)) {
    const start = m.index! + m[0].length - m[1].length
    out.push({ category: 'nombre', start, end: start + m[1].length, text: m[1] })
  }
  return out
}

const STREET_TYPE = "(?:[Cc]/|[Cc]\\.\\s?/|[Cc]alle|[Aa]vda\\.?|[Aa]v\\.|[Aa]venida|[Pp]laza|[Pp]za\\.?|[Pp]aseo|[Pp]º|[Cc]amino|[Cc]arretera|[Cc]tra\\.?|[Rr]onda|[Uu]rb\\.?|[Uu]rbanizaci[oó]n|[Tt]raves[ií]a|[Gg]lorieta|[Cc]allej[oó]n|[Pp]asaje|[Pp]ol\\.?\\s?[Ii]nd\\.?|[Pp]ol[ií]gono)"

/** Dirección en texto corrido: tipo de vía + nombre + número (y piso o puerta si los hay). */
export function findAddresses(text: string): TextEntity[] {
  const name = `(?:(?:de|del|de\\s+la|de\\s+los|de\\s+las|la|el|los|las)\\s+)?[\\p{Lu}0-9][\\p{L}'’.\\-]*(?:\\s+(?:(?:de|del|la|el|las|los|y)\\s+)?[\\p{Lu}][\\p{L}'’.\\-]*){0,4}`
  const num = `,?\\s*(?:n[º°o.]?\\s*)?(?:\\d+[A-Za-z]?|s/n)`
  const extra = `(?:\\s*,?\\s*(?:\\d+\\s*[º°ª]\\s*[A-Z]?(?![\\p{L}])|piso\\s+\\d+|planta\\s+\\d+|puerta\\s+\\w+|bajo(?:\\s+[A-Z](?![\\p{L}]))?|esc(?:alera)?\\.?\\s*\\w+|portal\\s+\\w+|nave\\s+\\w+))*`
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${STREET_TYPE}\\s+${name}${num}${extra}`, 'gu')
  const out: TextEntity[] = []
  for (const m of text.matchAll(re)) out.push({ category: 'direccion', start: m.index!, end: m.index! + m[0].length, text: m[0] })
  return out
}

/** El CP de las reglas de facturas se come el resto de la línea: en texto corrido se recorta a «29001 Málaga». */
function trimPostalCode(text: string, e: TextEntity): TextEntity {
  if (e.category !== 'cp') return e
  const m = /^\d{5}(?:[ ,]+\p{Lu}[\p{L}'’\-]*(?:\s+(?:(?:de|del|la|el|las|los)\s+)?\p{Lu}[\p{L}'’\-]*){0,3})?(?:\s*\([^)\n]*\))?/u.exec(e.text)
  if (!m || m[0].length === e.text.length) return e
  return { ...e, end: e.start + m[0].length, text: text.slice(e.start, e.start + m[0].length) }
}

function overlapsAny(e: TextEntity, list: TextEntity[]) {
  return list.some((o) => e.start < o.end && o.start < e.end)
}

/** Une detecciones: si dos se solapan, gana la más larga (a igualdad, la primera en la lista). */
function merge(groups: TextEntity[][]): TextEntity[] {
  const all = groups.flat().filter((e) => e.end > e.start)
  const kept: TextEntity[] = []
  const sorted = all
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (b.e.end - b.e.start) - (a.e.end - a.e.start) || a.i - b.i)
  for (const { e } of sorted) if (!overlapsAny(e, kept)) kept.push(e)
  return kept.sort((a, b) => a.start - b.start)
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Clave para reconocer el mismo dato escrito igual o casi igual (mayúsculas, tildes, espacios, guiones). */
export function valueKey(category: TextCategory, value: string): string {
  const f = fold(value).replace(/\s+/g, ' ').trim()
  if (['dni', 'cif', 'iban', 'tarjeta', 'telefono', 'matricula', 'cp'].includes(category)) return `${category}:${f.replace(/[\s.\-–—/()+]/g, '')}`
  return `${category === 'otro' ? 'otro' : category}:${f.replace(/[.,;:]+$/, '')}`
}

/** Busca el resto de apariciones de cada valor ya detectado o añadido a mano, para tratarlas igual. */
export function expandOccurrences(text: string, entities: TextEntity[]): TextEntity[] {
  const extra: TextEntity[] = []
  const seen = new Set<string>()
  for (const e of entities) {
    const value = e.text.trim()
    if (value.length < 2) continue
    const key = `${e.category}|${value.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(value)}(?![\\p{L}\\p{N}])`, 'giu')
    for (const m of text.matchAll(re)) {
      const cand: TextEntity = { category: e.category, start: m.index!, end: m.index! + m[0].length, text: m[0], manual: e.manual }
      if (!overlapsAny(cand, entities) && !overlapsAny(cand, extra)) extra.push(cand)
    }
  }
  return [...entities, ...extra].sort((a, b) => a.start - b.start)
}

/** Detecta datos personales en un texto. Devuelve tramos sin solapes, ordenados, con posiciones del texto original. */
export function detectInText(input: string): TextEntity[] {
  const text = input.slice(0, MAX_TEXT_LENGTH).replace(/\r/g, ' ')
  const { page, maps } = toPage(text)
  const fromRules: TextEntity[] = detectPage(page).map((d) => {
    const span = d.spans[0]
    const line = page.lines[span.line]
    const start = mapOffset(line, maps[span.line], span.start, false)
    const end = mapOffset(line, maps[span.line], span.end, true)
    return trimPostalCode(text, { category: d.category, start, end, text: text.slice(start, end) })
  })
  const merged = merge([findBirthDates(text), findAddresses(text), fromRules, findNames(text), findSignatures(text)])
  return expandOccurrences(text, merged)
}

const COMPANY_FORM = /(?:\bS\.?\s?L\.?(?:U\.?|L\.?|P\.?)?|\bS\.?\s?A\.?(?:U\.?)?|\bS\.?\s?Coop\.?|\bC\.?\s?B\.?|\bLtd\.?|\bLLC|\bGmbH|\bInc\.?)\s*$/i

export interface Replacement {
  tag: string
  value: string
  category: TextCategory
}

export interface AnonymizeResult {
  text: string
  replacements: Replacement[]
}

/**
 * Sustituye cada entidad por su etiqueta. El mismo dato (aunque cambie el formato) recibe siempre la misma
 * etiqueta. Las entidades deben venir sin solapes (las de `detectInText` y las añadidas con `addManual`).
 */
export function anonymize(text: string, entities: TextEntity[], lang: TagLanguage = 'es'): AnonymizeResult {
  const sorted = [...entities].sort((a, b) => a.start - b.start)
  const byKey = new Map<string, Replacement>()
  const counters = new Map<string, number>()
  let out = ''
  let cursor = 0
  for (const e of sorted) {
    if (e.start < cursor) continue
    const value = text.slice(e.start, e.end)
    const key = valueKey(e.category, value)
    let rep = byKey.get(key)
    if (!rep) {
      const base = e.category === 'nombre' && COMPANY_FORM.test(value) ? TAGS[lang].empresa : TAGS[lang][e.category]
      const n = (counters.get(base) ?? 0) + 1
      counters.set(base, n)
      rep = { tag: `[${base}_${n}]`, value, category: e.category }
      byKey.set(key, rep)
    }
    out += text.slice(cursor, e.start) + rep.tag
    cursor = e.end
  }
  out += text.slice(cursor)
  return { text: out, replacements: [...byKey.values()] }
}

/**
 * Devuelve los datos reales a un texto (la respuesta de ChatGPT). Acepta la etiqueta con corchetes y,
 * por si el asistente los quita, también sin ellos («PERSONA_1»). Nunca toca PERSONA_10 al buscar PERSONA_1.
 */
export function restore(text: string, replacements: Replacement[]): string {
  if (!replacements.length) return text
  const byTag = new Map(replacements.map((r) => [r.tag.slice(1, -1).toUpperCase(), r.value]))
  const names = [...byTag.keys()].sort((a, b) => b.length - a.length).map(escapeRe).join('|')
  const re = new RegExp(`\\[\\s*(${names})\\s*\\]|(?<![A-Za-z0-9_])(${names})(?![A-Za-z0-9_])`, 'gi')
  return text.replace(re, (_m, a?: string, b?: string) => byTag.get((a ?? b ?? '').toUpperCase()) ?? _m)
}

/**
 * Añade a mano un dato que falta: marca todas sus apariciones (sin distinguir mayúsculas) que no estén ya
 * marcadas. Devuelve la lista nueva, ordenada.
 */
export function addManual(text: string, entities: TextEntity[], value: string, category: TextCategory = 'otro'): TextEntity[] {
  const v = value.trim()
  if (!v) return entities
  const re = new RegExp(`${/^[\p{L}\p{N}]/u.test(v) ? '(?<![\\p{L}\\p{N}])' : ''}${escapeRe(v)}${/[\p{L}\p{N}]$/u.test(v) ? '(?![\\p{L}\\p{N}])' : ''}`, 'giu')
  const added: TextEntity[] = []
  for (const m of text.matchAll(re)) {
    const cand: TextEntity = { category, start: m.index!, end: m.index! + m[0].length, text: m[0], manual: true }
    // Si contiene detecciones automáticas más pequeñas, las sustituye.
    const inside = entities.filter((e) => e.start >= cand.start && e.end <= cand.end)
    const clash = entities.filter((e) => !inside.includes(e) && e.start < cand.end && cand.start < e.end)
    if (clash.length) continue
    entities = entities.filter((e) => !inside.includes(e))
    added.push(cand)
  }
  return [...entities, ...added].sort((a, b) => a.start - b.start)
}
