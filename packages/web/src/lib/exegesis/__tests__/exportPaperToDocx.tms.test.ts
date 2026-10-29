import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { DEFAULT_TMS_EXEGETICAL_RUBRIC, PAPER_COVER_FIELDS, assembleMarkdown, buildCitationFormBlock } from '@dosfilos/domain';
import type { CoverStyle, ExegeticalPaper, PaperCover } from '@dosfilos/domain';
import { EMPTY_VERIFICATION_SUMMARY } from '@dosfilos/domain';
import { exportPaperToDocx, nivelDeWord } from '../exportPaperToDocx';

/**
 * El formato ES el entregable.
 *
 * Las pruebas de humo dicen que el archivo se arma; estas dicen que se
 * arma como la guía del seminario exige. Sí, miran el XML: es el único
 * sitio donde «Times New Roman 12 a doble espacio» es comprobable sin
 * abrir Word a mano, y ese cotejo manual es justo lo que se hizo tres
 * veces con el trabajo de Salmo 23.
 */
async function xmlOf(paper: ExegeticalPaper, entry: string): Promise<string> {
    const blob = await exportPaperToDocx(paper, { exportedAt: new Date('2026-09-17') });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    return zip.file(entry)!.async('string');
}

/**
 * Los encabezados y pies se numeran por orden de creación, así que el
 * nombre del archivo cambia al agregar una portada. Se buscan por lo que
 * contienen, no por cómo se llaman.
 */
async function headersAndFooters(paper: ExegeticalPaper): Promise<Array<{ name: string; xml: string }>> {
    const blob = await exportPaperToDocx(paper, { exportedAt: new Date('2026-09-17') });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const names = Object.keys(zip.files).filter(n => /^word\/(header|footer)\d+\.xml$/.test(n));
    return Promise.all(names.map(async name => ({ name, xml: await zip.file(name)!.async('string') })));
}

const paper = (over: Partial<ExegeticalPaper> = {}): ExegeticalPaper => ({
    id: 'p1', ownerId: 'o1', createdAt: new Date(), updatedAt: new Date(),
    passage: { bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 1, verseEnd: 3 },
    displayLanguage: 'es', title: 'Análisis de Salmo 23:1-3',
    assignmentBrief: null, styleGuideId: null, sources: [], rubric: null,
    stepPlan: { steps: [] } as never, phase: 'writing', steps: [], currentStepId: null,
    assembledMarkdown: [
        '## Introducción',
        '',
        'El salmo abre con una metáfora pastoral.',
        '',
        '> יְהוָה רֹעִי לֹא אֶחְסָר',
        '',
        'La raíz שׁוב aparece en el verso 3 (Waltke-O\'Connor, "Syntax", p. 436).',
        '',
        '## Bibliografía',
        '',
        '- Ross, Allen P. *A Commentary on the Psalms*. Grand Rapids: Kregel, 2011.',
    ].join('\n'),
    verifications: EMPTY_VERIFICATION_SUMMARY,
    ...over,
} as unknown as ExegeticalPaper);

describe('exportPaperToDocx — la forma de cita sale de la rúbrica', () => {
    const conForma = (citationForm: string) => paper({
        rubric: {
            ...DEFAULT_TMS_EXEGETICAL_RUBRIC,
            formatting: { lineSpacing: 'single', blankLineBetweenParagraphs: true, citationForm },
        },
    } as unknown as Partial<ExegeticalPaper>);

    it('por omisión la cita va a nota al pie, como antes', async () => {
        const blob = await exportPaperToDocx(paper(), { exportedAt: new Date('2026-09-17') });
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        expect(Object.keys(zip.files)).toContain('word/footnotes.xml');
        const notas = await zip.file('word/footnotes.xml')!.async('string');
        expect(notas).toContain('Waltke');
    });

    it('cuando el encuadre pide cita entre paréntesis, la cita se queda en el texto', async () => {
        // No es «no hacer nada»: es la otra convención. El trabajo práctico
        // semanal pide «(Apellido, página)» en el texto más bibliografía al
        // final, sin notas, y el exportador convertía a nota siempre.
        const blob = await exportPaperToDocx(conForma('parenthetical'), { exportedAt: new Date('2026-09-17') });
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const doc = await zip.file('word/document.xml')!.async('string');
        expect(doc).toContain('Waltke');
        const notas = zip.file('word/footnotes.xml');
        if (notas) expect(await notas.async('string')).not.toContain('Waltke');
    });

    it('«footnote» explícito se comporta como el valor por omisión', async () => {
        const blob = await exportPaperToDocx(conForma('footnote'), { exportedAt: new Date('2026-09-17') });
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        expect(await zip.file('word/footnotes.xml')!.async('string')).toContain('Waltke');
    });
});

/**
 * El puente entre lo que se le PIDE al compositor y lo que el exportador
 * sabe maquetar.
 *
 * `buildCitationFormBlock` afirma, en prosa, que la forma con título entre
 * comillas es «la única que el exportador reconoce para bajar la cita a nota
 * al pie». Esa afirmación vivía sólo en un comentario, en otro paquete, y el
 * día que alguien toque cualquiera de las dos puntas nada se iba a enterar.
 * Medido en Santiago 2:1-13: tres versículos salieron con la forma corta y el
 * cuarto con la larga, en el mismo trabajo.
 */
describe('la forma que se le pide al compositor es la que el exportador convierte', () => {
    const conCita = (cita: string) => paper({
        assembledMarkdown: ['## Versículo 1', '', `El genitivo es atributivo ${cita}.`].join('\n'),
    });

    it('la forma que el bloque enseña como ejemplo sí baja a nota al pie', async () => {
        // El ejemplo se toma del bloque, no se reescribe acá: si alguien
        // cambia la forma que se le enseña al compositor, esta prueba cae.
        const bloque = buildCitationFormBlock('footnote', 'es');
        const ejemplo = bloque.match(/\(Wallace[^)]*\)/)?.[0];
        expect(ejemplo).toBeTruthy();
        const notas = await xmlOf(conCita(ejemplo!), 'word/footnotes.xml');
        expect(notas).toContain('Wallace');
    });

    it('la forma corta se queda varada en el cuerpo, que es por lo que se prohíbe mezclarlas', async () => {
        const doc = await xmlOf(conCita('(Wallace, hoja 87)'), 'word/document.xml');
        expect(doc).toContain('Wallace');
        const blob = await exportPaperToDocx(conCita('(Wallace, hoja 87)'), { exportedAt: new Date('2026-09-17') });
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const notas = zip.file('word/footnotes.xml');
        if (notas) expect(await notas.async('string')).not.toContain('Wallace');
    });
});

