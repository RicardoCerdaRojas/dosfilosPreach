import { describe, expect, it } from 'vitest';
import { applyExportFinding, applyMechanicalExportFindings, reviewBeforeExport } from '../exportReview';

/**
 * Los casos son tramos reales de los Word entregados: medido sobre el texto
 * completo del TI #1 y del TI #2, la revisión marca exactamente estos y
 * ninguno más.
 */
const kinds = (t: string, keys: string[] = []) => reviewBeforeExport(t, { citationKeys: keys }).map(f => [f.kind, f.find, f.replace]);

describe('reviewBeforeExport — palabras sin tilde, de una lista cerrada', () => {
    it('REGRESIÓN TI #1 y TI #2: «lexico», «aqui», «versiculo»', () => {
        expect(kinds('נהל no tiene qal. El lexico registra solo un piel.')).toEqual([['accent', 'lexico', 'léxico']]);
        expect(kinds('pero el hebreo aqui no tiene un verbo.')).toEqual([['accent', 'aqui', 'aquí']]);
        expect(kinds('Así que el versiculo expresa que Dios honra.')).toEqual([['accent', 'versiculo', 'versículo']]);
    });

    it('conserva mayúsculas: «INVESTIGACION» → «INVESTIGACIÓN», «Analisis» → «Análisis»', () => {
        expect(kinds('TRABAJO DE INVESTIGACION')).toEqual([['accent', 'INVESTIGACION', 'INVESTIGACIÓN']]);
        expect(kinds('Analisis del texto.')).toEqual([['accent', 'Analisis', 'Análisis']]);
    });

    it('no marca palabras que existen sin tilde ni las que ya la llevan', () => {
        expect(kinds('Solo esta forma; mas aun, el titulo de la pagina, el numero que critica y termino. El léxico aquí.')).toEqual([]);
    });
});

describe('reviewBeforeExport — puntuación y paréntesis', () => {
    it('REGRESIÓN TI #2: «208..» → «208.»; los puntos suspensivos no se tocan', () => {
        expect(kinds('Craigie, Psalms 1–50, 208.. Ortiz')).toEqual([['double-period', '..', '.']]);
        expect(kinds('y así… o así... sigue.')).toEqual([]);
    });

    it('un paréntesis sin cerrar se avisa sin reemplazo', () => {
        const [f] = reviewBeforeExport('Uno (dos tres.\n\nOtro párrafo (bien).');
        expect(f!.kind).toBe('unbalanced-paren');
        expect(f!.replace).toBeNull();
        expect(reviewBeforeExport('Otro párrafo (bien).')).toEqual([]);
    });
});

describe('reviewBeforeExport — una sola nomenclatura (regla 22)', () => {
    const conPerfecto = (s: string) => `El perfecto דִּשַּׁנְתָּ y el imperfecto. ${s}`;

    it('REGRESIÓN TI #2: «qatal» y «weqatal» sin glosa, en un trabajo que dice perfecto', () => {
        expect(kinds(conPerfecto('el cambio a qatal en דִּשַּׁנְתָּ no es neutro.'))).toEqual([['nomenclature', 'qatal', 'perfecto']]);
        expect(kinds(conPerfecto('el retorno esperado (el weqatal וְשַׁבְתִּי).'))).toEqual([['nomenclature', 'weqatal', 'perfecto consecutivo']]);
    });

    it('«el weqatal consecutivo» → «el perfecto consecutivo», sin repetir «consecutivo»', () => {
        const [f] = reviewBeforeExport(conPerfecto('explican que el weqatal consecutivo adopta el sentido.'));
        expect(f!.replace).toBe('perfecto');
        expect(applyExportFinding(conPerfecto('explican que el weqatal consecutivo adopta el sentido.'), f!)).toContain('el perfecto consecutivo adopta');
    });

    it('glosado no se marca: «sujeto–yiqtol (sujeto seguido de imperfecto)»', () => {
        expect(kinds(conPerfecto('incluye el patrón sujeto–yiqtol (sujeto seguido de imperfecto) en esa categoría.'))).toEqual([]);
    });

    it('en un trabajo que no usa perfecto/imperfecto, la sigla es su nomenclatura y no se marca', () => {
        expect(kinds('El yiqtol de la cláusula y el qatal anterior.')).toEqual([]);
    });
});

describe('reviewBeforeExport — formas de autor', () => {
    it('REGRESIÓN TI #2: «Waltke-O’Connor» junto a «Waltke y O’Connor»', () => {
        expect(kinds('Waltke y O’Connor explican. Luego Waltke-O’Connor clasifica.')).toEqual([['author-form', 'Waltke-O’Connor', 'Waltke y O’Connor']]);
    });
    it('una forma sola con guion es un nombre (Nestle-Aland): no se marca', () => {
        expect(kinds('Según Nestle-Aland, la lectura es segura.')).toEqual([]);
    });
});

describe('reviewBeforeExport — dentro de una cita no se marca; los controles mecánicos sí afuera', () => {
    it('las páginas de una cita las maqueta el exportador', () => {
        expect(kinds('Lo dice Ross (Ross, pp. 567-568).', ['Ross'])).toEqual([]);
    });
    it('un rango con guion en la prosa sí: «Salmo 23:4-6» → raya corta', () => {
        expect(kinds('En Salmo 23:4-6 el salmista.')).toEqual([['hyphen-range', '23:4-6', '23:4–6']]);
    });
});

describe('applyExportFinding', () => {
    it('corrige en su lugar; si el texto cambió ahí, no toca nada', () => {
        const t = 'el hebreo aqui no tiene verbo; aqui sí.';
        const [primero] = reviewBeforeExport(t);
        expect(applyExportFinding(t, primero!)).toBe('el hebreo aquí no tiene verbo; aqui sí.');
        expect(applyExportFinding('otro texto distinto del revisado', primero!)).toBeNull();
    });
    it('un aviso sin reemplazo no se aplica', () => {
        const [f] = reviewBeforeExport('Uno (dos.');
        expect(applyExportFinding('Uno (dos.', f!)).toBeNull();
    });
});

describe('applyMechanicalExportFindings', () => {
    it('corrige todas las mecánicas y deja las que decide el estudiante', () => {
        const t = 'El perfecto y el qatal. El lexico dice aqui que 208.. y en Salmo 23:4-6 sigue.';
        const r = applyMechanicalExportFindings(t);
        expect(r.markdown).toBe('El perfecto y el qatal. El léxico dice aquí que 208. y en Salmo 23:4–6 sigue.');
        expect(r.applied).toBe(4);
        // La nomenclatura queda para el estudiante.
        expect(reviewBeforeExport(r.markdown).map(f => f.kind)).toEqual(['nomenclature']);
    });
});
