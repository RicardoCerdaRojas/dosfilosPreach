import { describe, expect, it } from 'vitest';
import { buildSourcesAndFormatBlock } from '../sourcesAndFormatBlock';
import { buildPreachingBrief, briefGaps } from '../preachingBriefTemplate';
import { PREACHING_STUDY_RUBRIC } from '../../entities/preachingStudyRubric';
import { DEFAULT_TMS_EXEGETICAL_RUBRIC } from '../../entities/PaperRubric';
import type { ExegeticalPaper } from '../../entities/ExegeticalPaper';
import type { PreviousDelivery } from '../sourceMemory';

const relleno = (n: number) => 'palabra corriente sin original. '.repeat(Math.ceil(n / 32)).slice(0, n);
const TRANSLITERADO = 'The root hāyâ in the G-imperfect; compare ʾāmar, the ṣādê and the šîn of qûm. '.repeat(80);

const trabajo = (sources: Array<{ citationKey: string | null; text: string }>, rubric = PREACHING_STUDY_RUBRIC) =>
    ({ rubric, sources: sources.map(s => ({ citationKey: s.citationKey, excerpts: [{ text: s.text }] })) } as unknown as ExegeticalPaper);

describe('buildSourcesAndFormatBlock — el sistema escribe lo que ya midió', () => {
    it('la forma de cita sale de la rúbrica elegida', () => {
        expect(buildSourcesAndFormatBlock(trabajo([]), null)).toContain('(Apellido, p. N)');
        expect(buildSourcesAndFormatBlock(trabajo([], DEFAULT_TMS_EXEGETICAL_RUBRIC), null))
            .toContain('nota al pie');
    });

    it('dice qué tipo de fuente ancla cuando la rúbrica lo declara', () => {
        expect(buildSourcesAndFormatBlock(trabajo([]), null)).toContain('comentario expositivo');
    });

    it('y calla cuando la rúbrica no nombra un comentario primero', () => {
        // La académica encabeza su énfasis con la edición del texto, que no es
        // un ancla sino material. Inventar un ancla ahí sería afirmar algo que
        // esa rúbrica no dice.
        expect(buildSourcesAndFormatBlock(trabajo([], DEFAULT_TMS_EXEGETICAL_RUBRIC), null))
            .not.toContain('Ancla de cada versículo');
    });

    it('nombra al que translitera, que es un hecho verificable', () => {
        const b = buildSourcesAndFormatBlock(trabajo([
            { citationKey: 'Sasson', text: TRANSLITERADO },
        ]), null);
        expect(b).toMatch(/Sasson translitera/);
    });

    it('NO acusa al libro que simplemente no cita el original', () => {
        // De los 8 libros de producción sin un carácter en lengua original, 2
        // no tenían por qué tenerlo. A nivel de fuente el cero no distingue
        // una extracción rota de un libro que no cita el original, y un
        // encuadre que acusa a un libro sano enseña a ignorar el encuadre.
        const b = buildSourcesAndFormatBlock(trabajo([
            { citationKey: 'MacArthur', text: relleno(20_000) },
        ]), null);
        expect(b).not.toContain('MacArthur');
    });

    it('una fuente con el original no se nombra: no hay nada que advertir', () => {
        const b = buildSourcesAndFormatBlock(trabajo([
            { citationKey: 'Mayor', text: `${relleno(9000)} μέντοι προσωπολημψία` },
        ]), null);
        expect(b).not.toContain('Mayor');
    });

    it('nombra lo ya citado en la entrega anterior, sin dictar la regla', () => {
        // Cuántas semanas hay que esperar lo pone el sílabo, no este código.
        const previa: PreviousDelivery = {
            paperId: 'p1', title: 'Santiago 1', passage: {} as never,
            createdAt: new Date(), citedSourceKeys: ['Ropes', 'Varner'],
        };
        const b = buildSourcesAndFormatBlock(trabajo([
            { citationKey: 'Ropes', text: relleno(3000) },
            { citationKey: 'Mayor', text: relleno(3000) },
        ]), previa);
        expect(b).toContain('Ropes');
        expect(b).toContain('Si el plan no permite repetir');
        // Mayor está en el corpus pero no se citó la vez pasada.
        expect(b).not.toContain('Mayor');
    });

    it('sin nada que decir queda sólo el formato, no un bloque vacío', () => {
        const b = buildSourcesAndFormatBlock(trabajo([]), null);
        expect(b.split('\n')).toHaveLength(2);
    });
});

describe('la plantilla llega con ese bloque escrito', () => {
    it('el encuadre generado ya no pide anotar a mano lo que el sistema sabe', () => {
        const brief = buildPreachingBrief(buildSourcesAndFormatBlock(trabajo([
            { citationKey: 'Sasson', text: TRANSLITERADO },
        ]), null));
        expect(brief).toContain('Sasson translitera');
        expect(brief).not.toContain('Anotá acá lo que sepas de tus libros');
    });

    it('y el único bloque que queda por llenar es el de preguntas', () => {
        // Descubrir las cruces del texto es el acto exegético: es lo que no se
        // delega, y por eso es lo único que sigue en blanco.
        const brief = buildPreachingBrief(buildSourcesAndFormatBlock(trabajo([]), null));
        expect(briefGaps(brief)).toContain('template-unfilled');
        expect(brief).toContain('PREGUNTAS DEL TEXTO');
    });
});
