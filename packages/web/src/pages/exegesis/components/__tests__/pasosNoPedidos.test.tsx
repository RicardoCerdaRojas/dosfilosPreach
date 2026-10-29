import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ExegeticalStep } from '@dosfilos/domain';

/**
 * TP #9 (B22): un TP que solo responde cuatro preguntas mostraba 4:11, 4:13,
 * 4:16, la introducción y la conclusión «pendientes» entre las respuestas.
 */
vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}));
const { NotRequestedSteps, splitNotRequestedSteps } = await import('../NotRequestedSteps');
beforeEach(cleanup);

const v = (n: number) => ({ bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: n, verseEnd: n });
const paso = (id: string, over: Partial<ExegeticalStep> = {}) => ({
    id, kind: 'verse', state: 'pending', versions: [], includeInDocument: true, verseRef: v(Number(id.slice(1)) || 1), ...over,
}) as unknown as ExegeticalStep;

const TP9 = [
    paso('v11', { includeInDocument: false }),
    paso('v12', { state: 'accepted', versions: [{} as never] }),
    paso('v13', { includeInDocument: false }),
    paso('v16', { includeInDocument: false }),
    paso('c', { kind: 'conclusion', includeInDocument: false, verseRef: null }),
    paso('i', { kind: 'introduction', includeInDocument: false, verseRef: null }),
    paso('a', { kind: 'assembly', includeInDocument: undefined, verseRef: null }),
];

describe('splitNotRequestedSteps', () => {
    it('fuera del documento, pendientes y sin versión: plegados; el ensamble nunca', () => {
        const { requested, notRequested } = splitNotRequestedSteps(TP9);
        expect(notRequested.map(s => s.id)).toEqual(['v11', 'v13', 'v16', 'c', 'i']);
        expect(requested.map(s => s.id)).toEqual(['v12', 'a']);
    });

    it('uno fuera del documento que el estudiante igual estudió se queda a la vista', () => {
        const estudiado = paso('v13', { includeInDocument: false, state: 'accepted', versions: [{} as never] });
        const conVersionFallida = paso('v16', { includeInDocument: false, state: 'failed' });
        expect(splitNotRequestedSteps([estudiado, conVersionFallida]).notRequested).toEqual([]);
    });

    it('sin la marca (trabajos de antes), todo cuenta como pedido', () => {
        expect(splitNotRequestedSteps([paso('v1', { includeInDocument: undefined })]).notRequested).toEqual([]);
    });
});

describe('NotRequestedSteps', () => {
    it('plegado: dice cuántos y cuáles, y que no son trabajo atrasado; desplegado, muestra las tarjetas', () => {
        const { notRequested } = splitNotRequestedSteps(TP9);
        render(<NotRequestedSteps steps={notRequested} language="es" hasQuestions renderStep={s => <p key={s.id}>tarjeta {s.id}</p>} />);
        const boton = screen.getByRole('button', { name: /detail\.steps\.notRequestedGroup\.title/ });
        expect(boton).toHaveAttribute('aria-expanded', 'false');
        expect(boton.textContent).toContain('{"count":5}');
        expect(boton.textContent).toContain('Santiago 4:11');
        expect(boton.textContent).toContain('detail.steps.kind.conclusion');
        expect(boton.textContent).toContain('detail.steps.notRequestedGroup.hint');
        expect(screen.queryByText('tarjeta v11')).toBeNull();
        fireEvent.click(boton);
        expect(boton).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('tarjeta v11')).toBeInTheDocument();
    });

    it('sin preguntas en el encargo dice «fuera del documento»; sin pasos, nada', () => {
        const { container, rerender } = render(<NotRequestedSteps steps={[paso('v1', { includeInDocument: false })]} language="es" hasQuestions={false} renderStep={() => null} />);
        expect(screen.getByRole('button').textContent).toContain('detail.steps.notRequestedGroup.titleExcluded');
        rerender(<NotRequestedSteps steps={[]} language="es" hasQuestions renderStep={() => null} />);
        expect(container).toBeEmptyDOMElement();
    });
});
