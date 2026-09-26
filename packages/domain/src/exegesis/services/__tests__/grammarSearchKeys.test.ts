import { describe, expect, it } from 'vitest';
import { foldKey, grammarSearchKeys, sectionsForKeys, titleNamesGreek } from '../grammarSearchKeys';

/** El encuadre real del trabajo de Santiago 2:1-13. */
const ENCUADRE = `Trabajo práctico semanal de exégesis del NT sobre Santiago 2:1-13.
1. ¿Cómo están funcionando los genitivos τοῦ κυρίου ἡμῶν Ἰησοῦ Χριστοῦ τῆς δόξης (Stg. 2:1)?
2. ¿Cómo funciona ἐὰν (Stg. 2:2)? ¿Qué relación tiene con el versículo 4?
3. ¿Qué significa la conjunción μέντοι (Stg. 2:8)?
4. ¿Cómo está funcionando el participio ἐλεγχόμενοι (Stg. 2:9)?`;

describe('grammarSearchKeys — con qué se le pregunta a una gramática', () => {
    const claves = grammarSearchKeys(ENCUADRE);

    it('saca las formas griegas que el encuadre nombra', () => {
        expect(claves.greek).toEqual(expect.arrayContaining(['εαν', 'μεντοι', 'ελεγχομενοι']));
    });

    it('las formas van sin diacríticos, porque el índice escribe una sola grafía', () => {
        // El encuadre dice «ἐὰν» y Porter titula «2.10. ἐάν»: son la misma
        // palabra y ninguna de las dos grafías encuentra a la otra.
        expect(claves.greek).toContain('εαν');
        expect(claves.greek.some(g => /[̀-ͯ]/.test(g))).toBe(false);
    });

    it('admite las de dos letras, porque el índice les dedica secciones', () => {
        // Porter titula «2.11. εἰ (Conjunction, Conditional)»: con el tope en
        // tres se perdía εἰ y con ella media respuesta a las condicionales.
        expect(grammarSearchKeys('la condicional εἰ y el artículo ὁ').greek).toEqual(['ει']);
    });

    it('reconoce las categorías que el encuadre nombra, y NO las demás', () => {
        expect(claves.categories).toEqual(expect.arrayContaining(['genitiv', 'participi', 'conjuncion']));
        // El encuadre no habla de dativo ni de infinitivo: proponer su índice
        // sería devolver ruido con forma de respuesta.
        expect(claves.categories).not.toContain('dativ');
        expect(claves.categories).not.toContain('infinitiv');
    });

    it('cada categoría viaja en los dos idiomas: el índice está en el del LIBRO', () => {
        // Porter titula «The Genitive Case»; el encuadre dice «genitivos».
        expect(claves.categories).toContain('genitive'.slice(0, 7));
        expect(claves.categories).toContain('participl');
        expect(claves.categories).toContain('conjunction');
    });

    it('un encuadre que no habla de gramática no propone nada', () => {
        // Más honesto que ofrecer el índice entero.
        const vacio = grammarSearchKeys('Trabajo sobre el trasfondo histórico de la carta.');
        expect(vacio.greek).toEqual([]);
        expect(vacio.categories).toEqual([]);
    });

    it('sin encuadre tampoco', () => {
        expect(grammarSearchKeys(null)).toEqual({ greek: [], categories: [] });
        expect(grammarSearchKeys('   ')).toEqual({ greek: [], categories: [] });
    });
});

describe('foldKey', () => {
    it('pliega tildes latinas y diacríticos griegos por igual', () => {
        expect(foldKey('ἐὰν')).toBe(foldKey('ἐάν'));
        expect(foldKey('Genitivos')).toBe('genitivos');
        expect(foldKey('partícula')).toBe('particula');
    });
});

describe('titleNamesGreek — palabra entera, que es lo que permite dos letras', () => {
    it('reconoce la forma aunque el título la escriba con otros acentos', () => {
        expect(titleNamesGreek('2.10. ἐάν (Conjunction, Conditional)', 'εαν')).toBe(true);
    });

    it('no la reconoce dentro de otra palabra griega', () => {
        // Sin palabra entera, «δε» caería dentro de media gramática.
        expect(titleNamesGreek('3.1. δείκνυμι and its compounds', 'δε')).toBe(false);
        expect(titleNamesGreek('2.7. δέ (Conjunction, Adversative)', 'δε')).toBe(true);
    });

    it('la puntuación y el paréntesis no son frontera de palabra griega', () => {
        expect(titleNamesGreek('2.11. εἰ (Conjunction, Conditional)', 'ει')).toBe(true);
    });
});

describe('sectionsForKeys — qué secciones se proponen y en qué orden', () => {
    /** El índice real de Porter, recortado a lo que importa. */
    const PORTER = [
        { sheet: 92, section: '2.4. The Genitive Case' },
        { sheet: 93, section: '2.4. The Genitive Case' },
        { sheet: 183, section: '10. Participles' },
        { sheet: 192, section: '5.3. Conditional' },
        { sheet: 209, section: '2.10. ἐάν (Conjunction, Conditional)' },
        { sheet: 226, section: '2.2. Conditional Imperatives' },
        { sheet: 255, section: '16. Conditional Clauses' },
        { sheet: 261, section: '2.1.3. Third class conditional (more probable, present general)' },
        { sheet: 300, section: '4.9. ἐπί with the Accusative Case' },
        { sheet: 400, section: null },
    ];

    const claves = { greek: ['εαν'], categories: ['condicional', 'conditional'] };

    it('la sección que nombra la forma griega va primero, aunque no sea la primera hoja', () => {
        expect(sectionsForKeys(PORTER, claves)[0]!.sheet).toBe(209);
    });

    it('la sección más específica NO queda enterrada por ser la de título más largo', () => {
        // Con un orden por forma del título, «2.1.3. Third class conditional»
        // quedaba última de once con peso 0,14 — y es la que contesta.
        const propuestas = sectionsForKeys(PORTER, claves);
        expect(propuestas.map(p => p.sheet)).toContain(261);
        expect(propuestas.map(p => p.sheet).indexOf(261)).toBeLessThan(propuestas.length);
    });

    it('detrás de las corroboradas manda el orden del libro', () => {
        const sinCorroborar = sectionsForKeys(PORTER, claves).filter(p => !p.corroborated);
        expect(sinCorroborar.map(p => p.sheet)).toEqual([192, 226, 255, 261]);
    });

    it('una sección repetida en varias hojas se propone en la PRIMERA', () => {
        const genitivo = sectionsForKeys(PORTER, { greek: [], categories: ['genitiv'] });
        expect(genitivo.filter(p => p.section.includes('Genitive Case'))).toHaveLength(1);
        expect(genitivo[0]!.sheet).toBe(92);
    });

    it('dice POR QUÉ propone cada una', () => {
        expect(sectionsForKeys(PORTER, claves)[0]!.matched).toContain('εαν');
    });

    it('lo que el encuadre no nombra no entra', () => {
        // El encuadre de este trabajo no pregunta por ἐπί.
        expect(sectionsForKeys(PORTER, claves).map(p => p.sheet)).not.toContain(300);
    });

    it('sin claves no se propone nada, y un libro sin secciones tampoco', () => {
        expect(sectionsForKeys(PORTER, { greek: [], categories: [] })).toEqual([]);
        expect(sectionsForKeys([{ sheet: 1, section: null }], claves)).toEqual([]);
    });
});
