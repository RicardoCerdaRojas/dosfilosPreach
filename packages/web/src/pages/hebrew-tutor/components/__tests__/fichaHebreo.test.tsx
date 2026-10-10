import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import {
    HEBREW_INFINITIVE_RULES, HEBREW_INFINITIVE_SOURCES, HEBREW_KI_RULES, HEBREW_KI_SOURCES, HEBREW_PARTICIPLE_RULES, HEBREW_PARTICIPLE_SOURCES,
    type WordAnalysis,
} from '@dosfilos/domain';
import es from '@/i18n/locales/es/hebrewTutor.json';
import en from '@/i18n/locales/en/hebrewTutor.json';
import esLs from '@/i18n/locales/es/languageStructure.json';
import enLs from '@/i18n/locales/en/languageStructure.json';

/**
 * La ficha de palabra del hebreo (rediseño): la PRUEBA DE PARIDAD — ningún dato
 * que antes mostraban la tarjeta, el tooltip o el panel «Tutor interactivo» se
 * pierde — y el comportamiento del bloque de función (regla, asistente, otra
 * lectura, opciones), que antes probaban las notas del infinitivo, el
 * participio y כִּי.
 */
vi.mock('react-i18next', () => ({
    // `exists`: un valor fuera del catálogo («DESCONOCIDO…») no tiene traducción.
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k), i18n: { language: 'es', exists: (k: string) => !k.includes('DESCONOCIDO') } }),
}));
const { BLOQUES_HEBREO, DESTINO_NOMBRE, DESTINO_PALABRA, DESTINO_VERBO } = await import('../../ficha/bloquesHebreo');
const { FichaCompleta, FichaResumen } = await import('@/components/word-ficha/Ficha');
const { TarjetasResumenHebreo } = await import('../FichasHebreo');
const { FichaPanel } = await import('@/components/word-ficha/Ficha');

/** Una palabra con TODOS los campos llenos, cada uno con un valor reconocible. */
const PALABRA: WordAnalysis = {
    hebrewText: 'אֲכָלְךָ',
    transliteration: 'TRANSLIT-ʾăḵolḵā',
    root: 'אכל',
    rootTransliteration: 'RAIZ-TR-ʾ-k-l',
    rootMeaning: 'SIGNIFICADO-RAIZ comer, consumir',
    lemmaGloss: 'LEXICO comer',
    category: 'VERB' as never,
    syntacticFunction: 'FUNCION-SINTACTICA depende de בְּיוֹם',
    translation: 'TRADUCCION tu comer',
    explanation: 'EXPLICACION-PEDAGOGICA El infinitivo constructo funciona como sustantivo verbal.',
    verbMorphology: {
        binyan: 'QAL' as never, verbForm: 'INF_CONSTRUCT' as never, verbType: 'I_GUTTURAL' as never, rootClassification: 'CLASE-RAIZ Pe-álef',
        person: 2 as never, gender: 'M' as never, number: 'S' as never, temporalValue: 'VALOR-TEMPORAL al comer',
        recognitionClues: ['PISTA-1 sin preformativo', 'PISTA-2 ḥaṭef pataḥ'],
    },
    nominalMorphology: { gender: 'M' as never, number: 'S' as never, state: 'CONSTRUCT' as never, person: 2 as never },
    morphemes: [
        { text: 'אֲכָלְ', role: 'ROOT' as never, label: 'MORFEMA-raiz' },
        { text: 'ךָ', role: 'SUFFIX' as never, label: 'MORFEMA-sufijo' },
    ],
    clauseTag: null,
    oshbReference: {
        morphCode: 'OSHB-CODIGO-HVqc/Sp2ms', strongNumber: '398', agreesWithAnalysis: false,
        corrections: [{ field: 'person', analysis: '3', oshb: '2', reason: 'oshb' as never }],
    },
} as WordAnalysis;

const INF = { ordinal: 9, text: 'אֲכָלְךָ', form: 'construct' as const, rule: 'trasConstructo' as const, allowed: ['genitive'] as const, status: 'medida' as const };
const DATOS = {
    word: PALABRA,
    infinitive: { candidate: INF, fn: 'genitive' as const, by: 'rule' as const, assistantReading: 'temporalAsSoonAs' as const },
    speech: { ordinal: 9, text: 'אֲכָלְךָ', kind: 'verb' as const, speaker: 'HABLANTE-יְהוָה', speakerOrdinals: [1] },
    fronted: { role: 'adv' as const, fronting: 'focus' as never },
    onInvestigate: vi.fn(),
};

