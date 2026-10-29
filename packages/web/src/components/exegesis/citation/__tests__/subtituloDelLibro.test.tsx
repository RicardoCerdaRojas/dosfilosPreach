import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SubtituloDelLibro } from '../SubtituloDelLibro';
import { subtituloDelLibro } from '../subtituloDelLibroTexto';

/**
 * TP #9, B19: la cabecera del visor no mostraba el autor del libro. Sale del
 * recurso de la biblioteca; si no lo trae, no se muestra nada.
 */
afterEach(cleanup);

describe('subtituloDelLibro', () => {
    it('agrega el autor bajo el rótulo', () => {
        expect(subtituloDelLibro('McCartney', 'James', 'Dan G. McCartney')).toBe('James · Dan G. McCartney');
    });

    it('no repite el título que el rótulo ya dice', () => {
        expect(subtituloDelLibro('The Letter of James (PNTC)', 'The letter of James', 'Douglas J. Moo')).toBe('Douglas J. Moo');
    });

    it('sin autor ni título nuevo, nada', () => {
        expect(subtituloDelLibro('NA28', null, null)).toBeNull();
        expect(subtituloDelLibro('NA28', 'NA28', '  ')).toBeNull();
    });
});

// Datos de la prueba, no texto de la interfaz.
const ROTULO = 'Tuggy Léxico';

describe('SubtituloDelLibro', () => {
    it('muestra el autor', () => {
        render(<SubtituloDelLibro label={ROTULO} title={null} author="Alfred E. Tuggy" />);
        expect(screen.getByTestId('libro-autor').textContent).toBe('Alfred E. Tuggy');
    });

    it('sin autor no dibuja nada', () => {
        render(<SubtituloDelLibro label={ROTULO} title={null} author={null} />);
        expect(screen.queryByTestId('libro-autor')).toBeNull();
    });
});
