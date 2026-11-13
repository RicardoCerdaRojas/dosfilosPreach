import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import es from '@/i18n/locales/es/greekTutor.json';
import type { GreekKeyInsight, GreekWordInsight, GreekWordToken } from '@dosfilos/domain';

/**
 * La ficha de palabra del griego (rediseño): PARIDAD con la tarjeta
 * (`GreekWordCard`) y el popover (`GreekWordHoverContent`) que reemplaza, y el
 * bloque de función (regla de Wallace, asistente, caso con su puente).
 */
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}));
vi.mock('../useLemmaFrequency', () => ({ useNtLemmaFrequency: () => 28, frecuenciaNT: () => 28 }));
const { BLOQUES_GRIEGO, DESTINO_CLAVE, DESTINO_INSIGHT, DESTINO_TOKEN } = await import('../ficha/bloquesGriego');
const { FichaCompleta, FichaResumen } = await import('@/components/word-ficha/Ficha');
const { FichaPanelGriego, TarjetasResumenGriego } = await import('../FichasGriego');

/** Un verbo con todo lo verbal lleno (Stg 1:2, ἡγήσασθε). */
const VERBO: GreekWordToken = { text: 'ἡγήσασθε', lemma: 'ἡγέομαι', pos: 'V' as never, transliteration: 'TRANSLIT-hēgēsasthe', tag: { tense: 'A', voice: 'M', mood: 'D', person: '2', number: 'P' } as never };
const INSIGHT_VERBO: GreekWordInsight = {
    text: 'ἡγήσασθε', semanticRange: 'RANGO guiar; considerar', syntacticFunction: 'FUNCION-SINT verbo principal', translation: 'TRADUCCION consideren',
    verbFunction: 'command' as never, verbRule: 'prohibition' as never, tenseUse: 'constative' as never, verbNote: 'NOTA-VERBO ordena evaluar',
    nameNote: 'NOTA-NOMBRE ninguna', composition: { parts: [{ text: 'ἡγε', gloss: 'GLOSA-PARTE guiar' }], note: 'NOTA-COMPOSICION', meaningMatchesParts: true } as never,
    discourseFunction: 'continuity' as never, connects: 'CONECTA-algo', discourseRule: 'overtPronoun' as never, overtPronounVerbText: 'VERBO-PRONOMBRE ἡγήσασθε',
} as GreekWordInsight;
const CLAVE: GreekKeyInsight = { text: 'ἡγήσασθε', significance: 'SIGNIFICANCIA evaluación deliberada' };

/** Un nombre con todo lo nominal lleno (caso, artículo, αὐτός, agencia). */
const NOMBRE: GreekWordToken = { text: 'χαρὰν', lemma: 'χαρά', pos: 'N' as never, transliteration: 'charan', tag: { case: 'A', number: 'S', gender: 'F' } as never };
const INSIGHT_NOMBRE: GreekWordInsight = {
    text: 'χαρὰν', semanticRange: 'RANGO-N gozo', syntacticFunction: 'FUNCION-SINT-N complemento', translation: 'gozo',
    caseFunction: 'doubleAccusative' as never, articleUse: 'anaphoric' as never, antecedent: 'ANTECEDENTE-τὸ', agency: 'ultimate' as never, nominalRule: 'agentHypo' as never,
    autosUse: 'intensive' as never, autosHeadText: 'CABEZA-αὐτός', autosTogether: true, autosHeadTranslation: 'CABEZA-TRAD él mismo',
} as GreekWordInsight;
const RELACIONES = [{ type: 'apposition', note: 'NOTA-RELACION aposición', otherText: 'OTRA-πᾶσαν' }];

const DATOS_VERBO = { token: VERBO, insight: INSIGHT_VERBO, keyInsight: CLAVE, bookCount: 1, bookName: 'LIBRO-Santiago', fronted: { role: 'o' as const }, onSaveFinding: vi.fn(), saved: false };
const DATOS_NOMBRE = { token: NOMBRE, insight: INSIGHT_NOMBRE, relations: RELACIONES };

