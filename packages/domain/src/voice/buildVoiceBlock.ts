import type { VoiceSample } from './selectVoiceSamples';

/**
 * El bloque de prompt que le enseña al modelo CÓMO ESCRIBE ESTE PASTOR.
 *
 * TODO EL PESO ESTÁ EN UNA SOLA INSTRUCCIÓN: imitar la VOZ, nunca el CONTENIDO.
 *
 * Sin decirlo —y decirlo fuerte— el fallo no es teórico: se le pasan fragmentos
 * de su sermón sobre Jonás y el sermón de Santiago hereda las ilustraciones de
 * Jonás, sus giros y hasta su conclusión. El resultado se parecería mucho al
 * pastor, sí, pero sería el sermón equivocado — y él lo descubriría leyéndolo en
 * voz alta el sábado.
 *
 * Por eso el bloque hace tres cosas en este orden: rotula los fragmentos como
 * MUESTRA DE ESTILO, enumera qué mirar en ellos (ritmo, léxico, cómo abre y
 * cierra), y prohíbe explícitamente traer material. La prohibición va al final
 * porque es lo último que el modelo lee antes de escribir.
 *
 * Devuelve cadena vacía sin muestras: quien llama concatena sin condicionales y
 * el prompt queda igual que hoy.
 */
export function buildVoiceBlock(samples: readonly VoiceSample[]): string {
    if (samples.length === 0) return '';

    const fragmentos = samples
        .map((s, i) => `MUESTRA ${i + 1} — de su sermón «${s.title}»:\n"""\n${s.excerpt.trim()}\n"""`)
        .join('\n\n');

    return `

## CÓMO ESCRIBE ESTE PREDICADOR

Abajo hay fragmentos de sermones que ESTE MISMO PASTOR armó y predicó. Están aquí
para que el borrador suene a él y no a un texto genérico.

${fragmentos}

QUÉ MIRAR EN LAS MUESTRAS:
- El LARGO y el RITMO de sus frases. Si escribe corto, escribe corto.
- Su LÉXICO: las palabras que usa para dirigirse a la congregación y para nombrar
  lo que Dios hace.
- Cómo ABRE un punto y cómo lo CIERRA.
- Cuánto explica antes de aplicar, y con qué tono aplica.

REGLA QUE NO SE NEGOCIA — IMITA LA VOZ, NUNCA EL CONTENIDO:
Las muestras son de OTROS pasajes y de OTROS sermones. No traigas de ellas
ninguna ilustración, ningún ejemplo, ninguna frase, ninguna conclusión ni ningún
giro de contenido. Si una imagen de las muestras te parece que encaja en este
sermón, NO la uses: pertenece a otro texto y a otro domingo. De las muestras
tomas la FORMA de escribir; el contenido sale ÚNICAMENTE del pasaje y del
material de este sermón.`;
}