/**
 * Las citas SIN título: la forma que el exportador no sabía leer.
 *
 * Medido sobre los 14 trabajos con prosa ensamblada en producción: 63 citas
 * bajaban a nota al pie y 103 se quedaban varadas en el cuerpo, con seis
 * trabajos enteros sin una sola nota. El compositor emite «Kistemaker
 * (p. 259)» y «(Mayor, 77)» además de la forma con título, y este archivo
 * sólo conocía la última.
 *
 * Ensanchar el patrón a secas convertiría en nota al pie el pie de imprenta de
 * la propia bibliografía. El discriminador es el corpus del trabajo.
 */
describe('una cita sin título baja al pie sólo si su autor es fuente del trabajo', () => {
    const conFuentes = (texto: string, claves: Array<string | null>): ExegeticalPaper => paper({
        sources: claves.map((citationKey, i) => ({ id: `s${i}`, citationKey })) as never,
        assembledMarkdown: ['## Versículo 1', '', texto].join('\n'),
    });

    const notas = async (texto: string, claves: Array<string | null>) => {
        const blob = await exportPaperToDocx(conFuentes(texto, claves), { exportedAt: new Date('2026-09-17') });
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const f = zip.file('word/footnotes.xml');
        return f ? await f.async('string') : '';
    };

    it('«(Mayor, 77)» con Mayor declarado baja al pie', async () => {
        expect(await notas('El genitivo es apositivo (Mayor, 77).', ['Mayor'])).toContain('Mayor');
    });

    it('«Kistemaker (p. 259)», con el autor fuera del paréntesis, también', async () => {
        expect(await notas('Así lo sostiene Kistemaker (p. 259).', ['Kistemaker'])).toContain('Kistemaker');
    });

    it('el rótulo honesto «hoja N» no queda afuera', async () => {
        expect(await notas('Wallace lo clasifica así (Wallace, hoja 87).', ['Wallace'])).toContain('Wallace');
    });

    it('un pie de imprenta NO es una cita, aunque tenga la misma forma', async () => {
        // El caso que prohibía ensanchar el patrón: la ficha Turabian de la
        // propia bibliografía es «(Ciudad: Editorial, año)».
        const n = await notas('Ross, Allen P. *Commentary*. (Nashville: Broadman & Holman, 2003).', ['Mayor']);
        expect(n).not.toContain('Broadman');
    });

    it('una referencia bíblica tampoco', async () => {
        const n = await notas('La prohibición viene de antes (Génesis 19:25, 29).', ['Mayor']);
        expect(n).not.toContain('Génesis');
    });

    it('un autor que el trabajo no declara se queda en el cuerpo', async () => {
        // Sin ficha no hay entrada de bibliografía a la que remitir: bajarla
        // al pie produciría una nota que no lleva a ninguna parte.
        const n = await notas('Algo dice Fulano (p. 12).', ['Mayor']);
        expect(n).not.toContain('Fulano');
    });

    it('el título SIN comillas también baja, si el autor es fuente del trabajo', async () => {
        // La cuarta forma. Un trabajo entero de Salmo 23:1-3 exportó sin una
        // sola nota al pie teniendo seis citas así.
        const n = await notas(
            'Así lo señala Craigie (Craigie, Word Biblical Commentary Vol_ 19, Psalms 1-50, 206).',
            ['Craigie'],
        );
        expect(n).toContain('Craigie');
    });

    it('y admite los paréntesis que el título lleva de verdad', async () => {
        const n = await notas(
            'Ross argumenta (Ross, A Commentary on the Psalms 1-41 (Kregel Exegetical Library), 560).',
            ['Ross'],
        );
        expect(n).toContain('Ross');
    });

    it('un pie de imprenta tiene esa MISMA estructura y sigue sin bajar', async () => {
        // Tres campos separados por comas, el último numérico: por su forma
        // es indistinguible de la cita de arriba. Sólo el corpus las separa.
        const n = await notas('Craigie, Peter C. *Psalms 1-50*. (Waco, TX: Word Books, 1983).', ['Craigie']);
        expect(n).not.toContain('Word Books');
    });

    it('con la forma parentética no baja ninguna, resuelva o no', async () => {
        const conForma = paper({
            sources: [{ id: 's0', citationKey: 'Mayor' }] as never,
            rubric: { formatting: { lineSpacing: 'single', blankLineBetweenParagraphs: true, citationForm: 'parenthetical' } } as never,
            assembledMarkdown: ['## Versículo 1', '', 'El genitivo es apositivo (Mayor, 77).'].join('\n'),
        });
        const blob = await exportPaperToDocx(conForma, { exportedAt: new Date('2026-09-17') });
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const doc = await zip.file('word/document.xml')!.async('string');
        expect(doc).toContain('Mayor');
        const f = zip.file('word/footnotes.xml');
        if (f) expect(await f.async('string')).not.toContain('Mayor');
    });
});

/**
 * La nota al pie se arma con la FICHA del libro, no con el paréntesis.
 *
 * Turabian pide que la nota lleve la obra completa —autor con nombre de pila,
 * título, colección, pie de imprenta y página— y eso no está en el cuerpo: el
 * paréntesis dice «(Craigie, …, 206)». El dato vive en la ficha de la
 * biblioteca y `formatFirstNote` sabía armarlo desde antes; no lo llamaba
 * nadie, así que la nota salía como un eco del paréntesis.
 */
