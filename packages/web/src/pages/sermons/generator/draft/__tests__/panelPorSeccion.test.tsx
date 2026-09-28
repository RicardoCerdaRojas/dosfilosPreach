import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: null }) }));
vi.mock('@/services/LocalBibleService', () => ({ LocalBibleService: { getVerses: () => [] } }));
vi.mock('@dosfilos/infrastructure', () => ({ FirestoreGreekFindingsRepository: class { } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/hooks/useProposeElements', () => ({
    useProposeElements: () => ({ propose: vi.fn().mockResolvedValue([]), loading: false, error: null }),
}));
vi.mock('@/hooks/useProposeAuthorityQuotes', () => ({
    useProposeAuthorityQuotes: () => ({ propose: vi.fn().mockResolvedValue([]), loading: false }),
}));

const { SectionElementsPanel } = await import('../SectionElementsPanel');

/**
 * Lo que el panel guarda es DE UNA SECCIÓN.
 *
 * La idea a medio escribir, las propuestas traídas y el aviso de que no se
 * pudieron traer valen para la sección abierta y para ninguna otra. Sin
 * remontar, React reusa la instancia al cambiar de sección y esos tres quedan
 * colgando bajo el título de la siguiente: las propuestas del contexto
 * histórico se leían como si fueran de la conexión actual, con su explicación
 * citando versículos que la nueva sección no trata.
 *
 * El test monta el panel como lo monta el taller —con `key` por sección— y
 * afirma el contrato: cambiar de sección no arrastra lo escrito. Quitar la
 * `key` lo pone en rojo.
 */
const seccion = (id: string, title: string) => ({
    id,
    title,
    prompt: '',
    scriptureRef: null,
    definition: null,
} as never);

function Taller() {
    const [actual, setActual] = useState(seccion('intro.history', 'Contexto histórico'));
    return (
        <div>
            <button onClick={() => setActual(seccion('intro.today', 'Conexión actual'))}>cambiar</button>
            <SectionElementsPanel
                key={(actual as { id: string }).id}
                section={actual}
                passage={'JON 4:1-4' as never}
                proposition={'' as never}
                points={[] as never}
                study={null as never}
                studyKeyWords={[] as never}
                elements={[]}
                onChange={vi.fn()}
                writing={false}
                hasProse={false}
                onWriteSection={vi.fn()}
            />
        </div>
    );
}

describe('el panel de una sección no arrastra lo de la anterior', () => {
    it('la idea a medio escribir no sobrevive al cambio de sección', () => {
        render(<Taller />);
        const caja = screen.getAllByRole('textbox')[0]!;
        fireEvent.change(caja, { target: { value: 'una idea del contexto histórico' } });
        expect((caja as HTMLTextAreaElement).value).toBe('una idea del contexto histórico');

        fireEvent.click(screen.getByText('cambiar'));

        const nueva = screen.getAllByRole('textbox')[0]!;
        expect((nueva as HTMLTextAreaElement).value).toBe('');
    });
});
