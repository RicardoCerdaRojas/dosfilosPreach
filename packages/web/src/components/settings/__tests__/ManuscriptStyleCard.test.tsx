import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DEFAULT_MANUSCRIPT_STYLE } from '@dosfilos/domain';
import { ManuscriptStyleCard } from '../ManuscriptStyleCard';

vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const caja = () => screen.getByLabelText('manuscriptStyle.title') as HTMLTextAreaElement;
const reset = () => screen.getByRole('button', { name: /manuscriptStyle.reset/ });

describe('ManuscriptStyleCard (#5 del ejercicio de Jonás)', () => {
    it('sin estilo propio muestra el del sistema y no ofrece volver a él', () => {
        render(<ManuscriptStyleCard value={undefined} onChange={() => {}} />);
        expect(caja().value).toBe(DEFAULT_MANUSCRIPT_STYLE);
        expect(screen.getByText('manuscriptStyle.usingSystem')).toBeTruthy();
        expect(reset()).toBeDisabled();
    });

    it('editar sube el estilo propio; volver al del sistema sube undefined', () => {
        const onChange = vi.fn();
        render(<ManuscriptStyleCard value={undefined} onChange={onChange} />);
        fireEvent.change(caja(), { target: { value: 'Párrafos largos.' } });
        expect(onChange).toHaveBeenLastCalledWith('Párrafos largos.');
        expect(screen.getByText('manuscriptStyle.usingOwn')).toBeTruthy();
        fireEvent.click(reset());
        expect(onChange).toHaveBeenLastCalledWith(undefined);
        expect(caja().value).toBe(DEFAULT_MANUSCRIPT_STYLE);
    });

    it('vaciar la caja para reescribirla no la devuelve al del sistema', () => {
        const onChange = vi.fn();
        const { rerender } = render(<ManuscriptStyleCard value="Mío." onChange={onChange} />);
        fireEvent.change(caja(), { target: { value: '' } });
        expect(onChange).toHaveBeenLastCalledWith(undefined);
        rerender(<ManuscriptStyleCard value={undefined} onChange={onChange} />);
        expect(caja().value).toBe('');
    });

    it('la configuración que llega después se muestra', () => {
        const { rerender } = render(<ManuscriptStyleCard value={undefined} onChange={() => {}} />);
        rerender(<ManuscriptStyleCard value="Guardado antes." onChange={() => {}} />);
        expect(caja().value).toBe('Guardado antes.');
    });
});
