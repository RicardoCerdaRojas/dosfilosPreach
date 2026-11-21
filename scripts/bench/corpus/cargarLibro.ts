/**
 * Banco del corpus — carga de un libro de la biblioteca. SOLO LEE de Firestore.
 *
 * Arma, desde `document_chunks`, lo mismo que la app recibe de las callables
 * `getDocumentPageIndex`, `getDocumentOutline` y las secciones de la gramática. El texto queda en
 * memoria durante la corrida y nunca se escribe a disco.
 */
import type { Firestore } from 'firebase-admin/firestore';

export interface FragmentoLibro {
  chunkIndex: number;
  text: string;
  sheet: number;
  section: string | null;
  sectionPath: string[];
  refs: unknown;
}

export interface HojaIndice {
  sheet: number;
  chunkIndices: number[];
  section: string | null;
  firstLine: string;
  lastLine: string;
  charCount: number;
}

export interface TramoEsquema {
  startChunk: number;
  endChunk: number;
  page: number;
  section: string | null;
  sectionPath: string[];
}

export interface LibroCargado {
  resourceId: string;
  titulo: string;
  pageNumbering: unknown;
  fragmentos: FragmentoLibro[];
  indice: HojaIndice[];
  secciones: Array<{ section: string; sheet: number }>;
  esquema: TramoEsquema[];
}

const cache = new Map<string, Promise<LibroCargado>>();

export function cargarLibro(db: Firestore, resourceId: string): Promise<LibroCargado> {
  let p = cache.get(resourceId);
  if (!p) { p = leer(db, resourceId); cache.set(resourceId, p); }
  return p;
}

async function leer(db: Firestore, resourceId: string): Promise<LibroCargado> {
  const recurso = (await db.doc(`library_resources/${resourceId}`).get()).data();
  if (!recurso) throw new Error(`library_resources/${resourceId} no existe`);
  const docs = (await db.collection('document_chunks').where('resourceId', '==', resourceId)
    .select('text', 'metadata', 'refs', 'chunkIndex').get()).docs.map(d => d.data());

  const fragmentos: FragmentoLibro[] = docs
    .filter(c => typeof c.metadata?.page === 'number' && c.metadata.page >= 1)
    .map(c => ({
      chunkIndex: typeof c.chunkIndex === 'number' ? c.chunkIndex : 0,
      text: String(c.text ?? ''),
      sheet: c.metadata.page as number,
      section: typeof c.metadata?.section === 'string' ? c.metadata.section : null,
      sectionPath: Array.isArray(c.metadata?.sectionPath) ? (c.metadata.sectionPath as string[]) : [],
      refs: c.refs,
    }))
    .sort((a, b) => a.chunkIndex - b.chunkIndex);

  const porHoja = new Map<number, HojaIndice>();
  for (const c of fragmentos) {
    const plano = c.text.replace(/\s+/g, ' ').trim();
    let e = porHoja.get(c.sheet);
    if (!e) {
      e = { sheet: c.sheet, chunkIndices: [], section: c.section, firstLine: plano.slice(0, 180), lastLine: plano.slice(-60), charCount: 0 };
      porHoja.set(c.sheet, e);
    }
    e.chunkIndices.push(c.chunkIndex);
    e.charCount += c.text.length;
    if (!e.section && c.section) e.section = c.section;
    if (!e.firstLine) e.firstLine = plano.slice(0, 180);
    if (plano) e.lastLine = plano.slice(-60);
  }

  const secciones: LibroCargado['secciones'] = [];
  const vistas = new Set<string>();
  for (const c of fragmentos) {
    if (!c.section || vistas.has(c.section)) continue;
    vistas.add(c.section);
    secciones.push({ section: c.section, sheet: c.sheet });
  }

  const esquema: TramoEsquema[] = [];
  for (const c of fragmentos) {
    const ult = esquema[esquema.length - 1];
    const mismo = ult && ult.section === c.section && ult.sectionPath.length === c.sectionPath.length
      && ult.sectionPath.every((s, i) => s === c.sectionPath[i]);
    if (mismo && c.chunkIndex === ult.endChunk + 1) ult.endChunk = c.chunkIndex;
    else esquema.push({ startChunk: c.chunkIndex, endChunk: c.chunkIndex, page: c.sheet, section: c.section, sectionPath: c.sectionPath });
  }

  return {
    resourceId,
    titulo: String(recurso.title ?? ''),
    pageNumbering: recurso.pageNumbering,
    fragmentos,
    indice: [...porHoja.values()].sort((a, b) => a.sheet - b.sheet),
    secciones,
    esquema,
  };
}
