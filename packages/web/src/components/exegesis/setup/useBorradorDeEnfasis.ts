import { useEffect, useState } from 'react';
import type { SourceType, StepEmphasis } from '@dosfilos/domain';

/**
 * El borrador de énfasis de una tarjeta del plan estructural.
 *
 * Arranca de lo guardado; si no hay nada guardado, de la sugerencia de la
 * rúbrica. Se resincroniza cuando lo guardado o la sugerencia CAMBIAN DE
 * CONTENIDO, nunca porque cambien de identidad.
 *
 * El defecto que esto corrige: la tarjeta resincronizaba con cada objeto nuevo.
 * La sugerencia se recalcula a partir de `paper`, y `paper` es un objeto nuevo
 * en cada relectura (tiene fechas, así que la caché no conserva la
 * referencia). Relecturas hay al volver a la ventana y al guardar CUALQUIER
 * otra tarjeta. Resultado: el pastor quitaba tipos, cambiaba de ventana o
 * guardaba otra sección, y su borrador volvía a la sugerencia sin aviso. Al
 * guardar, se guardaba la sugerencia. Pasó en producción el 2026-09-16 con las
 * tres tarjetas de un trabajo.
 */
export function useBorradorDeEnfasis(persisted: StepEmphasis, suggestion: StepEmphasis) {
    const inicialEnfatizados = elegir(persisted.emphasizedTypes, suggestion.emphasizedTypes);
    const inicialAtenuados = elegir(persisted.deemphasizedTypes, suggestion.deemphasizedTypes);

    const [emphasized, setEmphasized] = useState<SourceType[]>([...inicialEnfatizados]);
    const [deemphasized, setDeemphasized] = useState<SourceType[]>([...inicialAtenuados]);

    const claveEnfatizados = inicialEnfatizados.join(',');
    const claveAtenuados = inicialAtenuados.join(',');

    useEffect(() => {
        setEmphasized(claveEnfatizados ? (claveEnfatizados.split(',') as SourceType[]) : []);
    }, [claveEnfatizados]);

    useEffect(() => {
        setDeemphasized(claveAtenuados ? (claveAtenuados.split(',') as SourceType[]) : []);
    }, [claveAtenuados]);

    return { emphasized, setEmphasized, deemphasized, setDeemphasized, inicialAtenuados };
}

function elegir(guardado: ReadonlyArray<SourceType>, sugerido: ReadonlyArray<SourceType>): ReadonlyArray<SourceType> {
    return guardado.length > 0 ? guardado : sugerido;
}