describe('la nota al pie sale en Turabian, desde la ficha del libro', () => {
    const CRAIGIE = {
        author: 'Peter C. Craigie', authorSorted: 'Craigie, Peter C.',
        title: 'Psalms 1-50', shortTitle: 'Psalms',
        series: 'Word Biblical Commentary', volume: '19',
        city: 'Waco, TX', publisher: 'Word Books', year: '1983',
    };
    const conCraigie = (cuerpo: string): ExegeticalPaper => paper({
        sources: [{ id: 's0', citationKey: 'Craigie' }] as never,
        assembledMarkdown: ['## Versículo 1', '', cuerpo].join('\n'),
    });
    const notasDe = async (cuerpo: string) => {
        const blob = await exportPaperToDocx(conCraigie(cuerpo), {
            exportedAt: new Date('2026-09-17'),
            bibliography: [{
                citationKey: 'Craigie', displayLabel: 'Psalms 1-50',
                text: 'Craigie, Peter C. *Psalms 1-50*.', missing: [], data: CRAIGIE,
            }],
        });
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const f = zip.file('word/footnotes.xml');
        return f ? await f.async('string') : '';
    };

    it('la nota trae el nombre de pila y el pie de imprenta, que el paréntesis no tenía', async () => {
        const n = await notasDe('Como observa Craigie (Craigie, p. 206).');
        expect(n).toContain('Peter C. Craigie');
        expect(n).toContain('Word Books');
        expect(n).toContain('206');
    });

    it('la primera nota va completa y la siguiente, de la misma obra, es «Ibid.» con su página', async () => {
        // Turabian: repetir la ficha entera en cada nota no es más prolijo,
        // es otro estilo. La guía de TMS admite «Ibid.» (TI #1, notas 24, 40 y 44).
        const n = await notasDe('Primero (Craigie, p. 206). Después (Craigie, p. 210).');
        expect(n).toContain('Peter C. Craigie');
        expect((n.match(/Word Books/g) ?? []).length).toBe(1);
        expect(n.replace(/<[^>]+>/g, '')).toContain('Ibid., 210.');
    });

    it('REGRESIÓN: «Ibid.» solo cuando la nota anterior es de la misma obra; si no, la abreviada', async () => {
        const ROSS = { author: 'Allen P. Ross', authorSorted: 'Ross, Allen P.', title: 'A Commentary on the Psalms', shortTitle: 'Commentary on the Psalms', city: 'Grand Rapids', publisher: 'Kregel', year: '2011' };
        const blob = await exportPaperToDocx(paper({
            sources: [{ id: 's0', citationKey: 'Craigie' }, { id: 's1', citationKey: 'Ross' }] as never,
            assembledMarkdown: ['## Versículo 1', '', 'Uno (Craigie, p. 206). Dos (Ross, p. 5). Tres (Craigie, p. 210).'].join('\n'),
        }), {
            exportedAt: new Date('2026-09-17'),
            bibliography: [
                { citationKey: 'Craigie', displayLabel: 'Psalms 1-50', text: 'x', missing: [], data: CRAIGIE },
                { citationKey: 'Ross', displayLabel: 'Commentary', text: 'y', missing: [], data: ROSS },
            ],
        });
        const n = await (await JSZip.loadAsync(await blob.arrayBuffer())).file('word/footnotes.xml')!.async('string');
        expect(n).not.toContain('Ibid.');
        const texto = n.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '');
        expect(texto).toContain('Craigie, Psalms, 210.');
        // El título va en cursiva, no entre asteriscos.
        expect(texto).not.toContain('*');
        expect(n).toMatch(/<w:i\/>.*?Psalms 1-50/s);
    });

    const ROSS_FICHA = { author: 'Allen P. Ross', authorSorted: 'Ross, Allen P.', title: 'A Commentary on the Psalms', shortTitle: 'Commentary on the Psalms', city: 'Grand Rapids', publisher: 'Kregel', year: '2011' };
    const exportarConDos = async (texto: string) => {
        const blob = await exportPaperToDocx(paper({
            sources: [{ id: 's0', citationKey: 'Craigie' }, { id: 's1', citationKey: 'Ross' }] as never,
            assembledMarkdown: ['## Versículo 1', '', texto].join('\n'),
        }), {
            exportedAt: new Date('2026-09-17'),
            bibliography: [
                { citationKey: 'Craigie', displayLabel: 'Psalms 1-50', text: 'x', missing: [], data: CRAIGIE },
                { citationKey: 'Ross', displayLabel: 'Commentary', text: 'y', missing: [], data: ROSS_FICHA },
            ],
        });
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const plano = (x: string) => x.replace(/<w:footnoteReference w:id="(\d+)"\/>/g, '[^$1]').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '');
        return { notas: plano(await zip.file('word/footnotes.xml')!.async('string')), cuerpo: plano(await zip.file('word/document.xml')!.async('string')) };
    };

    it('REGRESIÓN TI #2: «(A, 638; B, 59)» es UNA nota con las dos obras, sin «)» suelto ni espacio antes de la llamada', async () => {
        const { notas, cuerpo } = await exportarConDos('Lo dicen (Craigie, "Psalms 1-50", p. 206; Ross, "A Commentary on the Psalms", p. 59). Fin.');
        expect(cuerpo).toContain('Lo dicen[^1]. Fin.');
        expect(cuerpo).not.toMatch(/\[\^\d+\]\)/);
        expect(notas).toContain('Word Books, 1983), 206; Allen P. Ross, A Commentary on the Psalms (Grand Rapids: Kregel, 2011), 59.');
        expect(notas).not.toContain('[^2]');
    });

    it('REGRESIÓN TI #2: la cita corta «(Ross, 565)» no deja un «)» suelto en el cuerpo', async () => {
        const { cuerpo } = await exportarConDos('Es mayor (Ross, 565). Otra (Craigie, "Psalms 1-50", p. 27). Y (Ross, A Commentary on the Psalms 1-41 (Kregel Exegetical Library), 566). Fin.');
        expect(cuerpo).toContain('Es mayor[^1]. Otra[^2]. Y[^3]. Fin.');
    });

    it('después de una nota con dos obras no hay «Ibid.»: no diría a cuál', async () => {
        const { notas } = await exportarConDos('Uno (Craigie, "Psalms 1-50", p. 206; Ross, "A Commentary on the Psalms", p. 59). Dos (Ross, p. 60).');
        expect(notas).not.toContain('Ibid.');
        expect(notas).toContain('Ross, Commentary on the Psalms, 60.');
    });

    it('Turabian: la misma página que la nota anterior es «Ibid.» solo', async () => {
        const { notas } = await exportarConDos('Uno (Ross, p. 565). Dos (Ross, p. 565). Tres (Ross, p. 566).');
        expect(notas).toMatch(/2011\), 565\.\s*Ibid\.\s*Ibid\., 566\./);
        expect(notas).not.toContain('Ibid..');
    });

    it('REGRESIÓN: una nota sin página detrás de una con página no es «Ibid.» solo (diría «la misma página»)', async () => {
        const { notas } = await exportarConDos('Uno (Ross, p. 565). Dos (Ross, "A Commentary on the Psalms").');
        expect(notas).not.toContain('Ibid.');
        expect(notas).toContain('Ross, Commentary on the Psalms.');
    });

    describe('el «Ibid.» lo decide la guía del trabajo', () => {
        const exportarRoss = async (ibid: { enabled: boolean; label: string; allowPageOverride: boolean }) => {
            const blob = await exportPaperToDocx(paper({
                sources: [{ id: 's1', citationKey: 'Ross' }] as never,
                assembledMarkdown: ['## Versículo 1', '', 'Uno (Ross, p. 565). Dos (Ross, p. 565). Tres (Ross, p. 566).'].join('\n'),
            }), { exportedAt: new Date('2026-09-17'), ibid, bibliography: [{ citationKey: 'Ross', displayLabel: 'C', text: 'y', missing: [], data: ROSS_FICHA }] });
            return (await (await JSZip.loadAsync(await blob.arrayBuffer())).file('word/footnotes.xml')!.async('string')).replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '');
        };

        it('REGRESIÓN: una guía que no admite «Ibid.» (SBL) da la forma abreviada', async () => {
            const notas = await exportarRoss({ enabled: false, label: 'Ibid.', allowPageOverride: true });
            expect(notas).not.toContain('Ibid');
            expect(notas).toMatch(/Ross, Commentary on the Psalms, 565\.\s*Ross, Commentary on the Psalms, 566\./);
        });

        it('usa el rótulo de la guía', async () => {
            const notas = await exportarRoss({ enabled: true, label: 'Ibíd.', allowPageOverride: true });
            expect(notas).toMatch(/2011\), 565\.\s*Ibíd\.\s*Ibíd\., 566\./);
        });

        it('sin «Ibid.» con otra página, la página distinta va con la forma abreviada', async () => {
            const notas = await exportarRoss({ enabled: true, label: 'Ibid.', allowPageOverride: false });
            expect(notas).toMatch(/2011\), 565\.\s*Ibid\.\s*Ross, Commentary on the Psalms, 566\./);
        });
    });

    it('«Ibid.» va en cursiva, como el ejemplo de la guía de TMS', async () => {
        const blob = await exportPaperToDocx(paper({
            sources: [{ id: 's1', citationKey: 'Ross' }] as never,
            assembledMarkdown: ['## Versículo 1', '', 'Uno (Ross, p. 565). Dos (Ross, p. 566).'].join('\n'),
        }), { exportedAt: new Date('2026-09-17'), bibliography: [{ citationKey: 'Ross', displayLabel: 'C', text: 'y', missing: [], data: ROSS_FICHA }] });
        const xml = await (await JSZip.loadAsync(await blob.arrayBuffer())).file('word/footnotes.xml')!.async('string');
        expect(xml).toMatch(/<w:i\/>(?:(?!<\/w:r>).)*<w:t[^>]*>Ibid\.<\/w:t>/s);
        expect(xml.replace(/<[^>]+>/g, '')).toContain('Ibid., 566.');
    });

    it('REGRESIÓN: una nota sin ficha entre dos de la misma obra corta la racha del «Ibid.»', async () => {
        const blob = await exportPaperToDocx(paper({
            sources: [{ id: 's0', citationKey: 'Craigie' }, { id: 's1', citationKey: 'Ross' }] as never,
            assembledMarkdown: ['## Versículo 1', '', 'Uno (Craigie, p. 206). Dos (Ross, p. 5). Tres (Craigie, p. 210).'].join('\n'),
        }), {
            exportedAt: new Date('2026-09-17'),
            bibliography: [{ citationKey: 'Craigie', displayLabel: 'Psalms 1-50', text: 'x', missing: [], data: CRAIGIE }],
        });
        const n = await (await JSZip.loadAsync(await blob.arrayBuffer())).file('word/footnotes.xml')!.async('string');
        const texto = n.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '');
        expect(texto).toContain('Ross, p. 5');
        expect(texto).not.toContain('Ibid.');
        expect(texto).toContain('Craigie, Psalms, 210.');
    });

    it('sin ficha se escribe lo que decía el cuerpo, sin inventar editorial', async () => {
        // Una nota incompleta se ve y se corrige; una con una editorial
        // inventada no se ve.
        const sinFicha = paper({
            sources: [{ id: 's0', citationKey: 'Andersen' }] as never,
            assembledMarkdown: ['## Versículo 1', '', 'Así (Andersen, p. 42).'].join('\n'),
        });
        const blob = await exportPaperToDocx(sinFicha, { exportedAt: new Date('2026-09-17') });
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const n = await zip.file('word/footnotes.xml')!.async('string');
        expect(n).toContain('Andersen');
        expect(n).toContain('42');
    });
});

