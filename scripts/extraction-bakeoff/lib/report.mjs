/**
 * Report rendering.
 *
 * Two artefacts on purpose, because they answer different questions:
 *
 *   informe.md   — the numbers. Ranks engines, states thresholds, and is
 *                  diffable, so a second run months later can be compared
 *                  against this one.
 *
 *   comparar.html — the same Greek and Hebrew passage from every engine,
 *                  side by side, at a font size where a missing breathing is
 *                  actually visible. No metric replaces this for a product
 *                  whose promise is citation fidelity: the numbers narrow
 *                  the field, a human confirms the winner.
 */

import { scriptDensityByPage } from './metrics.mjs';

const PAGE_SPLIT = /<!--\s*page:\s*(\d+)\s*-->/g;

// ── Markdown ───────────────────────────────────────────────────────────────

export function renderMarkdown(run) {
    const { doc, results, generatedAt } = run;
    const lines = [];

    lines.push(`# Banco de pruebas de extracción — ${doc.title}`);
    lines.push('');
    lines.push(`Generado: ${generatedAt}`);
    lines.push('');
    lines.push(`- **Documento**: ${doc.title}`);
    if (doc.resourceId) lines.push(`- **Recurso**: \`${doc.resourceId}\``);
    lines.push(`- **Páginas evaluadas**: ${doc.slicePages} (páginas ${doc.originalRange[0]}–${doc.originalRange[1]} de ${doc.originalTotal})`);
    lines.push(`- **Se espera griego**: ${doc.expectGreek ? 'sí' : 'no'} · **hebreo**: ${doc.expectHebrew ? 'sí' : 'no'}`);
    lines.push(`- **El PDF trae texto embebido**: ${doc.hasEmbeddedText ? 'sí' : 'NO (escaneado)'}`);
    lines.push('');

    if (!doc.hasEmbeddedText) {
        lines.push('> El PDF no trae texto embebido, así que `pdftotext` no da referencia y la');
        lines.push('> métrica de novedad no significa nada acá: en un escaneado el motor honesto');
        lines.push('> es el ÚNICO con texto y por eso puntúa 100% novedoso. Este es justo el caso');
        lines.push('> que el tier Premium promete resolver.');
        lines.push('');
    }

    const ran = results.filter(r => !r.skipped);
    const skipped = results.filter(r => r.skipped);

    if (doc.detected) {
        lines.push(`- **Escritura detectada**: griego ${doc.detected.greek} letras · hebreo ${doc.detected.hebrew} consonantes`);
        lines.push('');
    }

    if (doc.flagWarnings?.length) {
        lines.push('> ### ⚠️ Leer antes que el veredicto');
        lines.push('>');
        for (const w of doc.flagWarnings) lines.push(`> - ${w}`);
        lines.push('');
    }

    if (ran.length < 3) {
        lines.push(`> Sólo corrieron ${ran.length} motor(es). Esto todavía no es una comparación:`);
        lines.push('> falta el resto para poder decir cuál conviene. Revisa las claves de API.');
        lines.push('');
    }

    // ── Verdicts first: this is what the reader came for.
    lines.push('## Veredicto');
    lines.push('');
    lines.push('| Motor | Estado | Motivo |');
    lines.push('|---|---|---|');
    for (const r of ran) {
        const notes = r.verdict.notes.length ? r.verdict.notes.join('; ') : '—';
        lines.push(`| ${r.label} | **${r.verdict.status}** | ${notes} |`);
    }
    for (const r of skipped) {
        lines.push(`| ${r.label} | NO EJECUTADO | ${r.reason} |`);
    }
    lines.push('');
    lines.push('`INSPECCIONAR` no es aprobado: significa que pasó los filtros mecánicos y ahora');
    lines.push('un humano tiene que mirar `comparar.html`. Para un producto que promete citas');
    lines.push('verificables, esa mirada es obligatoria antes de adoptar cualquier motor.');
    lines.push('');

    // ── Script fidelity: the premium tier's reason to exist.
    lines.push('## Fidelidad de escritura');
    lines.push('');
    lines.push('| Motor | Letras griegas | Ratio diacrítico | Consonantes hebreas | Ratio niqqud | Cantilación | � | Marcas huérfanas | Palabras mezcladas |');
    lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const r of ran) {
        const s = r.metrics.script;
        lines.push(
            `| ${r.label} | ${s.greekLetters} | ${fmt(s.greekDiacriticRatio)} | ${s.hebrewConsonants} `
            + `| ${fmt(s.niqqudRatio)} | ${s.cantillation} | ${s.replacementChars} | ${s.orphanCombining} | ${s.mixedScriptWords ?? '—'} |`,
        );
    }
    lines.push('');
    lines.push('**Cómo leer el ratio diacrítico.** Es la métrica que decide el tier Premium.');
    lines.push('Griego politónico corrido (NA28/SBLGNT) cae entre 0,35 y 0,60. Un ratio cerca de');
    lines.push('cero CON muchas letras griegas es la firma de un motor que reconoció las letras y');
    lines.push('tiró los espíritus y acentos a la basura. Ese texto es inservible para exégesis y');
    lines.push('un word-error-rate no lo detecta, porque todas las letras siguen ahí.');
    lines.push('');
    lines.push('Lo mismo para el hebreo: puntuado (BHS) va de 0,6 a 1,0 en niqqud. Cero significa');
    lines.push('texto consonantal — legible para un hebraísta, inútil para un pastor.');
    lines.push('');

    // ── Page integrity: the citation anchor.
    lines.push('## Integridad de páginas');
    lines.push('');
    lines.push('| Motor | Páginas emitidas | Esperadas | Faltantes | Duplicadas | Ascendentes | Vacías |');
    lines.push('|---|---:|---:|---|---|---|---|');
    for (const r of ran) {
        const p = r.metrics.page;
        lines.push(
            `| ${r.label} | ${p.uniquePages} | ${p.expectedPages ?? '—'} `
            + `| ${p.missingPages.length ? p.missingPages.slice(0, 6).join(', ') : '—'} `
            + `| ${p.duplicated ? 'SÍ' : 'no'} | ${p.ascending ? 'sí' : 'NO'} `
            + `| ${p.emptyPages.length ? p.emptyPages.join(', ') : '—'} |`,
        );
    }
    lines.push('');
    lines.push('Una página que el motor nunca emitió es contenido que desaparece del índice en');
    lines.push('silencio. Un marcador duplicado o fuera de orden rompe el ancla de la cita para');
    lines.push('todo lo que viene después — y una cita que apunta a la página equivocada es peor');
    lines.push('que no tener cita, porque parece verificable.');
    lines.push('');

    // ── Structure.
    lines.push('## Estructura recuperada');
    lines.push('');
    lines.push('| Motor | Encabezados | Tablas | Filas de tabla | Saltos de nivel | Caracteres |');
    lines.push('|---|---:|---:|---:|---:|---:|');
    for (const r of ran) {
        const s = r.metrics.structure;
        lines.push(`| ${r.label} | ${s.headings} | ${s.tables} | ${s.tableRows} | ${s.headingLevelJumps} | ${r.metrics.chars} |`);
    }
    lines.push('');
    lines.push('Las tablas importan más de lo que parece acá: una entrada de léxico y un aparato');
    lines.push('crítico suelen SER tablas, y un motor que las aplana en prosa destruye la');
    lines.push('alineación entre lema y glosa sin perder un solo carácter.');
    lines.push('');

    // ── Novelty, gated.
    if (doc.noveltyUsable) {
        lines.push('## Texto que ningún otro motor produjo');
        lines.push('');
        lines.push('| Motor | Ratio de novedad |');
        lines.push('|---|---:|');
        for (const r of ran) lines.push(`| ${r.label} | ${fmt(r.metrics.novelty.novelRatio)} |`);
        lines.push('');
        lines.push('Este PDF trae texto embebido, así que todos los motores leyeron la misma fuente');
        lines.push('y deberían coincidir. Un motor con novedad alta acá está aportando material que');
        lines.push('los demás no vieron. Podría ser mejor reconstrucción de layout — o podría ser el');
        lines.push('modelo "corrigiendo" el texto. Revisa las muestras en `novedad.txt` antes de');
        lines.push('celebrar: un OCR por LLM que mejora la redacción del autor es inaceptable acá.');
        lines.push('');
    }

    if (!doc.noveltyUsable && doc.hasEmbeddedText && doc.enginesRan < 3) {
        lines.push('## Texto que ningún otro motor produjo');
        lines.push('');
        lines.push(`Omitida: con ${doc.enginesRan} motor(es) esta métrica degenera en una diferencia`);
        lines.push('por pares — ambos salen con el mismo número alto y no distingue quién inventó');
        lines.push('texto de quién se comió texto. Necesita tres o más para decir algo.');
        lines.push('');
    }

    // ── Page drift vs the reference.
    const withDrift = ran.filter(r => r.metrics.drift);
    if (withDrift.length) {
        lines.push('## Corrimiento de página contra la referencia');
        lines.push('');
        lines.push('| Motor | Páginas comparadas | Coincidencia | Desacuerdos |');
        lines.push('|---|---:|---:|---|');
        for (const r of withDrift) {
            const d = r.metrics.drift;
            if (d.inapplicable) {
                lines.push(`| ${r.label} | — | no aplica | ${d.inapplicable} |`);
                continue;
            }
            const worst = d.disagreements.slice(0, 5).map(x => x.page).join(', ') || '—';
            lines.push(`| ${r.label} | ${d.comparedPages} | ${fmt(d.agreementRatio)} | ${worst} |`);
        }
        lines.push('');
        lines.push('Compara en qué páginas cada motor encontró griego o hebreo. Si un motor pone el');
        lines.push('aparato griego en la página 40 y la referencia en la 41, uno de los dos corrió la');
        lines.push('numeración — y ese error produce citas plausibles que apuntan al lugar equivocado.');
        lines.push('');
    }

    // ── Cost and latency.
    lines.push('## Costo y latencia');
    lines.push('');
    if (!run.rates?.present) {
        lines.push(`> Sin \`rates.json\` (esperado en \`${run.rates?.path ?? 'scripts/extraction-bakeoff/'}\`).`);
        lines.push('> Se reportan las unidades facturables; el dinero queda NO CALCULABLE.');
        lines.push('> Copia `rates.example.json` y llénalo con las tarifas de TU factura.');
        lines.push('');
    }
    if (!doc.fresh) {
        lines.push('> Corrida SIN `--fresh`: si un recorte ya se había medido, LlamaParse puede');
        lines.push('> devolverlo desde caché y facturar 0. La columna "caché" lo indica cuando la');
        lines.push('> API lo reporta.');
        lines.push('');
    }
    lines.push('| Motor | Unidades facturables | Caché | USD medido | USD por libro | Segundos |');
    lines.push('|---|---|---|---|---|---:|');
    for (const r of ran) {
        const b = r.billing ?? {};
        const units = r.costUnits === null || r.costUnits === undefined
            ? '—'
            : `${r.costUnits} ${r.costUnit ?? ''}`.trim();
        const cache = b.cacheHit === true ? 'SÍ' : b.cacheHit === false ? 'no' : '?';
        const usd = r.cost?.usd == null ? '**NO CALCULABLE**' : `$${r.cost.usd.toFixed(4)}`;
        const perBook = r.costPerBook?.usd == null ? '—' : `$${r.costPerBook.usd.toFixed(2)}`;
        lines.push(`| ${r.label} | ${units} | ${cache} | ${usd} | ${perBook} | ${(r.elapsedMs / 1000).toFixed(1)} |`);
    }
    lines.push('');
    const caveats = ran.filter(r => r.cost?.caveat);
    if (caveats.length) {
        lines.push('**Advertencias de costo**');
        lines.push('');
        for (const r of caveats) lines.push(`- **${r.label}**: ${r.cost.caveat}`);
        lines.push('');
    }
    if (run.rates?.present) {
        lines.push('### Tarifas usadas y de dónde salen');
        lines.push('');
        lines.push('| Tarifa | Valor | Procedencia |');
        lines.push('|---|---:|---|');
        for (const p of run.rates.provenance ?? []) {
            lines.push(`| ${p.label} | ${p.value ?? '—'} | ${p.source} |`);
        }
        lines.push('');
        lines.push('Un precio sin origen declarado no se distingue de uno recordado a medias.');
        lines.push('Contrasta esta tabla con tu factura antes de citar cualquier cifra de abajo.');
        lines.push('');
    }
    // En un plan con cupo mensual, la pregunta que decide no es cuánto cuesta
    // sino cuántos libros caben. Medido: plan Free = 10.000 créditos/mes, y un
    // solo comentario de 425 páginas puede llevarse una fracción enorme.
    const cupo = run.rates?.values?.llamaparse?.creditosPorMes;
    // Sólo con créditos > 0. Medido: en plan Free la API devuelve 0 tanto en
    // `job_credits_usage` como en `credits_used`, así que el delta da 0 y la
    // sección concluía "∞ libros por mes" — un número seguro de sí mismo y
    // completamente vacío, que es justo lo que este banco existe para evitar.
    const lp = ran.filter(r => r.id?.startsWith('llamaparse') && r.billing?.creditsDelta > 0);
    const lpSinDato = ran.filter(r => r.id?.startsWith('llamaparse') && !(r.billing?.creditsDelta > 0));
    if (cupo && lpSinDato.length && !lp.length) {
        lines.push('### Cupo mensual de créditos');
        lines.push('');
        lines.push('**No medible con esta corrida.** La API de LlamaParse devolvió 0 tanto en');
        lines.push('`job_credits_usage` como en `credits_used`, sin marcar caché. En plan Free');
        lines.push('parece no desglosar consumo por trabajo.');
        lines.push('');
        lines.push('Sí reporta páginas facturadas, así que el consumo se puede reconstruir con');
        lines.push('los multiplicadores de crédito por página de cada modo (`creditosPorPagina`');
        lines.push('en `rates.json`, desde la documentación de LlamaParse).');
        lines.push('');
        lines.push('Alternativa empírica, más fiable que cualquier tabla: anota los créditos');
        lines.push('disponibles en el panel ANTES y DESPUÉS de una corrida `--fresh`. La');
        lines.push('diferencia es lo que costó, sin intermediarios.');
        lines.push('');
    }
    if (cupo && lp.length) {
        lines.push('### Cupo mensual de créditos');
        lines.push('');
        lines.push(`Plan de ${cupo.toLocaleString()} créditos/mes. Extrapolado a un libro de ${doc.bookPages ?? '?'} páginas:`);
        lines.push('');
        lines.push('| Motor | Créditos / recorte | Créditos / libro | Libros por mes |');
        lines.push('|---|---:|---:|---:|');
        for (const r of lp) {
            const perPage = r.billing.creditsDelta / doc.slicePages;
            const perBook = Math.round(perPage * (doc.bookPages ?? 0));
            const books = perBook > 0 ? Math.floor(cupo / perBook) : '∞';
            lines.push(`| ${r.label} | ${r.billing.creditsDelta} | ${perBook.toLocaleString()} | **${books}** |`);
        }
        lines.push('');
        lines.push('Si «libros por mes» sale bajo, el motor no es viable en producción por más');
        lines.push('barato que se vea en dólares: el cupo se agota y las subidas siguientes fallan.');
        lines.push('');
    }

    lines.push(`«USD por libro» extrapola linealmente del recorte (${doc.slicePages} págs) al libro`);
    lines.push(`completo (${doc.bookPages ?? '?'} págs). Es el número sobre el que se decide, y el más`);
    lines.push('fácil de citar sin sus supuestos: vale para cobro por página, y hay que desconfiar');
    lines.push('de él en cualquier motor con costo fijo por trabajo.');
    lines.push('');

    lines.push('---');
    lines.push('');
    lines.push('## Qué hacer con esto');
    lines.push('');
    lines.push('1. Abre `comparar.html` y mira el mismo pasaje griego en cada motor. Busca espíritus');
    lines.push('   (ἁ/ἀ), acentos y iota suscrita. Un motor puede ganar en números y perder acá.');
    lines.push('2. Repite con un documento de cada clase: escaneado, aparato crítico, léxico. Un');
    lines.push('   motor que gana en texto embebido puede hundirse en un escaneado.');
    lines.push('3. Recién entonces decide, y decide por clase de documento: nada obliga a usar el');
    lines.push('   mismo motor para todo.');
    lines.push('');

    return lines.join('\n');
}

