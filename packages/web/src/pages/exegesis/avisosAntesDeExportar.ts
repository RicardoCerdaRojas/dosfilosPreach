import {
    assemblyDelivery,
    hasCover,
    paperIsDelivered,
    sectionsBehindAssembly,
    type ExegeticalPaper,
} from '@dosfilos/domain';

type Traducir = (clave: string, opciones?: Record<string, unknown>) => string;

/**
 * Los avisos que antes llegaban después de bajar el archivo, y ahora se ven
 * antes (fase «Lecciones del TI #2», etapa 2).
 *
 * `assembledMarkdown` es lo que se descarga: se escribe al aceptar el ensamble
 * y al recomponer un versículo. NO se escribe al regenerar el ensamble: un ensamble regenerado y sin aceptar es
 * invisible, la pantalla muestra el texto nuevo y el archivo trae el anterior
 * (Santiago 2:1-13: habría bajado los nueve versículos que el autor excluyó).
 * Tampoco al editar un versículo o aceptar una conclusión regenerada: el paso se
 * ve corregido y el archivo sale con lo de antes. Y el Word sin portada, que nada
 * decía.
 */
export function avisosAntesDeExportar(
    paper: ExegeticalPaper,
    formato: 'docx' | 'md',
    t: Traducir,
): string[] {
    const entrega = assemblyDelivery(paper);
    const atrasadas = sectionsBehindAssembly(paper, paper.displayLanguage);
    return [
        ...(entrega.state === 'difiere'
            ? [t('detail.length.stale.toast', { delivered: entrega.deliveredWords, onScreen: entrega.onScreenWords })]
            : []),
        ...(atrasadas.length > 0
            ? [t('detail.length.behind', { count: atrasadas.length, sections: atrasadas.map(p => p.label).join(', ') })]
            : []),
        ...(formato === 'docx' && !hasCover(paper.cover) && paperIsDelivered(paper) ? [t('detail.exportDocx.toast.noCover')] : []),
    ];
}
