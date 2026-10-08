import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLAUSE_RELATIONS, verseStructure, verseWords, type ChapterStructure } from '@dosfilos/domain';
import type { StructureWordLinks } from '../StructureSection';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k }),
}));
const { StructureFlow, StructureSection } = await import('../StructureSection');
const { useVerseStructure } = await import('../useVerseStructure');
const { TooltipProvider } = await import('@/components/ui/tooltip');

/** La sección como la usan las páginas: el hook arriba, la vista abajo. */
const Seccion = ({ lang, book, chapter, verse, links }: { lang: 'gr' | 'he'; book: string; chapter: number; verse: number; links?: StructureWordLinks }) => {
    const estructura = useVerseStructure(lang, book, chapter, verse);
    return <StructureSection lang={lang} structure={estructura} links={links} />;
};

const archivo = (rel: string) =>
    readFileSync(join(__dirname, '..', '..', '..', '..', 'public', 'language-data', 'v1', rel), 'utf8');
const cargar = (rel: string): ChapterStructure => JSON.parse(archivo(rel));
const santiago2 = cargar('gr/JAS/2.json');

describe('StructureFlow (G1 + G5)', () => {
    it('Stg 2:9: prótasis con su clase, apódosis, conector punteado y objeto antepuesto resaltado', () => {
        render(<StructureFlow lang="gr" nodes={verseStructure(santiago2, 9)} />);
        const filas = screen.getAllByTestId('structure-row');
        expect(filas).toHaveLength(5);
        expect(filas[1]!.textContent).toContain('protasis · classLabel.1');
        expect(filas[1]!.textContent).toContain('classNotes.1');
        expect(filas[2]!.textContent).toContain('apodosis');
        const ei = screen.getByText('εἰ').parentElement!;
        expect(ei.className).toContain('outline-dashed');
        const hamartian = screen.getByText('ἁμαρτίαν').parentElement!;
        expect(hamartian.className).toContain('outline-warning');
        expect(filas[2]!.textContent).toContain('fronted');
    });

    it('la sangría sigue la profundidad, relativa a la fila menos profunda', () => {
        render(<StructureFlow lang="gr" nodes={verseStructure(santiago2, 9)} />);
        const sangrias = screen.getAllByTestId('structure-row').map(f => f.style.marginLeft);
        expect(sangrias).toEqual(['0rem', '3rem', '1.5rem', '3rem', '4.5rem']);
    });

    it('si ninguna fila está en el nivel 0 (el versículo empieza dentro de otra cláusula), no sangra de más', () => {
        const fila = (index: number, depth: number) =>
            ({ index, depth, words: [{ r: `1!${index}`, t: `w${index}`, role: '' }], connector: null, relation: 'main', isApodosis: false, verbless: false, fronted: [] }) as const;
        render(<StructureFlow lang="gr" nodes={[fila(1, 2), fila(2, 3)]} />);
        expect(screen.getAllByTestId('structure-row').map(f => f.style.marginLeft)).toEqual(['0rem', '1.5rem']);
    });

    it('tocar una palabra avisa su posición en el versículo (enlace con las tarjetas)', () => {
        const ordinal = new Map(verseWords(santiago2, 9).map((w, i) => [w.r, i]));
        const onSelect = vi.fn();
        render(<StructureFlow lang="gr" nodes={verseStructure(santiago2, 9)} ordinal={ordinal} links={{ onSelect, selected: 4 }} />);
        fireEvent.click(screen.getByText('ἁμαρτίαν'));
        expect(onSelect).toHaveBeenCalledWith(3);
        expect(screen.getByText('ἐργάζεσθε,').parentElement!.className).toContain('ring-2');
    });

    it('con `toPageIndex` el clic y la marca usan el índice de la página (la palabra del análisis hebreo)', () => {
        const ordinal = new Map(verseWords(santiago2, 9).map((w, i) => [w.r, i]));
        const onSelect = vi.fn();
        const indice = verseWords(santiago2, 9).map((_, i) => i + 100);
        render(<StructureFlow lang="gr" nodes={verseStructure(santiago2, 9)} ordinal={ordinal} pageIndex={indice} links={{ onSelect, selected: 104 }} />);
        fireEvent.click(screen.getByText('ἁμαρτίαν'));
        expect(onSelect).toHaveBeenCalledWith(103);
        expect(screen.getByText('ἐργάζεσθε,').parentElement!.className).toContain('ring-2');
    });

    it('pinta cada palabra con la capa de color de la página (pedido del fundador)', () => {
        const ordinal = new Map(verseWords(santiago2, 9).map((w, i) => [w.r, i]));
        render(<StructureFlow lang="gr" nodes={verseStructure(santiago2, 9)} ordinal={ordinal} links={{ renderText: i => <b data-testid="pintada">{`#${i}`}</b> }} />);
        expect(screen.getAllByTestId('pintada')).toHaveLength(verseWords(santiago2, 9).length);
        expect(screen.getByText('#3')).toBeInTheDocument();
    });

    it('al pasar el mouse muestra la ficha de la palabra (tooltip)', async () => {
        const ordinal = new Map(verseWords(santiago2, 9).map((w, i) => [w.r, i]));
        const { TooltipContent } = await import('@/components/ui/tooltip');
        render(
            <TooltipProvider>
                <StructureFlow lang="gr" nodes={verseStructure(santiago2, 9)} ordinal={ordinal} links={{ renderTooltip: i => <TooltipContent>{`ficha ${i}`}</TooltipContent> }} />
            </TooltipProvider>,
        );
        fireEvent.focus(screen.getByText('ἁμαρτίαν').closest('span')!.parentElement!);
        await waitFor(() => expect(screen.getAllByText('ficha 3').length).toBeGreaterThan(0));
    });

    it('lo antepuesto se resalta ENTERO (Rut 1:16 «אֶל אֲשֶׁר»), no sólo su primera palabra', () => {
        const nodes = verseStructure(cargar('he/Ruth/1.json'), 16);
        const fila = nodes.find(n => n.fronted.some(f => f.rs.length === 2))!;
        render(<StructureFlow lang="he" nodes={nodes} />);
        const textos = fila.words.filter(w => fila.fronted[0]!.rs.includes(w.r)).map(w => w.t);
        expect(textos).toHaveLength(2);
        for (const t of textos) expect(screen.getByText(t).parentElement!.className).toContain('outline-warning');
    });

    it('en hebreo la sangría va a la derecha, donde empieza la lectura (Rut 1:1)', () => {
        render(<StructureFlow lang="he" nodes={verseStructure(cargar('he/Ruth/1.json'), 1)} />);
        const filas = screen.getAllByTestId('structure-row');
        expect(filas.map(f => f.style.marginRight)).toEqual(['0rem', '1.5rem', '0rem', '0rem', '1.5rem']);
        expect(filas.every(f => f.style.marginLeft === '')).toBe(true);
    });

    it('el hebreo va de derecha a izquierda', () => {
        const { container } = render(<StructureFlow lang="he" nodes={verseStructure(cargar('he/Ruth/1.json'), 16)} />);
        expect(container.querySelector('[dir="rtl"]')).not.toBeNull();
    });
});

