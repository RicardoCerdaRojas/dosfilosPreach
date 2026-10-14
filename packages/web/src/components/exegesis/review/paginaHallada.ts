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
        // «pp. 202» y «P. 202» también: el rótulo puede venir de la pista
        // del verificador, que es texto libre.
        const m = rotulo.match(/^(pp?\.|hoja)\s*(\d+)/i);
        if (!m) return null;
        return { page: Number(m[2]), ...(m[1]!.toLowerCase() === 'hoja' ? {} : { pageKind: 'printed' as const }), label: rotulo };
    }
    const n = Number(verdict.matchedPage);
    return Number.isInteger(n) && n > 0 ? { page: n, pageKind: 'printed', label: `p. ${n}` } : null;
}

/**
 * Si la página hallada es OTRA que la citada. Cuenta la clase de número: la
 * «p. 16» citada y la «hoja 16» hallada son páginas distintas del libro. Un
 * rango citado que empieza en la hallada es la misma.
 */
export function esOtraPagina(
    verdict: Pick<VerifiedCitation, 'pages' | 'raw'>,
    hallada: { page: number; pageKind?: CitationPageKind },
): boolean {
    const citada = String(verdict.pages ?? '').split(/[–-]/)[0]?.trim();
    if (!citada) return true;
    const citadaEsHoja = /\bhoja\b/i.test(verdict.raw ?? '');
    const halladaEsHoja = hallada.pageKind !== 'printed';
    return citadaEsHoja !== halladaEsHoja || citada !== String(hallada.page);
}
