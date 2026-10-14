import type { CitationPageKind, VerifiedCitation } from '@dosfilos/domain';

/**
 * La página donde el verificador halló el apoyo, para abrirla en el visor
 * (fase F, F4).
 *
 * Cuando el verificador dice «citaste p. 203 pero el apoyo está en 202», hay
 * que poder mirar las DOS para decidir. En el TP #7 las dos alarmas de
 * McCartney eran falsas y el fundador lo comprobó saliendo de la aplicación.
 *
 * Se lee del rótulo (`matchedPageLabel`: «p. 202», «hoja 16»), que dice qué
 * clase de número es. Sin rótulo, el número pelado se toma como página
 * impresa, que es como la pantalla lo venía mostrando. Una página romana o
 * sin número no se puede abrir: `null`.
 */
export function paginaHallada(verdict: Pick<VerifiedCitation, 'matchedPage' | 'matchedPageLabel'>): { page: number; pageKind?: CitationPageKind; label: string } | null {
    const rotulo = verdict.matchedPageLabel?.trim();
    if (rotulo) {
        const m = rotulo.match(/^(p\.|hoja)\s*(\d+)/);
        if (!m) return null;
        return { page: Number(m[2]), ...(m[1] === 'hoja' ? {} : { pageKind: 'printed' as const }), label: rotulo };
    }
    const n = Number(verdict.matchedPage);
    return Number.isInteger(n) && n > 0 ? { page: n, pageKind: 'printed', label: `p. ${n}` } : null;
}
