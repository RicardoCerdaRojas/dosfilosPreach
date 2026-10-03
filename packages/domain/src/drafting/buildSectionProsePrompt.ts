import type { SermonElement } from './SermonElement';
import { manuscriptStyleFor } from './sermonManuscriptStyle';
import type { WalkSection } from './deriveSectionWalk';

export interface SectionProseInput {
    section: WalkSection;
    /** Etiqueta y trabajo de la sección, ya traducidos por quien llama. */
    sectionLabel: string;
    sectionJob: string;
    /** Lo que el pastor decidió para esta sección. Sin descartados. */
    elements: readonly SermonElement[];
    passage: string;
    proposition?: string;
    /** Título del punto al que pertenece la sección, verbatim. */
    pointTitle?: string;
    /**
     * La proposición del punto, si el pastor ya la decidió.
     *
     * Es la frase de la que se desprenden las partes del punto — "es a un punto
     * lo que la proposición homilética es al sermón". Cuando existe, gobierna la
     * estructura: se enuncia primero y cada idea desarrolla uno de sus
     * conceptos. Cuando NO existe, el modelo no la inventa: sería otra decisión
     * central tomada por la máquina, como pasaba con el título.
     */
    pointProposition?: string;
    /**
     * Texto bíblico REAL de la sección, leído de la Biblia local.
     *
     * Cuando viaja, el modelo lo cita tal cual. Sin él lo escribe de memoria —
     * y una cita bíblica mal recordada en el púlpito es de la misma familia que
     * una cita de autor inventada.
     */
    scriptureText?: string;
    /** Registro del sermón: cómo habla este pastor a su congregación. */
    audienceRigor?: 'beginner' | 'seminary';
    /** El estilo del manuscrito que guardó el usuario. Ausente = el del sistema. */
    manuscriptStyle?: string;
}

const VINETA = (t: string) => `- ${t}`;

/**
 * Escribe la prosa de UNA sección A PARTIR de lo que el pastor decidió.
 *
 * ESTE ES EL PROMPT QUE HACE QUE TODO EL FLUJO SIGNIFIQUE ALGO. Sin él, las
 * decisiones se guardan y el sermón se genera igual que antes — ideas que se
 * piden, se muestran y nadie lee.
 *
 * LA RESTRICCIÓN CENTRAL NO ES DE ESTILO, ES DE HONESTIDAD DE LA MEDICIÓN. El
 * modelo DESARROLLA lo decidido y NO AGREGA ideas propias. Si contrabandea
 * contenido que el pastor no decidió, la procedencia deja de describir el
 * sermón: la pantalla diría que las ideas son suyas mientras el texto lleva
 * otras que nunca vio.
 *
 * ELEMENTOS Y DIRECTIVAS SE TRATAN DISTINTO, y es la razón de que el modelo de
 * datos los separe:
 *   - Un ELEMENTO es una idea que él tuvo. Se DESARROLLA sin cambiarla.
 *   - Una DIRECTIVA es un tema que él mandó cubrir. Ahí el modelo SÍ aporta el
 *     contenido, porque eso fue lo que se le pidió.
 *
 * Mezclarlos rompe las dos direcciones: desarrollar una directiva deja el tema
 * sin cubrir, y "cubrir" un elemento invita a reemplazar su idea por otra.
 */