const textoDe = (d: object) => render(<FichaCompleta registro={BLOQUES_GRIEGO} d={d as never} />).container.textContent ?? '';

describe('Ficha griega — paridad: ningún dato se pierde', () => {
    it('cada campo del token, del análisis y de la clave tiene un bloque que existe (o una razón para quedar fuera)', () => {
        const ids = new Set(BLOQUES_GRIEGO.map(b => b.id));
        for (const tabla of [DESTINO_TOKEN, DESTINO_INSIGHT, DESTINO_CLAVE]) {
            for (const [campo, destino] of Object.entries(tabla)) {
                if (typeof destino === 'string') expect(ids.has(destino), `${campo} → ${destino}`).toBe(true);
                else expect(destino.fuera.length, campo).toBeGreaterThan(10);
            }
        }
        expect(ids.size).toBe(BLOQUES_GRIEGO.length);
    });

    it('con todos los campos llenos, la ficha muestra cada valor (verbo y nombre)', () => {
        const verbo = textoDe(DATOS_VERBO);
        const faltanV = [
            'ἡγήσασθε', 'TRANSLIT-hēgēsasthe', 'ἡγέομαι', 'analyzer.pos.V', 'analyzer.keyWordBadge', 'TRADUCCION consideren', 'RANGO guiar; considerar',
            'analyzer.frequency', 'LIBRO-Santiago', 'NOTA-NOMBRE ninguna', 'GLOSA-PARTE guiar', 'analyzer.tense.A', 'analyzer.mood.D',
            'analyzer.verbFn.functions.command', 'analyzer.verbFn.rules.prohibition', 'NOTA-VERBO ordena evaluar', 'analyzer.verbFn.tenseUses.constative',
            'FUNCION-SINT verbo principal', 'SIGNIFICANCIA evaluación deliberada', 'analyzer.saveFinding', 'cardFronted',
            'VERBO-PRONOMBRE', 'NOTA-COMPOSICION',
        ].filter(v => !verbo.includes(v));
        expect(faltanV).toEqual([]);
        const nombre = textoDe(DATOS_NOMBRE);
        const faltanN = [
            'χαρὰν', 'analyzer.caseFn.A.doubleAccusative', 'analyzer.caseFnHint.doubleAccusative', 'FUNCION-SINT-N complemento',
            'analyzer.articleUse.anaphoric', 'ANTECEDENTE-τὸ', 'NOTA-RELACION aposición', 'OTRA-πᾶσαν', 'analyzer.case.A',
            'analyzer.autos.intensive', 'analyzer.agency.ultimate', 'analyzer.agency.ruleAgentHypo',
        ].filter(v => !nombre.includes(v));
        expect(faltanN).toEqual([]);
    });

    it('el resumen lleva palabra, lema, traducción, forma en una línea y la función con su origen', () => {
        const t = render(<FichaResumen registro={BLOQUES_GRIEGO} d={DATOS_VERBO as never} />).container.textContent ?? '';
        for (const v of ['ἡγήσασθε', 'ἡγέομαι', 'TRADUCCION consideren', 'analyzer.tense.A · analyzer.voice.M · analyzer.mood.D', 'analyzer.verbFn.functions.command', 'wordFicha.origin.rule']) {
            expect(t, v).toContain(v);
        }
        expect(t).not.toContain('SIGNIFICANCIA');
    });
});

