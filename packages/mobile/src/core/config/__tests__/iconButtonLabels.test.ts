import { describe, expect, it } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Accesibilidad (C2): un botón que sólo tiene un ícono no le dice nada a
 * VoiceOver ni a TalkBack — el lector anuncia «botón» y nada más. Todo
 * `TouchableOpacity`/`Pressable` sin texto adentro lleva `accessibilityLabel`.
 *
 * Se lee el código fuente: es un invariante, no una prueba de una pantalla.
 * LÍMITE: sólo ve íconos escritos dentro del botón. Un botón que recibe su
 * contenido por parámetro (las celdas de los ajustes de la Biblia) no lo ve.
 */
const ROOT = join(__dirname, '../../../..');
const DIRS = ['src', 'app'];

function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return name === '__tests__' || name === 'dev' ? [] : files(path);
        return path.endsWith('.tsx') ? [path] : [];
    });
}

/** Fin de una etiqueta de apertura, saltando las llaves (`=>` no la cierra). */
function tagEnd(s: string, from: number): number {
    let depth = 0;
    for (let i = from; i < s.length; i++) {
        if (s[i] === '{') depth++;
        else if (s[i] === '}') depth--;
        else if (s[i] === '>' && depth === 0) return i + 1;
    }
    return s.length;
}

export function unlabeledIconButtons(source: string): number[] {
    const lines: number[] = [];
    const open = /<(TouchableOpacity|Pressable)\b/g;
    for (let m = open.exec(source); m; m = open.exec(source)) {
        const tag = m[1]!;
        const openingEnd = tagEnd(source, m.index);
        const opening = source.slice(m.index, openingEnd);
        if (opening.endsWith('/>')) continue;
        let depth = 1;
        let i = openingEnd;
        while (depth > 0 && i < source.length) {
            const nextOpen = source.slice(i).search(new RegExp(`<${tag}\\b`));
            const nextClose = source.indexOf(`</${tag}>`, i);
            if (nextClose < 0) break;
            if (nextOpen >= 0 && i + nextOpen < nextClose) {
                const end = tagEnd(source, i + nextOpen);
                if (!source.slice(i + nextOpen, end).endsWith('/>')) depth++;
                i = end;
            } else {
                depth--;
                i = nextClose + tag.length + 3;
            }
        }
        const body = source.slice(openingEnd, i);
        if (/accessibilityLabel|accessible=\{false\}/.test(opening)) continue;
        if (body.includes('MaterialIcons') && !/<Text\b|<\w*Label\b/.test(body)) {
            lines.push(source.slice(0, m.index).split('\n').length);
        }
    }
    return lines;
}

describe('accesibilidad — botones de ícono', () => {
    it('el detector encuentra un botón de ícono sin etiqueta y respeta el que la tiene', () => {
        const sin = `<TouchableOpacity onPress={() => go()}>\n<MaterialIcons name="close" />\n</TouchableOpacity>`;
        const con = `<TouchableOpacity onPress={() => go()} accessibilityLabel={t('x')}><MaterialIcons name="close" /></TouchableOpacity>`;
        const texto = `<Pressable onPress={go}><MaterialIcons name="add" /><Text>Agregar</Text></Pressable>`;
        expect(unlabeledIconButtons(sin)).toEqual([1]);
        expect(unlabeledIconButtons(con)).toEqual([]);
        expect(unlabeledIconButtons(texto)).toEqual([]);
        // «Label» en otra cosa (una variable, una prop) no es un texto.
        const disfrazado = `<Pressable onPress={go} style={hasLabel}><MaterialIcons name="add" /></Pressable>`;
        expect(unlabeledIconButtons(disfrazado)).toEqual([1]);
    });

    it('ningún botón de ícono de la app queda mudo', () => {
        const offenders = DIRS.flatMap((dir) => files(join(ROOT, dir))).flatMap((path) =>
            unlabeledIconButtons(readFileSync(path, 'utf8')).map((line) => `${relative(ROOT, path)}:${line}`),
        );
        expect(offenders).toEqual([]);
    });
});
