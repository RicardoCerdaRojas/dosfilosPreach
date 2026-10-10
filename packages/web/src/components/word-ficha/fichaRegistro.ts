import type React from 'react';

/**
 * EL REGISTRO DE BLOQUES DE LA FICHA DE PALABRA (hebreo y griego).
 *
 * La ficha no se escribe a mano: se dibuja recorriendo una lista de bloques,
 * uno por dato. Cada bloque dice en qué sección va, si entra en el resumen
 * (tooltip y tarjeta), de dónde sale el dato y dónde estaba antes del
 * rediseño. Con eso:
 *   - una función nueva es un bloque más, sin tocar el panel;
 *   - la prueba de paridad recorre la misma lista: ningún dato sin lugar;
 *   - la tabla de destino (`docs/FICHA_DE_PALABRA.md`) sale de aquí y no se
 *     desactualiza.
 * Mismo patrón que `ruleSources.ts` para las citas.
 */

/** El orden de lectura de la ficha: qué es, cómo está hecha, qué hace, dónde está, para qué sirve. */
export const SECCIONES = ['encabezado', 'palabra', 'forma', 'funcion', 'contexto', 'estudio', 'acciones'] as const;
export type FichaSeccion = (typeof SECCIONES)[number];

/**
 * De dónde sale el dato. Decide el color del bloque de función y, en R5, qué
 * tiene que validar el profesor.
 *   - `datos`: OSHB, MorphGNT, MACULA o un conteo propio (no se discute);
 *   - `regla`: una regla medida de la gramática (cita su sección);
 *   - `asistente`: lo escribe el asistente;
 *   - `mixto`: la regla acota y el asistente elige o explica;
 *   - `accion`: un botón, no un dato.
 */
export type FichaOrigen = 'datos' | 'regla' | 'asistente' | 'mixto' | 'accion';

/** Dónde estaba el dato antes del rediseño (para la tabla y la prueba de paridad). */
export type FichaAntes = 'tarjeta' | 'tooltip' | 'panel';

export interface FichaBloque<D> {
    /** Estable: lo usan la tabla y las pruebas. */
    readonly id: string;
    /** El dato, en castellano, para la tabla de destino. */
    readonly dato: string;
    readonly seccion: FichaSeccion;
    /** En el encabezado: la palabra (título), las insignias o la traducción. */
    readonly lugar?: 'titulo' | 'insignia' | 'traduccion';
    readonly origen: FichaOrigen;
    readonly antes: readonly FichaAntes[];
    /** ¿Tiene algo que mostrar para esta palabra? */
    readonly hay: (d: D) => boolean;
    /** Lo que se ve en la ficha completa. */
    readonly Completo: React.FC<{ d: D }>;
    /** Lo que se ve en el resumen (tooltip y tarjeta resumen). Sin él, el bloque no entra al resumen. */
    readonly Corto?: React.FC<{ d: D }>;
}

export type FichaRegistro<D> = readonly FichaBloque<D>[];

/** Una fila de la tabla de destino. */
export interface FilaDestino {
    readonly id: string;
    readonly dato: string;
    readonly idioma: 'he' | 'gr';
    readonly antes: readonly FichaAntes[];
    readonly seccion: FichaSeccion;
    readonly corto: boolean;
    readonly origen: FichaOrigen;
}

export function filasDestino<D>(idioma: 'he' | 'gr', registro: FichaRegistro<D>): FilaDestino[] {
    return registro.map(b => ({ id: b.id, dato: b.dato, idioma, antes: b.antes, seccion: b.seccion, corto: !!b.Corto, origen: b.origen }));
}
