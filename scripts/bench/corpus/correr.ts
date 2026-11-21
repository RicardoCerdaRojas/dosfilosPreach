/**
 * Banco del corpus. SOLO LEE de Firestore (library_resources, document_chunks). No llama modelos
 * ni embeddings, y no escribe nada fuera de la salida que se le pida.
 *
 * Uso:
 *   npx tsx scripts/bench/corpus/correr.ts [--conjunto desarrollo|prueba|todos] [--rutas inicial,pregunta]
 *                                         [--json salida.json] [--comparar scripts/bench/corpus/linea-base.json]
 *
 * Sale con código 1 si `--comparar` encuentra una regresión (ver `regresiones` en metricas.ts).
 * Credenciales: las de aplicación por defecto de gcloud (lectura de producción).
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { cargarLibro, type LibroCargado } from './cargarLibro';
import { leerCasos } from './casos';
import { medirCaso, regresiones, resumir, type Resumen } from './metricas';
import { morfologiaDelPasaje } from './morfologia';
import { propuestaActual, RUTAS_ACTUALES } from './propuestaActual';
import { agregarRegiones } from './regiones';
import type { ResultadoCaso } from './tipos';

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** La caché de morfología vive en el checkout principal; en un worktree se busca allí. */
function raizConCache(): string {
  try {
    const comun = execSync('git rev-parse --path-format=absolute --git-common-dir', { encoding: 'utf8' }).trim();
    return dirname(comun);
  } catch {
    return process.cwd();
  }
}

const pct = (x: number) => `${(x * 100).toFixed(1)} %`;

function imprimir(nombre: string, r: Resumen): void {
  console.log(`\n${nombre}: recall ${pct(r.recall)} (${r.acertadas}/${r.citadas}) · cobertura ${pct(r.cobertura)} · precisión mínima ${pct(r.precisionMinima)} (${r.propuestas} propuestas + ${r.navegacion} de navegación) · misma pregunta ${r.enLaMismaPregunta.acertadas}/${r.enLaMismaPregunta.citadas}`);
  for (const [g, m] of Object.entries(r.porGrupo)) {
    if (m.citadas) console.log(`  ${g.padEnd(20)} recall ${pct(m.recall).padStart(7)} · cobertura ${pct(m.cobertura).padStart(7)}  (${m.acertadas}/${m.cubiertas}/${m.citadas}; ${m.propuestas} propuestas)`);
  }
}

async function main(): Promise<void> {
  const conjunto = argumento('conjunto') ?? 'todos';
  const rutas = (argumento('rutas') ?? RUTAS_ACTUALES.join(',')).split(',').filter(Boolean);
  const navegacion = (argumento('navegacion') ?? '').split(',').filter(Boolean);
  const casos = leerCasos(conjunto);
  if (!casos.length) throw new Error(`No hay casos para el conjunto «${conjunto}»`);

  initializeApp({ projectId: 'dosfilosapp' });
  const db = getFirestore();
  const raiz = raizConCache();
  const resultados: ResultadoCaso[] = [];

  for (const caso of casos) {
    const libros = new Map<string, LibroCargado>();
    for (const f of caso.fuentes) libros.set(f.libro, await cargarLibro(db, f.resourceId));
    const { versos, aviso } = morfologiaDelPasaje(caso, raiz);
    const propuestas = propuestaActual(caso, libros, versos);
    agregarRegiones(caso, propuestas, libros, versos);
    const r = medirCaso(caso, propuestas, rutas, navegacion);
    resultados.push(r);
    console.log(`\n· ${caso.nombre} [${caso.conjunto}]${aviso ? ` — ${aviso}` : ''}`);
    console.log(`  ${r.acertadas}/${r.citadas} citadas propuestas · ${r.propuestas} hojas · misma pregunta ${r.enLaMismaPregunta.acertadas}/${r.enLaMismaPregunta.citadas} · fuera de la biblioteca ${r.fueraDeLaBiblioteca}`);
    const perdidasPorLibro = new Map<string, string[]>();
    for (const p of r.perdidas) perdidasPorLibro.set(p.libro, [...(perdidasPorLibro.get(p.libro) ?? []), `${p.etiqueta}${p.pregunta ? `(P${p.pregunta})` : ''}`]);
    for (const [libro, l] of perdidasPorLibro) console.log(`    sin proponer · ${libro}: ${l.join(' ')}`);
  }

  const porConjunto: Record<string, Resumen> = {};
  for (const c of ['desarrollo', 'prueba'] as const) {
    const rs = resultados.filter(r => r.conjunto === c);
    if (rs.length) { porConjunto[c] = resumir(rs); imprimir(c, porConjunto[c]!); }
  }
  const total = resumir(resultados);
  imprimir(`total (propuestas: ${rutas.join(', ')}${navegacion.length ? `; navegación: ${navegacion.join(', ')}` : ''})`, total);

  const salida = argumento('json');
  if (salida) {
    writeFileSync(salida, JSON.stringify({ rutas, navegacion, porConjunto, total, casos: resultados.map(({ perdidas, ...r }) => ({ ...r, perdidas: perdidas.length })) }, null, 2) + '\n');
  }

  const base = argumento('comparar');
  if (base) {
    const antes = JSON.parse(readFileSync(base, 'utf8')) as { porConjunto: Record<string, Resumen> };
    const fallas = Object.entries(antes.porConjunto).flatMap(([c, r]) => (porConjunto[c] ? regresiones(r, porConjunto[c]!).map(x => ({ conjunto: c, ...x })) : []));
    if (fallas.length) {
      console.error('\nREGRESIÓN frente a la línea base:');
      for (const f of fallas) console.error(`  ${f.conjunto} · ${f.medida}: ${pct(f.antes)} → ${pct(f.ahora)}`);
      process.exit(1);
    }
    console.log('\nSin regresiones frente a la línea base.');
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
