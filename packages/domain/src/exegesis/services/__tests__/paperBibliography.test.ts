import { describe, it, expect } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import type { CanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import type { ExegeticalPaper } from '../../entities/ExegeticalPaper';
import { exportPaperToMarkdown } from '../../entities/exportPaperToMarkdown';
import { buildPaperBibliography, citedSourceKeys } from '../paperBibliography';
import type { BibliographySourceRow } from '../paperBibliography';

const analisisCitando = (...sourceKeys: string[]): CanonicalVerseAnalysis => ({
    ...buildEmptyCanonicalVerseAnalysis({ bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 1, verseEnd: 1 }),
    commentatorEngagement: sourceKeys.map((sourceKey, i) => ({
        sourceKey, page: 54 + i, role: 'anchor', position: 'x',
    })),
} as CanonicalVerseAnalysis);

const paper = (steps: Array<{ aceptado?: CanonicalVerseAnalysis }>): ExegeticalPaper => ({
    passage: { bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 1, verseEnd: 13 },
    displayLanguage: 'es',
    title: 'Santiago 2:1–13',
    steps: steps.map((s, i) => ({
        kind: 'verse',
        order: i,
        verseRef: { bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: i + 1, verseEnd: i + 1 },
        accepted: s.aceptado ? { markdown: 'cuerpo', canonicalAnalysis: s.aceptado } : null,
    })),
} as unknown as ExegeticalPaper);

const FICHAS: BibliographySourceRow[] = [
    {
        citationKey: 'Porter', displayLabel: 'Idioms of the Greek New Testament',
        data: {
            author: 'Stanley E. Porter', authorSorted: 'Porter, Stanley E.',
            title: 'Idioms of the Greek New Testament',
            city: 'London', publisher: 'Continuum', year: '1999',
        },
    },
    {
        citationKey: 'Mayor', displayLabel: 'The Epistle of St. James',
        data: {
            author: 'Joseph B. Mayor', authorSorted: 'Mayor, Joseph B.',
            title: 'The Epistle of St. James',
            city: 'Grand Rapids', publisher: 'Baker Book House', year: '1978',
        },
    },
    {
        citationKey: 'Adamson', displayLabel: 'The Epistle of James (NICNT)',
        data: null,
    },
    {
        citationKey: 'Metzger', displayLabel: 'A Textual Commentary',
        data: {
            author: 'Bruce M. Metzger', authorSorted: 'Metzger, Bruce M.',
            title: 'A Textual Commentary on the Greek New Testament',
            city: 'Stuttgart', publisher: 'UBS', year: '1994',
        },
    },
];

describe('citedSourceKeys', () => {
    it('sólo cuenta los pasos aceptados', () => {
        const p = paper([
            { aceptado: analisisCitando('Mayor') },
            {},
        ]);
        expect([...citedSourceKeys(p)]).toEqual(['Mayor']);
    });

    it('junta las claves de todos los versículos aceptados, sin repetir', () => {
        const p = paper([
            { aceptado: analisisCitando('Mayor', 'Porter') },
            { aceptado: analisisCitando('Mayor', 'Adamson') },
        ]);
        expect([...citedSourceKeys(p)].sort()).toEqual(['Adamson', 'Mayor', 'Porter']);
    });
});

describe('buildPaperBibliography', () => {
    it('una fuente configurada pero NO citada no entra', () => {
        // El corpus de Santiago 2:1-13 tenía siete fuentes y el trabajo citó
        // cinco. Imprimir Metzger sin haberlo citado declara una lectura que
        // no ocurrió.
        const entries = buildPaperBibliography(paper([{ aceptado: analisisCitando('Mayor', 'Porter') }]), FICHAS);
        expect(entries.map(e => e.citationKey)).toEqual(['Mayor', 'Porter']);
    });

    it('una fuente citada que ya no está en el corpus no desaparece', () => {
        // Pasa cuando se quita la fuente después de generar: el cuerpo sigue
        // citándola. Que falte en la bibliografía es peor que verla coja,
        // porque no se nota.
        const entries = buildPaperBibliography(paper([{ aceptado: analisisCitando('Wallace') }]), FICHAS);
        expect(entries).toHaveLength(1);
        expect(entries[0]!.citationKey).toBe('Wallace');
        expect(entries[0]!.text).toBeNull();
    });

    it('ordena por el apellido que la entrada va a imprimir', () => {
        const entries = buildPaperBibliography(
            paper([{ aceptado: analisisCitando('Porter', 'Adamson', 'Mayor') }]),
            FICHAS,
        );
        // Adamson no tiene ficha: ordena por su rótulo, «The Epistle of
        // James (NICNT)», que cae después de Mayor y Porter.
        expect(entries.map(e => e.citationKey)).toEqual(['Mayor', 'Porter', 'Adamson']);
    });

    it('una ficha incompleta no se omite ni se rellena: se devuelve con lo que falta', () => {
        const entries = buildPaperBibliography(paper([{ aceptado: analisisCitando('Adamson') }]), FICHAS);
        expect(entries).toHaveLength(1);
        expect(entries[0]!.text).toBeNull();
        expect(entries[0]!.missing).toEqual(['author', 'title', 'city', 'publisher', 'year']);
    });

    it('una ficha completa se formatea en Turabian', () => {
        const entries = buildPaperBibliography(paper([{ aceptado: analisisCitando('Porter') }]), FICHAS);
        expect(entries[0]!.text).toBe(
            'Porter, Stanley E. *Idioms of the Greek New Testament*. London: Continuum, 1999.',
        );
    });
});

describe('exportPaperToMarkdown — la bibliografía llega al documento', () => {
    const p = paper([{ aceptado: analisisCitando('Mayor', 'Adamson') }]);

    it('sin bibliografía no hay sección: es lo que ven los contadores de largo', () => {
        // `PaperLengthCard` llama a esta misma función. Sumarle la
        // bibliografía inflaría un conteo que la rúbrica no cuenta.
        const md = exportPaperToMarkdown(p);
        expect(md).not.toContain('## Bibliografía');
    });

    it('con bibliografía, la sección lleva el encabezado que el exportador Word busca', () => {
        const md = exportPaperToMarkdown(p, { bibliography: buildPaperBibliography(p, FICHAS) });
        expect(md).toContain('## Bibliografía');
        expect(md).toContain('- Mayor, Joseph B. *The Epistle of St. James*. Grand Rapids: Baker Book House, 1978.');
    });

    it('sin portada, la cabecera de trabajo identifica el archivo', () => {
        const md = exportPaperToMarkdown(p, { exportedAt: new Date('2026-09-23') });
        expect(md).toContain('# Santiago 2:1–13');
        expect(md).toContain('**Pasaje:**');
        expect(md).toContain('**Exportado:** 2026-09-23');
    });

    it('con portada, la cabecera de trabajo desaparece y el cuerpo abre el documento', () => {
        // «Exportado: 2026-09-23» impreso sobre la página 1 de un trabajo con
        // portada delata la herramienta. El cuerpo empieza en el contenido.
        const md = exportPaperToMarkdown(p, { exportedAt: new Date('2026-09-23'), omitHeader: true });
        expect(md).not.toContain('**Exportado:**');
        expect(md).not.toContain('**Pasaje:**');
        expect(md).not.toContain('# Santiago 2:1–13');
        expect(md.trimStart().startsWith('## ')).toBe(true);
    });

    it('sin cabecera, la bibliografía sigue entrando', () => {
        const md = exportPaperToMarkdown(p, {
            omitHeader: true,
            bibliography: buildPaperBibliography(p, FICHAS),
        });
        expect(md).toContain('## Bibliografía');
    });

    it('si el cuerpo ya trae una bibliografía, no se agrega otra', () => {
        // `assembledMarkdown` se usa literal y puede venir del ensamblado o
        // de la mano del usuario. Añadir una segunda dejaría el documento con
        // dos, y la segunda saldría en página nueva como si fuera un anexo.
        const conBiblio = {
            ...paper([{ aceptado: analisisCitando('Mayor') }]),
            assembledMarkdown: '## Versículo 1\n\ncuerpo\n\n## Bibliografía\n\n- Escrita a mano.',
        } as ExegeticalPaper;
        const md = exportPaperToMarkdown(conBiblio, {
            bibliography: buildPaperBibliography(conBiblio, FICHAS),
        });
        expect(md.match(/## Bibliograf/g)).toHaveLength(1);
        expect(md).toContain('- Escrita a mano.');
    });

    it('la ficha coja se imprime fea, para que no se entregue sin verla', () => {
        const md = exportPaperToMarkdown(p, { bibliography: buildPaperBibliography(p, FICHAS) });
        expect(md).toContain('- The Epistle of James (NICNT). [FICHA INCOMPLETA, faltan: author, title, city, publisher, year]');
    });
});
