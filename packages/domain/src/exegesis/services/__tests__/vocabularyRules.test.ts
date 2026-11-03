import { describe, expect, it } from 'vitest';
import { buildVocabularyBlock, vocabularyRules } from '../vocabularyRules';
import { buildAcademicRegisterBlock } from '../academicVoice';

/** Etapa 4.2 (B67): lo que el fundador corrigió a mano en el TI #2, en código para todo prompt. */
describe('la regla general de vocabulario', () => {
    it('académica: una nomenclatura, la palabra llana, «el salmista», «el SEÑOR», sin refutar, sin «sin + infinitivo»', () => {
        const r = vocabularyRules('es', 'academic').join('\n');
        expect(r).toContain('En hebreo, una sola nomenclatura');
        expect(r).toContain('«yiqtol (imperfecto)»');
        expect(r).toContain('«fuerza» y no «eficacia»');
        expect(r).toContain('«el salmista»');
        expect(r).toContain('No «el hablante»');
        expect(r).toContain('Tampoco «el creyente»');
        expect(r).toContain('si dice «el SEÑOR» para יהוה, no escribas «Yahweh»');
        expect(r).toContain('No refutes una lectura que ni el trabajo ni una fuente presentó');
        expect(r).not.toContain('sin + infinitivo');
        expect(r).toContain('hendíadis');
    });

    it('pastoral: la aplicación y refutar malas lecturas son de su oficio', () => {
        const r = vocabularyRules('es', 'pastoral').join('\n');
        expect(r).not.toContain('el creyente');
        expect(r).not.toContain('No refutes');
    });

    it('pastoral: sin términos de gramática ni siquiera explicados; no prohíbe «nosotros» (el grupo pequeño lo pide)', () => {
        const r = vocabularyRules('es', 'pastoral').join('\n');
        expect(r).toContain('Sin términos de gramática, ni siquiera explicados');
        expect(r).toContain('siempre traducida');
        expect(r).toContain('«el salmista»');
        expect(r).not.toContain('nomenclatura');
        expect(r).not.toContain('nosotros');
    });

    it('en inglés también, con su encabezado', () => {
        expect(buildVocabularyBlock('en', 'academic')).toMatch(/^VOCABULARY \(hard rules\):/);
        expect(buildVocabularyBlock('en', 'academic')).toContain('"the LORD" for יהוה');
        expect(buildVocabularyBlock('es', 'pastoral')).toMatch(/^VOCABULARIO \(reglas duras\):/);
    });

    it('el registro académico la lleva, y su ejemplo ya no enseña «se prefiere» (13 en el TI #2)', () => {
        for (const lang of ['es', 'en'] as const) {
            const bloque = buildAcademicRegisterBlock(lang);
            for (const regla of vocabularyRules(lang, 'academic')) expect(bloque).toContain(regla);
        }
        expect(buildAcademicRegisterBlock('es')).not.toContain('se prefiere');
        expect(buildAcademicRegisterBlock('en')).not.toContain('it is preferable');
    });
});
