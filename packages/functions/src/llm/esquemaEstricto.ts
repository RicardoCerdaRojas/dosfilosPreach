/**
 * El esquema de respuesta de una función, en la forma que exige el modo estricto
 * de OpenAI (Structured Outputs).
 *
 * Los esquemas de la exégesis ya están en JSON Schema estándar —`type: 'object'`,
 * `properties`, `required`, `enum`—: nada en ellos es propio de Gemini. Lo que
 * separaba a OpenAI eran tres exigencias de su modo estricto, que se resuelven
 * acá, en el servidor, sin tocar ninguno de los nueve archivos que los escriben:
 *
 *   1. Todo objeto declara `additionalProperties: false`.
 *   2. Todo campo es obligatorio. Uno que era opcional pasa a «obligatorio, pero
 *      puede ser `null`»: el modelo lo manda en `null` en vez de omitirlo. Quien
 *      lee la respuesta tiene que tolerar `null` donde antes esperaba «ausente»;
 *      eso se verifica función por función, no se supone.
 *   3. `nullable: true` (la forma OpenAPI) pasa a `type: [..., 'null']`.
 *
 * LISTA BLANCA DE PALABRAS CLAVE. Se conserva sólo lo que el modo estricto
 * entiende; `minimum`, `default`, `examples` y similares se descartan. Perder
 * una cota numérica es aceptable —la descripción sigue guiando al modelo—;
 * mandar una palabra que la API rechaza tumbaría la llamada entera.
 */

type Nodo = Record<string, unknown>;

const CONSERVADAS: ReadonlySet<string> = new Set(['type', 'description', 'enum', 'properties', 'required', 'items']);

export function esquemaEstricto(esquema: unknown): Nodo {
    return convertir(esquema, false);
}

function convertir(entrada: unknown, admiteNull: boolean): Nodo {
    if (!entrada || typeof entrada !== 'object') return {};
    const nodo = entrada as Nodo;
    const salida: Nodo = {};
    for (const [clave, valor] of Object.entries(nodo)) {
        if (CONSERVADAS.has(clave) && clave !== 'properties' && clave !== 'required' && clave !== 'items') {
            salida[clave] = valor;
        }
    }

    const tipo = typeof nodo.type === 'string' ? nodo.type.toLowerCase() : nodo.type;
    if (typeof tipo === 'string') salida.type = tipo;

    if (tipo === 'object') {
        const propiedades = (nodo.properties ?? {}) as Record<string, unknown>;
        const obligatorias = new Set(Array.isArray(nodo.required) ? (nodo.required as string[]) : []);
        const convertidas: Nodo = {};
        for (const [nombre, sub] of Object.entries(propiedades)) {
            convertidas[nombre] = convertir(sub, !obligatorias.has(nombre));
        }
        salida.properties = convertidas;
        salida.required = Object.keys(propiedades);
        salida.additionalProperties = false;
    }

    if (tipo === 'array' && nodo.items) {
        salida.items = convertir(nodo.items, false);
    }

    if (admiteNull || nodo.nullable === true) {
        if (typeof salida.type === 'string') salida.type = [salida.type, 'null'];
        if (Array.isArray(salida.enum) && !salida.enum.includes(null)) salida.enum = [...salida.enum, null];
    }
    return salida;
}

/**
 * Deshace, en la respuesta, lo que `esquemaEstricto` le hizo al contrato: un
 * campo que era OPCIONAL y vino en `null` se quita, para que quien lee reciba
 * «ausente» como con Gemini. Un campo declarado `nullable` conserva su `null`.
 *
 * Se revisaron los lectores de los 16 campos opcionales de los esquemas de
 * exégesis y todos toleran `null` hoy; esto existe para que ese dato no tenga
 * que seguir siendo cierto mañana, cuando alguien escriba `!== undefined`.
 */
export function quitarNulosOpcionales(valor: unknown, esquema: unknown): unknown {
    const nodo = (esquema ?? {}) as Nodo;
    const tipo = typeof nodo.type === 'string' ? nodo.type.toLowerCase() : '';
    if (tipo === 'array' && Array.isArray(valor)) {
        return valor.map((v) => quitarNulosOpcionales(v, nodo.items));
    }
    if (tipo !== 'object' || !valor || typeof valor !== 'object' || Array.isArray(valor)) return valor;
    const propiedades = (nodo.properties ?? {}) as Record<string, Nodo>;
    const obligatorias = new Set(Array.isArray(nodo.required) ? (nodo.required as string[]) : []);
    const salida: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
        const sub = propiedades[clave];
        if (v === null && sub && !obligatorias.has(clave) && sub.nullable !== true) continue;
        salida[clave] = sub ? quitarNulosOpcionales(v, sub) : v;
    }
    return salida;
}
