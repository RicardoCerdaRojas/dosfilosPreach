/**
 * Banco del corpus — ruta `region`: las regiones de cada gramática que tratan las categorías del encuadre y de la
 * morfología del pasaje (`grammarCategoryRegions`, primer paso de la meta de gramáticas en dos pasos). Es una ruta
 * de NAVEGACIÓN: se mide como cobertura, no como propuesta.
 */
import {
  grammarCategoryRegions, grammarKeysFromMorphology, grammarSearchKeys, mergeGrammarKeys,
} from '../../../packages/domain/src/index';
import type { LibroCargado } from './cargarLibro';
import type { VersoMorfologia } from './morfologia';
import type { CasoBanco, PropuestaFuente } from './tipos';

export function agregarRegiones(
  caso: CasoBanco,
  propuestas: PropuestaFuente[],
  libros: ReadonlyMap<string, LibroCargado>,
  versos: readonly VersoMorfologia[],
): void {
  const claves = mergeGrammarKeys(grammarSearchKeys(caso.consigna), grammarKeysFromMorphology(versos as never));
  for (const p of propuestas) {
    const hojas = new Set<number>();
    const L = libros.get(p.libro);
    if (L && p.sourceType === 'grammar-syntax') {
      const entradas = L.fragmentos.map(f => ({ sheet: f.sheet, sectionPath: f.sectionPath.length ? f.sectionPath : (f.section ? [f.section] : []) }));
      for (const r of grammarCategoryRegions(entradas, claves)) for (let h = r.startSheet; h <= r.endSheet; h++) hojas.add(h);
    }
    (p.rutas as Record<string, ReadonlySet<number>>).region = hojas;
  }
}
