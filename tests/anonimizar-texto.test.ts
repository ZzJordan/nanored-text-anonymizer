import { describe, expect, it } from 'vitest'
import { anonymize, detectInText, restore } from '@/lib/tools/text-anonymizer'

// Datos ficticios (DNI y IBAN de ejemplo con dígito de control válido).
const TEXT = 'Mi DNI es 12345678Z y mi IBAN ES9121000418450200051332. Escríbeme a ejemplo@correo.test.'

describe('text-anonymizer', () => {
  it('detecta DNI, IBAN y email', () => {
    const cats = detectInText(TEXT).map((e) => e.category)
    expect(cats).toContain('dni')
    expect(cats).toContain('iban')
    expect(cats).toContain('email')
  })
  it('sustituye por etiquetas y devuelve el texto original al restaurar', () => {
    const entities = detectInText(TEXT)
    const out = anonymize(TEXT, entities)
    expect(out.text).not.toContain('12345678Z')
    expect(out.text).not.toContain('ES9121000418450200051332')
    expect(out.text).toMatch(/\[DNI_1\]/)
    expect(restore(out.text, out.replacements)).toBe(TEXT)
  })
})
