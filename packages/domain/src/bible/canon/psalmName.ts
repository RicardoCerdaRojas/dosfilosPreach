/**
 * «Salmo» y «Salmos» como el mismo libro, para COMPARAR textos.
 *
 * Desde la fase «Lecciones del TI #2» (B68a) un solo salmo se escribe en
 * singular —«Salmo 23:4»—, como en el TI #1 entregado. Lo guardado antes
 * dice «Salmos 23:4»: los encabezados del ensamble, la huella de extracción
 * de cada fuente y las ediciones a mano del ensamble. Quien compare un texto
 * nuevo con uno guardado pasa los dos por aquí, y así un trabajo viejo no
 * pierde sus secciones ni marca sus fuentes como desactualizadas.
 *
 * Solo para comparar: para mostrar, `formatPassageReference`. Sin imports a
 * propósito, para que lo use `ProjectSource` sin el ciclo con `bible/canon`.
 */
export function sameBookNameForPsalms(text: string): string {
    return text
        .replace(/\b([Ss])almos\b/g, '$1almo')
        .replace(/\b([Pp])salms\b/g, '$1salm')
        .replace(/\bSALMOS\b/g, 'SALMO')
        .replace(/\bPSALMS\b/g, 'PSALM');
}
