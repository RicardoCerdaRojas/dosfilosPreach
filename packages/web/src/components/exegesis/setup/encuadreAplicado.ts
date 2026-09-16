import { ASSIGNMENT_BRIEF_MAX_CHARS, type UserAssignmentBrief } from '@dosfilos/domain';

/**
 * Qué hay de verdad en el cuadro del encuadre, respecto de las plantillas.
 *
 * Existe porque el selector afirmaba algo que podía ser falso. Su rótulo decía
 * «Plantilla: {nombre}» con el nombre de la plantilla PREDETERMINADA, sin
 * importar cuál se hubiera aplicado. Se elegía otra, el texto cambiaba abajo y
 * el rótulo seguía igual: parecía que el clic no hacía nada. Peor, si el texto
 * del cuadro era de otra plantilla o estaba editado, la pantalla seguía
 * anunciando la predeterminada — y lo que se guarda en el trabajo es el TEXTO,
 * no el rótulo.
 *
 * Se deduce del texto en vez de recordar el último clic, y por eso no puede
 * desincronizarse: también reconoce la predeterminada cargada sola al abrir la
 * página, y deja de nombrar una plantilla en cuanto el texto se edita.
 */
export type EstadoDelEncuadre =
    | { tipo: 'vacio' }
    | { tipo: 'plantilla'; plantilla: UserAssignmentBrief }
    /** Hay texto, pero no es el de ninguna plantilla: escrito a mano o editado. */
    | { tipo: 'propio' };

export function estadoDelEncuadre(
    plantillas: ReadonlyArray<UserAssignmentBrief>,
    texto: string,
): EstadoDelEncuadre {
    const actual = texto.trim();
    if (!actual) return { tipo: 'vacio' };

    // La predeterminada primero: si dos plantillas comparten el texto, se nombra
    // la que el usuario marcó como suya por defecto.
    const ordenadas = [...plantillas].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));

    // La página recorta el texto al aplicarlo; se compara con el mismo recorte,
    // o una plantilla larga no se reconocería nunca.
    const plantilla = ordenadas.find(
        p => p.body.slice(0, ASSIGNMENT_BRIEF_MAX_CHARS).trim() === actual,
    );
    return plantilla ? { tipo: 'plantilla', plantilla } : { tipo: 'propio' };
}
