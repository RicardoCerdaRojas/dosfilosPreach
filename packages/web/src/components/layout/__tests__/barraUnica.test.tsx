import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { BarraDePagina } from '../barra-de-pagina';
import { BarraDePaginaContexto } from '../barra-de-pagina-contexto';

describe('BarraDePagina', () => {
    it('pone el título, el dato, los controles y las acciones en el espacio de la barra', () => {
        const espacio = document.createElement('div');
        document.body.appendChild(espacio);
        render(
            <BarraDePaginaContexto.Provider value={espacio}>
                <BarraDePagina titulo="Biblioteca" dato="73 libros" controles={<button type="button">Consultar</button>} acciones={<button type="button">Agregar</button>} />
            </BarraDePaginaContexto.Provider>,
        );
        expect(espacio.querySelector('h1')?.textContent).toBe('Biblioteca');
        expect(espacio.textContent).toContain('73 libros');
        expect(espacio.textContent).toContain('Consultar');
        expect(espacio.textContent).toContain('Agregar');
    });

    it('sin la barra de la app alrededor no dibuja nada', () => {
        const { container } = render(<BarraDePagina titulo="Biblioteca" />);
        expect(container.innerHTML).toBe('');
        expect(screen.queryByText('Biblioteca')).toBeNull();
    });
});

/**
 * El botón lleno lleva texto blanco sobre `--primary-solid` (o el casi blanco
 * de `--primary-foreground`). En cada tema, claro y oscuro, tiene que llegar a
 * AA (4,5:1); con `--primary` el verde daba 2,6:1 y el naranja 2,9:1.
 */
describe('contraste de los botones llenos en cada tema', () => {
    it('el hover oscurece (nunca `/90`, que lo aclara)', () => {
        const fuentes = readFileSync(resolve(__dirname, '../../ui/button.tsx'), 'utf8');
        expect(fuentes).toContain('hover:bg-primary-solid-hover');
        expect(fuentes).not.toMatch(/bg-primary-solid\/\d/);
    });
    const css = readFileSync(resolve(__dirname, '../../../index.css'), 'utf8');
    const hsl = (h: number, s: number, l: number) => {
        s /= 100; l /= 100;
        const k = (n: number) => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        return [0, 8, 4].map(n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))));
    };
    const luminancia = ([r, g, b]: number[]) => {
        const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    const valor = (texto: string) => texto.trim().split(/\s+/).map(x => parseFloat(x)) as [number, number, number];
    const bloques = [...css.matchAll(/([^{}]+)\{([^{}]*--primary-solid:[^{}]*)\}/g)];

    it('cada tema define su tono sólido', () => {
        // El texto antes de `{` puede traer el comentario del bloque: vale lo que sigue a `*/`.
        const selectores = bloques.map(b => b[1]!.split('*/').pop()!.trim().replace(/\s+/g, ' '));
        for (const tema of ['purple', 'green', 'orange']) {
            expect(selectores.some(s => s === `[data-theme="${tema}"]`)).toBe(true);
            expect(selectores.some(s => s === `[data-theme="${tema}"].dark`)).toBe(true);
        }
        expect(selectores.some(s => s.startsWith(':root'))).toBe(true);
    });

    it('el texto del botón sobre el tono sólido llega a AA en todos', () => {
        expect(bloques.length).toBeGreaterThanOrEqual(9);
        for (const [, selector, cuerpo] of bloques) {
            const texto = cuerpo!.match(/--primary-foreground:\s*([^;]+);/)?.[1] ?? '0 0% 100%';
            // En reposo y en hover: `/90` aclaraba el hover y lo bajaba de AA.
            for (const token of ['--primary-solid', '--primary-solid-hover']) {
                const fondo = cuerpo!.match(new RegExp(`${token}:\\s*([^;]+);`))![1]!;
                const [a, b] = [luminancia(hsl(...valor(fondo))), luminancia(hsl(...valor(texto)))];
                const contraste = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
                expect(contraste, `${selector!.split('*/').pop()!.trim()} ${token}: ${contraste.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
            }
        }
    });
});
