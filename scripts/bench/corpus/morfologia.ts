/**
 * Banco del corpus — morfología del pasaje, para los lemas y las categorías gramaticales.
 *
 * Lee los archivos que descarga `scripts/language-structure/build.mjs` (con SHA fijado) en
 * `.cache/language-structure/`. Griego: MorphGNT. Hebreo: todavía no; el caso corre sin lemas y
 * el informe lo dice.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CasoBanco } from './tipos';

export interface VersoMorfologia {
  chapter: number;
  verse: number;
  morphology: { tokens: Array<{ pos: string; text: string; lemma: string; tag: { mood?: string } }> };
}

/** Número de libro de MorphGNT (61 = Mateo … 87 = Apocalipsis). */
const MORPHGNT: Record<string, string> = { JAS: '80-Jas' };
const MORPHGNT_SHA = 'aaed91e57c8e';

export function morfologiaDelPasaje(caso: CasoBanco, raiz: string): { versos: VersoMorfologia[]; aviso?: string } {
  if (caso.idioma !== 'griego') return { versos: [], aviso: 'sin lemas: el banco aún no lee la morfología hebrea' };
  const libro = MORPHGNT[caso.pasaje.bookId];
  if (!libro) return { versos: [], aviso: `sin lemas: falta ${caso.pasaje.bookId} en la tabla de MorphGNT del banco` };
  const ruta = join(raiz, '.cache/language-structure', MORPHGNT_SHA, `${libro}-morphgnt.txt`);
  if (!existsSync(ruta)) return { versos: [], aviso: `sin lemas: falta ${ruta} (correr scripts/language-structure/build.mjs)` };

  const porVerso = new Map<number, VersoMorfologia['morphology']['tokens']>();
  const { chapterStart: cap, verseStart: desde, verseEnd: hasta } = caso.pasaje;
  for (const linea of readFileSync(ruta, 'utf8').split('\n')) {
    const [ref, pos, tag, text, , , lemma] = linea.split(' ');
    if (!ref || !lemma || !pos || !tag || !text) continue;
    const c = Number(ref.slice(2, 4)); const v = Number(ref.slice(4, 6));
    if (c !== cap || v < desde || v > hasta) continue;
    const l = porVerso.get(v) ?? [];
    l.push({ pos: pos.replace(/-$/, ''), text, lemma, tag: { mood: tag[3] === '-' ? undefined : tag[3] } });
    porVerso.set(v, l);
  }
  return { versos: [...porVerso].map(([verse, tokens]) => ({ chapter: cap, verse, morphology: { tokens } })) };
}
