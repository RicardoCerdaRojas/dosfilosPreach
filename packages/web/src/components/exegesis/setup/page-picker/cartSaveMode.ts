/**
 * Qué hace el botón del carrito, y por lo tanto qué dice.
 *
 * Decía «Agregar 13 hojas al trabajo» también cuando las hojas YA estaban en
 * el trabajo y sólo había que volver a guardar para limpiar fragmentos viejos:
 * el fundador no lo reconoció como «guardar» (Jonás 4:5-11, 2026-10-02).
 */
export type CartSaveMode =
    /** Guardando. */
    | 'saving'
    /** Nada que guardar: la selección es la guardada y la fuente está pareja. */
    | 'saved'
    /** Misma selección, pero la fuente guardó fragmentos que su receta no declara. */
    | 'resave'
    /** Ya había una selección guardada y cambió. */
    | 'update'
    /** Primera selección de esta fuente. */
    | 'add';

export function cartSaveMode(input: {
    isSaving: boolean;
    selectionChanged: boolean;
    needsResave: boolean;
    hadSaved: boolean;
}): CartSaveMode {
    if (input.isSaving) return 'saving';
    if (input.selectionChanged) return input.hadSaved ? 'update' : 'add';
    if (input.needsResave) return 'resave';
    return 'saved';
}
