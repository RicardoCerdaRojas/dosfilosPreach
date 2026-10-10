import type { FichaAntes, FichaOrigen, FichaSeccion, FilaDestino } from './fichaRegistro';

/**
 * La tabla de destino de la ficha de palabra, generada desde los registros de
 * bloques (`docs/FICHA_DE_PALABRA.md`). Una prueba exige que el documento esté
 * al día: se regenera con `ACTUALIZAR_TABLA=1 npx vitest run tablaDestino`.
 */

const SECCION: Readonly<Record<FichaSeccion, string>> = {
    encabezado: 'Encabezado', palabra: 'La palabra', forma: 'La forma', funcion: 'Su función', contexto: 'En el contexto', estudio: 'Para estudiar', acciones: 'Acciones',
};
const ORIGEN: Readonly<Record<FichaOrigen, string>> = {
    datos: 'datos (OSHB, MorphGNT, MACULA o conteo propio)', regla: 'regla', asistente: 'asistente', mixto: 'regla + asistente', accion: '—',
};
const ANTES: Readonly<Record<FichaAntes, string>> = { tarjeta: 'tarjeta', tooltip: 'tooltip', panel: 'panel' };
const IDIOMA = { he: 'Hebreo', gr: 'Griego' } as const;

export function tablaMarkdown(filas: readonly FilaDestino[]): string {
    const partes = [
        '# Ficha de palabra — tabla de destino',
        '',
        '> Generado desde los registros de bloques (`bloquesHebreo.tsx`, `bloquesGriego.tsx`). No editar a mano:',
        '> `ACTUALIZAR_TABLA=1 npx vitest run tablaDestino` (en `packages/web`).',
        '',
        'Cada fila es un bloque de la ficha: el dato, dónde estaba antes del rediseño, en qué sección queda, si entra en el resumen (tooltip y tarjeta) y de dónde sale.',
        '',
    ];
    for (const idioma of ['he', 'gr'] as const) {
        const deEste = filas.filter(f => f.idioma === idioma);
        if (!deEste.length) continue;
        partes.push(`## ${IDIOMA[idioma]} (${deEste.length} bloques)`, '', '| # | Bloque | Dato | Antes | Sección | Resumen | De dónde sale |', '|---|---|---|---|---|---|---|');
        deEste.forEach((f, i) => partes.push(`| ${i + 1} | \`${f.id}\` | ${f.dato} | ${f.antes.map(a => ANTES[a]).join(', ')} | ${SECCION[f.seccion]} | ${f.corto ? 'sí' : '—'} | ${ORIGEN[f.origen]} |`));
        partes.push('');
    }
    return partes.join('\n');
}
