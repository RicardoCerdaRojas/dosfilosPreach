import { buscarBiblioteca } from './buscarBiblioteca';
import { consultarCatalogo } from './consultarCatalogo';
import { leerHoja } from './leerHoja';
import { leerRequisitos } from './leerRequisitos';
import { leerTrabajo } from './leerTrabajo';
import type { Alcance, Herramienta } from './tipos';

/** Las herramientas del corpus (A9: solo lectura). */
export const HERRAMIENTAS: ReadonlyArray<Herramienta> = [buscarBiblioteca, leerHoja, leerTrabajo, leerRequisitos, consultarCatalogo];

/** Las que un token con esos alcances puede usar. */
export function herramientasPara(alcances: ReadonlyArray<string>): Herramienta[] {
    return HERRAMIENTAS.filter(h => alcances.includes(h.alcance as Alcance));
}