describe('exportPaperToDocx — la maquetación sale de la rúbrica', () => {
    const conFormato = (formatting: unknown) => paper({
        rubric: { ...DEFAULT_TMS_EXEGETICAL_RUBRIC, formatting },
    } as unknown as Partial<ExegeticalPaper>);

    it('sin rúbrica que diga otra cosa, manda la guía de la casa: doble espacio', async () => {
        const styles = await xmlOf(paper(), 'word/styles.xml');
        expect(styles).toMatch(/w:line="480"/);
    });

    it('el encuadre pide espacio simple y el documento sale a espacio simple', async () => {
        // Es el caso que originó el campo: el trabajo práctico semanal de
        // griego se pide a espacio simple y el exportador lo sacaba a doble,
        // porque el número estaba cableado.
        const styles = await xmlOf(
            conFormato({ lineSpacing: 'single', blankLineBetweenParagraphs: false }),
            'word/styles.xml',
        );
        const cuerpo = styles.slice(0, styles.indexOf('w:styleId="Heading1"'));
        expect(cuerpo).toMatch(/w:line="240"/);
        expect(cuerpo).not.toMatch(/w:line="480"/);
    });

    it('la línea entre párrafos se escribe como espacio posterior, no como renglón vacío', async () => {
        // Un renglón vacío es un párrafo más: se descuadra al editar y cuenta
        // en cualquier recuento que mire párrafos.
        const styles = await xmlOf(
            conFormato({ lineSpacing: 'single', blankLineBetweenParagraphs: true }),
            'word/styles.xml',
        );
        const cuerpo = styles.slice(0, styles.indexOf('w:styleId="Heading1"'));
        expect(cuerpo).toMatch(/w:after="240"/);
    });

    it('espacio y medio', async () => {
        const styles = await xmlOf(
            conFormato({ lineSpacing: 'one-and-a-half', blankLineBetweenParagraphs: false }),
            'word/styles.xml',
        );
        expect(styles.slice(0, styles.indexOf('w:styleId="Heading1"'))).toMatch(/w:line="360"/);
    });

    it('la sangría de primera línea no la toca el interlineado', async () => {
        const styles = await xmlOf(
            conFormato({ lineSpacing: 'single', blankLineBetweenParagraphs: true }),
            'word/styles.xml',
        );
        expect(styles).toMatch(/w:firstLine="720"/);
    });
});

