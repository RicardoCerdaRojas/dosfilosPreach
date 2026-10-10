import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HEBREW_BOOKS_CATALOG } from '@dosfilos/infrastructure';
import { BIBLE_BOOKS_ES, resolveBibleBook } from '@dosfilos/domain';
import { verseSuggestions } from '../buscarVersiculo';
import { VerseSearchInput } from '../VerseSearchInput';

/**
 * «Ir a versículo» del tutor de hebreo. En producción «Gn 2:17» no encontraba nada y el campo no
 * decía nada (prueba del fundador, 2026-10-10): sólo buscaba por el comienzo del nombre del catálogo,
 * con tildes exactas.
 */
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const primera = (q: string) => {
    const s = verseSuggestions(q, HEBREW_BOOKS_CATALOG)[0];
    return s && `${s.bookKey} ${s.chapter}:${s.verse}`;
};

describe('Ir a versículo — qué entiende', () => {
    it('las referencias del fundador y las abreviaturas en español', () => {
        expect(primera('Gn 2:17')).toBe('Gen 2:17');
        expect(primera('genesis 2:17')).toBe('Gen 2:17');
        expect(primera('Génesis 2:17')).toBe('Gen 2:17');
        expect(primera('Rt 1:7')).toBe('Ruth 1:7');
        expect(primera('Ex 3:14')).toBe('Exod 3:14');
        expect(primera('Éx 3:14')).toBe('Exod 3:14');
        expect(primera('1 S 3:4')).toBe('1Sam 3:4');
        expect(primera('1S 3:4')).toBe('1Sam 3:4');
        expect(primera('1 Sm 3:4')).toBe('1Sam 3:4'); // la tabla sólo tiene «1Sm», junto
        expect(primera('Sal 23:1')).toBe('Ps 23:1');
        expect(primera('Gn 2.17')).toBe('Gen 2:17');
        expect(primera('Gn 2 17')).toBe('Gen 2:17');
        expect(primera('Gn2:17')).toBe('Gen 2:17');
        // Abreviaturas que faltaban en la tabla común (revisión adversarial).
        expect([primera('Dn 9:24'), primera('Jr 1:5'), primera('Lm 3:22'), primera('Ct 2:1')]).toEqual(['Dan 9:24', 'Jer 1:5', 'Lam 3:22', 'Cant 2:1']);
        // Sin tildes: la tabla común sólo tiene «Ester».
        expect(primera('Éster 2:17')).toBe('Esth 2:17');
    });
    it('«Jon» es Jonás y «Job» es Job, aunque «Jo» sea el comienzo de varios', () => {
        expect(primera('Jon 1:1')).toBe('Jonah 1:1');
        expect(primera('Job 1:1')).toBe('Job 1:1');
        expect(verseSuggestions('Jo 1', HEBREW_BOOKS_CATALOG).length).toBeGreaterThan(1);
    });
    it('lo que se escribe a medias o de más: separador colgando, rango, letra, punto, punto y coma', () => {
        expect(primera('Gn 2:')).toBe('Gen 2:1');
        expect(primera('Sal 119:')).toBe('Ps 119:1');
        expect(primera('Gn 2:17-18')).toBe('Gen 2:17');
        expect(primera('Gn 2:17a')).toBe('Gen 2:17');
        expect(primera('Gn. 2:17')).toBe('Gen 2:17');
        expect(primera('Gn 2;17')).toBe('Gen 2:17');
    });
    it('en Abdías (un solo capítulo) el número suelto es el versículo, como en la tabla común', () => {
        expect(primera('Abd 5')).toBe('Obad 1:5');
        expect(primera('Abdías 5')).toBe('Obad 1:5');
        expect(primera('Abd 1:5')).toBe('Obad 1:5');
        expect(verseSuggestions('Abd 2:1', HEBREW_BOOKS_CATALOG)).toEqual([]);
    });
    it('una abreviatura de un libro del NT no lleva a otro del AT que empiece igual («Jud» es Judas, no Jueces)', () => {
        expect(verseSuggestions('Jud 1:1', HEBREW_BOOKS_CATALOG)).toEqual([]);
        expect(primera('Jue 1:1')).toBe('Judg 1:1');
        expect(primera('Judges 1:1')).toBe('Judg 1:1');
    });
    it('cada nombre y abreviatura de cada libro da ESE libro primero (si se agrega un alias que choca, falla aquí)', () => {
        const mal: string[] = [];
        for (const b of HEBREW_BOOKS_CATALOG) {
            const id = resolveBibleBook(b.nameSpanish)!.id;
            const alias = [b.nameSpanish, b.nameEnglish, b.abbreviation, b.morphhbKey, ...Object.entries(BIBLE_BOOKS_ES).filter(([, i]) => i === id).map(([k]) => k)];
            for (const a of alias) {
                const s = verseSuggestions(`${a} 1:1`, HEBREW_BOOKS_CATALOG)[0];
                if (s?.bookKey !== b.morphhbKey) mal.push(`${a} → ${s?.bookKey ?? '∅'} (esperaba ${b.morphhbKey})`);
            }
        }
        expect(mal).toEqual([]);
    });
    it('sin versículo, el 1; sólo el capítulo, el versículo 1', () => {
        expect(primera('Rut')).toBe('Ruth 1:1');
        expect(primera('Rut 2')).toBe('Ruth 2:1');
    });
    it('un capítulo que el libro no tiene, o un libro que no está en el AT: nada (no lleva a otro lugar)', () => {
        expect(verseSuggestions('Rt 5:1', HEBREW_BOOKS_CATALOG)).toEqual([]);
        expect(verseSuggestions('Jn 3:16', HEBREW_BOOKS_CATALOG)).toEqual([]);
        expect(verseSuggestions('G', HEBREW_BOOKS_CATALOG)).toEqual([]);
    });
    it('cada libro del catálogo se reconoce por la tabla común (si no, sus abreviaturas no funcionan)', () => {
        const sinTabla = HEBREW_BOOKS_CATALOG.filter(b => !resolveBibleBook(b.nameSpanish)).map(b => b.nameSpanish);
        expect(sinTabla).toEqual([]);
        const ids = HEBREW_BOOKS_CATALOG.map(b => resolveBibleBook(b.nameSpanish)!.id);
        expect(new Set(ids).size).toBe(HEBREW_BOOKS_CATALOG.length);
    });
});

describe('Ir a versículo — el campo', () => {
    const escribir = (q: string) => {
        const onNavigate = vi.fn();
        render(<VerseSearchInput onNavigate={onNavigate} />);
        const input = screen.getByLabelText('verseAnalyzer.verseSearch.label');
        fireEvent.change(input, { target: { value: q } });
        return { onNavigate, input };
    };
    it('Enter lleva a la primera sugerencia', () => {
        const { onNavigate, input } = escribir('Gn 2:17');
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onNavigate).toHaveBeenCalledWith('Gen', 2, 17);
    });
    it('Enter funciona aunque la lista se haya cerrado con Escape', () => {
        const { onNavigate, input } = escribir('Rt 1:7');
        fireEvent.keyDown(input, { key: 'Escape' });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onNavigate).toHaveBeenCalledWith('Ruth', 1, 7);
    });
    it('sin coincidencias, lo dice (antes no mostraba nada)', () => {
        const { onNavigate, input } = escribir('Hechos 2:1');
        expect(screen.getByTestId('verse-search-no-match')).toBeInTheDocument();
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onNavigate).not.toHaveBeenCalled();
    });
});