describe('Ficha griega — el bloque de función', () => {
    it('función del verbo por regla: «Según la gramática», por qué decidió y la cita', () => {
        render(<FichaCompleta registro={BLOQUES_GRIEGO} d={DATOS_VERBO as never} />);
        const n = screen.getByTestId('verb-function').textContent!;
        expect(n).toContain('wordFicha.origin.rule');
        expect(n).toContain('wordFicha.howRecognized');
        expect(n).toContain('analyzer.verbFn.rules.prohibition');
        expect(screen.getAllByTestId('source-note').length).toBeGreaterThan(0);
    });
    it('sin regla, la eligió el asistente de la lista (no «texto libre»); las reglas griegas no dicen «por validar»', () => {
        render(<FichaCompleta registro={BLOQUES_GRIEGO} d={{ ...DATOS_VERBO, insight: { ...INSIGHT_VERBO, verbRule: undefined } } as never} />);
        expect(screen.getByTestId('verb-function').textContent).toContain('wordFicha.origin.assistant');
        expect(within(screen.getByTestId('verb-function')).getByTestId('ficha-origen-eleccion')).toBeInTheDocument();
    });
    it('una regla griega decide sin «regla por validar» (ese estado es de las reglas medidas del hebreo)', () => {
        render(<FichaCompleta registro={BLOQUES_GRIEGO} d={DATOS_VERBO as never} />);
        expect(screen.getByTestId('verb-function').textContent).not.toContain('wordFicha.ruleToValidate');
    });
    it('sin datos, ni «La forma» ni bloques de agencia vacíos', () => {
        const { container } = render(<FichaCompleta registro={BLOQUES_GRIEGO} d={{ token: { ...NOMBRE, tag: {} }, insight: { ...INSIGHT_NOMBRE, nominalRule: undefined, caseFunction: undefined } } as never} />);
        expect(container.querySelector('[data-ficha-seccion="forma"]')).toBeNull();
        expect(container.querySelector('[data-ficha-bloque="gr.agencia"]')).toBeNull();
        expect(container.querySelector('[data-ficha-bloque="gr.autos"]')).toBeNull();
    });
    it('el uso del tiempo solo (Stg 2:7, presente habitual): lo elige el asistente; un no verbo no tiene función verbal', () => {
        render(<FichaCompleta registro={BLOQUES_GRIEGO} d={{ token: VERBO, insight: { ...INSIGHT_VERBO, verbFunction: undefined, verbRule: undefined, tenseUse: 'customary' } } as never} />);
        const n = screen.getByTestId('tense-use').textContent!;
        expect(n).toContain('analyzer.verbFn.tenseUses.customary');
        expect(n).toContain('wordFicha.origin.assistant');
        expect(screen.queryByTestId('verb-function')).toBeNull();
    });
    it('uso del tiempo acotado por regla (Stg 2:10 γέγονεν, Wallace p. 581): el porqué, las opciones y la otra lectura del asistente', () => {
        const insight = { ...INSIGHT_VERBO, verbFunction: undefined, verbRule: undefined, tenseUse: undefined, tenseRule: 'prolepticPerfect', tenseUseOptions: ['proleptic', 'gnomic'], tenseUseOutside: 'intensive' };
        render(<FichaCompleta registro={BLOQUES_GRIEGO} d={{ token: VERBO, insight } as never} />);
        const n = screen.getByTestId('tense-use').textContent!;
        for (const v of ['analyzer.verbFn.tenseRules.prolepticPerfect', 'analyzer.verbFn.tenseUses.proleptic', 'analyzer.verbFn.tenseUses.gnomic', 'Proleptic (Futuristic) Perfect']) expect(n, v).toContain(v);
        expect(n).toContain('analyzer.verbFn.tenseUses.intensive');
    });
    it('la condicional en la ficha de ἐάν (revisión del profesor, Stg 2:14): clase, qué es, su valor y la fuente; en el tooltip, una línea', () => {
        const conj = { text: 'ἐὰν', lemma: 'ἐάν', pos: 'C' as never, transliteration: 'ean', tag: {} as never };
        const conditional = { ordinal: 4, conditionalClass: 3 as const, use: 'presentGeneral' as const };
        render(<FichaCompleta registro={BLOQUES_GRIEGO} d={{ token: conj, conditional } as never} />);
        const n = screen.getByTestId('conditional').textContent!;
        for (const v of ['analyzer.conditional.title', 'classLabel.3', 'classNotes.3', 'analyzer.conditional.uses.presentGeneral', 'Third Class Condition']) expect(n, v).toContain(v);
        const corto = render(<FichaResumen registro={BLOQUES_GRIEGO} d={{ token: conj, conditional } as never} />).container.textContent!;
        expect(corto).toContain('analyzer.conditional.short.presentGeneral');
    });
    it('ὅστις + subjuntivo sin ἄν (Stg 2:10 τηρήσῃ): su regla propia, sin «con ἄν» y sólo con la fuente de la relativa (prueba del fundador)', () => {
        const insight = { ...INSIGHT_VERBO, verbFunction: 'indefinite', verbRule: 'indefiniteRelative', tenseUse: undefined };
        const subj = { ...VERBO, tag: { tense: 'A', voice: 'A', mood: 'S', person: '3', number: 'S' } as never };
        render(<FichaCompleta registro={BLOQUES_GRIEGO} d={{ token: subj, insight } as never} />);
        const n = screen.getByTestId('verb-function').textContent!;
        expect(n).toContain('analyzer.verbFn.rules.indefiniteRelative');
        expect(n).toContain('Subjunctive in Indefinite Relative Clause');
        expect(n).not.toContain('Indefinite Temporal Clause');
        // Y el texto real no dice que hay ἄN donde no lo hay.
        const reglas = (es as { analyzer: { verbFn: { rules: Record<string, string>; functions: Record<string, string> } } }).analyzer.verbFn;
        expect(reglas.rules.indefiniteRelative).toContain('con o sin ἄν');
        expect(reglas.functions.indefinite).not.toContain('con ἄν');
    });
    it('uso del tiempo acotado y elegido: el nombre, sin opciones', () => {
        const insight = { ...INSIGHT_VERBO, verbFunction: undefined, verbRule: undefined, tenseUse: 'proleptic', tenseRule: 'prolepticPerfect' };
        render(<FichaCompleta registro={BLOQUES_GRIEGO} d={{ token: VERBO, insight } as never} />);
        const n = screen.getByTestId('tense-use').textContent!;
        expect(n).toContain('analyzer.verbFn.tenseUses.proleptic');
        expect(n).not.toContain('wordFicha.options');
    });
    it('el caso lleva su función sintáctica adentro; sin caso, la sintáctica va sola', () => {
        render(<FichaCompleta registro={BLOQUES_GRIEGO} d={DATOS_NOMBRE as never} />);
        expect(screen.getByTestId('case-function').textContent).toContain('FUNCION-SINT-N complemento');
        expect(screen.queryByTestId('ficha-funcion')).toBeNull();
    });
});