describe('la lectura del asistente en cada fila (G1 + G5, opción b)', () => {
    const jn316 = verseStructure(cargar('gr/JHN/3.json'), 16);
    const ina = jn316.find(n => n.relation === 'purposeOrResult')!;
    const stg29 = verseStructure(santiago2, 9);
    const apodosis = stg29.find(n => n.isApodosis)!;

    it('muestra valor y explicación marcados «Asistente», y la relación que eligió donde el dato deja abierto', () => {
        render(<StructureFlow lang="gr" nodes={jn316} readings={[{ index: ina.index, anchor: ina.words[0]!.r, value: 'propósito del don', explanation: 'ἵνα + subjuntivo.', resolved: 'purpose' }]} />);
        const lecturas = screen.getAllByTestId('clause-reading');
        expect(lecturas).toHaveLength(1);
        expect(lecturas[0]!.textContent).toContain('propósito del don');
        expect(lecturas[0]!.textContent).toContain('readingTag');
        expect(screen.getByText('resolved.purpose')).toBeInTheDocument();
        expect(screen.queryByText('relations.purposeOrResult')).toBeNull();
        // La nota de la ambigüedad sobra: la dice la elección.
        expect(screen.queryByText(/notes\.purposeOrResult/)).toBeNull();
    });

    it('foco o marco de lo antepuesto, en lugar de «puede ser foco o marco»', () => {
        render(<StructureFlow lang="gr" nodes={stg29} readings={[{ index: apodosis.index, anchor: apodosis.words[0]!.r, value: 'consecuencia', explanation: 'x', fronting: 'focus' }]} />);
        const fila = screen.getAllByTestId('structure-row').find(f => f.textContent!.includes('ἁμαρτίαν'))!;
        expect(fila.textContent).toContain('frontedChosen');
        expect(fila.textContent).not.toContain('frontedNote');
    });

    it('una lectura anclada a otra primera palabra no se muestra', () => {
        render(<StructureFlow lang="gr" nodes={jn316} readings={[{ index: ina.index, anchor: 'otra', value: 'x', explanation: 'y' }]} />);
        expect(screen.queryAllByTestId('clause-reading')).toHaveLength(0);
    });
});

