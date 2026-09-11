import { describe, it, expect } from 'vitest';

/**
 * Un recurso que termina bien no puede seguir arrastrando el motivo del intento
 * anterior.
 *
 * Caso real, Barrick el 11-09-2026. El guardia de plazo dispara veinte segundos
 * antes del tope y escribe `failed` más su motivo, contando con que una
 * extracción que termine bien después lo pise —el comentario del guardia lo dice
 * con todas las letras—. Pisaba sólo el ESTADO. El recurso quedó así:
 *
 *     textExtractionStatus : ready
 *     pageCount            : 170
 *     extractionError      : «La extracción superó el tiempo máximo (15 min)»
 *
 * Listo, completo, con hebreo, y con cara de roto. Es la misma clase de defecto
 * que este módulo lleva tiempo corrigiendo: el sistema afirma algo y nadie
 * comprueba que siga siendo verdad.
 *
 * La prueba mira la FORMA del objeto que se escribe, no el resultado de
 * escribirlo, porque el defecto vivía justamente en un campo ausente — y un
 * campo ausente no falla, sólo deja el valor viejo en su lugar.
 */

/** Los campos que el camino de éxito debe escribir para dejar el recurso limpio. */
const CAMPOS_QUE_LIMPIA_EL_EXITO = ['extractionError', 'extractionFailureReason'] as const;

/** Lo que el guardia de plazo deja escrito cuando se le acaba el tiempo. */
const LO_QUE_ESCRIBE_EL_GUARDIA = {
    textExtractionStatus: 'failed',
    extractionError: 'La extracción superó el tiempo máximo de 540 s. Reintenta con Premium, que dispone de más tiempo.',
    extractionFailureReason: 'timeout',
};

/**
 * El estado final de un recurso tras aplicar, en orden, lo que escribió el
 * guardia y lo que escribe el éxito posterior.
 */
function estadoTrasReintentoExitoso(escrituraDelExito: Record<string, unknown>) {
    return { ...LO_QUE_ESCRIBE_EL_GUARDIA, ...escrituraDelExito };
}

describe('un éxito posterior limpia el motivo del fallo', () => {
    it('el defecto: escribir sólo el estado deja el motivo huérfano', () => {
        const final = estadoTrasReintentoExitoso({ textExtractionStatus: 'ready', pageCount: 170 });
        expect(final.textExtractionStatus).toBe('ready');
        // Esto es exactamente lo que se vio en producción.
        expect(final.extractionError).toContain('superó el tiempo máximo');
    });

    it('el arreglo: el éxito pone los dos campos en null', () => {
        const escritura: Record<string, unknown> = { textExtractionStatus: 'ready', pageCount: 170 };
        for (const campo of CAMPOS_QUE_LIMPIA_EL_EXITO) escritura[campo] = null;

        const final = estadoTrasReintentoExitoso(escritura);
        expect(final.textExtractionStatus).toBe('ready');
        expect(final.extractionError).toBeNull();
        expect(final.extractionFailureReason).toBeNull();
    });

    it('limpiar exige null, no omitir el campo', () => {
        // Omitirlo es lo que causó el defecto: `merge` conserva lo que no se
        // menciona, así que «no escribir nada» y «borrar» no son lo mismo.
        const omitido = estadoTrasReintentoExitoso({ textExtractionStatus: 'ready' });
        const explicito = estadoTrasReintentoExitoso({ textExtractionStatus: 'ready', extractionError: null });
        expect(omitido.extractionError).not.toBeNull();
        expect(explicito.extractionError).toBeNull();
    });
});