describe('Ficha griega — tarjetas resumen, impresión y panel', () => {
    const datos = (i: number) => (i === 0 ? DATOS_VERBO : DATOS_NOMBRE) as never;
    it('una tarjeta por palabra y, al imprimir, la ficha completa de cada una', () => {
        render(<TarjetasResumenGriego total={2} datos={datos} activa={null} onAbrir={() => {}} />);
        expect(screen.getAllByTestId('tarjeta-resumen')).toHaveLength(2);
        expect(screen.queryAllByTestId('ficha-completa')).toHaveLength(0);
        act(() => { window.dispatchEvent(new Event('beforeprint')); });
        expect(screen.getAllByTestId('ficha-completa')).toHaveLength(2);
    });
    it('el panel navega a la palabra siguiente', () => {
        const onAbrir = vi.fn();
        render(<FichaPanelGriego titulo="Stg 1:2" total={2} datos={datos} abierta={0} onAbrir={onAbrir} />);
        expect(screen.getByTestId('ficha-panel').textContent).toContain('TRADUCCION consideren');
        fireEvent.click(screen.getByLabelText('wordFicha.next'));
        expect(onAbrir).toHaveBeenCalledWith(1);
        expect(screen.getByLabelText('wordFicha.previous')).toBeDisabled();
    });
});

