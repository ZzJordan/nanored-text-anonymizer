'use client'

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Copy, Eraser, Plus } from 'lucide-react'
import type { Language } from '@/lib/translations'
import type { TextCategory, TextEntity } from '@/lib/tools/text-anonymizer'
import { trackEvent } from '@/lib/analytics'
import { useCopy } from './use-copy'

type Engine = typeof import('@/lib/tools/text-anonymizer')

/**
 * Anonimizador de texto. Todo ocurre en el navegador: el texto, las detecciones y la tabla de equivalencias
 * viven solo en el estado de React (memoria de la pestaña). No se guardan en el almacenamiento del navegador ni se envían a nada;
 * la analítica solo recibe qué botón se pulsó (tool_action). El motor de detección se carga al pegar texto.
 */
const copy = {
  es: {
    input: 'Texto original',
    inputHint: 'Pega un correo, contrato, informe o conversación. No sale de tu navegador.',
    placeholder: 'Hola Marta,\nTe paso los datos de Javier Ruiz Moreno (DNI 12345678Z, tel. 600 000 000) para el contrato…',
    tooLong: (max: number) => `Solo se analizan los primeros ${max.toLocaleString('es-ES')} caracteres.`,
    loading: 'Preparando la detección…',
    foundTitle: 'Datos encontrados',
    foundHint: 'Desmarca lo que no quieras ocultar. Cada dato se sustituye en todas sus apariciones.',
    none: 'No se ha detectado ningún dato personal. Revisa el texto y añade a mano lo que haga falta.',
    count: (n: number) => (n === 1 ? '1 dato distinto' : `${n} datos distintos`),
    times: (n: number) => (n > 1 ? `${n} veces` : ''),
    manual: 'a mano',
    addTitle: 'Añadir un dato que falte',
    addLabel: 'Dato a ocultar',
    addPlaceholder: 'Un nombre, empresa, proyecto…',
    addCategory: 'Tipo',
    add: 'Añadir',
    useSelection: 'Usar lo seleccionado',
    addNotFound: 'Ese texto no aparece tal cual en el original (o ya está dentro de otro dato marcado).',
    outputTitle: 'Texto anonimizado',
    outputHint: 'Cópialo y pégalo en ChatGPT, Claude o Gemini. Pídele que mantenga las etiquetas entre corchetes.',
    copyOutput: 'Copiar texto anonimizado',
    tableTitle: 'Tabla de equivalencias (solo en esta pestaña)',
    tableHint: 'Se borra al cerrar o recargar la página. No la pegues en el asistente.',
    tag: 'Etiqueta',
    value: 'Dato real',
    restoreTitle: 'Devolver los datos reales',
    restoreLabel: 'Respuesta del asistente',
    restoreHint: 'Pega aquí la respuesta de ChatGPT: las etiquetas se cambian por los datos originales.',
    restorePlaceholder: 'Pega la respuesta con [PERSONA_1], [DNI_1]…',
    restored: 'Respuesta con los datos reales',
    copyRestored: 'Copiar respuesta',
    leftover: (tags: string) => `Etiquetas sin equivalencia en esta pestaña: ${tags}. Revisa si el asistente las cambió.`,
    clear: 'Borrar todo',
    copied: 'Copiado',
    copyError: 'No se ha podido copiar: selecciónalo y cópialo a mano.',
    warning: 'La detección no es perfecta: revisa el texto anonimizado antes de pegarlo. Lo que no se marque seguirá ahí.',
    cats: { nombre: 'Persona o empresa', dni: 'DNI / NIE', cif: 'CIF', iban: 'Cuenta (IBAN)', tarjeta: 'Tarjeta', email: 'Email o web', telefono: 'Teléfono', direccion: 'Dirección', cp: 'Código postal', matricula: 'Matrícula', fecha: 'Fecha de nacimiento', otro: 'Otro dato' } satisfies Record<TextCategory, string>,
  },
  en: {
    input: 'Original text',
    inputHint: 'Paste an email, contract, report or conversation. It never leaves your browser.',
    placeholder: 'Hi Marta,\nHere are the details of Javier Ruiz Moreno (DNI 12345678Z, phone 600 000 000) for the contract…',
    tooLong: (max: number) => `Only the first ${max.toLocaleString('en-GB')} characters are analysed.`,
    loading: 'Getting detection ready…',
    foundTitle: 'Data found',
    foundHint: 'Untick anything you do not want to hide. Each item is replaced wherever it appears.',
    none: 'No personal data detected. Review the text and add anything needed by hand.',
    count: (n: number) => (n === 1 ? '1 distinct item' : `${n} distinct items`),
    times: (n: number) => (n > 1 ? `${n} times` : ''),
    manual: 'added by hand',
    addTitle: 'Add missing data',
    addLabel: 'Data to hide',
    addPlaceholder: 'A name, company, project…',
    addCategory: 'Type',
    add: 'Add',
    useSelection: 'Use selection',
    addNotFound: 'That text does not appear exactly in the original (or it is already inside another marked item).',
    outputTitle: 'Anonymised text',
    outputHint: 'Copy it and paste it into ChatGPT, Claude or Gemini. Ask it to keep the bracketed tags unchanged.',
    copyOutput: 'Copy anonymised text',
    tableTitle: 'Lookup table (this tab only)',
    tableHint: 'It is deleted when you close or reload the page. Do not paste it into the assistant.',
    tag: 'Tag',
    value: 'Real data',
    restoreTitle: 'Put the real data back',
    restoreLabel: 'Assistant’s answer',
    restoreHint: 'Paste ChatGPT’s answer here: the tags are swapped for the original data.',
    restorePlaceholder: 'Paste the answer with [PERSON_1], [ID_1]…',
    restored: 'Answer with the real data',
    copyRestored: 'Copy answer',
    leftover: (tags: string) => `Tags with no match in this tab: ${tags}. Check whether the assistant changed them.`,
    clear: 'Clear everything',
    copied: 'Copied',
    copyError: 'Could not copy: select it and copy it by hand.',
    warning: 'Detection is not perfect: review the anonymised text before pasting it. Anything not marked stays in.',
    cats: { nombre: 'Person or company', dni: 'Spanish ID', cif: 'Company tax ID', iban: 'Account (IBAN)', tarjeta: 'Card', email: 'Email or web', telefono: 'Phone', direccion: 'Address', cp: 'Postcode', matricula: 'Number plate', fecha: 'Date of birth', otro: 'Other data' } satisfies Record<TextCategory, string>,
  },
} as const

