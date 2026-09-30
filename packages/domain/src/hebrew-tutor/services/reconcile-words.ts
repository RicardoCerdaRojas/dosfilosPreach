import { MorphemeRole } from '../value-objects/grammar.js';
import type { VerseAnalysis } from '../entities/verse-analysis.js';

/**
 * Pone el texto masorético de morphhb en las palabras que analizó el modelo.
 *
 * El modelo normaliza el Unicode y pierde los te'amim; morphhb es la
 * autoridad del texto. Lo que el modelo aporta es el ANÁLISIS: cuántas
 * consonantes tiene cada morfema, para colorearlos.
 *
 * Antes se juntaban las consonantes de TODO el versículo y se repartían según
 * los conteos del modelo, sin anclar cada palabra. Un conteo equivocado corría
 * todas las palabras siguientes, en la línea del versículo y en las tarjetas:
 * en Rut 1:7 el modelo contó 4 consonantes en שָׁמָּה (la ה direccional dos
 * veces) y todo lo que seguía se corrió una letra. ~11 de 135 versículos del
 * caché global estaban así.
 *
 * Ahora cada palabra recibe SU token. Si el conteo del modelo no calza con la
 * palabra real, la palabra va entera como un solo morfema: se pierde el color
 * de esa palabra, nunca sus letras, y el error no pasa a la siguiente.
 */

/** Puntuación de versículo: sof pasuq ׃ y paseq ׀. No pertenece a ningún morfema. */
const VERSE_PUNCT_RE = /[׃׀]/g;

const MAQAF_RE = /־/g;

const FINALES: Record<string, string> = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

const esConsonante = (c: string) => c >= 'א' && c <= 'ת';

const consonantes = (s: string) => Array.from(s).filter(esConsonante).length;

/** Las consonantes de un texto, con las finales llevadas a su forma normal. */
const esqueleto = (s: string) =>
  Array.from(s).filter(esConsonante).map(c => FINALES[c] ?? c).join('');

type Palabra = VerseAnalysis['words'][number];

export function reconcileGlobalWords(
  geminiWords: VerseAnalysis['words'],
  morphhbTokens: readonly { text: string }[],
): VerseAnalysis['words'] {
  if (!morphhbTokens || morphhbTokens.length === 0) return geminiWords;
  const tokens = alinear(geminiWords, morphhbTokens);
  return geminiWords.map((w, i) => reconciliarPalabra(w, tokens[i] ?? null));
}

/**
 * Qué texto de morphhb le toca a cada palabra del modelo.
 *
 * Con la misma cantidad, por posición. Con otra —el modelo juntó dos tokens
 * unidos por maqaf, o se saltó uno— se busca por esqueleto consonántico: una
 * palabra toma los tokens siguientes (hasta tres) cuyas consonantes son las
 * suyas. Sin coincidencia, `null`: la palabra conserva el texto del modelo y
 * la alineación no avanza, así que el error no arrastra a las demás.
 */
function alinear(
  palabras: readonly Palabra[],
  tokens: readonly { text: string }[],
): Array<string | null> {
  if (palabras.length === tokens.length) return tokens.map(t => t.text);

  const out: Array<string | null> = [];
  let j = 0;
  for (const palabra of palabras) {
    const propio = esqueleto(palabra.hebrewText || (palabra.morphemes ?? []).map(m => m.text).join(''));
    let texto: string | null = null;

    for (let k = 1; k <= 3 && j + k <= tokens.length && texto === null; k++) {
      const tramo = tokens.slice(j, j + k).map(t => t.text).join('');
      if (esqueleto(tramo) === propio) {
        texto = tramo;
        j += k;
      }
    }
    // El modelo se saltó un token: se busca un poco más adelante.
    for (let salto = 1; salto <= 3 && texto === null && j + salto < tokens.length; salto++) {
      if (esqueleto(tokens[j + salto]!.text) === propio) {
        texto = tokens[j + salto]!.text;
        j += salto + 1;
      }
    }
    out.push(texto);
  }
  return out;
}

function reconciliarPalabra(w: Palabra, token: string | null): Palabra {
  const morfemas = w.morphemes ?? [];
  if (token === null) {
    return { ...w, morphemes: morfemas.map(m => ({ ...m, text: m.text.replace(VERSE_PUNCT_RE, '') })) };
  }

  const conteos = morfemas.map(m => consonantes(m.text));
  const total = conteos.reduce((a, b) => a + b, 0);

  let textos: string[];
  if (morfemas.length === 0) {
    textos = [];
  } else if (total !== consonantes(token)) {
    // El conteo no calza: la palabra entera, un solo morfema.
    return {
      ...w,
      hebrewText: token,
      morphemes: [{
        text: token.replace(VERSE_PUNCT_RE, ''),
        role: MorphemeRole.ROOT_R1,
        label: morfemas.map(m => m.label).filter(Boolean).join(' · '),
      }],
    };
  } else {
    textos = repartir(token, conteos, morfemas.map(m => m.text));
  }

  return {
    ...w,
    // `hebrewText` conserva el sof pasuq: la línea del versículo lo dibuja.
    hebrewText: token,
    // Los morfemas no: dentro de una tarjeta sería un carácter suelto.
    morphemes: morfemas.map((m, i) => ({ ...m, text: textos[i]!.replace(VERSE_PUNCT_RE, '') })),
  };
}

/**
 * Reparte el texto de UNA palabra entre sus morfemas según cuántas
 * consonantes le asignó el modelo a cada uno. Las vocales y marcas van con la
 * consonante que las precede.
 */
function repartir(token: string, conteos: readonly number[], originales: readonly string[]): string[] {
  const textos = conteos.map(() => '');
  let actual = 0;
  let vistas = 0;

  for (const c of token) {
    if (esConsonante(c)) {
      // Los morfemas sin consonantes (una vocal de prefijo) no reciben letras.
      while (actual < conteos.length && conteos[actual] === 0) actual++;
      const destino = Math.min(actual, textos.length - 1);
      textos[destino] += c;
      vistas++;
      if (actual < conteos.length && vistas >= conteos[actual]!) {
        actual++;
        vistas = 0;
      }
    } else {
      // Vocal, dagesh, te'amim o maqaf: con la consonante anterior.
      const destino = Math.min(vistas === 0 ? Math.max(0, actual - 1) : actual, textos.length - 1);
      textos[destino] += c;
    }
  }

  // Un morfema sin consonantes que quedó vacío recupera lo que escribió el
  // modelo, sin maqaf: el del texto real ya se repartió.
  return textos.map((t, i) => (t === '' ? originales[i]!.replace(MAQAF_RE, '') : t));
}

/**
 * La puntuación de versículo con que termina una palabra (sof pasuq ׃,
 * paseq ׀), o cadena vacía.
 *
 * Los morfemas no la llevan —en una tarjeta sería un carácter suelto—, así
 * que la línea del versículo, que dibuja la palabra por morfemas para
 * colorearla, la perdía: el versículo quedaba sin su fin de oración.
 */
export function versePunctuationOf(hebrewText: string): string {
  return hebrewText.match(/[׃׀]+$/)?.[0] ?? '';
}