/** U3b (revisión del profesor, Stg 2:16 «τις ἐξ ὑμῶν»): el partitivo con ἐκ lo decide la regla. */
describe('Ficha griega — el genitivo partitivo por regla (U3b)', () => {
    const UMON: GreekWordToken = { text: 'ὑμῶν', lemma: 'σύ', pos: 'RP' as never, transliteration: 'hymōn', tag: { case: 'G', number: 'P' } as never };

    it('con la regla, el bloque del caso dice «Regla», cómo se reconoce y cita a Wallace p. 84', () => {
        render(<FichaCompleta registro={BLOQUES_GRIEGO} d={{ token: UMON, insight: { text: 'ὑμῶν', caseFunction: 'partitive', nominalRule: 'partitiveEk' } } as never} />);
        const b = screen.getByTestId('case-function');
        expect(b.textContent).toContain('analyzer.caseFn.G.partitive');
        expect(b.textContent).toContain('analyzer.caseRule.partitiveEk');
        expect(b.querySelector('[data-testid="ficha-origen-regla"]')).not.toBeNull();
        expect(b.textContent).toContain('Wallace');
    });

    it('sin la regla, el mismo caso sigue siendo elección del asistente', () => {
        render(<FichaCompleta registro={BLOQUES_GRIEGO} d={{ token: UMON, insight: { text: 'ὑμῶν', caseFunction: 'partitive' } } as never} />);
        expect(screen.getByTestId('case-function').querySelector('[data-testid="ficha-origen-eleccion"]')).not.toBeNull();
    });
});

/** U3c (revisión del profesor, Stg 2:10 «ἐν ἑνί»): el sentido de Louw-Nida de la preposición, dato de MACULA. */
describe('Ficha griega — el sentido de Louw-Nida (U3c)', () => {
    const EN: GreekWordToken = { text: 'ἐν', lemma: 'ἐν', pos: 'P' as never, transliteration: 'en', tag: {} as never };

    it('Stg 2:10 89.5: Relaciones › especificación, como dato, con la cita del léxico', () => {
        render(<FichaCompleta registro={BLOQUES_GRIEGO} d={{ token: EN, ln: '89.5' } as never} />);
        const b = screen.getByTestId('louw-nida');
        expect(b.textContent).toContain('89.5');
        expect(b.textContent).toContain('relaciones');
        expect(b.textContent).toContain('especificación');
        expect(b.textContent).toContain('Louw');
        expect(b.textContent).toContain('analyzer.louwNida.note');
    });

    it('Stg 2:21 «89.25 89.77»: las dos lecturas que deja el dato (causa y medio)', () => {
        render(<FichaCompleta registro={BLOQUES_GRIEGO} d={{ token: EN, ln: '89.25 89.77' } as never} />);
        expect(screen.getAllByTestId('louw-nida-sentido').map(e => e.textContent)).toEqual([expect.stringContaining('causa'), expect.stringContaining('medio')]);
        expect(screen.getByTestId('louw-nida').textContent).toContain('analyzer.louwNida.twoReadings');
    });

    it('sin código (14 % de las preposiciones) o en otra palabra, no hay bloque', () => {
        render(<FichaCompleta registro={BLOQUES_GRIEGO} d={{ token: EN } as never} />);
        expect(screen.queryByTestId('louw-nida')).toBeNull();
    });
});

/** U9 (revisión del profesor, Stg 3:1): la señal de apertura de sección en la ficha del vocativo. */
describe('Ficha griega — apertura de sección (U9)', () => {
    const VOC: GreekWordToken = { text: 'ἀδελφοί', lemma: 'ἀδελφός', pos: 'N' as never, transliteration: 'adelphoi', tag: { case: 'V', number: 'P' } as never };

    it('con imperativo: lo nombra, dice «señal» y cita la indicación del profesor', () => {
        render(<FichaCompleta registro={BLOQUES_GRIEGO} d={{ token: VOC, opening: { question: false, imperative: 'γίνεσθε,' } } as never} />);
        const b = screen.getByTestId('apertura-seccion');
        expect(b.textContent).toContain('analyzer.opening.withImperative');
        expect(b.textContent).toContain('analyzer.opening.note');
        expect(b.textContent).toContain('Stg 3:1');
    });

    it('con pregunta (Stg 2:14), el texto de la pregunta; sin señal, no hay bloque', () => {
        const { unmount } = render(<FichaCompleta registro={BLOQUES_GRIEGO} d={{ token: VOC, opening: { question: true } } as never} />);
        expect(screen.getByTestId('apertura-seccion').textContent).toContain('analyzer.opening.withQuestion');
        unmount();
        render(<FichaCompleta registro={BLOQUES_GRIEGO} d={{ token: VOC } as never} />);
        expect(screen.queryByTestId('apertura-seccion')).toBeNull();
    });
});