/** Lo que tiene que aparecer en la ficha completa: cada valor que antes se veía. */
const VALORES = [
    'אֲכָלְךָ', 'TRANSLIT-ʾăḵolḵā', 'RAIZ-TR-ʾ-k-l', 'SIGNIFICADO-RAIZ comer, consumir', 'LEXICO comer', 'TRADUCCION tu comer',
    'FUNCION-SINTACTICA depende de בְּיוֹם', 'EXPLICACION-PEDAGOGICA', 'QAL', 'verseAnalyzer.verbForms.INF_CONSTRUCT', 'CLASE-RAIZ Pe-álef',
    'VALOR-TEMPORAL al comer', 'PISTA-1 sin preformativo', 'PISTA-2 ḥaṭef pataḥ', 'MORFEMA-raiz', 'MORFEMA-sufijo',
    'OSHB-CODIGO-HVqc/Sp2ms', 'verseAnalyzer.categories.VERB', 'verseAnalyzer.morphology.gender.M', 'verseAnalyzer.morphology.number.S',
    'verseAnalyzer.infinitive.functions.genitive', 'verseAnalyzer.ficha.recognizedBy.trasConstructo', 'HABLANTE-יְהוָה',
    'verseAnalyzer.ficha.weakVerb', 'verseAnalyzer.ficha.weakVerbRules', 'verseAnalyzer.ficha.investigate', 'cardFrontedChosen',
];

describe('Ficha hebrea — paridad: ningún dato se pierde', () => {
    it('cada campo del análisis tiene un bloque que existe en el registro (o una razón para quedar fuera)', () => {
        const ids = new Set(BLOQUES_HEBREO.map(b => b.id));
        for (const tabla of [DESTINO_PALABRA, DESTINO_VERBO, DESTINO_NOMBRE]) {
            for (const [campo, destino] of Object.entries(tabla)) {
                if (typeof destino === 'string') expect(ids.has(destino), `${campo} → ${destino}`).toBe(true);
                else expect(destino.fuera.length, campo).toBeGreaterThan(10);
            }
        }
        expect(ids.size).toBe(BLOQUES_HEBREO.length);
    });

    it('con todos los campos llenos, la ficha completa muestra cada valor', () => {
        const { container } = render(<FichaCompleta registro={BLOQUES_HEBREO} d={DATOS} />);
        const texto = container.textContent ?? '';
        const faltan = VALORES.filter(v => !texto.includes(v));
        expect(faltan).toEqual([]);
    });

    it('cada bloque se dibuja con la palabra completa (menos la función libre, que la regla absorbe)', () => {
        const { container } = render(<FichaCompleta registro={BLOQUES_HEBREO} d={DATOS} />);
        const dibujados = new Set([...container.querySelectorAll('[data-ficha-bloque]')].map(e => e.getAttribute('data-ficha-bloque')));
        const sinDibujar = BLOQUES_HEBREO.map(b => b.id).filter(id => !dibujados.has(id));
        // La función del participio y de כִּי no aplican a un infinitivo; la libre va dentro del bloque de la regla.
        expect(sinDibujar.sort()).toEqual(['he.apertura', 'he.funcionKi', 'he.funcionParticipio', 'he.funcionSintactica']);
    });

    it('el resumen (tooltip y tarjeta) lleva palabra, traducción, forma en una línea y la función', () => {
        const { container } = render(<FichaResumen registro={BLOQUES_HEBREO} d={DATOS} />);
        const t = container.textContent ?? '';
        for (const v of ['אֲכָלְךָ', 'TRADUCCION tu comer', 'QAL · verseAnalyzer.verbForms.INF_CONSTRUCT · 2MS', 'verseAnalyzer.infinitive.functions.genitive', 'wordFicha.origin.rule']) {
            expect(t, v).toContain(v);
        }
        // Lo largo no entra al resumen.
        expect(t).not.toContain('EXPLICACION-PEDAGOGICA');
        expect(t).not.toContain('PISTA-1');
    });
});

