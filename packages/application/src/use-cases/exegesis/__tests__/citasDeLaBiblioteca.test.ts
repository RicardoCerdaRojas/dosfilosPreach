import { describe, it, expect, vi } from 'vitest';
import { VerifySermonCitationsUseCase, workTitleOf, type LibraryWorkText } from '../VerifySermonCitationsUseCase';

/**
 * Sermón 6 de Jonás (2026-10-03): el verificador de publicar marcó «probable
 * cita inventada» a tres citas LITERALES de la biblioteca del pastor (Burt
 * p. 89 ×2, Calvino p. 66), elegidas con «Buscar citas en mi biblioteca».
 * Cotejaba sólo contra el paper y el manifiesto, y la de Calvino lleva «[…]».
 */
const LIBRO = 'Dios dice, ¿Tanto te enojas por la calabacera? Como si hubiera dicho que un asunto tan baladí '
    + 'lo había perturbado con excesiva violencia. Luego sigue otra cosa. Dios no meramente reprendió a Su siervo '
    + 'por no tolerar con paciencia el marchitamiento de la calabacera.';

function sermonCon(cita: string) {
    return {
        id: 's1', userId: 'u1',
        content: `## II. El apego\n\n> “${cita}” — Juan Calvino, Comentario Jonas, p. 66\n\nSigue el sermón.`,
    };
}

function montar(cita: string, libro: LibraryWorkText | undefined) {
    return new VerifySermonCitationsUseCase(
        { findById: vi.fn().mockResolvedValue(sermonCon(cita)) } as never,
        { getPaper: vi.fn() } as never,
        { getSession: vi.fn() } as never,
        libro,
    );
}

const RECORTADA = 'Dios dice, ¿Tanto te enojas por la calabacera? Como si hubiera dicho que un asunto tan baladí lo había perturbado con excesiva violencia. […] Dios no meramente reprendió a Su siervo por no tolerar con paciencia el marchitamiento de la calabacera.';

describe('VerifySermonCitationsUseCase — citas de la biblioteca del pastor', () => {
    it('una cita literal recortada con «[…]» se verifica contra el libro citado', async () => {
        const libro = vi.fn().mockResolvedValue({ author: 'Juan Calvino', text: LIBRO });
        const r = await montar(RECORTADA, libro).execute({ ownerId: 'u1', sermonId: 's1' });
        expect(libro).toHaveBeenCalledWith('u1', 'Comentario Jonas', 'Juan Calvino');
        expect(r.citations.map(c => c.status)).toEqual(['verified']);
        // Literal, trozo por trozo: no por la similitud difusa, que también aprueba paráfrasis.
        expect(r.citations[0]!.similarity).toBe(1);
        expect(r.sourceKind).toBe('library');
    });

    it('una cita que el libro no dice sigue marcada', async () => {
        const r = await montar('Calvino nunca escribió esta frase sobre la calabacera y el enojo de Jonás en su comentario.', vi.fn().mockResolvedValue({ author: 'Juan Calvino', text: LIBRO }))
            .execute({ ownerId: 'u1', sermonId: 's1' });
        expect(r.citations[0]!.status).not.toBe('verified');
    });

    it('si el libro no está en la biblioteca, no se inventa una verificación', async () => {
        const r = await montar(RECORTADA, vi.fn().mockResolvedValue(null)).execute({ ownerId: 'u1', sermonId: 's1' });
        expect(r.citations[0]!.status).toBe('not-found');
    });
});

describe('workTitleOf', () => {
    it('quita la página de la atribución', () => {
        expect(workTitleOf('Comentario Jonás, p. 89')).toBe('Comentario Jonás');
        expect(workTitleOf('Comentario Jonás, pp. 89–90')).toBe('Comentario Jonás');
        expect(workTitleOf('Comentario Jonás')).toBe('Comentario Jonás');
        expect(workTitleOf(null)).toBeNull();
    });
});

describe('parseSermonCitations — las formas que escribe nuestro motor', async () => {
    const { parseSermonCitations } = await import('../sermonCitationParser');
    const contenido = [
        '### Cita de autoridad',
        '',
        '"La lástima de Jonás se corresponde con sus intereses personales. En realidad, la pena que Jonás siente, aunque él pueda pensar que se debe a la muerte "injusta" de la planta, es más bien lástima de sí mismo." — David F. Burt, Comentario Jonás, p. 89',
        '',
        '"Dios dice, ¿Tanto te enojas por la calabacera? Como si hubiera dicho que un asunto tan baladí lo había perturbado. \\[…] Dios no meramente reprendió a Su siervo." — Juan Calvino, Comentario Jonas, p. 66',
    ].join('\n');
    const citas = parseSermonCitations(contenido);

    it('autor con iniciales, obra y página enteros; una cita por atribución', () => {
        expect(citas.map(c => [c.author, c.source])).toEqual([
            ['David F. Burt', 'Comentario Jonás, p. 89'],
            ['Juan Calvino', 'Comentario Jonas, p. 66'],
        ]);
    });

    it('la comilla interna no parte la cita, y el «\\[…]» llega como «[…]»', () => {
        expect(citas[0]!.quote).toContain('"injusta" de la planta');
        expect(citas[1]!.quote).toContain('perturbado. […] Dios');
    });
});

