import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { GreekKeyInsight, GreekWordInsight, GreekWordToken } from '@dosfilos/domain';

/**
 * La ficha de palabra del griego (rediseño): PARIDAD con la tarjeta
 * (`GreekWordCard`) y el popover (`GreekWordHoverContent`) que reemplaza, y el
 * bloque de función (regla de Wallace, asistente, caso con su puente).
 */
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}));
vi.mock('../useLemmaFrequency', () => ({ useNtLemmaFrequency: () => 28 }));
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
    it('sin regla, la eligió el asistente', () => {
        render(<FichaCompleta registro={BLOQUES_GRIEGO} d={{ ...DATOS_VERBO, insight: { ...INSIGHT_VERBO, verbRule: undefined } } as never} />);
        expect(screen.getByTestId('verb-function').textContent).toContain('wordFicha.origin.assistant');
    });
    it('el uso del tiempo solo (Stg 2:7, presente habitual): lo elige el asistente; un no verbo no tiene función verbal', () => {
        render(<FichaCompleta registro={BLOQUES_GRIEGO} d={{ token: VERBO, insight: { ...INSIGHT_VERBO, verbFunction: undefined, verbRule: undefined, tenseUse: 'customary' } } as never} />);
        const n = screen.getByTestId('tense-use').textContent!;
        expect(n).toContain('analyzer.verbFn.tenseUses.customary');
        expect(n).toContain('wordFicha.origin.assistant');
        expect(screen.queryByTestId('verb-function')).toBeNull();
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
