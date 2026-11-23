/** Banco del corpus — lectura de los casos congelados en `casos/`. */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CasoBanco } from './tipos';

const CASOS = join(dirname(fileURLToPath(import.meta.url)), 'casos');

export function leerCasos(conjunto: string): CasoBanco[] {
  return readdirSync(CASOS)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => JSON.parse(readFileSync(join(CASOS, f), 'utf8')) as CasoBanco)
    .filter(c => conjunto === 'todos' || c.conjunto === conjunto);
}
