import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProsaConCitas } from '../ProsaConCitas';

/** Fase F, F3: en la prosa de un paso, cada cita de una fuente del trabajo abre el visor. */
describe('ProsaConCitas', () => {
    const prosa = 'McCartney considera redundante la lectura (McCartney, p. 204), y Robertson lo confirma (Robertson, p. 534; Robertson, pp. 538–539). Ver [la guía](https://ejemplo.org).';

    it('cada cita es un botón que abre su página; una compuesta da uno por página', () => {
        const onOpenCita = vi.fn();
        render(<ProsaConCitas markdown={prosa} claves={['McCartney', 'Robertson']} onOpenCita={onOpenCita} tituloCita="Ver en el libro" />);
        const citas = screen.getAllByTestId('cita-en-prosa');
        expect(citas.map(c => c.textContent)).toEqual(['McCartney, p. 204', 'Robertson, p. 534', 'Robertson, pp. 538–539']);
        fireEvent.click(citas[2]!);
        expect(onOpenCita).toHaveBeenLastCalledWith({ sourceKey: 'Robertson', page: 538, pageKind: 'printed' });
        expect(citas[0]!.getAttribute('title')).toBe('Ver en el libro');
    });

    it('los enlaces normales siguen siendo enlaces, y el texto no cambia', () => {
        const { container } = render(<ProsaConCitas markdown={prosa} claves={['McCartney', 'Robertson']} onOpenCita={vi.fn()} tituloCita="x" />);
        expect(screen.getByRole('link', { name: 'la guía' }).getAttribute('href')).toBe('https://ejemplo.org');
        expect(container.textContent).toContain('(McCartney, p. 204), y Robertson lo confirma (Robertson, p. 534; Robertson, pp. 538–539).');
    });

    it('sin claves del trabajo no hay botones', () => {
        render(<ProsaConCitas markdown={prosa} claves={[]} onOpenCita={vi.fn()} tituloCita="x" />);
        expect(screen.queryAllByTestId('cita-en-prosa')).toHaveLength(0);
    });
});
