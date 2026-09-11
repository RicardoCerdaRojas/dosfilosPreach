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
    /**
     * El markdown de la página, cuando la entrada lo traía entero.
     *
     * Antes se perdía SIEMPRE: el patrón tomaba el primer campo que encontrara
     * —`text`, que va primero— y la interfaz ni siquiera tenía dónde guardar el
     * otro. Medido sobre la gramática de Barrick, donde tres de cinco tandas
     * pasaron por el rescate: las dos rescatadas quedaron con CERO encabezados
     * y CERO tablas, contra 12 tablas en las tandas que parsearon limpio. En
     * una gramática, un paradigma verbal sin su tabla deja de decir qué forma
     * corresponde a qué persona.
     */
    md?: string;
}

/**
 * El comienzo de una entrada: `{"page": N`. Desde ahí hasta el comienzo de la
 * siguiente está todo lo que esa página llegó a escribir.
 */
const COMIENZO = /\{\s*"page"\s*:\s*(\d+)/g;

/**
 * Un campo de texto escapado según JSON. `(?:[^"\\]|\\.)*` acepta comillas
 * escapadas dentro del valor y se detiene en la primera sin escapar, que es
 * exactamente donde la entrada se corrompió.
 */
function leerCampo(trozo: string, nombre: 'text' | 'md'): string | undefined {
    const m = trozo.match(new RegExp(`"${nombre}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
    if (!m) return undefined;
    try {
        return JSON.parse(`"${m[1]}"`) as string;
    } catch {
        // Ese campo quedó irrecuperable. Se pierde el campo, no la página.
        return undefined;
    }
}

export function rescatarPaginas(crudo: string): PaginaRescatada[] {
    // Primero las posiciones de cada entrada, para poder acotar dónde termina
    // una y empieza la siguiente. Sin ese corte, el patrón de `md` de una
    // página podría capturar el de la página de más abajo.
    const comienzos: Array<{ page: number; desde: number }> = [];
    COMIENZO.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = COMIENZO.exec(crudo)) !== null) {
        const page = Number(m[1]);
        if (Number.isFinite(page)) comienzos.push({ page, desde: m.index });
    }

    const out: PaginaRescatada[] = [];
    const vistas = new Set<number>();
    for (let i = 0; i < comienzos.length; i++) {
        const { page, desde } = comienzos[i]!;
        if (vistas.has(page)) continue;
        const hasta = i + 1 < comienzos.length ? comienzos[i + 1]!.desde : crudo.length;
        const trozo = crudo.slice(desde, hasta);

        const text = leerCampo(trozo, 'text');
        const md = leerCampo(trozo, 'md');
        // Sin ninguno de los dos no hay página que rescatar. Con uno solo sí:
        // `md` suele cortarse antes que `text` porque va después.
        if (text === undefined && md === undefined) continue;

        out.push({ page, text: text ?? md ?? '', ...(md !== undefined ? { md } : {}) });
        vistas.add(page);
    }
    return out.sort((a, b) => a.page - b.page);
}

/**
 * Cuántas de las páginas rescatadas conservaron su markdown.
 *
 * Existe para que la pérdida sea VISIBLE. Un rescate que salva el texto y se
 * come la estructura no falla: devuelve páginas, pasa el guard de cobertura y
 * entra al corpus como buena. Así se perdieron las tablas de 63 páginas de una
 * gramática sin que ningún registro lo dijera.
 */
export function conMarkdown(paginas: ReadonlyArray<PaginaRescatada>): number {
    return paginas.filter(p => p.md !== undefined && p.md.length > 0).length;
}