describe('StructureSection', () => {
    const pedidos: string[] = [];
    beforeEach(() => {
        pedidos.length = 0;
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            pedidos.push(url);
            const rel = url.replace('/language-data/v1/', '');
            try {
                return new Response(archivo(rel), { status: 200, headers: { 'content-type': 'application/json' } });
            } catch {
                return new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } });
            }
        }));
    });

    it('baja el capítulo y dibuja las filas', async () => {
        render(<Seccion lang="gr" book="JAS" chapter={2} verse={7} />);
        expect(screen.getByText('loading')).toBeInTheDocument();
        await waitFor(() => expect(screen.getAllByTestId('structure-row')).toHaveLength(2));
        expect(pedidos).toEqual(['/language-data/v1/gr/JAS/2.json']);
    });

    it('al cambiar de capítulo no muestra las filas del anterior mientras llega el nuevo', async () => {
        const { rerender } = render(<Seccion lang="gr" book="JAS" chapter={2} verse={7} />);
        await waitFor(() => expect(screen.getAllByTestId('structure-row')).toHaveLength(2));
        rerender(<Seccion lang="gr" book="JAS" chapter={1} verse={5} />);
        expect(screen.queryAllByTestId('structure-row')).toHaveLength(0);
        expect(screen.getByText('loading')).toBeInTheDocument();
        await waitFor(() => expect(screen.getAllByTestId('structure-row').length).toBeGreaterThan(0));
    });

    it('«Cant» del catálogo de hebreo se pide como «Song»', async () => {
        render(<Seccion lang="he" book="Cant" chapter={1} verse={1} />);
        await waitFor(() => expect(screen.getAllByTestId('structure-row').length).toBeGreaterThan(0));
        expect(pedidos).toEqual(['/language-data/v1/he/Song/1.json']);
    });

    it('un capítulo que no existe (el hosting responde HTML) dice que no está disponible', async () => {
        render(<Seccion lang="gr" book="XXX" chapter={1} verse={1} />);
        await waitFor(() => expect(screen.getByText('unavailable')).toBeInTheDocument());
    });

    it('un versículo sin cláusulas en MACULA (Mt 1:1, un encabezado) muestra sus palabras en una fila nominal', async () => {
        render(<Seccion lang="gr" book="MAT" chapter={1} verse={1} />);
        await waitFor(() => expect(screen.getAllByTestId('structure-row')).toHaveLength(1));
        expect(screen.getByText('verbless')).toBeInTheDocument();
    });

    it('sin lectura del asistente avisa por qué y ofrece pedirla', async () => {
        const onClick = vi.fn();
        const Con = () => {
            const estructura = useVerseStructure('gr', 'JAS', 2, 7);
            return <StructureSection lang="gr" structure={estructura} readingNotice={{ message: 'sin lectura', action: { label: 'Generar', onClick } }} />;
        };
        render(<Con />);
        await waitFor(() => expect(screen.getByTestId('reading-notice')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Generar'));
        expect(onClick).toHaveBeenCalled();
    });

    it('un versículo sin palabras (fuera del capítulo) lo dice', async () => {
        render(<Seccion lang="gr" book="MAT" chapter={1} verse={99} />);
        await waitFor(() => expect(screen.getByText('noClauses')).toBeInTheDocument());
    });
});

describe('textos de la vista', () => {
    const es = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'i18n', 'locales', 'es', 'languageStructure.json'), 'utf8'));
    const en = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'i18n', 'locales', 'en', 'languageStructure.json'), 'utf8'));
    it.each(CLAUSE_RELATIONS)('la relación «%s» tiene nombre en español y en inglés', rel => {
        expect(es.relations[rel]).toBeTruthy();
        expect(en.relations[rel]).toBeTruthy();
    });
});
