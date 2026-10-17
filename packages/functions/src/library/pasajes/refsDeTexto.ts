import { CANON_BIBLICO, GRAFIAS_DE_COMENTARIOS, PREFERENCIA_SI_AMBIGUA } from './canonBiblico';

/**
 * Qué pasajes bíblicos nombra un texto, como claves para un índice
 * (fase «buscador de la biblioteca», etapa 3).
 *
 * «Santiago 5:14-16» → `JAS.5`, `JAS.5.14`, `JAS.5.15`, `JAS.5.16`. Cada cita
 * deja la clave del capítulo y la de cada versículo, para que una búsqueda
 * por «Santiago 5» y otra por «Stg 5:14» encuentren el mismo fragmento con
 * una sola consulta `array-contains-any`.
 *
 * En la prosa, sólo citas con libro. El «v. 14» o el «1:17» suelto de un
 * comentario se resuelven sólo con el libro y el capítulo que da el
 * encabezado de su sección (`refsDeFragmento`).
 */

/** Versículos de más en un rango: «1:1-176» es un error de lectura, no una cita. */
const RANGO_MAXIMO = 40;
/** Capítulos de más en un rango («Mateo 5-7»). */
const RANGO_DE_CAPITULOS_MAXIMO = 30;
/** El capítulo más largo (Sal 119) tiene 176 versículos. */
const VERSICULO_MAXIMO = 176;
/** Claves por fragmento: un índice de Escrituras no aporta más y engorda el documento. */
export const REFS_POR_FRAGMENTO = 120;
/** El tope de valores de `array-contains-any` en Firestore. */
export const REFS_POR_CONSULTA = 30;

export interface OpcionesDeRefs {
    /**
     * Pedir mayúscula al comienzo del nombre. En la prosa de un libro una
     * cita siempre la lleva, y así «time is 5:30» o «los números 4 y 5» no
     * pasan por Isaías o Números. Lo que escribe el usuario en el buscador va
     * en minúscula: ahí se apaga, y también se aceptan «stg 5» o «sal 23».
     */
    exigirMayuscula?: boolean;
}

/** Una cita reconocida: el texto tal como apareció y lo que nombra. */
export interface Cita { texto: string; libro: string; capitulo: number; versiculos: number[] }

/** Espacio sin salto de renglón: una cita no cruza de un renglón a otro. */
const H = '[^\\S\\n]*';

let patron: { re: RegExp; porGrafia: Map<string, string[]>; capitulos: Map<string, number> } | null = null;

function armarPatron() {
    if (patron) return patron;
    const porGrafia = new Map<string, string[]>();
    const capitulos = new Map<string, number>();
    const agregar = (id: string, g: string) => {
        const limpia = g.replace(/\./g, '').trim();
        const ids = porGrafia.get(limpia) ?? [];
        if (!ids.includes(id)) ids.push(id);
        porGrafia.set(limpia, ids);
    };
    for (const [id, caps, grafias] of CANON_BIBLICO) {
        capitulos.set(id, caps);
        for (const g of grafias) agregar(id, g);
    }
    for (const [id, grafias] of Object.entries(GRAFIAS_DE_COMENTARIOS)) for (const g of grafias) agregar(id, g);
    const alternancia = [...porGrafia.keys()]
        .sort((a, b) => b.length - a.length)
        // «1 cor» admite «1Cor» y «1 Cor».
        .map(g => g.split(' ').map(escapar).join(H))
        .join('|');
    // Antes del nombre, nada que lo pegue a otra palabra («index 3:4» no es Éxodo).
    // Después: capítulo y, optativos, el versículo con su rango (que puede
    // cruzar de capítulo: «1:18-3:20») o un rango de capítulos («5-7»).
    const re = new RegExp(
        `(?<![\\p{L}\\p{N}])(${alternancia})\\.?${H}(\\d{1,3})` +
        `(?:${H}([:.,])${H}(\\d{1,3})[a-c]?` +
            `(?:${H}[-–—]${H}(?:(\\d{1,3})${H}[:.]${H}(\\d{1,3})|(\\d{1,3})(?!${H}[:.]${H}\\d))[a-c]?)?` +
        `|${H}[-–—]${H}(\\d{1,3})(?!${H}[:.,]${H}\\d))?` +
        `(?!\\d)`,
        'giu',
    );
    patron = { re, porGrafia, capitulos };
    return patron;
}