const MANUAL_CATEGORIES: TextCategory[] = ['otro', 'nombre', 'direccion', 'telefono', 'email', 'dni', 'iban', 'fecha']

interface Group {
  key: string
  category: TextCategory
  value: string
  count: number
  manual: boolean
}

export function TextAnonymizerTool({ language }: { language: Language }) {
  const t = copy[language]
  const id = useId()
  const [engine, setEngine] = useState<Engine | null>(null)
  const [text, setText] = useState('')
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set())
  const [manual, setManual] = useState<{ value: string; category: TextCategory }[]>([])
  const [addValue, setAddValue] = useState('')
  const [addCategory, setAddCategory] = useState<TextCategory>('otro')
  const [addMissing, setAddMissing] = useState(false)
  const [answer, setAnswer] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { copied, copy: copyText } = useCopy()
  const deferred = useDeferredValue(text)

  useEffect(() => {
    if (engine || !text) return
    let cancelled = false
    import('@/lib/tools/text-anonymizer').then((mod) => { if (!cancelled) setEngine(mod) }).catch(() => {})
    return () => { cancelled = true }
  }, [engine, text])

  const analysed = engine ? deferred.slice(0, engine.MAX_TEXT_LENGTH) : ''

  const all: TextEntity[] = useMemo(() => {
    if (!engine || !analysed) return []
    let list = engine.detectInText(analysed)
    for (const m of manual) list = engine.addManual(analysed, list, m.value, m.category)
    return list
  }, [engine, analysed, manual])

  const groups: Group[] = useMemo(() => {
    if (!engine) return []
    const map = new Map<string, Group>()
    for (const e of all) {
      const key = engine.valueKey(e.category, e.text)
      const g = map.get(key)
      if (g) { g.count++; g.manual ||= !!e.manual } else map.set(key, { key, category: e.category, value: e.text, count: 1, manual: !!e.manual })
    }
    return [...map.values()]
  }, [engine, all])

  const active = useMemo(() => (engine ? all.filter((e) => !excluded.has(engine.valueKey(e.category, e.text))) : []), [engine, all, excluded])
  const result = useMemo(() => (engine && analysed ? engine.anonymize(analysed, active, language) : { text: '', replacements: [] }), [engine, analysed, active, language])
  const tagByKey = useMemo(() => {
    const m = new Map<string, string>()
    if (engine) for (const r of result.replacements) m.set(engine.valueKey(r.category, r.value), r.tag)
    return m
  }, [engine, result])
  const restored = useMemo(() => (engine && answer ? engine.restore(answer, result.replacements) : ''), [engine, answer, result])
  const leftover = useMemo(() => {
    if (!restored) return []
    return [...new Set(restored.match(/\[[A-Z][A-Z_]*_\d+\]/g) ?? [])]
  }, [restored])

  const toggle = (key: string) => setExcluded((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next })
  const addData = () => {
    const value = addValue.trim()
    if (!value || !engine) return
    const before = all.length
    const after = engine.addManual(analysed, all, value, addCategory)
    if (after.length === before && !after.some((e) => e.manual && e.text.toLowerCase() === value.toLowerCase())) { setAddMissing(true); return }
    setAddMissing(false)
    setManual((prev) => [...prev, { value, category: addCategory }])
    setExcluded((prev) => { const next = new Set(prev); next.delete(engine.valueKey(addCategory, value)); return next })
    setAddValue('')
  }
  const useSelection = () => {
    const el = inputRef.current
    if (!el) return
    const selected = el.value.slice(el.selectionStart, el.selectionEnd).trim()
    if (selected) { setAddValue(selected.slice(0, 120)); setAddMissing(false) }
  }
  const clearAll = () => { setText(''); setAnswer(''); setManual([]); setExcluded(new Set()); setAddValue(''); setAddMissing(false) }
  const status = (key: string) => (copied === key ? t.copied : copied === `${key}:error` ? t.copyError : '')

  return (
    <div className="tool-panel">
      <div className="tool-grid">
        <div>
          <label className="lead-label" htmlFor={`${id}-input`}>{t.input}</label>
          <textarea
            id={`${id}-input`} ref={inputRef} className="lead-input min-h-64 resize-y" rows={10} value={text}
            onChange={(e) => setText(e.target.value)} placeholder={t.placeholder} spellCheck={false} autoComplete="off"
            aria-describedby={`${id}-input-hint`}
          />
          <p id={`${id}-input-hint`} className="tool-hint">{t.inputHint}{engine && text.length > engine.MAX_TEXT_LENGTH ? ` ${t.tooLong(engine.MAX_TEXT_LENGTH)}` : ''}</p>
        </div>

        <div>
          <label className="lead-label" htmlFor={`${id}-output`}>{t.outputTitle}</label>
          <textarea id={`${id}-output`} className="lead-input min-h-64 resize-y" rows={10} readOnly value={result.text} aria-describedby={`${id}-output-hint`} />
          <p id={`${id}-output-hint`} className="tool-hint">{text && !engine ? t.loading : t.outputHint}</p>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <button type="button" className="conversion-button" disabled={!result.text} onClick={() => { copyText('output', result.text); trackEvent('tool_action', { tool: 'anonimizar_texto', action: 'copy_text' }) }}>
              <Copy className="w-4 h-4" aria-hidden="true" />{t.copyOutput}
            </button>
            <button type="button" className="tool-button" onClick={clearAll} disabled={!text && !answer}>
              <Eraser className="w-4 h-4" aria-hidden="true" />{t.clear}
            </button>
          </div>
          <p className="tool-status" role="status">{status('output')}</p>
        </div>
      </div>

      <p className="tool-warning">{t.warning}</p>

      {text && engine ? (
        <section className="tool-result" aria-labelledby={`${id}-found`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id={`${id}-found`} className="tool-subtitle">{t.foundTitle}</h3>
            <p className="tool-hint" aria-live="polite">{t.count(groups.length)}</p>
          </div>
          <p className="tool-hint">{groups.length ? t.foundHint : t.none}</p>
          {groups.length ? (
            <ul className="tool-found">
              {groups.map((g) => {
                const on = !excluded.has(g.key)
                return (
                  <li key={g.key}>
                    <label className="tool-found-item">
                      <input type="checkbox" checked={on} onChange={() => toggle(g.key)} />
                      <span className="tool-found-cat">{t.cats[g.category]}{g.manual ? ` · ${t.manual}` : ''}</span>
                      <span className="tool-found-value">{g.value}</span>
                      <span className="tool-found-tag">{on ? tagByKey.get(g.key) ?? '' : '—'}{g.count > 1 ? ` · ${t.times(g.count)}` : ''}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          ) : null}

          <fieldset className="tool-add">
            <legend className="tool-subtitle">{t.addTitle}</legend>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_auto] items-end">
              <div>
                <label className="lead-label" htmlFor={`${id}-add`}>{t.addLabel}</label>
                <input id={`${id}-add`} className="lead-input" value={addValue} maxLength={120} placeholder={t.addPlaceholder}
                  onChange={(e) => { setAddValue(e.target.value); setAddMissing(false) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addData() } }}
                  aria-describedby={`${id}-add-error`} aria-invalid={addMissing || undefined} />
              </div>
              <div>
                <label className="lead-label" htmlFor={`${id}-add-cat`}>{t.addCategory}</label>
                <select id={`${id}-add-cat`} className="lead-input" value={addCategory} onChange={(e) => setAddCategory(e.target.value as TextCategory)}>
                  {MANUAL_CATEGORIES.map((c) => <option key={c} value={c}>{t.cats[c]}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="tool-button" onClick={useSelection}>{t.useSelection}</button>
                <button type="button" className="tool-button" onClick={addData} disabled={!addValue.trim()}><Plus className="w-4 h-4" aria-hidden="true" />{t.add}</button>
              </div>
            </div>
            <p id={`${id}-add-error`} className="tool-error" role="alert">{addMissing ? t.addNotFound : ''}</p>
          </fieldset>

          {result.replacements.length ? (
            <details className="tool-table">
              <summary>{t.tableTitle}</summary>
              <p className="tool-hint">{t.tableHint}</p>
              <div className="overflow-x-auto">
                <table>
                  <thead><tr><th scope="col">{t.tag}</th><th scope="col">{t.value}</th></tr></thead>
                  <tbody>{result.replacements.map((r) => <tr key={r.tag}><td className="font-mono">{r.tag}</td><td>{r.value}</td></tr>)}</tbody>
                </table>
              </div>
            </details>
          ) : null}
        </section>
      ) : null}

      <section className="tool-result" aria-labelledby={`${id}-restore`}>
        <h3 id={`${id}-restore`} className="tool-subtitle">{t.restoreTitle}</h3>
        <div className="tool-grid">
          <div>
            <label className="lead-label" htmlFor={`${id}-answer`}>{t.restoreLabel}</label>
            <textarea id={`${id}-answer`} className="lead-input min-h-48 resize-y" rows={8} value={answer} maxLength={120000}
              onChange={(e) => setAnswer(e.target.value)} placeholder={t.restorePlaceholder} spellCheck={false}
              onPaste={() => trackEvent('tool_action', { tool: 'anonimizar_texto', action: 'restore' })}
              aria-describedby={`${id}-answer-hint`} />
            <p id={`${id}-answer-hint`} className="tool-hint">{t.restoreHint}</p>
          </div>
          <div>
            <label className="lead-label" htmlFor={`${id}-restored`}>{t.restored}</label>
            <textarea id={`${id}-restored`} className="lead-input min-h-48 resize-y" rows={8} readOnly value={restored} />
            {leftover.length ? <p className="tool-error">{t.leftover(leftover.join(', '))}</p> : null}
            <button type="button" className="conversion-button mt-3" disabled={!restored} onClick={() => { copyText('restored', restored); trackEvent('tool_action', { tool: 'anonimizar_texto', action: 'copy_restored' }) }}>
              <Copy className="w-4 h-4" aria-hidden="true" />{t.copyRestored}
            </button>
            <p className="tool-status" role="status">{status('restored')}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