describe('exportPaperToDocx — la portada como el estilo «Carátula» de TMS (TP #6)', () => {
    const portadaDe = async (cover: Partial<PaperCover>, title = 'Santiago 3:1-12') => {
        const doc = await xmlOf(paper({
            title,
            cover: { institution: "The Master's Seminary", author: 'Ricardo Cerda', place: 'Concepción, Chile', date: 'Octubre 2026', ...cover },
        } as Partial<ExegeticalPaper>), 'word/document.xml');
        return doc.slice(0, doc.indexOf('<w:sectPr'));
    };

    it('REGRESIÓN: ningún renglón de la portada lleva espacio después (heredaba 12 pt del cuerpo)', async () => {
        const portada = await portadaDe({ assignmentTitle: 'Trabajo práctico #6' });
        const parrafos = portada.match(/<w:p>[\s\S]*?<\/w:p>|<w:p [\s\S]*?<\/w:p>/g) ?? [];
        expect(parrafos.length).toBeGreaterThan(20);
        for (const p of parrafos) expect(p).toMatch(/<w:spacing[^>]*w:after="0"/);
    });

    it('REGRESIÓN: si el nombre de la entrega ya dice el pasaje, el pasaje no se repite', async () => {
        const portada = await portadaDe({ assignmentTitle: 'Trabajo Práctico #6 - Santiago 3:1−12' });
        expect(portada.match(/SANTIAGO 3:1/g)?.length).toBe(1);
    });

    it('si no lo dice, el pasaje va debajo del nombre de la entrega', async () => {
        const portada = await portadaDe({ assignmentTitle: 'Trabajo práctico #6' });
        expect(portada).toContain('TRABAJO PRÁCTICO #6');
        expect(portada).toContain('SANTIAGO 3:1–12');
    });

    it('un rango con signo menos (−) sale con guion medio', async () => {
        const portada = await portadaDe({ assignmentTitle: 'Trabajo práctico #6 - Santiago 3:1−12' });
        expect(portada).toContain('3:1–12');
        expect(portada).not.toContain('3:1−12');
    });
});

describe('exportPaperToDocx — la portada manda sobre la cabecera', () => {
    const conPortada = paper({
        cover: {
            institution: "The Master's Seminary", assignmentTitle: 'Trabajo práctico #4',
            author: 'Ricardo Cerda', place: 'Concepción, Chile', date: 'Septiembre 2026', course: null,
        },
    } as unknown as Partial<ExegeticalPaper>);

    it('con portada, el cuerpo NO repite título, pasaje ni fecha de exportación', async () => {
        const xml = await xmlOf(conPortada, 'word/document.xml');
        // La portada sí los dice, en mayúsculas y centrados. Lo que no puede
        // pasar es que la página 1 del cuerpo los repita con «Exportado».
        expect(xml).not.toContain('Exportado');
    });

    it('sin portada, la cabecera se conserva: el archivo tiene que decir de qué es', async () => {
        const xml = await xmlOf(paper(), 'word/document.xml');
        expect(xml).toContain('Exportado');
    });
});

describe('exportPaperToDocx — la bibliografía generada', () => {
    /** Un trabajo sin `assembledMarkdown`: el cuerpo sale de los pasos aceptados. */
    const sinEnsamblar = paper({
        assembledMarkdown: null,
        steps: [{
            kind: 'verse', order: 0,
            verseRef: { bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 1, verseEnd: 1 },
            accepted: { markdown: 'El salmo abre con una metáfora pastoral.' },
        }],
    } as unknown as Partial<ExegeticalPaper>);

    it('la sección entra con sangría francesa y sin viñeta', async () => {
        const blob = await exportPaperToDocx(sinEnsamblar, {
            exportedAt: new Date('2026-09-17'),
            bibliography: [{
                citationKey: 'Ross', displayLabel: 'A Commentary on the Psalms',
                text: 'Ross, Allen P. *A Commentary on the Psalms*. Grand Rapids: Kregel, 2011.',
                missing: [], data: null,
            }],
        });
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const xml = await zip.file('word/document.xml')!.async('string');
        expect(xml).toContain('BIBLIOGRAF');
        expect(xml).toContain('Ross, Allen P.');
        // Sangría francesa: medio pulgada a la izquierda y media negativa en
        // la primera línea. Sin esto la entrada sale como un párrafo normal.
        expect(xml).toMatch(/w:ind[^>]*w:hanging="720"/);
        // Y sin viñeta: una bibliografía con topos no es una bibliografía.
        const desdeBiblio = xml.slice(xml.indexOf('BIBLIOGRAF'));
        expect(desdeBiblio).not.toContain('w:numPr');
    });

    it('una ficha incompleta llega al documento diciendo qué le falta', async () => {
        const blob = await exportPaperToDocx(sinEnsamblar, {
            exportedAt: new Date('2026-09-17'),
            bibliography: [{
                citationKey: 'Adamson', displayLabel: 'The Epistle of James',
                text: null, missing: ['city', 'publisher', 'year'], data: null,
            }],
        });
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const xml = await zip.file('word/document.xml')!.async('string');
        expect(xml).toContain('FICHA INCOMPLETA');
        expect(xml).toContain('The Epistle of James');
        // REGRESIÓN (TP #6): lo que falta, nombrado en el idioma del trabajo,
        // no con la clave interna en inglés.
        expect(xml).toContain('faltan: ciudad, editorial, año');
        expect(xml).not.toMatch(/city|publisher/);
    });
});