function escapar(texto: string): string {
    return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Minúscula, sin acentos y con un espacio entre partes, como el dominio. */
function normalizarGrafia(texto: string): string {
    return texto.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

/** Los libros que nombra una grafía («1Cor» y «1 cor» son la misma). */
function librosDeGrafia(clave: string): string[] {
    const { porGrafia } = armarPatron();
    return porGrafia.get(clave) ?? porGrafia.get(clave.replace(/^(\d|i{1,3})\s*/, '$1 ')) ?? porGrafia.get(clave.replace(/\s+/g, '')) ?? [];
}

/** El libro que tiene ese capítulo; si quedan dos, la preferencia. */
function resolverLibro(clave: string, capitulo: number): string | null {
    const { capitulos } = armarPatron();
    const viables = librosDeGrafia(clave).filter(id => capitulo >= 1 && capitulo <= (capitulos.get(id) ?? 0));
    if (viables.length === 1) return viables[0]!;
    if (viables.length > 1) {
        const preferido = PREFERENCIA_SI_AMBIGUA[clave];
        return preferido && viables.includes(preferido) ? preferido : null;
    }
    return null;
}

/**
 * «Judas 4», «Flm 6», «3 Jn 4»: en un libro de un solo capítulo la cifra
 * sola es el versículo. Devuelve el libro si la grafía nombra uno así sin
 * duda (o por la preferencia, «Jud» → Judas).
 */
function libroDeUnCapitulo(clave: string): string | null {
    const { capitulos } = armarPatron();
    const ids = librosDeGrafia(clave);
    const unicos = ids.filter(id => capitulos.get(id) === 1);
    if (unicos.length !== 1) return null;
    return ids.length === 1 || PREFERENCIA_SI_AMBIGUA[clave] === unicos[0] ? unicos[0]! : null;
}

/**
 * Versículos de los libros de un solo capítulo. Ahí no hay capítulo que
 * descarte una cifra imposible, y medido en la biblioteca (2026-10-16) se
 * colaban «AB 37» (Anchor Bible), los números de página de un índice
 * («Obadiah 23», «OBADIAH 91») y erratas («Filemon 1:27»).
 */
const VERSICULOS_DE_UN_CAPITULO: Readonly<Record<string, number>> = { OBA: 21, PHM: 25, '2JN': 13, '3JN': 15, JUD: 25 };

/** Los versículos de «14» o «14-16»; un rango absurdo deja sólo el comienzo. */
function versiculosDe(desdeStr: string | undefined, hastaStr: string | undefined): number[] {
    const desde = desdeStr === undefined ? 0 : Number(desdeStr);
    if (desde < 1 || desde > VERSICULO_MAXIMO) return [];
    const hasta = hastaStr === undefined ? desde : Number(hastaStr);
    const fin = hasta > desde && hasta - desde <= RANGO_MAXIMO && hasta <= VERSICULO_MAXIMO ? hasta : desde;
    const versiculos: number[] = [];
    for (let v = desde; v <= fin; v++) versiculos.push(v);
    return versiculos;
}

/** Sin acentos (Génesis, Éxodo) pero conservando la mayúscula. */
const sinAcentos = (texto: string) => texto.normalize('NFD').replace(/\p{M}/gu, '');

/** Las citas de un texto, en orden de aparición (para el índice y para revisarlas a mano). */
export function citasDeTexto(texto: string, opciones: OpcionesDeRefs = {}): Cita[] {
    return citasYTramos(texto, opciones).citas;
}

/** Las citas y dónde está cada una en el texto sin acentos (para taparlas). */
function citasYTramos(texto: string, opciones: OpcionesDeRefs = {}): { citas: Cita[]; plano: string; tramos: Array<[number, number]> } {
    const plano = sinAcentos(texto ?? '');
    const citas: Cita[] = [];
    const tramos: Array<[number, number]> = [];
    if (!plano) return { citas, plano, tramos };
    const { re, capitulos } = armarPatron();
    const enProsa = opciones.exigirMayuscula ?? true;
    re.lastIndex = 0;
    for (const m of plano.matchAll(re)) {
        const [cita, grafia = '', capStr = '', separador, versStr, finCapStr, finVersStr, finMismoStr, finCapSoloStr] = m;
        // La primera LETRA en mayúscula: «1 Cor» sí, «vol. 2 p. 3:4» no.
        const primeraLetra = /\p{L}/u.exec(grafia)?.[0] ?? '';
        if (enProsa && !/\p{Lu}/u.test(primeraLetra)) continue;
        const clave = normalizarGrafia(grafia);
        const corta = clave.replace(/\s/g, '').length < 4;
        // «Es 3,5 veces», «Is 3,5 kg»: con dos letras, la coma no separa versículos.
        if (enProsa && separador === ',' && clave.replace(/\s/g, '').length <= 2) continue;
        const capitulo = Number(capStr);

        if (versStr === undefined) {
            const unico = libroDeUnCapitulo(clave);
            if (unico && finCapSoloStr === undefined) {
                // En prosa, sólo con el nombre entero: «AB 37» es la Anchor Bible.
                if (enProsa && corta) continue;
                const versiculos = versiculosDe(capStr, undefined);
                if (versiculos.length > 0) {
                    citas.push({ texto: cita, libro: unico, capitulo: 1, versiculos });
                    tramos.push([m.index ?? 0, (m.index ?? 0) + cita.length]);
                }
                continue;
            }
            // Una cifra sola tras un nombre corto («Ex 3», «Am 2») es demasiado
            // ambigua en prosa: sin versículo, sólo con el nombre entero.
            if (enProsa && corta) continue;
            const libro = resolverLibro(clave, capitulo);
            if (!libro) continue;
            const hasta = finCapSoloStr === undefined ? capitulo : Number(finCapSoloStr);
            const ultimo = hasta > capitulo && hasta - capitulo <= RANGO_DE_CAPITULOS_MAXIMO ? Math.min(hasta, capitulos.get(libro) ?? capitulo) : capitulo;
            for (let c = capitulo; c <= ultimo; c++) citas.push({ texto: cita, libro, capitulo: c, versiculos: [] });
            tramos.push([m.index ?? 0, (m.index ?? 0) + cita.length]);
            continue;
        }

        const libro = resolverLibro(clave, capitulo);
        if (!libro) continue;
        if (finCapStr !== undefined) {
            // «1:18-3:20»: el comienzo, los capítulos de en medio y el final.
            const finCap = Number(finCapStr);
            const ultimo = finCap > capitulo && finCap - capitulo <= RANGO_DE_CAPITULOS_MAXIMO && finCap <= (capitulos.get(libro) ?? 0) ? finCap : capitulo;
            citas.push({ texto: cita, libro, capitulo, versiculos: versiculosDe(versStr, undefined) });
            for (let c = capitulo + 1; c < ultimo; c++) citas.push({ texto: cita, libro, capitulo: c, versiculos: [] });
            if (ultimo > capitulo) citas.push({ texto: cita, libro, capitulo: ultimo, versiculos: versiculosDe(finVersStr, undefined) });
        } else {
            citas.push({ texto: cita, libro, capitulo, versiculos: versiculosDe(versStr, finMismoStr) });
        }
        const inicio = m.index ?? 0;
        const siguen = continuacion(plano, inicio + cita.length, libro, citas[citas.length - 1]!.capitulo);
        citas.push(...siguen.citas);
        tramos.push([inicio, siguen.fin]);
    }
    return { citas, plano, tramos };
}

/**
 * Lo que sigue a una cita en una lista: «; 8.40» es otro capítulo del mismo
 * libro y «, 12» otro versículo del mismo capítulo («Ac 7.12; 8.40; 9.21»,
 * «Rom 2:6, 12»). Los comentarios citan así, y sin esto sólo contaba la
 * primera. Una cifra sola tras «;» no se toma: puede ser capítulo o página.
 */
const SIGUIENTE = new RegExp(`${H}([;,])${H}(?:(\\d{1,3})${H}[:.]${H}(\\d{1,3})|(\\d{1,3}))[a-c]?(?:${H}[-–—]${H}(\\d{1,3})[a-c]?)?(?![\\d:.]*\\d)`, 'y');
const CONTINUACION_MAXIMA = 30;

function continuacion(plano: string, desde: number, libro: string, capituloInicial: number): { citas: Cita[]; fin: number } {
    const { capitulos } = armarPatron();
    const citas: Cita[] = [];
    let capitulo = capituloInicial;
    let fin = desde;
    SIGUIENTE.lastIndex = desde;
    for (let i = 0; i < CONTINUACION_MAXIMA; i++) {
        const m = SIGUIENTE.exec(plano);
        if (!m) break;
        const [texto, signo, capStr, versStr, solo, finStr] = m;
        if (capStr !== undefined) {
            const nuevo = Number(capStr);
            if (nuevo < 1 || nuevo > (capitulos.get(libro) ?? 0)) break;
            capitulo = nuevo;
            citas.push({ texto: texto.trim(), libro, capitulo, versiculos: versiculosDe(versStr, finStr) });
            fin = SIGUIENTE.lastIndex;
            continue;
        } else {
            if (signo !== ',') break;
            const versiculos = versiculosDe(solo, finStr);
            if (versiculos.length === 0) break;
            citas.push({ texto: texto.trim(), libro, capitulo, versiculos });
        }
        fin = SIGUIENTE.lastIndex;
    }
    return { citas, fin };
}

/** Las claves de unas citas, sin repetir y con tope. */
function claves(citas: ReadonlyArray<Cita>): string[] {
    const refs = new Set<string>();
    for (const c of citas) {
        const tope = VERSICULOS_DE_UN_CAPITULO[c.libro];
        const versiculos = tope === undefined ? c.versiculos : c.versiculos.filter(v => v <= tope);
        // Sólo versículos imposibles («Filemon 1:27»): la cita entera no es de ese libro.
        if (c.versiculos.length > 0 && versiculos.length === 0) continue;
        refs.add(`${c.libro}.${c.capitulo}`);
        for (const v of versiculos) refs.add(`${c.libro}.${c.capitulo}.${v}`);
        if (refs.size >= REFS_POR_FRAGMENTO) break;
    }
    return [...refs].slice(0, REFS_POR_FRAGMENTO);
}

/** Los pasajes que nombra un texto, como `LIBRO.cap` y `LIBRO.cap.vers`, en orden de aparición. */
export function refsDeTexto(texto: string, opciones: OpcionesDeRefs = {}): string[] {
    return claves(citasDeTexto(texto, opciones));
}

/**
 * Las claves con que se busca un pasaje escrito en el buscador: las de los
 * versículos y, después, las de sus capítulos (un comentario que sólo dice
 * «Santiago 5» en el encabezado también trata 5:14). Con más versículos de
 * los que caben, sólo los capítulos.
 */
export function refsDeConsulta(consulta: string): string[] {
    const refs = refsDeTexto(consulta, { exigirMayuscula: false });
    const versiculos = refs.filter(r => r.split('.').length === 3);
    const capitulos = refs.filter(r => r.split('.').length === 2);
    if (versiculos.length + capitulos.length <= REFS_POR_CONSULTA) return [...versiculos, ...capitulos];
    return capitulos.slice(0, REFS_POR_CONSULTA);
}

interface Contexto {
    libro: string;
    capitulo: number | null;
    /** Vino de una cita (con cifras), no de un encabezado que sólo dice «Numbers»: sólo así vale para el texto. */
    firme: boolean;
}

/** «8:28-30» o «1:17» sin libro, leídos con el libro del contexto. */
const SIN_LIBRO = new RegExp(`(?<![\\p{L}\\p{N}.:,])(\\d{1,3})${H}:${H}(\\d{1,3})(?:${H}[-–—]${H}(\\d{1,3}))?(?![\\d:.]*\\d)`, 'gu');
/** «v. 14», «vv. 13-18», «vers. 4». */
const VERSICULO_SUELTO = new RegExp(`(?<![\\p{L}])(?:vv?|vers|verses?|versiculos?)\\.?${H}(\\d{1,3})(?:${H}[-–—]${H}(\\d{1,3}))?(?![\\d:]*\\d)`, 'giu');

/** Lo que precede al nombre en un encabezado que sólo nombra el libro. */
const PREFIJO_DE_LIBRO = /^(?:(?:the\s+)?(?:book|epistle|letter|gospel)\s+(?:of|to)\s+(?:the\s+)?|(?:el\s+)?(?:libro|epistola|carta|evangelio)\s+(?:de|a)\s+(?:los\s+)?|comentario\s+(?:a|de|sobre)\s+(?:los\s+)?)/;

/**
 * «Romans», «The Epistle of James», «Comentario a Romanos»: un encabezado que
 * sólo nombra un libro (con el nombre entero, no una abreviatura) da el
 * contexto para los «8:28-30» de los encabezados de abajo.
 */
function libroDelEncabezado(encabezado: string): string | null {
    const clave = normalizarGrafia(encabezado).replace(PREFIJO_DE_LIBRO, '');
    if (clave.replace(/\s/g, '').length < 4) return null;
    const ids = librosDeGrafia(clave);
    return ids.length === 1 ? ids[0]! : null;
}

function tapar(texto: string, tramos: ReadonlyArray<[number, number]>): string {
    let out = texto;
    for (const [a, b] of tramos) out = out.slice(0, a) + ' '.repeat(b - a) + out.slice(b);
    return out;
}

function citasConContexto(texto: string, contexto: Contexto): Cita[] {
    const { capitulos } = armarPatron();
    const plano = sinAcentos(texto);
    const citas: Cita[] = [];
    for (const m of plano.matchAll(SIN_LIBRO)) {
        const capitulo = Number(m[1]);
        if (capitulo < 1 || capitulo > (capitulos.get(contexto.libro) ?? 0)) continue;
        citas.push({ texto: m[0], libro: contexto.libro, capitulo, versiculos: versiculosDe(m[2], m[3]) });
    }
    if (contexto.capitulo !== null) {
        for (const m of plano.matchAll(VERSICULO_SUELTO)) {
            const versiculos = versiculosDe(m[1], m[2]);
            if (versiculos.length > 0) citas.push({ texto: m[0], libro: contexto.libro, capitulo: contexto.capitulo, versiculos });
        }
    }
    return citas;
}

/**
 * Los pasajes de un fragmento: los de su texto y los de su sección. El
 * encabezado de un comentario («Santiago 5:13-18», o «Santiago 5» › «vv.
 * 13-18») da el libro y el capítulo con que se leen el «v. 14» y el «1:17»
 * sueltos del texto. Cada encabezado se lee por separado: el último no se
 * pega a la primera cifra del texto.
 */
export function refsDeFragmento(texto: string, seccion: ReadonlyArray<string> | null | undefined): string[] {
    const citas: Cita[] = [];
    let contexto: Contexto | null = null;
    for (const encabezado of seccion ?? []) {
        const propias = citasDeTexto(encabezado);
        if (propias.length > 0) {
            citas.push(...propias);
            const ultima = propias[propias.length - 1]!;
            // Un encabezado con libro cambia el contexto; el capítulo sólo si es uno.
            const libros = new Set(propias.map(c => c.libro));
            const caps = new Set(propias.map(c => c.capitulo));
            contexto = libros.size === 1 ? { libro: ultima.libro, capitulo: caps.size === 1 ? ultima.capitulo : null, firme: true } : null;
            continue;
        }
        const soloLibro = libroDelEncabezado(encabezado);
        if (soloLibro) { contexto = { libro: soloLibro, capitulo: null, firme: false }; continue; }
        if (!contexto) continue;
        const sueltas = citasConContexto(encabezado, contexto);
        if (sueltas.length === 0) continue;
        citas.push(...sueltas);
        const caps = new Set(sueltas.map(c => c.capitulo));
        contexto = { ...contexto, capitulo: caps.size === 1 ? sueltas[0]!.capitulo : contexto.capitulo, firme: true };
    }
    const propias = citasYTramos(texto);
    citas.push(...propias.citas);
    // Las cifras sueltas se leen con el contexto SIN las citas que ya tienen
    // libro: en un comentario de Santiago, el «5:14» de «Rom 5:14» es Romanos.
    if (contexto?.firme) citas.push(...citasConContexto(tapar(propias.plano, propias.tramos), contexto));
    return claves(citas);
}

/**
 * El pasaje que nombra una pregunta, para mostrarlo («¿Qué dicen mis libros
 * sobre génesis 2:17?» → «Génesis 2:17»): la cita como la escribió el pastor
 * —con sus acentos—, con la primera LETRA en mayúscula. `null` si la pregunta
 * no nombra ninguno con seguridad (fase «biblioteca consultable», U6).
 *
 * En una pregunta no se exige mayúscula, así que una cifra sola tras una
 * grafía corta es una palabra común: «dan 3 razones», «la sal 2 veces», «mi 2
 * pregunta» (revisión adversarial). Hace falta un versículo («stg 3:13») o el
 * nombre entero del libro («santiago 3»), y que deje alguna clave.
 */
export function etiquetaDePasaje(pregunta: string): string | null {
    const citas = citasDeTexto(pregunta, { exigirMayuscula: false });
    const primera = citas.find(c => {
        const grafia = c.texto.replace(/[\d\s:.,\-–—]+$/g, '').replace(/[^\p{L}]/gu, '');
        return (c.versiculos.length > 0 || grafia.length >= 4) && claves([c]).length > 0;
    });
    if (!primera) return null;
    // `citasDeTexto` busca sin acentos: se arma el mismo texto llevando, por
    // cada posición, la del original, para recortar la cita de ahí.
    let plano = '';
    const origen: number[] = [];
    for (let i = 0; i < pregunta.length; i++) {
        const sin = pregunta[i]!.normalize('NFD').replace(/\p{M}/gu, '');
        for (const c of sin) { plano += c; origen.push(i); }
    }
    const desde = plano.indexOf(primera.texto);
    const recorte = desde >= 0
        ? pregunta.slice(origen[desde]!, origen[desde + primera.texto.length - 1]! + 1)
        : primera.texto;
    const limpio = recorte.replace(/\s+/g, ' ').trim().replace(/[.,;:]+$/, '');
    // «1 cor 13:4» → «1 Cor 13:4»: la mayúscula va en la primera letra, no en la cifra.
    return limpio.replace(/\p{L}/u, l => l.toUpperCase());
}
