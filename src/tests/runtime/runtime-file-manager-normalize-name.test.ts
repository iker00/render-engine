import { describe, expect, it } from 'vitest'
import { normalizeFileName } from '../../runtime/nodes/file-manager/normalize-file-name'

describe('normalizeFileName', () => {
  it('returns a simple name unchanged when there are no invalid characters', () => {
    expect(normalizeFileName('documento.pdf')).toBe('documento.pdf')
  })

  it('replaces Windows invalid characters with underscores', () => {
    expect(normalizeFileName('do:cu*mento?.pdf')).toBe('do_cu_mento_.pdf')
  })

  it('replaces all Windows invalid characters: \\ / : * ? " < > |', () => {
    expect(normalizeFileName('a\\b/c:d*e?f"g<h>i|j.txt')).toBe('a_b_c_d_e_f_g_h_i_j.txt')
  })

  it('trims trailing spaces from the full name', () => {
    expect(normalizeFileName('documento.pdf   ')).toBe('documento.pdf')
  })

  it('trims trailing dots from the full name', () => {
    expect(normalizeFileName('documento.pdf...')).toBe('documento.pdf')
  })

  it('trims trailing spaces and dots together', () => {
    expect(normalizeFileName('documento.pdf...  ')).toBe('documento.pdf')
  })

  it('replaces a Windows reserved name CON with archivo_1', () => {
    expect(normalizeFileName('CON.txt')).toBe('archivo_1.txt')
  })

  it('handles reserved name case-insensitively (com1 → archivo_1)', () => {
    expect(normalizeFileName('com1.log')).toBe('archivo_1.log')
  })

  it('handles reserved name PRN case-insensitively', () => {
    expect(normalizeFileName('prn.txt')).toBe('archivo_1.txt')
  })

  it('handles reserved name AUX', () => {
    expect(normalizeFileName('AUX.txt')).toBe('archivo_1.txt')
  })

  it('handles reserved name NUL', () => {
    expect(normalizeFileName('NUL.dat')).toBe('archivo_1.dat')
  })

  it('handles reserved names COM1 through COM9', () => {
    for (let i = 1; i <= 9; i++) {
      expect(normalizeFileName(`COM${i}.txt`)).toBe('archivo_1.txt')
    }
  })

  it('handles reserved names LPT1 through LPT9', () => {
    for (let i = 1; i <= 9; i++) {
      expect(normalizeFileName(`LPT${i}.txt`)).toBe('archivo_1.txt')
    }
  })

  it('does not treat a non-reserved name as reserved', () => {
    expect(normalizeFileName('CONSOLE.txt')).toBe('CONSOLE.txt')
  })

  it('truncates a very long base to produce a total length of exactly 255 preserving the extension', () => {
    const longBase = 'a'.repeat(300)
    const result = normalizeFileName(`${longBase}.pdf`)
    expect(result.length).toBe(255)
    expect(result.endsWith('.pdf')).toBe(true)
  })

  it('does not exceed 255 characters after truncation', () => {
    const longBase = 'b'.repeat(300)
    const result = normalizeFileName(`${longBase}.txt`)
    expect(result.length).toBeLessThanOrEqual(255)
  })

  it('prepends the prefix with underscore separator when prefix is provided', () => {
    expect(normalizeFileName('documento.pdf', 'EXP')).toBe('EXP_documento.pdf')
  })

  it('applies prefix after normalization', () => {
    expect(normalizeFileName('do:cu.pdf', 'EXP')).toBe('EXP_do_cu.pdf')
  })

  it('applies prefix AFTER truncation (final length may exceed 255)', () => {
    const longBase = 'a'.repeat(300)
    const normalized = normalizeFileName(`${longBase}.pdf`)
    // Truncation produces 255 chars, then prefix is prepended
    const withPrefix = normalizeFileName(`${longBase}.pdf`, 'EXP')
    expect(withPrefix).toBe('EXP_' + normalized)
    expect(withPrefix.length).toBe(255 + 4) // 'EXP_'.length === 4
  })

  it('handles a file without extension', () => {
    expect(normalizeFileName('doc_u')).toBe('doc_u')
  })

  it('replaces invalid characters in a file without extension', () => {
    expect(normalizeFileName('doc/u')).toBe('doc_u')
  })

  it('does not add a prefix when prefix is empty string', () => {
    expect(normalizeFileName('documento.pdf', '')).toBe('documento.pdf')
  })

  it('handles combination: invalid characters + spaces at end + reserved name', () => {
    // 'CON*.txt   ' → substitute * → 'CON_.txt   ' → trim → 'CON_.txt'
    // base after substitution is 'CON_' which does NOT match the reserved list
    // so it stays as 'CON_.txt'
    expect(normalizeFileName('CON*.txt   ')).toBe('CON_.txt')
  })

  it('handles the exact combination that produces archivo_1: CON substituted and trimmed base equals CON', () => {
    // 'CON.txt   ' → substitute (no invalids in base) → 'CON.txt   ' → trim → 'CON.txt'
    // base is 'CON' which IS reserved → archivo_1.txt
    expect(normalizeFileName('CON.txt   ')).toBe('archivo_1.txt')
  })

  it('separates base and extension by the LAST dot', () => {
    // 'archive.tar.gz' → base='archive.tar', ext='.gz'
    // No invalids; not reserved
    expect(normalizeFileName('archive.tar.gz')).toBe('archive.tar.gz')
  })

  it('handles invalid characters in the extension part', () => {
    // 'file.p?df' → ext='p?df' → 'p_df'
    expect(normalizeFileName('file.p?df')).toBe('file.p_df')
  })
})