describe('exportPaperToDocx — formato de la guía', () => {
    it('el documento entero va en Times New Roman 12 a doble espacio', async () => {
        const styles = await xmlOf(paper(), 'word/styles.xml');
        expect(styles).toContain('Times New Roman');
        // 24 medios puntos = 12 pt; 480 veinteavos = doble espacio.
        expect(styles).toMatch(/w:sz w:val="24"/);
        expect(styles).toMatch(/w:line="480"/);
        // Sangría de primera línea de media pulgada.
        expect(styles).toMatch(/w:firstLine="720"/);
    });

    it('los títulos son del mismo cuerpo, negros y centrados: no los azules de Word', async () => {
        const styles = await xmlOf(paper(), 'word/styles.xml');
        const heading1 = styles.slice(styles.indexOf('w:styleId="Heading1"'));
        expect(heading1).toContain('w:val="000000"');
        expect(heading1).toMatch(/w:jc w:val="center"/);
    });

    it('la hoja es carta con márgenes de una pulgada', async () => {
        const doc = await xmlOf(paper(), 'word/document.xml');
        expect(doc).toContain('w:w="12240"');
        expect(doc).toContain('w:h="15840"');
        expect(doc).toMatch(/w:top="1440"/);
    });

    it('una cita hebrea va de derecha a izquierda y alineada a ese lado', async () => {
        const doc = await xmlOf(paper(), 'word/document.xml');
        expect(doc).toContain('<w:rtl/>');
        expect(doc).toMatch(/w:jc w:val="right"/);
        // Y sus espacios no se parten entre renglones.
        expect(doc).toContain(' ');
    });

    it('la cita entre paréntesis sale como nota al pie a 10 pt y espacio simple', async () => {
        const notes = await xmlOf(paper(), 'word/footnotes.xml');
        expect(notes).toContain('Syntax');
        expect(notes).toMatch(/w:sz w:val="20"/);
        expect(notes).toMatch(/w:line="240"/);
    });

    it('la bibliografía empieza en página nueva y va con sangría francesa', async () => {
        const doc = await xmlOf(paper(), 'word/document.xml');
        // El título de la bibliografía empieza la hoja por sí mismo: sin un
        // salto de página DENTRO del título, que dejaba un renglón de título
        // vacío al pie de la hoja anterior.
        const titulo = doc.slice(doc.lastIndexOf('<w:p>', doc.indexOf('BIBLIOGRAF')) , doc.indexOf('BIBLIOGRAF'));
        expect(titulo).toContain('<w:pageBreakBefore/>');
        expect(titulo).not.toContain('<w:br w:type="page"/>');
        expect(doc).toMatch(/w:hanging="720"/);
    });

    it('sin datos de portada no se inventa una', async () => {
        const doc = await xmlOf(paper(), 'word/document.xml');
        expect(doc).not.toContain('POR');
    });

    it('con datos de portada, la portada va primero, en mayúsculas y sin número de página', async () => {
        const doc = await xmlOf(paper({
            cover: { institution: "The Master's Seminary", author: 'Ricardo Cerda', place: 'Chiguayante, Concepción', date: 'Septiembre 2026' },
        } as Partial<ExegeticalPaper>), 'word/document.xml');

        // El apóstrofo viaja escapado en el XML.
        expect(doc).toContain('THE MASTER’S SEMINARY');
        expect(doc).toContain('RICARDO CERDA');
        expect(doc).toContain('POR');
        expect(doc.indexOf('THE MASTER’S SEMINARY')).toBeLessThan(doc.indexOf('Introducción'));
        // Dos secciones: la portada y el cuerpo.
        expect(doc.match(/<w:sectPr/g)?.length).toBe(2);
    });

    it('el título del trabajo va ENCIMA del pasaje, que es como lo nombra el profesor', async () => {
        // La portada abría con el pasaje y el trabajo llegaba sin
        // identificarse: «Trabajo práctico #3» es el renglón que el
        // profesor busca para saber qué entrega está corrigiendo.
        const doc = await xmlOf(paper({
            cover: {
                institution: "The Master's Seminary",
                assignmentTitle: 'Trabajo práctico #3',
                author: 'Ricardo Cerda',
                place: 'Concepción, Chile',
                date: 'Septiembre 2026',
            },
        } as Partial<ExegeticalPaper>), 'word/document.xml');

        expect(doc).toContain('TRABAJO PRÁCTICO #3');
        expect(doc.indexOf('THE MASTER’S SEMINARY')).toBeLessThan(doc.indexOf('TRABAJO PRÁCTICO #3'));
        expect(doc.indexOf('TRABAJO PRÁCTICO #3')).toBeLessThan(doc.indexOf('POR'));
    });

    it('los renglones en blanco son los del modelo TMS: 3 · 6 · 6 · 3', async () => {
        // Guía TMS cap. 1, «Página de título». Salía 4 · 6 · 7 · 4: un renglón
        // vacío de arranque más los pedidos, y el curso vacío sumaba otro.
        const doc = await xmlOf(paper({
            cover: {
                institution: "The Master's Seminary",
                assignmentTitle: 'Trabajo práctico #5',
                author: 'Ricardo Cerda',
                place: 'Concepción, Chile',
                date: 'Septiembre 2026',
            },
        } as Partial<ExegeticalPaper>), 'word/document.xml');

        // Los párrafos de la portada, hasta el primer cambio de sección: texto
        // o vacío, en orden.
        const portada = doc.slice(0, doc.indexOf('<w:sectPr'));
        const renglones = [...portada.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)]
            .map(m => [...m[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(t => t[1]).join('').trim());
        // «X» por renglón con texto, número por racha de vacíos.
        const forma: Array<string | number> = [];
        for (const r of renglones) {
            if (r) forma.push('X');
            else if (typeof forma[forma.length - 1] === 'number') (forma[forma.length - 1] as number)++;
            else forma.push(1);
        }
        // 3 · SEMINARIO · 6 · TÍTULO (entrega + pasaje) · 6 · POR / AUTOR · 3 · LUGAR / FECHA
        expect(forma).toEqual([3, 'X', 6, 'X', 'X', 6, 'X', 'X', 3, 'X', 'X']);
    });

    it('el exportador imprime TODOS los campos de la portada, no una lista aparte', async () => {
        // El exportador arma la portada renglón por renglón, con sus
        // líneas en blanco, así que no puede recorrer la lista del
        // dominio. Esta prueba es lo que los ata: un campo nuevo que
        // alguien agregue al dominio y olvide aquí deja de imprimirse
        // sin un solo error, que es el mismo fallo que ya costó el
        // título del trabajo una capa más abajo.
        const marcas = Object.fromEntries(
            PAPER_COVER_FIELDS.map(campo => [campo, `marca${campo}`]),
        ) as PaperCover;
        const doc = await xmlOf(paper({ cover: marcas } as Partial<ExegeticalPaper>), 'word/document.xml');

        const ausentes = PAPER_COVER_FIELDS.filter(
            campo => !doc.includes(`MARCA${campo.toLocaleUpperCase('es')}`),
        );
        expect(ausentes, 'campos que el exportador NO imprime').toEqual([]);
    });

    // Las dos que siguen fijan comportamiento que ya existía antes de
    // agregar el título: el curso nunca fue obligatorio en el exportador.
    // No prueban nada nuevo de este cambio y no pretenden hacerlo; están
    // para que el reordenamiento del formulario no lo rompa sin querer.
    it('sin curso no aparece ningún renglón de curso: la portada del seminario no lo lleva', async () => {
        const doc = await xmlOf(paper({
            cover: { institution: "The Master's Seminary", author: 'Ricardo Cerda' },
        } as Partial<ExegeticalPaper>), 'word/document.xml');
        expect(doc).not.toContain('OT603');
    });

    it('con curso escrito, se imprime: otra guía sí puede pedirlo', async () => {
        const doc = await xmlOf(paper({
            cover: { institution: "The Master's Seminary", author: 'Ricardo Cerda', course: 'OT603' },
        } as Partial<ExegeticalPaper>), 'word/document.xml');
        expect(doc).toContain('OT603');
    });

    it('el cuerpo numera sus páginas: la primera abajo al centro, las demás arriba a la derecha', async () => {
        const doc = await xmlOf(paper(), 'word/document.xml');
        expect(doc).toMatch(/w:titlePg/);
        // El número es un campo, en el encabezado y en el pie de la
        // primera página; Word lo actualiza solo al repaginar.
        const parts = await headersAndFooters(paper());
        const withPage = parts.filter(p => p.xml.includes('PAGE'));
        expect(withPage.some(p => p.name.includes('header') && /w:jc w:val="right"/.test(p.xml))).toBe(true);
        expect(withPage.some(p => p.name.includes('footer') && /w:jc w:val="center"/.test(p.xml))).toBe(true);
    });
});


/**
 * La portada se arma como dice la guía del trabajo (pendiente 21 de la fase
 * del TP de Santiago): antes, renglones, mayúsculas y «POR» estaban fijos.
 */
describe('exportPaperToDocx — la portada sigue la guía de estilo', () => {
    const conPortada = paper({
        cover: { institution: 'Seminario Bíblico', author: 'Ricardo Cerda', place: 'Concepción', date: 'Octubre 2026' },
    } as Partial<ExegeticalPaper>);
    const portadaDe = async (coverStyle?: CoverStyle) => {
        const blob = await exportPaperToDocx(conPortada, { exportedAt: new Date('2026-10-03'), coverStyle });
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const doc = await zip.file('word/document.xml')!.async('string');
        const portada = doc.slice(0, doc.indexOf('<w:sectPr'));
        return [...portada.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)]
            .map(m => [...m[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(t => t[1]).join('').trim());
    };

    it('sin estilo de la guía, la de TMS: mayúsculas y «POR»', async () => {
        const r = await portadaDe();
        expect(r).toContain('SEMINARIO BÍBLICO');
        expect(r).toContain('POR');
    });

    it('con el de la guía: sus renglones, sin mayúsculas y su palabra antes del autor', async () => {
        const r = await portadaDe({ layout: { beforeInstitution: 1, afterInstitution: 2, afterTitle: 2, afterAuthor: 1 }, uppercase: false, byLine: 'Presentado por' });
        expect(r).toContain('Seminario Bíblico');
        expect(r).toContain('Presentado por');
        expect(r).not.toContain('POR');
        expect(r.slice(0, 2)).toEqual(['', 'Seminario Bíblico']);
    });

    it('palabra con sólo espacios cuenta como vacía: no corre la portada un renglón', async () => {
        const vacia = await portadaDe({ layout: { beforeInstitution: 3, afterInstitution: 6, afterTitle: 6, afterAuthor: 3 }, uppercase: true, byLine: '' });
        const espacios = await portadaDe({ layout: { beforeInstitution: 3, afterInstitution: 6, afterTitle: 6, afterAuthor: 3 }, uppercase: true, byLine: '   ' });
        expect(espacios).toEqual(vacia);
    });

    it('palabra vacía: no lleva esa línea', async () => {
        const r = await portadaDe({ layout: { beforeInstitution: 3, afterInstitution: 6, afterTitle: 6, afterAuthor: 3 }, uppercase: true, byLine: '' });
        expect(r).not.toContain('POR');
        expect(r).toContain('RICARDO CERDA');
    });
});

describe('exportPaperToDocx — encabezados y apóstrofos como pide la guía de TMS (devolución del TI #1)', () => {
    const conSecciones = paper({
        assembledMarkdown: [
            '## Análisis sintáctico y léxico de Salmo 23:1–3',
            '',
            'El texto. Waltke y O\'Connor explican el polel.',
            '',
            '---',
            '',
            '### Una identidad sin verbo',
            '',
            'Otro párrafo con \'comillas simples\'.',
            '',
            '## Bibliografía',
            '',
            '- Waltke, Bruce K., y M. O\'Connor. *An Introduction to Biblical Hebrew Syntax*.',
        ].join('\n'),
    });

    it('REGRESIÓN (B51): 12 pt antes de cada encabezado, una línea después; sin párrafo vacío por «---»', async () => {
        const styles = await xmlOf(conSecciones, 'word/styles.xml');
        const h2 = styles.slice(styles.indexOf('w:styleId="Heading2"'), styles.indexOf('</w:style>', styles.indexOf('w:styleId="Heading2"')));
        expect(h2).toMatch(/w:before="240"/);
        expect(h2).toMatch(/w:after="240"/);
        expect(h2).not.toMatch(/w:before="480"/);
        const doc = await xmlOf(conSecciones, 'word/document.xml');
        // Ningún párrafo vacío entre la sección y el subtítulo.
        expect(doc).not.toMatch(/<w:p>(?:<w:pPr>(?:(?!<\/w:pPr>).)*<\/w:pPr>)?<w:r>(?:<w:rPr>(?:(?!<\/w:rPr>).)*<\/w:rPr>)?<w:t(?: [^>]*)?><\/w:t><\/w:r><\/w:p>/);
    });

    it('el nivel tres va alineado a la izquierda; la bibliografía, en mayúsculas con dos líneas después', async () => {
        const styles = await xmlOf(conSecciones, 'word/styles.xml');
        const h3 = styles.slice(styles.indexOf('w:styleId="Heading3"'), styles.indexOf('</w:style>', styles.indexOf('w:styleId="Heading3"')));
        expect(h3).toMatch(/w:jc w:val="(left|start)"/);
        const doc = await xmlOf(conSecciones, 'word/document.xml');
        const biblio = doc.slice(doc.lastIndexOf('<w:p>', doc.indexOf('BIBLIOGRAF')), doc.indexOf('BIBLIOGRAF'));
        expect(biblio).toMatch(/w:after="480"/);
    });

    it('REGRESIÓN (B52): «O\'Connor» sale con apóstrofo tipográfico, en el cuerpo y en la bibliografía', async () => {
        const doc = await xmlOf(conSecciones, 'word/document.xml');
        expect(doc).toContain('O’Connor explican');
        expect(doc).toContain('M. O’Connor');
        expect(doc).toContain('‘comillas simples’');
        expect(doc).not.toContain('O&apos;Connor');
    });
});


describe('exportPaperToDocx — niveles de encabezado de la guía de TMS (hoja 11)', () => {
    /** Lo que de verdad escribe el ensamble: `#` título, `##` cada sección, `###` las cuestiones. */
    const ensamblado = (): ExegeticalPaper => {
        const PSA = (v: number) => ({ bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: v, verseEnd: v });
        const base = paper({ title: 'Análisis sintáctico y léxico de Salmo 23:4–6' });
        const steps = [
            { id: 'i', order: 0, kind: 'introduction', verseRef: null, includeInDocument: true, accepted: { markdown: 'La introducción.' } },
            { id: 'v4', order: 4, kind: 'verse', verseRef: PSA(4), includeInDocument: true, accepted: { markdown: 'El versículo.\n\n### La vara y el cayado\n\nLa cuestión.' } },
            { id: 'c', order: 90, kind: 'conclusion', verseRef: null, includeInDocument: true, accepted: { markdown: 'La conclusión.' } },
        ];
        const conPasos = { ...base, passage: PSA(4), steps } as unknown as ExegeticalPaper;
        return { ...conPasos, assembledMarkdown: assembleMarkdown(conPasos, 'es') };
    };
    const nivelDe = (doc: string, texto: string): string | null => {
        // El párrafo que contiene el texto: `<w:p>` o `<w:p …>` (docx le pone atributos).
        // La última aparición: sin portada, la cabecera de trabajo repite el
        // título y el pasaje antes del cuerpo.
        const i = doc.lastIndexOf(texto);
        const p = doc.slice(0, i).split(/(?=<w:p[ >])/).pop() ?? '';
        return p.match(/<w:pStyle w:val="(Heading\d)"/)?.[1] ?? null;
    };

    it('REGRESIÓN TI #2: el título y cada sección van en nivel uno; las cuestiones, en nivel dos', async () => {
        const doc = await xmlOf(ensamblado(), 'word/document.xml');
        expect(nivelDe(doc, 'Análisis sintáctico y léxico')).toBe('Heading1');
        expect(nivelDe(doc, 'Introducción')).toBe('Heading1');
        expect(nivelDe(doc, 'Salmo 23:4')).toBe('Heading1');
        expect(nivelDe(doc, 'La vara y el cayado')).toBe('Heading2');
        expect(nivelDe(doc, 'Conclusión')).toBe('Heading1');
    });

    it('nivel uno en negrita y centrado; nivel dos centrado y sin negrita; los dos con 12 pt antes y una línea después', async () => {
        const styles = await xmlOf(ensamblado(), 'word/styles.xml');
        const estilo = (id: string) => styles.slice(styles.indexOf(`w:styleId="${id}"`), styles.indexOf('</w:style>', styles.indexOf(`w:styleId="${id}"`)));
        for (const id of ['Heading1', 'Heading2']) {
            // Medido en el PDF del TI #1: con 24 pt antes quedan TRES líneas en
            // blanco (51,6 pt entre líneas base), porque el párrafo anterior a
            // doble espacio ya deja una. La guía pide dos: 12 pt (su nota 10).
            expect(estilo(id)).toMatch(/w:before="240"/);
            expect(estilo(id)).toMatch(/w:after="240"/);
            expect(estilo(id)).toMatch(/w:jc w:val="center"/);
        }
        expect(estilo('Heading1')).toMatch(/<w:b\/>/);
        expect(estilo('Heading2')).not.toMatch(/<w:b\/>/);
    });

    it('BIBLIOGRAFÍA: nivel uno para el índice, en mayúsculas y sin negrita, como en la propia guía', async () => {
        const doc = await xmlOf(ensamblado(), 'word/document.xml');
        const conBiblio = await xmlOf({ ...ensamblado(), assembledMarkdown: `${ensamblado().assembledMarkdown}\n## Bibliografía\n\n- Ross, Allen P. *A Commentary on the Psalms*.\n` } as ExegeticalPaper, 'word/document.xml');
        expect(doc).not.toContain('BIBLIOGRAF');
        expect(nivelDe(conBiblio, 'BIBLIOGRAFÍA')).toBe('Heading1');
        const run = conBiblio.slice(conBiblio.lastIndexOf('<w:r>', conBiblio.indexOf('BIBLIOGRAFÍA')), conBiblio.indexOf('BIBLIOGRAFÍA'));
        expect(run).toMatch(/<w:b w:val="(false|0)"\/>/);
    });

    it('`####` es nivel tres y nada pasa del tres', () => {
        expect([1, 2, 3, 4, 5].map(nivelDeWord)).toEqual([1, 1, 2, 3, 3]);
    });
});