function fmt(n) {
    if (n === null || n === undefined) return '—';
    return Number(n).toFixed(3);
}

// ── HTML side-by-side ──────────────────────────────────────────────────────

/**
 * Picks the pages with the densest Greek and Hebrew across all engines and
 * renders every engine's version of those pages next to each other.
 *
 * Uses a large serif face with generous line height because the whole point
 * is to see a breathing mark. At 13px in a monospace grid the difference
 * between ἁ and ἀ is invisible, which would defeat the exercise.
 */
export function renderHtml(run, { probes = [], topPages = 3 } = {}) {
    const { doc, results } = run;
    const ran = results.filter(r => !r.skipped);

    const interesting = pickScriptDensePages(ran, topPages);
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const sections = [];

    for (const page of interesting) {
        sections.push(`<h2>Página ${page} <span class="sub">(del recorte; original ${doc.originalRange[0] + page - 1})</span></h2>`);
        sections.push('<div class="grid">');
        for (const r of ran) {
            const body = pageBody(r.markdown, page);
            const s = r.metrics.script;
            sections.push(`
                <section>
                  <header>
                    <strong>${esc(r.label)}</strong>
                    <span class="badge ${r.verdict.status === 'NO APTO' ? 'bad' : 'ok'}">${esc(r.verdict.status)}</span>
                    <span class="sub">diacrítico ${fmt(s.greekDiacriticRatio)} · niqqud ${fmt(s.niqqudRatio)}</span>
                  </header>
                  <pre>${esc(body || '(sin contenido para esta página)')}</pre>
                </section>`);
        }
        sections.push('</div>');
    }

    for (const probe of probes) {
        sections.push(`<h2>Sonda: <code>${esc(probe)}</code></h2>`);
        sections.push('<div class="grid">');
        for (const r of ran) {
            const hit = findContext(r.markdown, probe);
            sections.push(`
                <section>
                  <header><strong>${esc(r.label)}</strong></header>
                  <pre>${hit ? esc(hit) : '<span class="miss">NO ENCONTRADO</span>'}</pre>
                </section>`);
        }
        sections.push('</div>');
    }

    return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Comparación de extractores — ${esc(doc.title)}</title>
<style>
  :root { color-scheme: light dark; --bg:#fff; --fg:#111; --mut:#666; --line:#ddd; --card:#fafafa; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#15171a; --fg:#e8e8e8; --mut:#9aa0a6; --line:#2c3034; --card:#1b1e22; }
  }
  body { background:var(--bg); color:var(--fg); margin:0; padding:28px 32px;
         font:15px/1.6 -apple-system, system-ui, sans-serif; }
  h1 { font-size:22px; margin:0 0 4px; }
  h2 { font-size:17px; margin:34px 0 12px; border-top:1px solid var(--line); padding-top:18px; }
  .sub { color:var(--mut); font-weight:400; font-size:13px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(380px,1fr)); gap:16px; }
  section { border:1px solid var(--line); border-radius:10px; background:var(--card); overflow:hidden; }
  header { padding:10px 14px; border-bottom:1px solid var(--line);
           display:flex; gap:10px; align-items:baseline; flex-wrap:wrap; }
  .badge { font-size:11px; padding:2px 8px; border-radius:99px; letter-spacing:.04em; }
  .badge.ok  { background:#1a7f371f; color:#1a7f37; }
  .badge.bad { background:#cf222e1f; color:#cf222e; }
  .miss { color:#cf222e; }
  /* Serif, grande y con aire: acá se tiene que VER un espíritu áspero. */
  pre { margin:0; padding:14px; white-space:pre-wrap; word-break:break-word;
        font-family:"New Athena Unicode","SBL BibLit","SBL Greek","Cardo","Gentium Plus",
                    "Times New Roman", serif;
        font-size:17px; line-height:1.85; max-height:520px; overflow:auto; }
</style></head>
<body>
<h1>Comparación de extractores</h1>
<p class="sub">${esc(doc.title)} · páginas ${doc.originalRange[0]}–${doc.originalRange[1]} de ${doc.originalTotal}</p>
<p>Mira los <strong>espíritus</strong> (ἁ vs ἀ), los acentos y la iota suscrita en griego;
   el <strong>niqqud</strong> y los acentos de cantilación en hebreo. Un motor puede ganar
   en las métricas y perder acá — y esta es la lectura que decide.</p>
${sections.join('\n')}
</body></html>`;
}

/** Pages where the engines collectively saw the most Greek + Hebrew. */
function pickScriptDensePages(ran, topN) {
    const totals = new Map();
    for (const r of ran) {
        for (const [page, d] of Object.entries(scriptDensityByPage(r.markdown))) {
            const p = Number(page);
            totals.set(p, (totals.get(p) ?? 0) + d.greek + d.hebrew);
        }
    }
    const sorted = [...totals.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
        // No Greek or Hebrew anywhere — still show the first pages so the run
        // is not silently empty.
        return [1, 2, 3].slice(0, topN);
    }
    return sorted.slice(0, topN).map(([p]) => p).sort((a, b) => a - b);
}

function pageBody(markdown, page) {
    const parts = markdown.split(PAGE_SPLIT);
    for (let i = 1; i < parts.length; i += 2) {
        if (Number(parts[i]) === page) return (parts[i + 1] ?? '').trim();
    }
    return '';
}

function findContext(markdown, needle, radius = 260) {
    const idx = markdown.normalize('NFC').indexOf(needle.normalize('NFC'));
    if (idx === -1) return null;
    return markdown.slice(Math.max(0, idx - radius), idx + needle.length + radius);
}
