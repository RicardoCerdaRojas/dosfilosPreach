import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLAUSE_RELATIONS, verseStructure, versePhrases, verseWords, type ChapterStructure } from '@dosfilos/domain';
import { frasePorRef } from '../frases';
import type { StructureWordLinks } from '../StructureSection';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k }),
}));
const { LeyendaFrases, StructureFlow, StructureSection } = await import('../StructureSection');
const { StructureDiagram } = await import('../StructureDiagram');
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
    it('Stg 2:9: prótasis con su clase (y su δέ, como en el texto), apódosis, conector punteado y objeto antepuesto resaltado', () => {
        render(<StructureFlow lang="gr" nodes={verseStructure(santiago2, 9)} />);
        const filas = screen.getAllByTestId('structure-row');
        expect(filas).toHaveLength(4);
        expect(filas[0]!.textContent).toContain('protasis · classLabel.1');
        expect(filas[0]!.textContent).toContain('classNotes.1');
        expect(filas[1]!.textContent).toContain('apodosis');
        const ei = screen.getByText('εἰ').parentElement!;
        expect(ei.className).toContain('outline-dashed');
        const hamartian = screen.getByText('ἁμαρτίαν').parentElement!;
        expect(hamartian.className).toContain('outline-warning');
        expect(filas[1]!.textContent).toContain('fronted');
    });

    it('el conector se resalta donde está la palabra, aunque su relación la lleve la apódosis (Mc 3:24 «καὶ ἐὰν…»)', () => {
        render(<StructureFlow lang="gr" nodes={verseStructure(cargar('gr/MRK/3.json'), 24)} />);
        expect(screen.getByText('καὶ').parentElement!.className).toContain('outline-dashed');
        expect(screen.getByText('ἐὰν').parentElement!.className).toContain('outline-dashed');
    });

    it('U11 (Stg 2:14): el 2.º miembro de la prótasis lo dice; la condición y la apódosis, no', () => {
        render(<StructureFlow lang="gr" nodes={verseStructure(santiago2, 14)} />);
        const filas = screen.getAllByTestId('structure-row');
        expect(filas.map(f => !!f.querySelector('[data-testid="protasis-miembro"]'))).toEqual([false, false, true, false, false]);
        expect(filas[2]!.textContent).toContain('relations.development');
    });

    it('U11b (Stg 2:16): con «Frases», «ἐξ ὑμῶν» punteada (va con τις) y «ἐν εἰρήνῃ» continua (va con el verbo); sin, nada', () => {
        const { unmount } = render(<StructureFlow lang="gr" nodes={verseStructure(santiago2, 16)} phrases={frasePorRef(versePhrases(santiago2, 16))} />);
        const ex = screen.getByText('ἐξ'), en = screen.getByText('ἐν');
        expect([ex.dataset.frase, screen.getByText('ὑμῶν·').dataset.frase, en.dataset.frase]).toEqual(['n', 'n', 'a']);
        expect(ex.className).toContain('decoration-dashed');
        expect(en.className).toContain('underline');
        expect(en.className).not.toContain('decoration-dashed');
        expect(screen.getByText('εἴπῃ').className).not.toContain('underline');
        unmount();
        render(<StructureFlow lang="gr" nodes={verseStructure(santiago2, 16)} />);
        expect(screen.getByText('ἐξ').className).not.toContain('underline');
    });

    it('U11b: la leyenda de las frases dice la forma de cada línea', () => {
        render(<LeyendaFrases />);
        expect(screen.getByTestId('phrases-legend').textContent).toBe('legendPhraseVerblegendPhraseNoun');
    });

    it('U11c Diagrama, Stg 2:14: la prótasis de dos miembros va en UN bloque con su barra y la flecha a la apódosis', () => {
        render(<StructureDiagram lang="gr" nodes={verseStructure(santiago2, 14)} phrases={versePhrases(santiago2, 14)} />);
        const bloque = screen.getByTestId('diagram-protasis');
        expect(bloque.querySelectorAll('[data-testid="diagram-line"]')).toHaveLength(2);
        expect(bloque.textContent).toContain('ἐὰν πίστιν λέγῃ τις ἔχειν');
        expect(bloque.textContent).toContain('protasis · classLabel.3');
        expect(bloque.textContent).toContain('protasisMember');
        expect(bloque.textContent).toContain('diagramToApodosis');
        expect(bloque.className).toContain('border-l-2');
    });

    it('U11c Diagrama, 1 Jn 4:20: la línea más profunda entre dos miembros («ὅτι Ἀγαπῶ τὸν θεόν») va DENTRO del corchete, que no se parte', () => {
        const juan = cargar('gr/1JN/4.json');
        render(<StructureDiagram lang="gr" nodes={verseStructure(juan, 20)} phrases={versePhrases(juan, 20)} />);
        const bloques = screen.getAllByTestId('diagram-protasis');
        expect(bloques).toHaveLength(1);
        expect(bloques[0]!.querySelectorAll('[data-testid="diagram-line"]')).toHaveLength(3);
        expect(bloques[0]!.textContent).toContain('ὅτι Ἀγαπῶ τὸν θεόν');
    });

    it('U11c Diagrama, Stg 2:18: las frases con el verbo en su línea, marcadas y subrayadas; hebreo sangra a la derecha', () => {
        const { unmount } = render(<StructureDiagram lang="gr" nodes={verseStructure(santiago2, 18)} phrases={versePhrases(santiago2, 18)} />);
        const frases = screen.getAllByTestId('diagram-line').filter(l => l.dataset.kind === 'phrase');
        expect(frases.map(l => l.textContent)).toEqual(['└χωρὶς τῶν ἔργων,', '└ἐκ τῶν ἔργων μου']);
        expect(screen.getByText('χωρὶς').className).toContain('underline');
        unmount();
        const rut = cargar('he/Ruth/1.json');
        render(<StructureDiagram lang="he" nodes={verseStructure(rut, 1)} phrases={versePhrases(rut, 1)} />);
        const sangrada = screen.getAllByTestId('diagram-line').find(l => l.style.marginRight && l.style.marginRight !== '0rem');
        expect(sangrada).toBeDefined();
        expect(screen.getAllByTestId('diagram-line').every(l => !l.style.marginLeft)).toBe(true);
    });

    it('la sangría sigue la profundidad, relativa a la fila menos profunda', () => {
        render(<StructureFlow lang="gr" nodes={verseStructure(santiago2, 9)} />);
        const sangrias = screen.getAllByTestId('structure-row').map(f => f.style.marginLeft);
        expect(sangrias).toEqual(['1.5rem', '0rem', '1.5rem', '3rem']);
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

describe('la fuente de cada fila con regla', () => {
    it('Stg 2:9: «Fuente» se abre al tocarlo y muestra la cita', () => {
        render(<StructureFlow lang="gr" nodes={verseStructure(santiago2, 9)} />);
        const toggles = screen.getAllByTestId('source-toggle');
        expect(toggles.length).toBeGreaterThan(0);
        fireEvent.click(toggles[0]!);
        expect(screen.getByTestId('source-note').textContent).toContain('First Class Condition');
    });

    it('igual con todo lo que pasa la página: tooltips, lecturas y enlaces', async () => {
        const { TooltipContent } = await import('@/components/ui/tooltip');
        const nodes = verseStructure(santiago2, 9);
        const ordinal = new Map(verseWords(santiago2, 9).map((w, i) => [w.r, i]));
        const Pagina = () => {
            const [sel, setSel] = React.useState<number | null>(null);
            return (
                <TooltipProvider>
                    <StructureFlow
                        lang="gr" nodes={nodes} ordinal={ordinal}
                        readings={nodes.map(n => ({ index: n.index, anchor: n.words[0]!.r, value: 'v', explanation: 'e' }))}
                        links={{ renderText: i => <b>{i}</b>, renderTooltip: i => <TooltipContent>{i}</TooltipContent>, onSelect: setSel, selected: sel }}
                    />
                </TooltipProvider>
            );
        };
        render(<Pagina />);
        fireEvent.click(screen.getAllByTestId('source-toggle')[0]!);
        expect(screen.getByTestId('source-note').textContent).toContain('First Class Condition');
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

    it('waw disyuntiva: conserva su nombre y suma el valor elegido (revisión del profesor, Rut 2:10 «siendo yo»)', () => {
        const rut = verseStructure(cargar('he/Ruth/2.json'), 10);
        const disy = rut.find(n => n.relation === 'disjunctive')!;
        render(<StructureFlow lang="he" nodes={rut} readings={[{ index: disy.index, anchor: disy.words[0]!.r, value: 'circunstancia', explanation: 'x', resolved: 'circumstantial' }]} />);
        expect(screen.getByText('relations.disjunctive · resolved.circumstantial')).toBeInTheDocument();
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
        // La vista y el tamaño se guardan en el navegador: cada prueba empieza de cero.
        localStorage.removeItem('estructura.vista');
        localStorage.removeItem('estructura.tamano');
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

    it('revisión del profesor (Stg 2:18): el aviso de la repetición en espejo en las dos vistas, y las letras A B B′ A′ en el Diagrama', async () => {
        localStorage.removeItem('estructura.vista');
        render(<Seccion lang="gr" book="JAS" chapter={2} verse={18} />);
        await waitFor(() => expect(screen.getByTestId('mirror-notice')).toBeInTheDocument());
        expect(screen.getByTestId('mirror-notice').textContent).toBe('mirrorNotice');
        expect(screen.queryAllByTestId('mirror-letter')).toHaveLength(0);
        fireEvent.click(screen.getByText('view.diagram'));
        expect(screen.getByTestId('mirror-notice')).toBeInTheDocument();
        expect(screen.getAllByTestId('mirror-letter').map(e => e.textContent)).toEqual(['mirrorLetter.A', 'mirrorLetter.B', 'mirrorLetter.B2', 'mirrorLetter.A2']);
        localStorage.removeItem('estructura.vista');
    });

    it('U11c: el selector Tarjetas | Diagrama cambia la vista y se recuerda', async () => {
        localStorage.removeItem('estructura.vista');
        const { unmount } = render(<Seccion lang="gr" book="JAS" chapter={2} verse={14} />);
        await waitFor(() => expect(screen.getAllByTestId('structure-row').length).toBeGreaterThan(0));
        expect(screen.getByText('view.cards').getAttribute('aria-pressed')).toBe('true');
        fireEvent.click(screen.getByText('view.diagram'));
        expect(screen.queryByTestId('structure-row')).toBeNull();
        expect(screen.getByTestId('structure-diagram')).toBeInTheDocument();
        expect(localStorage.getItem('estructura.vista')).toBe('diagram');
        unmount();
        render(<Seccion lang="gr" book="JAS" chapter={2} verse={14} />);
        await waitFor(() => expect(screen.getByTestId('structure-diagram')).toBeInTheDocument());
        localStorage.removeItem('estructura.vista');
    });

    it('A−/A+ de «Estructura»: agranda el texto original en tarjetas y diagrama (Stg 2:18, también las letras del espejo), se recuerda y se apaga en los topes', async () => {
        const tamanos = (sel: string) => new Set([...document.querySelectorAll<HTMLElement>(sel)].map(e => e.style.fontSize));
        const { unmount } = render(<Seccion lang="gr" book="JAS" chapter={2} verse={18} />);
        await waitFor(() => expect(screen.getAllByTestId('structure-row').length).toBeGreaterThan(0));
        // Tarjetas: el tamaño de antes (griego 1.125rem) y crece con A+.
        expect(tamanos('[data-testid="structure-row"] span[lang="grc"]')).toEqual(new Set(['1.125rem']));
        // El interlineado de antes (1.75rem, el de text-lg) en el escalón inicial, y crece con la letra.
        expect(new Set([...document.querySelectorAll<HTMLElement>('[data-testid="structure-row"] span[lang="grc"]')].map(e => e.style.lineHeight))).toEqual(new Set(['1.75rem']));
        expect(screen.getByRole('group', { name: 'textSizeNow' })).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('estructura-texto-bigger'));
        expect(tamanos('[data-testid="structure-row"] span[lang="grc"]')).toEqual(new Set(['1.35rem']));
        expect(localStorage.getItem('estructura.tamano')).toBe('2');
        // Diagrama: el mismo tamaño, y la letra del espejo va en em (crece con la palabra).
        fireEvent.click(screen.getByText('view.diagram'));
        expect(tamanos('[data-testid="diagram-line"] > span[lang="grc"]')).toEqual(new Set(['1.35rem']));
        expect(screen.getAllByTestId('mirror-letter')).toHaveLength(4);
        expect(screen.getAllByTestId('mirror-letter')[0]!.className).toContain('0.5em');
        // Al volver a la página, el tamaño elegido sigue.
        unmount();
        render(<Seccion lang="gr" book="JAS" chapter={2} verse={18} />);
        await waitFor(() => expect(screen.getByTestId('structure-diagram')).toBeInTheDocument());
        expect(tamanos('[data-testid="diagram-line"] > span[lang="grc"]')).toEqual(new Set(['1.35rem']));
        // Topes: A+ hasta el último escalón se apaga; A− hasta el primero, también.
        for (let k = 0; k < 6; k++) fireEvent.click(screen.getByTestId('estructura-texto-bigger'));
        expect(screen.getByTestId('estructura-texto-bigger').getAttribute('aria-disabled')).toBe('true');
        // En el tope, otro clic no hace nada y el botón sigue enfocable (no `disabled`).
        fireEvent.click(screen.getByTestId('estructura-texto-bigger'));
        expect(localStorage.getItem('estructura.tamano')).toBe('5');
        expect(screen.getByTestId('estructura-texto-bigger')).not.toBeDisabled();
        expect(tamanos('[data-testid="diagram-line"] > span[lang="grc"]')).toEqual(new Set(['2.3625rem']));
        for (let k = 0; k < 8; k++) fireEvent.click(screen.getByTestId('estructura-texto-smaller'));
        expect(screen.getByTestId('estructura-texto-smaller').getAttribute('aria-disabled')).toBe('true');
        expect(screen.getByTestId('estructura-texto-bigger').getAttribute('aria-disabled')).toBe('false');
        expect(localStorage.getItem('estructura.tamano')).toBe('0');
    });

    it('en hebreo (Gn 9:6) el tamaño base es el de antes (1.25rem) y crece igual', async () => {
        const tamanos = () => new Set([...document.querySelectorAll<HTMLElement>('[data-testid="structure-row"] span[lang="he"]')].map(e => e.style.fontSize));
        render(<Seccion lang="he" book="Gen" chapter={9} verse={6} />);
        await waitFor(() => expect(screen.getAllByTestId('structure-row').length).toBeGreaterThan(0));
        expect(tamanos()).toEqual(new Set(['1.25rem']));
        fireEvent.click(screen.getByTestId('estructura-texto-bigger'));
        expect(tamanos()).toEqual(new Set(['1.5rem']));
        // Y el diagrama hebreo, con el mismo tamaño y el interlineado proporcional.
        fireEvent.click(screen.getByText('view.diagram'));
        const lineas = [...document.querySelectorAll<HTMLElement>('[data-testid="diagram-line"] > span[lang="he"]')];
        expect(lineas.length).toBeGreaterThan(0);
        expect(new Set(lineas.map(e => `${e.style.fontSize} ${e.style.lineHeight}`))).toEqual(new Set(['1.5rem 2.1rem']));
    });

    it('un tamaño guardado roto (texto, fuera de rango) vuelve al de siempre', async () => {
        for (const malo of ['x', '99', '-1', '1.5']) {
            localStorage.setItem('estructura.tamano', malo);
            const { unmount } = render(<Seccion lang="gr" book="JAS" chapter={2} verse={14} />);
            await waitFor(() => expect(screen.getAllByTestId('structure-row').length).toBeGreaterThan(0));
            expect(new Set([...document.querySelectorAll<HTMLElement>('[data-testid="structure-row"] span[lang="grc"]')].map(e => e.style.fontSize))).toEqual(new Set(['1.125rem']));
            // Vuelve al escalón inicial de verdad: los dos botones habilitados y A+ sube UN escalón.
            expect(screen.getByTestId('estructura-texto-smaller').getAttribute('aria-disabled')).toBe('false');
            expect(screen.getByTestId('estructura-texto-bigger').getAttribute('aria-disabled')).toBe('false');
            fireEvent.click(screen.getByTestId('estructura-texto-bigger'));
            expect(new Set([...document.querySelectorAll<HTMLElement>('[data-testid="structure-row"] span[lang="grc"]')].map(e => e.style.fontSize))).toEqual(new Set(['1.35rem']));
            expect(localStorage.getItem('estructura.tamano')).toBe('2');
            unmount();
        }
        localStorage.removeItem('estructura.tamano');
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
        // Y dice cómo se reconoce (pregunta del fundador sobre Stg 2:13).
        expect(screen.getByText(/verblessNote/)).toBeInTheDocument();
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