describe('Ficha hebrea — tarjetas resumen e impresión', () => {
    it('una tarjeta resumen por palabra y, para imprimir, la ficha completa de cada una (en papel no hay panel)', () => {
        const analisis = { reference: 'Gn 2:17', words: [PALABRA, { ...PALABRA, hebrewText: 'מוֹת', translation: 'OTRA' }] } as never;
        const datos = (i: number) => (i === 0 ? DATOS : { word: { ...PALABRA, hebrewText: 'מוֹת', translation: 'OTRA' } });
        render(<TarjetasResumenHebreo analysis={analisis} datos={datos as never} activa={null} onAbrir={() => {}} onHover={() => {}} />);
        expect(screen.getAllByTestId('tarjeta-resumen')).toHaveLength(2);
        // Las fichas completas sólo se dibujan al imprimir (antes estaban siempre, ocultas).
        expect(screen.queryAllByTestId('ficha-completa')).toHaveLength(0);
        act(() => { window.dispatchEvent(new Event('beforeprint')); });
        const completas = screen.getAllByTestId('ficha-completa');
        expect(completas).toHaveLength(2);
        expect(completas[0]!.textContent).toContain('EXPLICACION-PEDAGOGICA');
    });
});

describe('Ficha hebrea — el bloque de función', () => {
    const verFuncion = (d: object) => {
        render(<FichaCompleta registro={BLOQUES_HEBREO} d={{ word: PALABRA, ...d }} />);
        return screen;
    };
    it('regla con una opción: «Según la gramática», cita y «regla por validar»; la otra lectura plegada', () => {
        const s = verFuncion({ infinitive: DATOS.infinitive });
        const n = s.getByTestId('infinitive-note').textContent!;
        expect(n).toContain('wordFicha.origin.rule');
        expect(n).toContain('wordFicha.ruleToValidate');
        expect(s.getByTestId('source-note')).toBeInTheDocument();
        const otra = s.getByTestId('ficha-otra-lectura');
        expect(otra.getAttribute('aria-expanded')).toBe('false');
        expect(otra.textContent).toContain('verseAnalyzer.infinitive.functions.temporalAsSoonAs');
        fireEvent.click(otra);
        expect(otra.getAttribute('aria-expanded')).toBe('true');
    });
    it('varias y el asistente eligió: «Asistente», sin «por validar»', () => {
        const be = { ordinal: 1, text: 'בְּשָׁמְעוֹ', form: 'construct' as const, rule: 'bInf' as const, allowed: ['temporalWhile', 'causal', 'instrumental'] as const, status: 'medida' as const };
        const n = verFuncion({ infinitive: { candidate: be, fn: 'causal', by: 'assistant' } }).getByTestId('infinitive-note').textContent!;
        expect(n).toContain('wordFicha.origin.assistant');
        expect(n).toContain('verseAnalyzer.infinitive.functions.causal');
        expect(n).not.toContain('ruleToValidate');
    });
    it('varias sin elección: las opciones, «re-analiza» y «Por elegir» (no «Asistente»: nadie eligió)', () => {
        const be = { ordinal: 1, text: 'בְּשָׁמְעוֹ', form: 'construct' as const, rule: 'bInf' as const, allowed: ['temporalWhile', 'causal'] as const, status: 'medida' as const };
        const n = verFuncion({ infinitive: { candidate: be } }).getByTestId('infinitive-note').textContent!;
        expect(n).toContain('wordFicha.options');
        expect(n).toContain('wordFicha.reanalyze');
        expect(n).toContain('wordFicha.origin.options');
        expect(n).not.toContain('wordFicha.origin.assistant');
    });
    it('sin regla, la función la da el asistente', () => {
        const n = verFuncion({}).getByTestId('ficha-funcion').textContent!;
        expect(n).toContain('FUNCION-SINTACTICA');
        expect(n).toContain('wordFicha.origin.assistant');
    });
});

describe('Ficha hebrea — textos en los dos idiomas', () => {
    const fichaDe = (loc: unknown) => (loc as { verseAnalyzer: { ficha: { recognizedBy: Record<string, string> } } }).verseAnalyzer.ficha;
    it('«Cómo se reconoce» tiene texto para cada regla del infinitivo, el participio y כִּי', () => {
        const reglas = [...HEBREW_INFINITIVE_RULES, ...HEBREW_PARTICIPLE_RULES, ...HEBREW_KI_RULES].map(r => r.rule);
        for (const loc of [es, en]) for (const r of reglas) expect(fichaDe(loc).recognizedBy[r], r).toBeTruthy();
    });
    it('cada función tiene nombre', () => {
        for (const loc of [es, en] as const) {
            const va = (loc as unknown as { verseAnalyzer: Record<string, { functions: Record<string, string> }> }).verseAnalyzer;
            for (const f of Object.keys(HEBREW_INFINITIVE_SOURCES)) expect(va.infinitive!.functions[f], f).toBeTruthy();
            for (const f of Object.keys(HEBREW_PARTICIPLE_SOURCES)) expect(va.participle!.functions[f], f).toBeTruthy();
            for (const f of Object.keys(HEBREW_KI_SOURCES)) expect(va.ki!.functions[f], f).toBeTruthy();
        }
    });
    it('los textos comunes de la ficha están en los dos idiomas', () => {
        const claves = (o: object, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? claves(v, `${p}${k}.`) : [`${p}${k}`]));
        const a = claves((esLs as { wordFicha: object }).wordFicha).sort();
        expect(a).toEqual(claves((enLs as { wordFicha: object }).wordFicha).sort());
        expect(claves(fichaDe(es)).sort()).toEqual(claves(fichaDe(en)).sort());
    });
});