/** U10 (revisión del profesor, Stg 3:5): el mismo lema otra vez en el versículo, con otra glosa en contexto. */
describe('Ficha griega — mismo lema en el versículo (U10)', () => {
    const HLIKON: GreekWordToken = { text: 'ἡλίκον', lemma: 'ἡλίκος', pos: 'A' as never, transliteration: 'hēlikon', tag: { case: 'N', number: 'S' } as never };
    const MISMO = [
        { text: 'ἡλίκον', gloss: 'small', translation: 'qué pequeño', self: true },
        { text: 'ἡλίκην', gloss: 'how great', translation: 'qué gran', self: false },
    ];

    it('Stg 3:5: las dos apariciones con la traducción del análisis, esta palabra destacada, y la indicación del profesor', () => {
        render(<FichaCompleta registro={BLOQUES_GRIEGO} d={{ token: HLIKON, sameLemma: MISMO } as never} />);
        const filas = screen.getAllByTestId('mismo-lema-aparicion');
        expect(filas.map(f => f.textContent)).toEqual([expect.stringContaining('«qué pequeño»'), expect.stringContaining('«qué gran»')]);
        expect(filas.map(f => f.className.includes('font-semibold'))).toEqual([true, false]);
        const b = screen.getByTestId('mismo-lema');
        expect(b.textContent).toContain('analyzer.sameLemma.note');
        expect(b.textContent).toContain('Stg 3:5');
    });

    it('sin análisis, sólo el texto y la glosa; sin el dato (o con una sola aparición), no hay bloque', () => {
        const { unmount } = render(<FichaCompleta registro={BLOQUES_GRIEGO} d={{ token: HLIKON, sameLemma: MISMO.map(({ translation: _t, ...w }) => w) } as never} />);
        expect(screen.getAllByTestId('mismo-lema-aparicion')[0]!.textContent).not.toContain('«');
        unmount();
        const r = render(<FichaCompleta registro={BLOQUES_GRIEGO} d={{ token: HLIKON } as never} />);
        expect(screen.queryByTestId('mismo-lema')).toBeNull();
        r.unmount();
        render(<FichaCompleta registro={BLOQUES_GRIEGO} d={{ token: HLIKON, sameLemma: [MISMO[0]] } as never} />);
        expect(screen.queryByTestId('mismo-lema')).toBeNull();
    });
});

/** Revisión del profesor (Stg 2:18): la repetición en espejo en la ficha. */
describe('Ficha griega — repetición en espejo', () => {
    const PISTIN: GreekWordToken = { text: 'πίστιν', lemma: 'πίστις', pos: 'N' as never, transliteration: 'pistin', tag: { case: 'A', number: 'S' } as never };
    it('dice la letra de la palabra, el espejo y que es un dato (puede ser un quiasmo), con la indicación del profesor', () => {
        render(<FichaCompleta registro={BLOQUES_GRIEGO} d={{ token: PISTIN, mirror: { position: 'A', a: 'πίστιν', b: 'ἔργων,', b2: 'ἔργων', a2: 'πίστιν.' } } as never} />);
        const b = screen.getByTestId('repeticion-espejo');
        expect(b.textContent).toContain('analyzer.mirror.position');
        expect(b.textContent).toContain('analyzer.mirror.note');
        expect(b.textContent).toContain('Stg 2:18');
    });
    it('sin espejo, no hay bloque', () => {
        render(<FichaCompleta registro={BLOQUES_GRIEGO} d={{ token: PISTIN } as never} />);
        expect(screen.queryByTestId('repeticion-espejo')).toBeNull();
    });
});

