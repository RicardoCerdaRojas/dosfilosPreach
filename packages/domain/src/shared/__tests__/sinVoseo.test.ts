import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Los prompts del dominio en español neutro, sin voseo (regla del proyecto;
 * fase H del ejercicio de Jonás). El agente socrático le hablaba al modelo en
 * voseo («reconocé», «citá», «podés») y el modelo le contestaba igual al
 * pastor. Se revisan las líneas de código, no los comentarios.
 */
const VOSEO =
    /(?<![\wáéíóúñ])(sos|vos|podés|tenés|querés|sabés|pedís|escribís|detectás|aceptás|devolvés|reconocé|citá|nombrá|ayudá|aceptá|confrontá|preguntá|señalá|invitá|respetá|sugerí|privilegiá|usá|hacé|decí|mirá|andá|fijate|preguntale|explicale|recordale|nombralo|devolvelo|decilo|hacelo|acá)(?![\wáéíóúñ])/i;

function* sources(dir: string): Generator<string> {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
            if (name === '__tests__' || name === 'node_modules') continue;
            yield* sources(p);
        } else if (p.endsWith('.ts')) yield p;
    }
}

const esComentario = (l: string) => /^\s*(\*|\/\/|\/\*)/.test(l);

describe('prompts del dominio sin voseo', () => {
    it.each(['guided-sermon', 'drafting', 'voice', 'sermon-judge'])('%s', carpeta => {
        const hallazgos: string[] = [];
        for (const f of sources(join(__dirname, '..', '..', carpeta))) {
            readFileSync(f, 'utf8')
                .split('\n')
                .forEach((l, i) => {
                    if (!esComentario(l) && VOSEO.test(l)) hallazgos.push(`${f}:${i + 1}: ${l.trim().slice(0, 80)}`);
                });
        }
        expect(hallazgos).toEqual([]);
    });
});
