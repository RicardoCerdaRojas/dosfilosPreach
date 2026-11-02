import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { initI18n, i18n } from '@/i18n';
import { TooltipProvider } from '@/components/ui/tooltip';
import { StepCard } from '@/components/exegesis/StepCard';
import { ESTADOS } from './estados';
import '@/index.css';

/**
 * Todas las tarjetas, a un ancho y en un idioma. `capturar.mjs` lee el informe que
 * se deja en `#informe`. También se abre a mano: `/banco/index.html?ancho=842`.
 */
const params = new URLSearchParams(location.search);
const ancho = Number(params.get('ancho') ?? 842);
const idioma = params.get('idioma') === 'en' ? 'en' : 'es';
// Para las capturas: de a pocas tarjetas, que se puedan leer.
const parte = params.get('parte');
const POR_CAPTURA = 6;
const estados = Object.entries(ESTADOS).filter((_, i) => parte === null || Math.floor(i / POR_CAPTURA) === Number(parte));

initI18n();
void i18n.changeLanguage(idioma);

const raiz = document.getElementById('raiz')!;
createRoot(raiz).render(
    <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
            <TooltipProvider>
                {estados.map(([nombre, paso]) => (
                    <section key={nombre} data-estado={nombre} style={{ width: ancho, margin: '0 0 24px' }}>
                        <h2 style={{ font: '600 12px Inter, sans-serif', margin: '0 0 6px', color: '#475569' }}>{nombre}</h2>
                        <StepCard step={paso} paperId="banco" language={idioma} hasAssembly />
                    </section>
                ))}
            </TooltipProvider>
        </MemoryRouter>
    </QueryClientProvider>,
);

const espera = (ms: number) => new Promise(r => setTimeout(r, ms));

/** El ícono de cada acción: el trazo identifica el dibujo, sea cual sea su tamaño. */
const dibujo = (svg: Element) => svg.innerHTML;

function repetidos(zona: Element | null): string[] {
    if (!zona) return [];
    const vistos = new Map<string, string>();
    const salen: string[] = [];
    zona.querySelectorAll('button, a').forEach(accion => {
        const svg = accion.querySelector('svg');
        const nombre = (accion.getAttribute('aria-label') ?? accion.textContent ?? '').trim();
        if (!svg || !nombre) return;
        const previo = vistos.get(dibujo(svg));
        if (previo && previo !== nombre) salen.push(`${previo} = ${nombre}`);
        else vistos.set(dibujo(svg), nombre);
    });
    return salen;
}

async function informar() {
    await espera(600);
    const expandir = i18n.t('exegesis:detail.steps.action.expand');
    raiz.querySelectorAll(`button[aria-label="${expandir}"]`).forEach(b => (b as HTMLButtonElement).click());
    await espera(600);
    // Sin Inter los anchos no valen: otra fuente puede partir una fila que sí cabe.
    await Promise.all(['400 14px Inter', '500 14px Inter', '500 12px Inter', '600 14px Inter'].map(f => document.fonts.load(f)));
    await document.fonts.ready;
    const conInter = [...document.fonts].some(f => f.family.replace(/"/g, '') === 'Inter' && f.status === 'loaded');

    const tarjetas = [...raiz.querySelectorAll('section[data-estado]')].map(seccion => {
        const articulo = seccion.querySelector('article')!;
        const pie = articulo.querySelector('footer');
        // Las acciones van sueltas en el pie (aceptada) o dentro de una línea (revisión).
        const lineas = pie ? [pie, ...pie.querySelectorAll(':scope > div')] : [];
        const acciones = lineas.flatMap(l => [...l.children].filter(h => h.matches('button, a')));
        // Los íconos del encabezado: el contenedor de la primera acción que no está en el pie.
        const encabezado = [...articulo.querySelectorAll('button[aria-label]')]
            .find(b => !b.closest('footer') && b.querySelector('svg') && !/expand|contraer|expandir|collapse/i.test(b.getAttribute('aria-label') ?? ''))
            ?.parentElement ?? null;
        return {
            estado: seccion.getAttribute('data-estado'),
            accionesEncabezado: encabezado ? encabezado.querySelectorAll('button, a').length : 0,
            // Por línea: «Componer prosa» va en la suya, a propósito.
            filas: Math.max(0, ...lineas.map(l => new Set([...l.children].filter(h => h.matches('button, a')).map(h => Math.round(h.getBoundingClientRect().top))).size)),
            acciones: acciones.map(a => a.textContent?.trim()),
            desborda: articulo.scrollWidth > articulo.clientWidth + 1,
            iconosPie: repetidos(pie),
            iconosEncabezado: repetidos(encabezado),
            subtitulo: articulo.querySelector('h3 + p span')?.textContent?.trim() ?? '',
        };
    });
    const informe = document.createElement('pre');
    informe.id = 'informe';
    informe.hidden = true;
    informe.textContent = JSON.stringify({ conInter, tarjetas });
    document.body.append(informe);
}

void informar();