describe('parseSermonCitations — revisión adversarial de R1', async () => {
    const { parseSermonCitations } = await import('../sermonCitationParser');

    it('dos citas en una línea son dos citas, cada una con su autor', () => {
        const c = parseSermonCitations('"Jonás se enoja por la planta y no por la ciudad." — Burt. Y Calvino añade: "En la ira siempre hay exceso, dice el comentario." — Juan Calvino, Comentario Jonas, p. 66');
        expect(c.map(x => x.author)).toEqual(['Burt', 'Juan Calvino']);
        expect(c[1]!.source).toBe('Comentario Jonas, p. 66');
    });

    it('a mitad de párrafo, el autor termina en el fin de la oración', () => {
        const [c] = parseSermonCitations('Como dice "la compasión de Dios es noble y altruista" — David F. Burt. Y así el sermón sigue con muchas palabras.');
        expect(c!.author).toBe('David F. Burt');
    });
});

describe('VerifySermonCitationsUseCase — no verificar una fabricación (revisión adversarial de R1)', () => {
    const LIBRO_BURT = 'Nínive era una gran ciudad. Dios es soberano sobre la creación entera. El profeta huye de su llamado. '
        + 'La lástima de Jonás se corresponde con sus intereses personales, mientras que la de Dios es desinteresada.';
    const montarCon = (contenido: string, libro: { author: string; text: string } | null) =>
        new VerifySermonCitationsUseCase(
            { findById: vi.fn().mockResolvedValue({ id: 's1', userId: 'u1', content: contenido }) } as never,
            { getPaper: vi.fn() } as never,
            { getSession: vi.fn() } as never,
            vi.fn().mockResolvedValue(libro),
        );

    it('palabras sueltas del libro cosidas con «…» no se verifican', async () => {
        const r = await montarCon('"Nínive era una gran ciudad… Dios es soberano… El profeta huye" — David F. Burt, Comentario Jonás, p. 89', { author: 'David F. Burt', text: LIBRO_BURT })
            .execute({ ownerId: 'u1', sermonId: 's1' });
        expect(r.citations[0]!.similarity).not.toBe(1);
    });

    it('trozos reales demasiado separados no se dan por una cita', async () => {
        const lejos = LIBRO_BURT.replace('Dios es soberano', 'Dios es soberano ' + 'relleno '.repeat(600));
        const r = await montarCon('"Nínive era una gran ciudad. [...] El profeta huye de su llamado." — David F. Burt, Comentario Jonás, p. 89', { author: 'David F. Burt', text: lejos })
            .execute({ ownerId: 'u1', sermonId: 's1' });
        expect(r.citations[0]!.similarity).not.toBe(1);
    });

    it('una elisión legítima («[...]» entre trozos cercanos y en orden) sí', async () => {
        const r = await montarCon('"Nínive era una gran ciudad. [...] El profeta huye de su llamado." — David F. Burt, Comentario Jonás, p. 89', { author: 'David F. Burt', text: LIBRO_BURT })
            .execute({ ownerId: 'u1', sermonId: 's1' });
        expect(r.citations[0]!.similarity).toBe(1);
    });

    it('trozos reales en orden invertido no se verifican', async () => {
        const r = await montarCon('"El profeta huye de su llamado. [...] Nínive era una gran ciudad." — David F. Burt, Comentario Jonás, p. 89', { author: 'David F. Burt', text: LIBRO_BURT })
            .execute({ ownerId: 'u1', sermonId: 's1' });
        expect(r.citations[0]!.similarity).not.toBe(1);
    });

    it('una frase de Burt atribuida a otro autor no se verifica con el libro de Burt', async () => {
        const r = await montarCon('"La lástima de Jonás se corresponde con sus intereses personales, mientras que la de Dios es desinteresada." — Juan Pérez, Comentario Jonás, p. 89', { author: 'David F. Burt', text: LIBRO_BURT })
            .execute({ ownerId: 'u1', sermonId: 's1' });
        expect(r.citations[0]!.status).not.toBe('verified');
    });

    it('la cita real de Burt sí', async () => {
        const r = await montarCon('"La lástima de Jonás se corresponde con sus intereses personales, mientras que la de Dios es desinteresada." — David F. Burt, Comentario Jonás, p. 89', { author: 'David F. Burt', text: LIBRO_BURT })
            .execute({ ownerId: 'u1', sermonId: 's1' });
        expect(r.citations[0]!.similarity).toBe(1);
    });
});
