/**
 * Rescata las páginas de una respuesta cuyo JSON llegó roto.
 *
 * Medido: 1 de cada 12 tandas vuelve con JSON inválido, con `finishReason=STOP`
 * y la respuesta completa. No es truncamiento: el aparato crítico de la BHS
 * mezcla paréntesis desbalanceados, comillas y tres alfabetos en la misma línea
 * —`)hpgr) || 2ª huc tr: || מִזְמוֹר = pr ψαλμός`— y algo de eso escapa mal
 * aunque se pida `responseMimeType: application/json`.
 *
 * Hasta ahora una tanda así se descartaba entera y el libro perdía ocho páginas.
 * Sobre obras reales eso se ve: Sasson tiene 20 huecos internos en 392 páginas.
 *
 * Rescatar convierte «perdí la tanda» en «perdí la página que venía rota». Las
 * entradas bien formadas se recuperan una por una; la que no parsea se pierde y
 * se cuenta como página faltante, que es la verdad y la ve el guard de
 * cobertura.
 *
 * NO intenta reparar el JSON. Cerrar llaves a mano o adivinar dónde faltaba una
 * comilla produce texto plausible y equivocado, y este corpus se cita.
 */

export interface PaginaRescatada {
    page: number;
    text: string;
}

/**
 * Una entrada `{"page":N,"text":"..."}`, con el texto escapado según JSON.
 * `(?:[^"\\]|\\.)*` acepta comillas escapadas dentro del texto y se detiene en
 * la primera sin escapar, que es exactamente donde la entrada se corrompió.
 */
const ENTRADA = /\{\s*"page"\s*:\s*(\d+)\s*,\s*"(?:text|md)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;

export function rescatarPaginas(crudo: string): PaginaRescatada[] {
    const out: PaginaRescatada[] = [];
    const vistas = new Set<number>();
    ENTRADA.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ENTRADA.exec(crudo)) !== null) {
        const page = Number(m[1]);
        if (!Number.isFinite(page) || vistas.has(page)) continue;
        try {
            out.push({ page, text: JSON.parse(`"${m[2]}"`) as string });
            vistas.add(page);
        } catch {
            // Esa entrada quedó irrecuperable. Se pierde una página, no ocho.
        }
    }
    return out.sort((a, b) => a.page - b.page);
}
