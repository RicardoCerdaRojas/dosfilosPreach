/**
 * Banco del corpus — carga de un libro de la biblioteca. SOLO LEE de Firestore.
 *
 * Arma, desde `document_chunks`, lo mismo que la app recibe de las callables
 * `getDocumentPageIndex`, `getDocumentOutline` y las secciones de la gramática. El texto queda en
 * memoria durante la corrida y nunca se escribe a disco.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { existsSync, readFileSync } from 'node:fs';
import { chunkStructuredMarkdown } from '../../../packages/functions/src/library/markdownChunker';

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

/**
 * Con `SECCIONES_DESDE=<carpeta>` (fuera del repo), la ruta de sección de cada fragmento se
 * recalcula con el separador del código, desde `<carpeta>/<resourceId>.md`: mide un cambio del
 * separador ANTES de reescribir producción (A8d). Empareja por hoja y comienzo del texto, como
 * `scripts/.secciones-a8d.ts`; sin pareja única, el fragmento queda como está.
 */
function seccionesDelSeparadorActual(resourceId: string, fragmentos: FragmentoLibro[]): void {
  const dir = process.env.SECCIONES_DESDE;
  const archivo = dir ? `${dir}/${resourceId}.md` : '';
  if (!dir || !existsSync(archivo)) return;
  const plano = (t: string) => t.replace(/\s+/g, ' ').trim();
  const porHoja = new Map<number, Array<{ text: string; sectionPath: string[] }>>();
  for (const c of chunkStructuredMarkdown(readFileSync(archivo, 'utf8'))) porHoja.set(c.page, [...(porHoja.get(c.page) ?? []), { text: plano(c.text), sectionPath: c.sectionPath }]);
  for (const f of fragmentos) {
    const cabeza = plano(f.text).slice(0, 80);
    const rutas = [...new Set((porHoja.get(f.sheet) ?? []).filter(c => c.text.includes(cabeza)).map(c => JSON.stringify(c.sectionPath)))];
    if (rutas.length !== 1) continue;
    f.sectionPath = JSON.parse(rutas[0]!) as string[];
    f.section = f.sectionPath[f.sectionPath.length - 1] ?? null;
  }
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
  seccionesDelSeparadorActual(resourceId, fragmentos);

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