describe('Ficha hebrea — lo que la revisión encontró perdido', () => {
    const ficha = (word: object, extra: object = {}) => render(<FichaCompleta registro={BLOQUES_HEBREO} d={{ word: { ...PALABRA, ...word } as WordAnalysis, ...extra }} />).container;
    it('sin traducción, la glosa (la cadena de respaldo del tooltip de antes)', () => {
        expect(ficha({ translation: '' }).textContent).toContain('«LEXICO comer»');
    });
    it('«Apertura» en וַיְהִי', () => {
        const vh = { ...PALABRA.verbMorphology!, verbForm: 'WAYYIQTOL' as never };
        expect(ficha({ root: 'היה', verbMorphology: vh }).textContent).toContain('verseAnalyzer.ficha.opening');
        expect(ficha({}).textContent).not.toContain('verseAnalyzer.ficha.opening');
    });
    it('el detective del verbo también para un verbo fuerte (como el panel de antes)', () => {
        const fuerte = { ...PALABRA.verbMorphology!, verbType: 'STRONG' as never, rootClassification: undefined };
        const c = ficha({ verbMorphology: fuerte }).textContent!;
        expect(c).toContain('verseAnalyzer.ficha.strongVerb');
        expect(c).not.toContain('verseAnalyzer.ficha.weakVerbRules');
    });
    it('«Investigar» sólo con detective y para verbos o nombres', () => {
        expect(ficha({}).textContent).not.toContain('verseAnalyzer.ficha.investigate');
        expect(ficha({ category: 'PARTICLE' }, { onInvestigate: () => {} }).textContent).not.toContain('verseAnalyzer.ficha.investigate');
        expect(ficha({}, { onInvestigate: () => {} }).textContent).toContain('verseAnalyzer.ficha.investigate');
    });
    it('el dagesh forte se ve como ◌ּ; un valor fuera del catálogo se muestra tal cual, no la clave', () => {
        const c = ficha({
            morphemes: [{ text: 'ּ', role: 'DAGESH_FORTE', label: '' }],
            verbMorphology: { ...PALABRA.verbMorphology!, verbForm: 'DESCONOCIDO_X' as never },
        }).textContent!;
        expect(c).toContain('\u25CC\u05BC');
        expect(c).toContain('DESCONOCIDO_X');
        expect(c).not.toContain('verseAnalyzer.verbForms.DESCONOCIDO_X');
    });
    it('«Leer completa» sólo si la explicación es larga', () => {
        expect(ficha({ explanation: 'Corta.' }).textContent).not.toContain('wordFicha.readMore');
        expect(ficha({ explanation: 'x'.repeat(400) }).textContent).toContain('wordFicha.readMore');
    });
    it('el resumen de un nombre: género, número y estado en una línea', () => {
        const nombre = { ...PALABRA, category: 'NOUN', verbMorphology: undefined } as unknown as WordAnalysis;
        const t = render(<FichaResumen registro={BLOQUES_HEBREO} d={{ word: nombre }} />).container.textContent!;
        expect(t).toContain('verseAnalyzer.morphology.gender.M · verseAnalyzer.morphology.number.S · verseAnalyzer.morphology.state.CONSTRUCT');
    });
    it('en hebreo, «siguiente» (←) va a la izquierda de «anterior» (→)', () => {
        render(<FichaPanel registro={BLOQUES_HEBREO} d={DATOS} abierto onCerrar={() => {}} referencia="Gn 2:17" onAnterior={() => {}} onSiguiente={() => {}} rtl />);
        const botones = screen.getAllByRole('button').map(b => b.getAttribute('aria-label')).filter(x => x?.startsWith('wordFicha.') && x !== 'wordFicha.close');
        expect(botones).toEqual(['wordFicha.next', 'wordFicha.previous']);
    });
});
