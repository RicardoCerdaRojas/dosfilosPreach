/**
 * Banco del corpus — ruta `opciones` (segundo paso de la meta de gramáticas): las subsecciones de cada gramática que
 * tratan las categorías que el ANÁLISIS guardado nombra para cada pregunta (`grammarSheetsForCategoryLabels`).
 * SOLO LEE `exegeticalPapers/{trabajoId}`. Solo corre en los casos hechos en la plataforma (TP #7–#10).
 */
import type { Firestore } from 'firebase-admin/firestore';
import { grammarSheetsForCategoryLabels, parseBriefQuestions } from '../../../packages/domain/src/index';
import type { LibroCargado } from './cargarLibro';
import type { CasoBanco, PropuestaFuente } from './tipos';

type Analisis = {
  questionAnswers?: Array<{ questionNumber: number; options?: Array<{ reading?: string }> }>;
  translationCruxes?: Array<{ options?: Array<{ characterization?: string }> }>;
  syntacticAnalysis?: { mainVerb?: { syntacticFunction?: string }; keyConstructions?: Array<{ syntacticFunction?: string }> };
};

/** Etiquetas de categoría por pregunta: opciones de la pregunta + caracterizaciones y funciones de sus versículos. */
export async function etiquetasPorPregunta(db: Firestore, caso: CasoBanco): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  if (!caso.trabajoId || !caso.consigna) return out;
  const paper = (await db.doc(`exegeticalPapers/${caso.trabajoId}`).get()).data();
  if (!paper) return out;
  const preguntas = parseBriefQuestions(caso.consigna, caso.pasaje as never);
  const porVerso = new Map<number, string[]>();
  for (const s of (paper.steps ?? []) as Array<{ kind: string; acceptedId?: string; verseRef?: { verse?: number }; versions?: Array<{ id: string; canonicalAnalysis?: Analisis }> }>) {
    const a = s.versions?.find(v => v.id === s.acceptedId)?.canonicalAnalysis;
    if (s.kind !== 'verse' || !a) continue;
    const v = s.verseRef?.verse ?? -1;
    const l = porVerso.get(v) ?? [];
    for (const q of a.questionAnswers ?? []) {
      const arr = out.get(q.questionNumber) ?? [];
      for (const o of q.options ?? []) if (o.reading) arr.push(o.reading);
      out.set(q.questionNumber, arr);
    }
    for (const c of a.translationCruxes ?? []) for (const o of c.options ?? []) if (o.characterization) l.push(o.characterization);
    if (a.syntacticAnalysis?.mainVerb?.syntacticFunction) l.push(a.syntacticAnalysis.mainVerb.syntacticFunction);
    for (const k of a.syntacticAnalysis?.keyConstructions ?? []) if (k.syntacticFunction) l.push(k.syntacticFunction);
    porVerso.set(v, l);
  }
  for (const q of preguntas) {
    const arr = out.get(q.number) ?? [];
    for (const v of q.verses) arr.push(...(porVerso.get(v.verse) ?? []));
    out.set(q.number, arr);
  }
  return out;
}

export function agregarOpciones(
  propuestas: PropuestaFuente[],
  libros: ReadonlyMap<string, LibroCargado>,
  etiquetas: ReadonlyMap<number, string[]>,
): void {
  for (const p of propuestas) {
    const todas = new Set<number>();
    const L = libros.get(p.libro);
    if (L && p.sourceType === 'grammar-syntax' && etiquetas.size) {
      const entradas = L.fragmentos.map(f => ({ sheet: f.sheet, sectionPath: f.sectionPath.length ? f.sectionPath : (f.section ? [f.section] : []) }));
      for (const [q, labels] of etiquetas) {
        const hojas = new Set<number>();
        for (const m of grammarSheetsForCategoryLabels(entradas, labels)) for (let h = m.node.startSheet; h <= m.node.endSheet; h++) { hojas.add(h); todas.add(h); }
        const previa = new Set(p.porPregunta.get(q) ?? []);
        for (const h of hojas) previa.add(h);
        (p.porPregunta as Map<number, ReadonlySet<number>>).set(q, previa);
      }
    }
    (p.rutas as Record<string, ReadonlySet<number>>).opciones = todas;
  }
}
