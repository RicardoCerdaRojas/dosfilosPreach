/**
 * Banco del corpus — tipos compartidos.
 *
 * Un caso es un trabajo terminado del que se sabe qué hojas de cada libro se citaron de verdad.
 * El banco mide si el sistema habría propuesto esas hojas. Los casos guardan SOLO referencias
 * (ids, etiquetas de página, números de hoja y de pregunta): nunca texto de libros.
 */

import type { BibleBookId } from '../../../packages/domain/src/bible/canon/BibleCanon';

export interface PasajeCaso {
  bookId: BibleBookId;
  chapterStart: number;
  chapterEnd: number;
  verseStart: number;
  verseEnd: number;
}

export interface FuenteCaso {
  /** Nombre corto con que el trabajo cita la obra («Wallace», «Kittel»). */
  libro: string;
  resourceId: string;
  sourceType: string;
  titulo: string;
}

export interface CitaCaso {
  libro: string;
  /** Página impresa tal como se citó («627», «cciv», «h.207» si se citó por hoja). */
  etiqueta: string;
  /** Hoja del PDF donde está esa página: la verdad que se compara. */
  hoja: number;
  /** Pregunta del encuadre en cuya respuesta se citó (solo trabajos por pregunta). */
  pregunta?: number;
}

export interface CasoBanco {
  id: string;
  nombre: string;
  /** `desarrollo`: se mira al mejorar las rutas. `prueba`: solo se mide, nunca se ajusta contra él. */
  conjunto: 'desarrollo' | 'prueba';
  idioma: 'griego' | 'hebreo';
  pasaje: PasajeCaso;
  consigna: string | null;
  fuentes: FuenteCaso[];
  citas: CitaCaso[];
  citasSinHoja: Array<{ libro: string; etiqueta: string }>;
  fueraDeLaBiblioteca: Array<{ libro: string; etiqueta: string; pregunta?: number }>;
  origen: string;
}

/** Lo que el sistema propone para una fuente de un caso, separado por ruta. */
export interface PropuestaFuente {
  libro: string;
  sourceType: string;
  /** Ruta con que se armó la propuesta inicial (edición, pasaje, estructura…). */
  rutaInicial: string;
  /** Rutas y las hojas que propone cada una. */
  rutas: Record<string, ReadonlySet<number>>;
  /** Hojas propuestas para cada pregunta (la tarjeta por pregunta). */
  porPregunta: ReadonlyMap<number, ReadonlySet<number>>;
}

/** Grupo de fuentes para leer las métricas por tipo. */
export type GrupoFuente = 'comentario-y-texto' | 'gramatica' | 'lexico';

export interface MetricaGrupo {
  citadas: number;
  acertadas: number;
  propuestas: number;
}

export interface ResultadoCaso {
  id: string;
  conjunto: CasoBanco['conjunto'];
  /** Rutas que cuentan como «lo que el sistema propone» en este resultado. */
  rutasMedidas: string[];
  citadas: number;
  acertadas: number;
  propuestas: number;
  /** Aciertos dentro de la misma pregunta en que se citó la hoja. */
  enLaMismaPregunta: { acertadas: number; citadas: number };
  porGrupo: Record<GrupoFuente, MetricaGrupo>;
  fueraDeLaBiblioteca: number;
  /** Hojas citadas que nadie propuso, para leer las causas. */
  perdidas: Array<{ libro: string; etiqueta: string; hoja: number; pregunta?: number }>;
}
