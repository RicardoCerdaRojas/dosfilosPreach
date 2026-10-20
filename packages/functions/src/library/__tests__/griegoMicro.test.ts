import { describe, expect, it } from 'vitest';
import { normalizeGreekLookalikes, sanitizeExtractedText, describeSanitization } from '../sanitizeExtractedText';
import { unirPaginas } from '../loteDeExtraccion';

// Lo real: el léxico de Tuggy leído por visión (lote kittel-y-tuggy, 2026-10-20).
const conMicro = 'Γ γ γάµµα | µετακινέω, µεταλαµβάνω, µανθάνω';
const conMu = 'Γ γ γάμμα | μετακινέω, μεταλαμβάνω, μανθάνω';

describe('«µ» de micro en palabras griegas', () => {
    it('se cambia por la «μ» griega, también dos seguidas (γάµµα)', () => {
        expect(normalizeGreekLookalikes(conMicro)).toEqual({ text: conMu, fixed: 6 });
    });
    it('también entre paréntesis en la palabra, como cifra y junto a su mayúscula (casos reales de Tuggy)', () => {
        expect(normalizeGreekLookalikes('ἐμπί(µ)πλημι o ἐμπι(µ)πλάω').text).toBe('ἐμπί(μ)πλημι o ἐμπι(μ)πλάω');
        expect(normalizeGreekLookalikes('Como cifra, µ´ vale 40').text).toBe('Como cifra, μ´ vale 40');
        expect(normalizeGreekLookalikes('| Μ µ μύ |').text).toBe('| Μ μ μύ |');
        expect(normalizeGreekLookalikes('Μ, µ. Mu (μῦ)').text).toBe('Μ, μ. Mu (μῦ)');
    });
    it('al final de la palabra: los nombres semíticos (Ἀβραάμ, Ἰερουσαλήμ)', () => {
        expect(normalizeGreekLookalikes('Ἀβραάµ, Ἰερουσαλήµ. Βηθλεέµ').text).toBe('Ἀβραάμ, Ἰερουσαλήμ. Βηθλεέμ');
    });
    it('fuera del griego no se toca (un «5 µg»), y es idempotente', () => {
        expect(normalizeGreekLookalikes('Dosis de 5 µg diarios').fixed).toBe(0);
        expect(normalizeGreekLookalikes(conMu)).toEqual({ text: conMu, fixed: 0 });
    });
    it('el saneo de la extracción la aplica y lo informa', () => {
        const r = sanitizeExtractedText(conMicro);
        expect(r.text).toBe(conMu);
        expect(r.report.greekLookalikesFixed).toBe(6);
        expect(describeSanitization(r.report)).toContain('6 «µ» de micro');
    });
    it('el libro unido del lote ya sale corregido (comparar, aplicar, reponer)', () => {
        const u = unirPaginas([{ page: 1, text: conMicro, md: `**${conMicro}**` }]);
        expect(u.paginas[0]).toMatchObject({ text: conMu, md: `**${conMu}**` });
        expect(u.texto).toContain('μανθάνω');
        expect(u.markdown).not.toContain('µ');
    });
});

describe('la búsqueda trata «µ» como «μ» (libros indexados antes del arreglo)', async () => {
    const { lemmaKey, lemmaOccurrencesIn, occurrencesIn } = await import('../documentTextSearch');
    it('la clave del lema y la búsqueda por lema la encuentran', () => {
        expect(lemmaKey('µανθάνω')).toBe(lemmaKey('μανθάνω'));
        expect(lemmaOccurrencesIn('Ver µανθάνω, aprender.', lemmaKey('μανθάνω')).length).toBe(1);
    });
    it('la búsqueda de texto también', () => {
        expect(occurrencesIn('Ver µανθάνω, aprender.', 'μανθανω').length + occurrencesIn('Ver µανθάνω, aprender.', 'μανθάνω').length).toBeGreaterThan(0);
    });
});
