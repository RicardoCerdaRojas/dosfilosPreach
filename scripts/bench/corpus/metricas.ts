/**
 * Banco del corpus — métricas. Funciones puras: no leen Firestore ni archivos.
 *
 * Acierto = hoja exacta. Una hoja útil que no se citó cuenta como propuesta sin acierto, así que la
 * precisión que sale de aquí es una cota inferior (diseño §4).
 */
import type { SourceType } from '../../../packages/domain/src/exegesis/entities/SourceType';
import type {
  CasoBanco, GrupoFuente, MetricaGrupo, PropuestaFuente, ResultadoCaso,
} from './tipos';

const GRUPO: Partial<Record<SourceType, GrupoFuente>> = {
  'grammar-syntax': 'gramatica',
  'lexicon-technical': 'lexico',
  'theological-dictionary': 'lexico',
};

/** Comentarios, ediciones del texto, aparato y Metzger van juntos: se ubican por el pasaje. */
export function grupoDe(sourceType: string): GrupoFuente {
  return GRUPO[sourceType as SourceType] ?? 'comentario-y-texto';
}

/** Unión de las hojas de las rutas pedidas. */
export function hojasPropuestas(p: PropuestaFuente, rutas: readonly string[]): Set<number> {
  const out = new Set<number>();
  for (const r of rutas) for (const h of p.rutas[r] ?? []) out.add(h);
  return out;
}

const grupoVacio = (): MetricaGrupo => ({ citadas: 0, acertadas: 0, propuestas: 0 });

/**
 * Cruza la verdad de un caso con lo que el sistema propone.
 * Cuenta cada (libro, hoja, pregunta) una sola vez: una misma hoja citada en dos preguntas son dos
 * citas, porque la tarjeta por pregunta tiene que encontrarla en cada una.
 */
export function medirCaso(
  caso: CasoBanco,
  propuestas: readonly PropuestaFuente[],
  rutas: readonly string[],
): ResultadoCaso {
  const porLibro = new Map(propuestas.map(p => [p.libro, p]));
  const porGrupo: Record<GrupoFuente, MetricaGrupo> = {
    'comentario-y-texto': grupoVacio(), gramatica: grupoVacio(), lexico: grupoVacio(),
  };
  let citadas = 0; let acertadas = 0;
  const mismaPregunta = { acertadas: 0, citadas: 0 };
  const perdidas: ResultadoCaso['perdidas'] = [];
  const vistas = new Set<string>();

  for (const c of caso.citas) {
    const clave = `${c.libro}|${c.hoja}|${c.pregunta ?? ''}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    const p = porLibro.get(c.libro);
    if (!p) continue; // fuente sin propuesta: el caso la lista pero no se cargó
    const g = porGrupo[grupoDe(p.sourceType)];
    const hojas = hojasPropuestas(p, rutas);
    const acierto = hojas.has(c.hoja);
    citadas++; g.citadas++;
    if (acierto) { acertadas++; g.acertadas++; } else perdidas.push({ libro: c.libro, etiqueta: c.etiqueta, hoja: c.hoja, pregunta: c.pregunta });
    if (c.pregunta !== undefined) {
      mismaPregunta.citadas++;
      if (p.porPregunta.get(c.pregunta)?.has(c.hoja)) mismaPregunta.acertadas++;
    }
  }

  let propuestasTotal = 0;
  for (const p of propuestas) {
    const n = hojasPropuestas(p, rutas).size;
    propuestasTotal += n;
    porGrupo[grupoDe(p.sourceType)].propuestas += n;
  }

  return {
    id: caso.id,
    conjunto: caso.conjunto,
    rutasMedidas: [...rutas],
    citadas,
    acertadas,
    propuestas: propuestasTotal,
    enLaMismaPregunta: mismaPregunta,
    porGrupo,
    fueraDeLaBiblioteca: new Set(caso.fueraDeLaBiblioteca.map(f => `${f.libro}|${f.etiqueta}`)).size,
    perdidas,
  };
}

export interface Resumen {
  citadas: number;
  acertadas: number;
  propuestas: number;
  recall: number;
  precisionMinima: number;
  porGrupo: Record<GrupoFuente, MetricaGrupo & { recall: number }>;
  enLaMismaPregunta: { acertadas: number; citadas: number };
}

const proporcion = (a: number, b: number) => (b === 0 ? 0 : a / b);

export function resumir(resultados: readonly ResultadoCaso[]): Resumen {
  const porGrupo = {
    'comentario-y-texto': grupoVacio(), gramatica: grupoVacio(), lexico: grupoVacio(),
  } as Record<GrupoFuente, MetricaGrupo>;
  let citadas = 0; let acertadas = 0; let propuestas = 0;
  const misma = { acertadas: 0, citadas: 0 };
  for (const r of resultados) {
    citadas += r.citadas; acertadas += r.acertadas; propuestas += r.propuestas;
    misma.acertadas += r.enLaMismaPregunta.acertadas; misma.citadas += r.enLaMismaPregunta.citadas;
    for (const k of Object.keys(porGrupo) as GrupoFuente[]) {
      porGrupo[k].citadas += r.porGrupo[k].citadas;
      porGrupo[k].acertadas += r.porGrupo[k].acertadas;
      porGrupo[k].propuestas += r.porGrupo[k].propuestas;
    }
  }
  const conRecall = Object.fromEntries(
    (Object.keys(porGrupo) as GrupoFuente[]).map(k => [k, { ...porGrupo[k], recall: proporcion(porGrupo[k].acertadas, porGrupo[k].citadas) }]),
  ) as Resumen['porGrupo'];
  return {
    citadas, acertadas, propuestas,
    recall: proporcion(acertadas, citadas),
    precisionMinima: proporcion(acertadas, propuestas),
    porGrupo: conRecall,
    enLaMismaPregunta: misma,
  };
}

export interface Regresion {
  medida: string;
  antes: number;
  ahora: number;
}

/**
 * Compara contra la línea base. Recall y aciertos en la misma pregunta no pueden bajar; la
 * precisión mínima puede bajar hasta `toleranciaPrecision` (proponer una hoja más no es grave si
 * con eso se acierta).
 */
export function regresiones(antes: Resumen, ahora: Resumen, toleranciaPrecision = 0.02): Regresion[] {
  const out: Regresion[] = [];
  const eps = 1e-9;
  if (ahora.recall + eps < antes.recall) out.push({ medida: 'recall', antes: antes.recall, ahora: ahora.recall });
  for (const k of Object.keys(antes.porGrupo) as GrupoFuente[]) {
    if (ahora.porGrupo[k].recall + eps < antes.porGrupo[k].recall) {
      out.push({ medida: `recall ${k}`, antes: antes.porGrupo[k].recall, ahora: ahora.porGrupo[k].recall });
    }
  }
  const mA = proporcion(antes.enLaMismaPregunta.acertadas, antes.enLaMismaPregunta.citadas);
  const mN = proporcion(ahora.enLaMismaPregunta.acertadas, ahora.enLaMismaPregunta.citadas);
  if (mN + eps < mA) out.push({ medida: 'misma pregunta', antes: mA, ahora: mN });
  if (ahora.precisionMinima + toleranciaPrecision + eps < antes.precisionMinima) {
    out.push({ medida: 'precisión mínima', antes: antes.precisionMinima, ahora: ahora.precisionMinima });
  }
  return out;
}
