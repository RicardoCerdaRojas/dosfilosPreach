import type { PaperCover } from './ExegeticalPaper';

/**
 * Cómo se configura un trabajo de ESTE curso, guardado para el siguiente.
 *
 * El fundador tiene tres trabajos de investigación en el mismo ramo. El
 * primero costó configurar rúbrica, encuadre, guía de estilo, método y
 * portada; los otros dos empezarían de cero, y lo que se repite a mano se
 * repite distinto: una rúbrica ligeramente diferente cambia la extensión
 * exigida, y una portada retecleada cambia el nombre del seminario.
 *
 * Es un PUNTERO a plantillas, no una copia de ellas. La rúbrica y el
 * encuadre siguen viviendo en sus colecciones, con su propio ciclo: el
 * perfil dice cuáles usar. Lo único que guarda por valor es la portada,
 * porque no tiene plantilla propia y son cuatro líneas.
 *
 * Lo que el perfil NO lleva, a propósito: el pasaje y el corpus. El
 * pasaje es de cada trabajo, y el corpus se arma contra ese pasaje —
 * heredar las fuentes del salmo 23 en un trabajo sobre Jonás sería
 * arrastrar el error en vez de ahorrar trabajo.
 */
export interface WorkProfile {
    id: string;
    ownerId: string;

    /** Cómo lo reconoce el estudiante: «OT603 · Trabajo de investigación». */
    displayName: string;

    /** El curso, cuando ayuda a distinguir dos perfiles parecidos. */
    course?: string;

    /** Plantilla de rúbrica a aplicar. `null` = la del sistema. */
    rubricTemplateId: string | null;

    /** Plantilla de encuadre a aplicar. `null` = sin encuadre. */
    briefTemplateId: string | null;

    /** Guía de estilo del seminario. `null` = TMS/Turabian por defecto. */
    styleGuideId: string | null;

    /** Método con el que se arma el corpus. */
    exegeticalStrategy: 'free' | 'dialectical';

    /**
     * Portada: seminario, autor, lugar. Se guarda por valor porque no
     * tiene plantilla propia y no cambia entre trabajos del mismo curso.
     */
    cover?: PaperCover | null;

    /**
     * Se aplica solo al crear un trabajo nuevo, mientras el estudiante no
     * elija otro. Exactamente uno por usuario, como en las rúbricas.
     */
    isDefault: boolean;

    createdAt: Date;
    updatedAt: Date;
}

export type WorkProfileDraft = Omit<WorkProfile, 'id' | 'createdAt' | 'updatedAt'>;

/** Tope del nombre, para que quepa en el desplegable sin recortarse. */
export const WORK_PROFILE_NAME_MAX_CHARS = 80;
