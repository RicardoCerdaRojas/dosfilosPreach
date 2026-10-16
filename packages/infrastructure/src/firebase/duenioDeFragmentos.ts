import { SYSTEM_SOURCE_OWNER_ID } from '@dosfilos/domain';
import { auth } from '../config/firebase';

/**
 * Quién puede ver qué fragmentos de `document_chunks` desde el cliente.
 *
 * Las reglas sólo dejan LEER lo propio y la biblioteca común (`__system__`,
 * textos de dominio público), y sólo dejan BORRAR lo propio. Firestore
 * rechaza ENTERA una consulta que no garantice la regla por sí misma, así
 * que toda consulta del cliente filtra por dueño: las de lectura con
 * `userId in [uid, '__system__']`, las de borrado con `userId == uid`.
 *
 * Con «Entrar como usuario» la sesión es la del usuario y esto sigue
 * valiendo. Los libros «core» de un administrador NO se leen desde acá: van
 * por callables (Admin SDK); en producción no hay ninguno (2026-10-16).
 */
export function uidDeLaSesion(): string {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('No hay sesión: no se pueden leer los fragmentos de la biblioteca');
    return uid;
}

/** Los dueños cuyos fragmentos puede LEER la sesión. */
export function duenosLegibles(): string[] {
    return [uidDeLaSesion(), SYSTEM_SOURCE_OWNER_ID];
}
