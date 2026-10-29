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

/**
 * El texto en el color de la marca (`text-primary-text`) y el ✓ sobre
 * `bg-success`. Con `--primary` como texto chico el verde daba 2,59:1, el
 * naranja 2,85:1 y el índigo oscuro 2,90:1; el ✓ blanco sobre el verde, 2,30:1.
 * Fase «Escritorio del proyecto», etapa 0 (2026-10-26).
 */
describe('contraste del texto de la marca y del ✓ de éxito en cada tema', () => {
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
    const contraste = (x: number[], y: number[]) => {
        const [a, b] = [luminancia(x), luminancia(y)];
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    /** `bg-primary/5` y compañía: el color con alfa, compuesto sobre el fondo. */
    const sobre = (color: number[], fondo: number[], alfa: number) => color.map((c, i) => c * alfa + fondo[i]! * (1 - alfa));
    const rgb = (texto: string) => hsl(...(texto.trim().split(/\s+/).map(x => parseFloat(x)) as [number, number, number]));
    const bloques = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(b => ({
        selector: b[1]!.split('*/').pop()!.trim().replace(/\s+/g, ' '),
        cuerpo: b[2]!,
    }));
    const token = (cuerpo: string, nombre: string) => cuerpo.match(new RegExp(`${nombre}:\\s*([^;]+);`))?.[1];
    const base = (oscuro: boolean) => bloques.find(b => (oscuro ? b.selector === '.dark' : b.selector.startsWith(':root')))!.cuerpo;
    const conTexto = bloques.filter(b => token(b.cuerpo, '--primary-text'));
    const esOscuro = (selector: string) => selector.includes('.dark') && !selector.includes('.light');

    it('cada tema define su tono de texto, en claro y en oscuro', () => {
        const selectores = conTexto.map(b => b.selector);
        for (const tema of ['purple', 'green', 'orange']) {
            expect(selectores).toContain(`[data-theme="${tema}"]`);
            expect(selectores).toContain(`[data-theme="${tema}"].dark`);
        }
        expect(selectores.some(s => s.startsWith(':root'))).toBe(true);
        expect(selectores).toContain('.dark');
        expect(selectores.some(s => s.includes('.light'))).toBe(true);
    });

    it('el texto de la marca llega a AA (4,5:1) sobre la tarjeta, el fondo y los fondos tintados', () => {
        expect(conTexto.length).toBeGreaterThanOrEqual(9);
        for (const { selector, cuerpo } of conTexto) {
            const fondoDelModo = base(esOscuro(selector));
            const de = (nombre: string) => rgb(token(cuerpo, nombre) ?? token(fondoDelModo, nombre)!);
            const texto = de('--primary-text');
            const tarjeta = de('--card');
            const primario = de('--primary');
            const fondos: Record<string, number[]> = {
                card: tarjeta,
                background: de('--background'),
                'primary/5': sobre(primario, tarjeta, 0.05),
                'primary/10': sobre(primario, tarjeta, 0.1),
                'info-subtle': de('--info-subtle'),
                'success-subtle': de('--success-subtle'),
            };
            for (const [nombre, fondo] of Object.entries(fondos)) {
                const c = contraste(texto, fondo);
                expect(c, `${selector} sobre ${nombre}: ${c.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
            }
        }
    });

    it('el ✓ sobre `bg-success`: un ícono pasa 3:1 y, si lleva texto, 4,5:1', () => {
        const conExito = bloques.filter(b => token(b.cuerpo, '--success'));
        expect(conExito.map(b => b.selector)).toEqual(expect.arrayContaining(['.dark']));
        expect(conExito.length).toBeGreaterThanOrEqual(3);
        for (const { selector, cuerpo } of conExito) {
            const c = contraste(rgb(token(cuerpo, '--success-foreground')!), rgb(token(cuerpo, '--success')!));
            expect(c, `${selector} ícono: ${c.toFixed(2)}`).toBeGreaterThanOrEqual(3);
            expect(c, `${selector} texto: ${c.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
        }
    });

    it('`text-success` se sigue leyendo sobre la tarjeta (el verde no se apagó en oscuro)', () => {
        for (const oscuro of [false, true]) {
            const cuerpo = base(oscuro);
            const c = contraste(rgb(token(cuerpo, '--success')!), rgb(token(cuerpo, '--card')!));
            expect(c, `${oscuro ? 'oscuro' : 'claro'}: ${c.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
        }
    });
});

/**
 * El anillo de foco (`--focus`, `ring-focus`) y el botón destructivo lleno
 * (`--destructive-solid`). Un indicador de foco pide 3:1 contra lo que lo
 * rodea (la tarjeta y el fondo, que es también el color del `ring-offset`);
 * el texto del botón destructivo, 4,5:1 en reposo y en hover. Fase
 * «Escritorio del proyecto», ronda de arreglos (2026-10-26).
 */
describe('contraste del foco y del botón destructivo en cada tema', () => {
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
    const contraste = (x: number[], y: number[]) => {
        const [a, b] = [luminancia(x), luminancia(y)];
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    const rgb = (texto: string) => hsl(...(texto.trim().split(/\s+/).map(x => parseFloat(x)) as [number, number, number]));
    const bloques = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(b => ({
        selector: b[1]!.split('*/').pop()!.trim().replace(/\s+/g, ' '),
        cuerpo: b[2]!,
    }));
    const token = (cuerpo: string, nombre: string) => cuerpo.match(new RegExp(`${nombre}:\\s*([^;]+);`))?.[1];
    const base = (oscuro: boolean) => bloques.find(b => (oscuro ? b.selector === '.dark' : b.selector.startsWith(':root')))!.cuerpo;
    const esOscuro = (selector: string) => selector.includes('.dark') && !selector.includes('.light');

    it('cada tema que define el texto de la marca define también su foco, con el mismo tono', () => {
        const conTexto = bloques.filter(b => token(b.cuerpo, '--primary-text'));
        expect(conTexto.length).toBeGreaterThanOrEqual(9);
        for (const { selector, cuerpo } of conTexto) {
            expect(token(cuerpo, '--focus'), selector).toBe(token(cuerpo, '--primary-text'));
        }
    });

    it('el anillo de foco llega a 3:1 sobre la tarjeta y el fondo', () => {
        const conFoco = bloques.filter(b => token(b.cuerpo, '--focus'));
        expect(conFoco.length).toBeGreaterThanOrEqual(9);
        for (const { selector, cuerpo } of conFoco) {
            const delModo = base(esOscuro(selector));
            const de = (nombre: string) => rgb(token(cuerpo, nombre) ?? token(delModo, nombre)!);
            for (const fondo of ['--card', '--background']) {
                const c = contraste(de('--focus'), de(fondo));
                expect(c, `${selector} foco sobre ${fondo}: ${c.toFixed(2)}`).toBeGreaterThanOrEqual(3);
            }
        }
    });

    it('el botón destructivo lleno llega a AA con su texto y con blanco, en reposo y en hover', () => {
        const conRojo = bloques.filter(b => token(b.cuerpo, '--destructive-solid'));
        // Claro, oscuro y el claro forzado de la landing.
        expect(conRojo.map(b => b.selector)).toEqual(expect.arrayContaining(['.dark']));
        expect(conRojo.some(b => b.selector.startsWith(':root'))).toBe(true);
        expect(conRojo.some(b => b.selector.includes('.light'))).toBe(true);
        for (const { selector, cuerpo } of conRojo) {
            for (const fondo of ['--destructive-solid', '--destructive-solid-hover']) {
                for (const texto of [token(cuerpo, '--destructive-foreground')!, '0 0% 100%']) {
                    const c = contraste(rgb(texto), rgb(token(cuerpo, fondo)!));
                    expect(c, `${selector} ${fondo} con ${texto}: ${c.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
                }
            }
            // El hover oscurece: más contraste con el texto, nunca menos.
            const l = (t: string) => luminancia(rgb(token(cuerpo, t)!));
            expect(l('--destructive-solid-hover'), selector).toBeLessThan(l('--destructive-solid'));
        }
    });

    it('los temas no redefinen el rojo destructivo: todos heredan el medido', () => {
        const temas = bloques.filter(b => b.selector.includes('data-theme'));
        expect(temas.length).toBeGreaterThanOrEqual(6);
        for (const { selector, cuerpo } of temas) expect(token(cuerpo, '--destructive-solid'), selector).toBeUndefined();
    });
});

describe('las páginas del proyecto usan el texto de la marca, no `text-primary`', () => {
    it('ningún `text-primary` como color de texto en components/project ni en pages/projects', async () => {
        const { readdirSync, statSync } = await import('node:fs');
        const { join } = await import('node:path');
        const raices = ['../../../pages/faculty/components/project', '../../../pages/projects'].map(r => resolve(__dirname, r));
        const archivos: string[] = [];
        const recorrer = (dir: string) => {
            for (const nombre of readdirSync(dir)) {
                const ruta = join(dir, nombre);
                if (statSync(ruta).isDirectory()) { if (nombre !== '__tests__') recorrer(ruta); }
                else if (/\.tsx?$/.test(nombre)) archivos.push(ruta);
            }
        };
        raices.forEach(recorrer);
        expect(archivos.length).toBeGreaterThan(10);
        const usos = archivos.flatMap(ruta => readFileSync(ruta, 'utf8').split('\n')
            // Los comentarios pueden nombrar la clase vieja para explicar por qué no se usa.
            .filter(linea => !/^\s*(\/\/|\*|\/\*\*)/.test(linea))
            .filter(linea => /(^|[\s'"`:])text-primary(?![\w-])/.test(linea))
            .map(linea => `${ruta.split('/src/').pop()}: ${linea.trim()}`));
        expect(usos).toEqual([]);
    });
});