export function buildSectionProsePrompt(input: SectionProseInput): string {
    const vivos = input.elements.filter((e) => e.provenance !== 'descartado');
    const ideas = vivos.filter((e) => e.kind === 'elemento');
    const temas = vivos.filter((e) => e.kind === 'directiva');

    const bloqueIdeas = ideas.length
        ? `\nIDEAS QUE ÉL DECIDIÓ (desarróllalas; NO las reemplaces ni las corrijas):\n${ideas.map((e) => VINETA(e.text)).join('\n')}\n`
        : '';
    const bloqueTemas = temas.length
        ? `\nTEMAS QUE ÉL MANDÓ CUBRIR (acá SÍ aportas el contenido, porque eso te pidió):\n${temas.map((e) => VINETA(e.text)).join('\n')}\n`
        : '';

    /**
     * UN ELEMENTO, UN MOVIMIENTO — cuando hay varios.
     *
     * La prosa corrida FUNDE las ideas: el oyente no puede seguir dónde termina
     * una y empieza la otra, y el pastor pierde la estructura con la que las
     * pensó. Desarrollar una por una es cómo se predica un punto con varias
     * partes, y además deja el texto AUDITABLE contra las decisiones: se ve qué
     * párrafo salió de qué idea.
     *
     * Con UNA sola idea no hay nada que separar: ahí la lista sería andamiaje
     * vacío, y una ilustración partida en viñetas deja de ser una ilustración.
     */
    // UNA SECCIÓN DE UNA SOLA IDEA NUNCA SE ABRE EN MOVIMIENTOS, aunque el
    // pastor haya escrito varias frases. Sin esto, una ilustración escrita en
    // dos líneas tomaba la proposición del punto como espina y salía con la
    // estructura de una exposición — dejando de ser una ilustración.
    const varias = !input.section.oneIdea && ideas.length + temas.length > 1;
    // La proposición gobierna la estructura SÓLO donde la sección la desglosa.
    // Como contexto sigue viajando: una aplicación debe servir a la tesis del
    // punto aunque no sea su desglose.
    const proposicionPunto = input.section.unpacksProposition ? input.pointProposition?.trim() : undefined;

    const estructura = !varias
        ? input.section.oneIdea
            ? `   Es UNA imagen, no un argumento. Cuéntala como un relato continuo, con
   las palabras y los detalles que él eligió. NO la abras en viñetas, NO la
   organices por conceptos y NO le agregues una moraleja: la aplicación va en
   otra sección. Si él escribió varias frases, son partes de la MISMA imagen.`
            : `   Es una sola idea: escríbela como un párrafo continuo. No la partas en
   viñetas — sin varias partes que separar, la lista es andamiaje vacío.`
        : proposicionPunto
          ? `   LOS MOVIMIENTOS SALEN DE LA PROPOSICIÓN, NO DE LA LISTA DE IDEAS.

   NO REPITAS LA PROPOSICIÓN: ya está escrita justo antes de este texto en el
   sermón. Enunciarla acá la haría aparecer dos veces seguidas. Escribe SÓLO
   lo que la desarrolla.

   NO CITES EL TEXTO BÍBLICO al abrir: el sermón ya lo pone antes de esta
   sección, con la Biblia real. Escribirlo acá lo duplicaría — y de memoria.
   Puedes citar FRAGMENTOS dentro de un movimiento cuando estás comentando
   esas palabras.

   UN MOVIMIENTO POR CADA CONCEPTO QUE LA PROPOSICIÓN NOMBRA, en el orden en
      que ella los nombra, CADA UNO COMO SU PROPIA VIÑETA (guion al inicio de
      línea). Las ideas de arriba son el MATERIAL con que llenas esos
      movimientos: una idea puede servir a un concepto, y varias pueden
      combinarse en uno. NO hagas un movimiento por idea.

      La viñeta no es decoración: separa visualmente los conceptos para que el
      predicador vea de un vistazo en cuántas partes se abre su proposición.
      Como párrafos corridos se funden y hay que contarlos leyendo.
   d) Si una idea decidida no sirve a ningún concepto de la proposición, úsala
      donde mejor apoye, al final. NO la descartes y NO inventes un concepto
      para acomodarla.

   NO REESCRIBAS UNA IDEA CON OTRAS PALABRAS. Si un movimiento dice lo mismo que
   la idea con sinónimos, no aporta nada: la idea ya estaba escrita. DESARROLLAR
   es anclar en las palabras del texto bíblico y mostrar qué se sigue de ellas —
   sin agregar afirmaciones que él no decidió.`
          : `   NO cites el texto bíblico al abrir: el sermón ya lo pone antes de esta
   sección. Desarrolla UNA IDEA POR MOVIMIENTO, en el orden en que están
   arriba: cada idea recibe su propio bloque. Puedes usar viñetas.
   NO fundas dos ideas en un mismo párrafo: el oyente tiene que poder seguir
   una a la vez.`;

    const registro =
        input.audienceRigor === 'seminary'
            ? 'Registro técnico: puedes usar vocabulario exegético sin explicarlo.'
            : 'Registro llano: si aparece un término técnico, explícalo en la misma frase.';

    return `Eres el redactor del sermón de un pastor. Él YA DECIDIÓ qué dice esta sección. Tu trabajo es escribirla, no pensarla — y escribirla CONCISA: esto es su documento de trabajo, no la transcripción de lo que dirá en el púlpito.

PASAJE: ${input.passage}
${input.proposition ? `PROPOSICIÓN DEL SERMÓN: "${input.proposition}"\n` : ''}${input.pointTitle ? `PUNTO AL QUE PERTENECE: "${input.pointTitle}"\n` : ''}${input.scriptureText ? `TEXTO BÍBLICO (${input.section.scriptureRef ?? ''}) — CÍTALO TAL CUAL, no lo escribas de memoria:\n"${input.scriptureText}"\n` : ''}${proposicionPunto ? `PROPOSICIÓN DE ESTE PUNTO (la escribió él; enúnciala TAL CUAL y desprende de ella las partes):\n"${proposicionPunto}"\n` : ''}
SECCIÓN: ${input.sectionLabel}
TRABAJO DE LA SECCIÓN: ${input.sectionJob}
${bloqueIdeas}${bloqueTemas}
REGLAS — LAS TRES PRIMERAS NO SON NEGOCIABLES:

1. **NO AGREGUES IDEAS QUE ÉL NO DECIDIÓ.** Ésta es la regla que sostiene todo
   lo demás. Si crees que falta algo, NO lo agregues: escribe sólo lo decidido.
   Contrabandear contenido hace que el sermón lleve ideas que él nunca vio.

2. **DESARROLLA LAS IDEAS, NO LAS SUSTITUYAS.** Cada idea decidida tiene que
   aparecer en el texto, reconocible. Puedes darle forma, ordenarla y conectarla
   con las otras; no puedes cambiarla por una mejor.

3. **NO INVENTES CITAS NI DATOS.** Nada de citas atribuidas a autores, cifras,
   fechas ni referencias que no vengan de arriba. Una cita inventada en el
   púlpito destruye la credibilidad del predicador. Si un dato haría falta y no
   lo tienes, escribe la frase sin él.

4. **LA FORMA DEL TEXTO SIGUE LA FORMA DE LO DECIDIDO.**
${estructura}

5. ${registro}

6. ${manuscriptStyleFor(input.manuscriptStyle)}

7. Frases cortas, sin subtítulos, sin encabezados. Nada de meta-comentarios
   ("en esta sección veremos", "a continuación analizaremos").

SALIDA: sólo la prosa de la sección. Sin título, sin comillas, sin explicación.`;
}
