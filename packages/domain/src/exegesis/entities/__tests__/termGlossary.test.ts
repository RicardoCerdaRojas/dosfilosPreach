import { describe, expect, it } from 'vitest';
import { countGlossaryHits, findGlossaryHits, type GlossaryTerm } from '../TermGlossary';

/** Los términos que el autor tachó a mano en su trabajo de Salmo 23. */
const GLOSARIO: GlossaryTerm[] = [
    { avoid: 'tronco', prefer: 'conjugación', note: 'No se entiende: nadie llama «tronco» a un binyan.' },
    { avoid: 'atestiguada', prefer: 'documentada' },
    { avoid: 'anclada' },
];

describe('findGlossaryHits', () => {
    it('encuentra el término aunque empiece oración en mayúscula', () => {
        const hits = findGlossaryHits('Atestiguada en los manuscritos antiguos.', GLOSARIO);
        expect(hits).toHaveLength(1);
        expect(hits[0]!.matched).toBe('Atestiguada');
        expect(hits[0]!.term.prefer).toBe('documentada');
    });

    it('encuentra la forma plural: «tronco» atrapa «troncos»', () => {
        expect(findGlossaryHits('Los troncos verbales del hebreo', GLOSARIO)).toHaveLength(1);
    });

    it('no salta dentro de otra palabra', () => {
        // «entronco» contiene «tronco» y no es el término del autor.
        expect(findGlossaryHits('El relato se entronca con el salmo', GLOSARIO)).toEqual([]);
    });

    it('compara sin tildes: «anclada» encuentra «ancladas»', () => {
        expect(findGlossaryHits('Las formas ancladas en el tiempo', GLOSARIO)).toHaveLength(1);
    });

    it('las posiciones sirven para cortar el texto ORIGINAL', () => {
        const texto = 'La raíz está atestiguada aquí';
        const hit = findGlossaryHits(texto, GLOSARIO)[0]!;
        expect(texto.slice(hit.at, hit.at + 'atestiguada'.length)).toBe('atestiguada');
    });

    it('trae el renglón donde cae, para reconocerlo sin abrir el documento', () => {
        const texto = 'Primer párrafo.\nEl tronco polel funciona como piel.\nTercero.';
        expect(findGlossaryHits(texto, GLOSARIO)[0]!.context).toBe('El tronco polel funciona como piel.');
    });

    it('un texto limpio no reporta nada', () => {
        expect(findGlossaryHits('La conjugación polel está documentada.', GLOSARIO)).toEqual([]);
    });

    it('un término de menos de tres letras se ignora: sería ruido', () => {
        expect(findGlossaryHits('de la casa', [{ avoid: 'de' }])).toEqual([]);
    });

    it('sin texto no hay nada que revisar', () => {
        expect(findGlossaryHits('', GLOSARIO)).toEqual([]);
    });
});

describe('countGlossaryHits', () => {
    it('cuenta por término, que es como el autor decide qué corregir', () => {
        const texto = 'El tronco piel y el tronco hifil; la forma está atestiguada.';
        const cuenta = countGlossaryHits(findGlossaryHits(texto, GLOSARIO));
        expect(cuenta.get('tronco')).toBe(2);
        expect(cuenta.get('atestiguada')).toBe(1);
    });
});
