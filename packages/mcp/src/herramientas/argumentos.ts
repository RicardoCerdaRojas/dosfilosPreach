import { ErrorDeHerramienta } from './tipos';

/** Un texto obligatorio, recortado y con tope. */
export function texto(args: Record<string, unknown>, campo: string, opciones: { max: number; min?: number }): string {
    const v = args[campo];
    if (typeof v !== 'string' || v.trim().length < (opciones.min ?? 1)) throw new ErrorDeHerramienta(`Falta «${campo}».`);
    const t = v.trim();
    if (t.length > opciones.max) throw new ErrorDeHerramienta(`«${campo}» es muy largo (máximo ${opciones.max} caracteres).`);
    return t;
}

/** Un texto opcional. */
export function textoOpcional(args: Record<string, unknown>, campo: string, max: number): string | null {
    const v = args[campo];
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) return null;
    return texto(args, campo, { max });
}

/** Un entero opcional dentro de un rango. */
export function enteroOpcional(args: Record<string, unknown>, campo: string, min: number, max: number): number | null {
    const v = args[campo];
    if (v === undefined || v === null) return null;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new ErrorDeHerramienta(`«${campo}» debe ser un entero entre ${min} y ${max}.`);
    return v;
}

/** Una lista opcional de ids, sin repetir y con tope. */
export function listaDeIds(args: Record<string, unknown>, campo: string, max: number): string[] | null {
    const v = args[campo];
    if (v === undefined || v === null) return null;
    if (!Array.isArray(v)) throw new ErrorDeHerramienta(`«${campo}» debe ser una lista.`);
    const ids = [...new Set(v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map(x => x.trim()))];
    if (ids.length === 0) return null;
    if (ids.length > max) throw new ErrorDeHerramienta(`«${campo}»: a lo sumo ${max}.`);
    return ids;
}
