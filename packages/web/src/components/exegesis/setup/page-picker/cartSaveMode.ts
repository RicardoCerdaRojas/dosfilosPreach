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
    /**
     * Había páginas guardadas y se quitaron TODAS: se guarda la fuente sin
     * páginas, vacía en el corpus. TP #9 (B20): al quitar todo Tuggy el botón
     * quedaba apagado y no había forma de guardarlo.
     */
    | 'clear'
    /** Primera selección de esta fuente. */
    | 'add';

export function cartSaveMode(input: {
    isSaving: boolean;
    selectionChanged: boolean;
    needsResave: boolean;
    hadSaved: boolean;
    /** El carrito quedó sin ningún tramo. */
    isEmpty?: boolean;
}): CartSaveMode {
    if (input.isSaving) return 'saving';
    if (input.selectionChanged) {
        if (!input.hadSaved) return 'add';
        return input.isEmpty ? 'clear' : 'update';
    }
    if (input.needsResave) return 'resave';
    return 'saved';
}

/**
 * Si el botón se puede pulsar. Sin hojas sólo se guarda para vaciar una
 * fuente que tenía páginas (`clear`); una primera selección vacía no tiene
 * nada que guardar.
 */
export function cartCanSave(mode: CartSaveMode, sheetCount: number): boolean {
    if (mode === 'saving' || mode === 'saved') return false;
    return mode === 'clear' || sheetCount > 0;
}
