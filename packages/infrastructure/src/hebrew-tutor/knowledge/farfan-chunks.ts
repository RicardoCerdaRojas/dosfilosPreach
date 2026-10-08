/**
 * Hebrew Grammar Knowledge Base — Farfán Source
 *
 * Structured chunks from the Farfán Hebrew Grammar (base_farfan_1-2.md
 * and base_farfan_3-5.md) organized for contextual injection into
 * Gemini prompts.
 *
 * Each chunk has:
 *   - id: unique identifier
 *   - topics: semantic tags used by knowledge-selector.ts
 *   - content: the textual content injected into the prompt
 */

export interface KnowledgeChunk {
  readonly id: string;
  readonly topics: readonly string[];
  readonly content: string;
}

/** All chunks from the Farfán grammar corpus. */
export const FARFAN_CHUNKS: readonly KnowledgeChunk[] = [

  // ── Prefixes and Articles ────────────────────────────────────────────────────

  {
    id: 'farfan-article-prefixes',
    topics: ['artículo', 'prefijo', 'ה', 'ו', 'preposición', 'inseparable', 'מן'],
    content: `
## Artículo y Prefijos Inseparables (§ 10–11, Farfán)

**El artículo** hebreo es un prefijo הַ que duplica (dagesh forte) la consonante siguiente.
Ante guturales o ר que no admiten dagesh, cambia su vocal:
- Forma ordinaria: הַ (ante consonante fuerte)
- Ante ע, ר, א: הָ
- Ante ח, ה con vocal: הַ (pero a veces הֶ)
- Ante עָ הָ חָ: הֶ

La ה del artículo se sincopa detrás de preposiciones inseparables (בְּ, כְּ, לְ):
לְהַמֶּלֶךְ → לַמֶּלֶךְ «para el rey»

**Prefijos inseparables** (ב, כ, ל, ו):
- Vocal ordinaria: šewá (בְּ, כְּ, לְ, וְ)
- Ante šewá móvil: vocal plena (בּ becomes בִּ ante šewá)
- La וּ ante labiales (פ, מ, ב) y Nomes con šewá

**Preposición מִן** «de, desde» se asimila al siguiente consonante (dagesh forte):
מִנְבַּ֫יִת → מִבַּ֫יִת «de casa»
Ante guturales o ר: el חִירֶק se alarga a צֵרֶה: מֵאָדָם «de Adán»
`,
  },

  // ── Personal Pronouns ────────────────────────────────────────────────────────

  {
    id: 'farfan-pronouns-personal',
    topics: ['pronombre', 'pronombre personal', 'sufijo pronominal', 'genitivo', 'dativo'],
    content: `
## Pronombre Personal (§ 12, Farfán)

**Forma separada (nominativo):**
| Persona | Singular | Plural |
|---------|----------|--------|
| 1ª com. | אָנֹכִי / אֲנִי | נַחְנוּ / אֲנַחְנוּ |
| 2ª ms.  | אַתָּה | אַתֶּם |
| 2ª fs.  | אַתְּ | אַתֵּנָה / אַתֵּן |
| 3ª ms.  | הוּא | הֵם / הֵמָּה |
| 3ª fs.  | הִיא | הֵנָּה |

**Sufijos pronominales del nombre y verbo:**
| Persona | Verbo | Nombre |
|---------|-------|--------|
| 1sg com | ני  | י (mío) |
| 2sg ms  | ָך  | ָך |
| 2sg fs  | ֵךְ | ֵךְ |
| 3sg ms  | וֹ / הוּ | וֹ |
| 3sg fs  | הָ  | הּ / הָ |
| 1pl com | נוּ | נוּ |
| 2pl ms  | כֶם | כֶם |
| 2pl fs  | כֶן | כֶן |
| 3pl ms  | ם (הֶם) | הֶם / ם |
| 3pl fs  | ן (הֶן) | הֶן / ן |
`,
  },

  // ── Demonstrative, Relative, Interrogative Pronouns ──────────────────────────

  {
    id: 'farfan-pronouns-other',
    topics: ['pronombre demostrativo', 'pronombre relativo', 'pronombre interrogativo', 'אשר', 'זה'],
    content: `
## Pronombres Demostrativo, Relativo e Interrogativo (§ 13–14, Farfán)

**Demostrativo:**
- Cercano: זֶה (ms), זֹאת (fs), אֵלֶּה (pl)
- Lejano: הוּא (ms), הִיא (fs), הֵם, הֵנָּה (pl) — usando 3ª persona pronombre personal

**Relativo:** אֲשֶׁר (indeclinable) «que, quien, lo que»; también el prefijo שֶׁ.
Los casos oblicuos se expresan con sufijos en otros elementos de la frase:
הָאִישׁ אֲשֶׁר נָתַתִּי לוֹ «el hombre al que di» (lit. «que di a él»)

**Interrogativo:** מִי «¿quién?», מָה «¿qué?»
מָה ante guturales: מֶה; ante otras consonantes: מַה (dagesh en la siguiente) o מַ prefijo.
`,
  },

  // ── Noun System ──────────────────────────────────────────────────────────────

  {
    id: 'farfan-noun-general',
    topics: ['sustantivo', 'nombre', 'género', 'número', 'plural', 'dual', 'desinencia'],
    content: `
## El Nombre (§ 15, Farfán)

Los nombres hebreos son bisílabos y trilíteros, derivados de raíces verbales.

**Géneros:** masculino y femenino (sin neutro).
**Números:** singular, plural, dual.

**Desinencias:**
| Género | Singular | Plural | Dual |
|--------|----------|--------|------|
| Masc.  | — (sin desinencia) | ִים / ִין | ַיִם |
| Fem.   | ָה / ת | וֹת | ָתַיִם |

**Anomalías de género:**
- Algunos masculinos tienen plural femenino: אָב «padre» → אָבוֹת
- Algunos femeninos tienen plural masculino: שָׁנָה «año» → שָׁנִים
- Pluralia tantum: חַיִּים «vida», פָּנִים «rostro»

**Tipos nominales** se nombran con קטל:
- *qaṭal* (דָּבָר): vocal larga en primera posición
- *qaṭil* (כָּבֵד): adjetivos de estado
`,
  },

  {
    id: 'farfan-noun-construct',
    topics: ['estado constructo', 'cadena constructa', 'absoluto', 'genitivo', 'posesión'],
    content: `
## Estado Absoluto y Constructo (§ 16, Farfán)

**Estado absoluto:** forma libre, sin depender de otro sustantivo.
**Estado constructo:** forma ligada al sustantivo siguiente, expresando posesión o relación.
סוּס הַמֶּלֶךְ «el caballo del rey» — סוּס está en constructo.

**Transformaciones en estado constructo:**
- El nombre pierde su acento primario y se une fónicamente al siguiente
- Desinencias que cambian:
  - ָה → ַת (fem. sg.)
  - ִים → ֵי (masc. pl.)
  - ַיִם → ֵי (dual)
- Las vocales largas se abrevian según posición:
  - Posición antepretónica: vocal → šewá
  - Sílaba cerrada y átona: vocal larga → breve correspondiente

**Ejemplo:** דָּבָר → דְּבַר (דְּבַר הַמֶּלֶךְ «la palabra del rey»)
El primer ָ (antepretónico) → šewá; el segundo ָ (cerrado y átono) → pataḥ.

**Regla:** El nombre en estado constructo NUNCA lleva artículo.
`,
  },

  {
    id: 'farfan-noun-suffixes',
    topics: ['sufijo del nombre', 'pronombre posesivo', 'genitivo pronominal', 'declinación'],
    content: `
## Sufijos del Nombre (§ 17, Farfán)

Los sufijos pronominales se añaden al estado constructo del nombre y expresan el genitivo:
סוּסֵיהֶן «los caballos de ellas» = «sus caballos»

**Sufijos del nombre singular (est. c. סוּס):**
- 1sg: סוּסִי (mi caballo)
- 2ms: סוּסְךָ (tu caballo)
- 2fs: סוּסֵךְ
- 3ms: סוּסוֹ
- 3fs: סוּסָהּ
- 1pl: סוּסֵנוּ
- 2mpl: סוּסְכֶם
- 3mpl: סוּסָם

**Sufijos del nombre plural (est. c. סוּסֵי):**
- 1sg: סוּסַי (mis caballos)
- 2ms: סוּסֶיךָ
- 3ms: סוּסָיו
- 3mpl: סוּסֵיהֶם
`,
  },

  // ── The Verb System ──────────────────────────────────────────────────────────

  {
    id: 'farfan-verb-intro',
    topics: ['verbo', 'raíz', 'tema', 'binyan', 'conjugación', 'sistema verbal', 'aspecto'],
    content: `
## El Sistema Verbal Hebreo — Introducción (§ 25–26, Farfán)

El hebreo bíblico tiene 7 **temas verbales (binyanim)**, cada uno con su propia
morfología y valor semántico.

| Binyan | Carácter | Ejemplo con קטל |
|--------|----------|-----------------|
| Qal (G) | Acción simple activa, estáticos | קָטַל «mató» |
| Nifal (N) | Pasivo/Reflexivo del Qal | נִקְטַל «fue matado» |
| Piel (D) | Intensivo/Factitivo activo | קִטֵּל «mató repetidamente» |
| Pual (Dp) | Pasivo del Piel | קֻטַּל «fue intensamente matado» |
| Hitpael (HtD) | Reflexivo del Piel | הִתְקַטֵּל «se mató a sí mismo» |
| Hifil (H) | Causativo activo | הִקְטִיל «hizo matar» |
| Hofal (Hp) | Causativo pasivo | הָקְטַל «fue hecho matar» |

**Conjugaciones verbales principales:**
- **Perfecto** (qatal): acción completada; valor de pasado o estado presente
- **Imperfecto** (yiqtol): acción inacabada; valor de futuro, habitual, modal
- **Wayyiqtol** (וַ + imperfecto): narración pasada, "pasado narrativo secuencial"
- **Weqatal** (וְ + perfecto): secuencia del futuro o acción consecuente
- **Imperativo**: órdenes directas (solo 2ª persona)
- **Infinitivo constructo**: sustantivo verbal, precedido de preposiciones
- **Infinitivo absoluto**: para énfasis verbal o acción simultánea
- **Participio activo/pasivo**: función adjetival o sustantival
`,
  },

  {
    id: 'farfan-verb-qal',
    topics: ['qal', 'verbo fuerte', 'perfecto', 'imperfecto', 'wayyiqtol', 'imperativo', 'participio', 'infinitivo', 'conjugación qal'],
    content: `
## Verbo QAL — Conjugaciones del Verbo Fuerte (§ 27–34, Farfán)

### QAL Perfecto (aspecto completivo)
Sufijos: -(nada) 3ms, הָ- 3fs, תָּ- 2ms, תְּ- 2fs, תִּי- 1cs, וּ- 3cp, תֶּם- 2mp, תֶּן- 2fp, נוּ- 1cp
Vocal característica: pataḥ bajo R1, qameṣ bajo R2 → קָטַל

### QAL Imperfecto (aspecto inacabado)
Preformativos: יִ- 3ms, תִ- 3fs/2ms, אֶ- 1cs, נִ- 1cp
Sufijos: nada 3ms, וּ- 3mp/2mp, נָה- 3fp/2fp
Vocal característica: jireq bajo preformativo, pataḥ bajo R1 → יִקְטֹל

### QAL Wayyiqtol
= וַ + imperfecto con dagesh forte en preformativo + acento retrocedido
עַ/יְ... → וַיִּ... Expresa narración pasada secuencial.
Ejemplo: וַיִּקְטֹל «y mató (narración)»

### QAL Imperativo
Se forma quitando el preformativo del imperfecto. Solo 2ª persona.
2ms: קְטֹל → פְּקֹד (con šewá si R1 es oclusiva)

### QAL Infinitivo constructo
Igual que el imperativo ms: קְטֹל
Con verbo III-He: קְטֹל + ה → diferente del imperativo
Suele ir precedido de preposición: לִקְטֹל

### QAL Infinitivo absoluto
Forma קָטוֹל — con jōlem vav. Invariable.
Se usa para enfatizar o como acción simultánea.

### QAL Participio activo
Masc. sg.: קֹטֵל (qōtēl); Fem. sg.: קֹטֶלֶת
Función adjetival o sustantival.
`,
  },

  {
    id: 'farfan-verb-nifal',
    topics: ['nifal', 'voz pasiva', 'voz reflexiva', 'nun asimilada', 'perfecto nifal', 'imperfecto nifal'],
    content: `
## Verbo NIFAL — Pasivo / Reflexivo (§ 35, Farfán + Lección 1 del Profesor)

El Nifal toma el Qal y lo expresa en **voz pasiva o reflexiva** (verbos activos).
Es el 6% de todos los verbos bíblicos (4,138 ocurrencias).

**Elemento característico:** nun (נ), visible en perfecto y participio;
asimilada (dagesh forte en R1) en el resto.

### NIFAL Perfecto
Prefijo נִ- + raíz con šewá en R1:
נִקְטַל 3ms, נִקְטְלָה 3fs, נִקְטַלְתָּ 2ms, נִקְטַלְתִּי 1cs
נִקְטְלוּ 3cp, נִקְטַלְתֶּם 2mp

### NIFAL Imperfecto
La נ se asimila a R1 → dagesh forte en R1.
Vocal del preformativo: jireq (normal); si R1 es gutural, alarga a ṣêrê (compensación).
Primera vocal de la raíz: qameṣ (característica del Nifal imperfecto).
יִקָּטֵל 3ms, תִּקָּטֵל 3fs/2ms, אֶקָּטֵל 1cs

### NIFAL Imperativo
Prefijo הִ- + raíz con dagesh forte en R1: הִקָּטֵל

### NIFAL Infinitivo constructo
Igual que el imperativo ms: הִקָּטֵל (preceded by prep.)

### NIFAL Participio
Prefijo נִ- visible (como el perfecto) + qameṣ bajo R2.
נִקְטָל ms, נִקְטֶלֶת fs
**Distinción:** el participio tiene qameṣ bajo R2; el perfecto 3ms tiene pataḥ.

**Claves de reconocimiento:**
- Perfecto: nun (נ) al inicio en toda la flexión
- Imperfecto: secuencia verde-rojo-verde + qameṣ bajo R1
- Imperativo: ה prefijada
- Participio: nun (נ) + qameṣ bajo R2
`,
  },

  {
    id: 'farfan-verb-piel',
    topics: ['piel', 'daguesh forte', 'factitivo', 'intensivo', 'perfecto piel', 'imperfecto piel', 'participio piel'],
    content: `
## Verbo PIEL — Intensivo / Factitivo (§ 36, Farfán + Lección 2 del Profesor)

El Piel expresa la idea central del Qal de forma intensiva o factitiva.
Es el 3er tema más frecuente (aprox. 6,400 ocurrencias).

**Elemento característico:** dagesh forte en R2 (la radical media se duplica).

### PIEL Perfecto
Vocal bajo preformativo (1ª radical): jireq; qameṣ bajo R2.
קִטֵּל 3ms, קִטְּלָה 3fs, קִטַּלְתָּ 2ms, קִטַּלְתִּי 1cs

### PIEL Imperfecto
Vocal del preformativo: šewá. Primera vocal de raíz: pataḥ.
יְקַטֵּל 3ms, תְּקַטֵּל 3fs/2ms
Secuencia de colores: verde-azul-rojo-verde (Piel: jireq → dagesh → pataḥ/ṣêrê).

### PIEL Participio
Prefijo מְ- + estructura del imperfecto sin preformativo.
מְקַטֵּל ms, מְקַטֶּלֶת fs

**Claves de reconocimiento:**
- Siempre: dagesh forte en R2
- Perfecto: jireq bajo R1
- Imperfecto: šewá bajo preformativo + pataḥ bajo R1
- Participio: מְ prefijado
`,
  },

  {
    id: 'farfan-verb-pual',
    topics: ['pual', 'pasivo piel', 'qibbuts', 'daguesh forte', 'perfecto pual'],
    content: `
## Verbo PUAL — Pasivo del Piel (§ 37, Farfán + Lección 3 del Profesor)

El Pual es el **pasivo del Piel** (como el Nifal es el pasivo del Qal).

**Elemento característico:** dagesh forte en R2 (como Piel) + qibbuts (וּ) bajo R1.

### PUAL Perfecto
Vocal bajo R1: qibbuts (וּ breve); dagesh forte en R2; pataḥ bajo R2.
קֻטַּל 3ms, קֻטְּלָה 3fs

### PUAL Imperfecto
Vocal del preformativo: šewá: יְקֻטַּל 3ms

### PUAL Participio
Prefijo מְ-: מְקֻטָּל ms

**Clave de reconocimiento:** Qibbuts bajo R1 + dagesh forte en R2 = Pual (u otros temas pasivos)
`,
  },

  {
    id: 'farfan-verb-hitpael',
    topics: ['hitpael', 'reflexivo', 'recíproco', 'preformativo hit', 'metátesis', 'sibilante'],
    content: `
## Verbo HITPAEL — Reflexivo / Recíproco (§ 38, Farfán + Lección 6 del Profesor)

El Hitpael es el **reflexivo o recíproco del Piel** (842 ocurrencias, 1.2%).
Describe una acción que el sujeto hace sobre sí mismo, o mutuamente.

**Elemento característico:** preformativo הִתְ- en TODAS las formas.
Y dagesh forte en R2 (al igual que Piel/Pual).

### Regla de metátesis (transposición)
Si R1 es **sibilante** (שׁ, שׂ, צ, ס, ז), la ת del preformativo se transpone con ella:
הִתְ + שׁמר → הִשְׁתַּמֵּר (ת transpuesta después de שׁ)

### Regla de asimilación
Si R1 es dental (ד, ת, ז, ט), la ת del preformativo se asimila a R1 (dagesh forte en R1).

### HITPAEL Perfecto
הִתְקַטֵּל 3ms, הִתְקַטְּלָה 3fs, הִתְקַטַּלְתָּ 2ms

### HITPAEL Imperfecto
La ה del preformativo הִתְ- se elide con el preformativo del imperfecto.
יִתְקַטֵּל 3ms, תִּתְקַטֵּל 3fs/2ms
Secuencia colores: verde-violeta-rojo-verde (Hitpael).

### HITPAEL Participio
Prefijo מִתְ-: מִתְקַטֵּל ms

**Claves de reconocimiento:**
- Perfecto: preformativo הִתְ- visible en toda la flexión + dagesh en R2
- Imperfecto: תְ- visible (ה del preformativo elida)
- Participio: מִתְ- prefijado
`,
  },

  {
    id: 'farfan-verb-hifil',
    topics: ['hifil', 'causativo', 'preformativo he', 'pataj', 'hifil perfecto', 'hifil imperfecto', 'participio hifil'],
    content: `
## Verbo HIFIL — Causativo Activo (§ 39, Farfán + Lección 4 del Profesor)

El Hifil expresa la **acción causativa**: hacer que alguien realice la acción del Qal.

**Elemento característico:** ה prefijado en el perfecto, participio, infinitivos (הִ-);
en el imperfecto el ה se elide y el preformativo recibe pataḥ subyacente.

### HIFIL Perfecto
Prefijo הִ-; vocal de transición ī después de R2; ṣêrê entre R2 y R3.
הִקְטִיל 3ms, הִקְטִ֫ילָה 3fs, הִקְטַ֫לְתָּ 2ms

### HIFIL Imperfecto
Vocal del preformativo: (generalmente) pataḥ (en sílaba abierta → ṣêrê).
La ה del preformativo perfecto no aparece.
יַקְטִיל 3ms, תַּקְטִיל 3fs/2ms

**Distinción con Qal:** En Qal el preformativo imperfecto tiene jireq; en Hifil tiene pataḥ
(a menos que la siguiente consonante sea gutural, en cuyo caso puede ser ambiguo).

### HIFIL Participio  
Prefijo מַ-: מַקְטִיל ms, מַקְטִילָה fs

**Claves de reconocimiento:**
- Perfecto: ה prefijado + ī larga (jōlem/ẖîreq magnum) entre R2 y R3
- Imperfecto: pataḥ bajo preformativo + ī entre R2 y R3
- Participio: מַ- prefijado
`,
  },

  {
    id: 'farfan-verb-hofal',
    topics: ['hofal', 'pasivo hifil', 'causativo pasivo', 'qamets-hatuf', 'hofal perfecto'],
    content: `
## Verbo HOFAL — Causativo Pasivo (§ 40, Farfán + Lección 5 del Profesor)

El Hofal es el pasivo del Hifil (causativo pasivo): «fue hecho hacer».

**Elemento característico:** qameṣ-ḥāṭûf (ָ breve = ŏ) bajo el preformativo o ה.

### HOFAL Perfecto
Prefijo הָ- (con qameṣ hatuf, articulado como "ŏ") + šewá bajo R1.
הָקְטַל 3ms

### HOFAL Imperfecto
Vocal del preformativo: qameṣ-ḥāṭûf: יָקְטַל 3ms

### HOFAL Participio
Prefijo מָ-: מָקְטָל ms

**Clave de reconocimiento:** qameṣ-ḥāṭûf bajo el preformativo o מ = Hofal
`,
  },

  // ── Weak Verbs ────────────────────────────────────────────────────────────────

  {
    id: 'farfan-verb-weak-i-nun',
    topics: ['verbo débil', 'I-nun', 'nun asimilada', 'נפל', 'נתן', 'נגש'],
    content: `
## Verbos Débiles I-Nun (§ 47, Farfán + Lección 7 del Profesor)

En verbos I-Nun, la nun (R1) se **asimila** a R2 en el Qal imperfecto e imperativo
(y en algunos otros temas):

**Qal imperfecto:** נִ + קַ → ... la Nun se asimila y aparece dagesh forte en R2
יִפֹּל «caerá» (< נפל), יִתֵּן «dará» (< נתן)

**Imperativo:** Pierde también la nun + šewá inicial:
נְפֹל → פֹּל «¡cae!»; נְתֹן → תֵּן «¡da!»

**Infinitivo constructo:** Pierde la nun: נְפֹל → לִפֹּל «caer»

**Excepción:** נגשׁ en Qal imperfecto retiene la nun silenciosamente: יִגַּשׁ

**Clave:** Si ves dagesh forte en R1 del imperfecto sin preformativo especial → puede ser I-Nun asimilada.
`,
  },

  {
    id: 'farfan-verb-weak-iii-he',
    topics: ['verbo débil', 'III-he', 'III-ה', 'גלה', 'בנה', 'עשה'],
    content: `
## Verbos Débiles III-He (§ 50, Farfán + Lección 7 del Profesor)

Los verbos III-He (R3 = ה) son los más numerosos entre los verbos débiles.
La ה radical **se elide o cambia** según la forma.

**Qal perfecto:** R3 aparece como ָה: גָּלָה «descubrió», בָּנָה «construyó»
**Qal imperfecto:** R3 aparece como ה final con vocal: יִגְלֶה 3ms, יִגְלוּ 3mp
**Qal imperativo:** גְּלֵה ms
**Qal infinitivo constructo:** גְּלֹות o גְּלוֹת (con sufijo: גָּלוֹת-וֹ)
**Qal participio activo:** גֹּלֶה ms

**En binyanim derivados:** el preformativo del tema + ה al final (conforme al paradigma).
Nifal: נִגְלָה perfecto, יִגָּלֶה imperfecto.
Piel: גִּלָּה perfecto, יְגַלֶּה imperfecto.
Hifil: הִגְלָה perfecto, יַגְלֶה imperfecto.

**Claves:**
- Perfecto 3ms termina en ָה larga
- Imperfecto 3ms termina en ֶה
- PI/imperfecto 3fp termina en ינָה: תִּגְלֶינָה
`,
  },

  {
    id: 'farfan-verb-weak-i-yod-waw',
    topics: ['verbo débil', 'I-yod', 'I-waw', 'Pe-Yod', 'Pe-Waw', 'הלך', 'ילד', 'ישב', 'ידע', 'ירד', 'יצא'],
    content: `
## Verbos Débiles I-Yod / I-Waw (§ 48–49, Farfán + Lección 7)

Los verbos I-Yod (R1 = י) y I-Waw (R1 = ו) pierden o transforman su primera radical
en ciertas formas.

**CASO ESPECIAL: הלך** — La raíz הלך es Pe-He (פ״ה) por identidad léxica (R1 = ה),
pero en Qal imperfecto, imperativo e infinitivo constructo, la ה se elide y el verbo
**sigue el patrón vocálico** de los verbos Pe-Yod. NO se debe decir que הלך "es" un
verbo I-Yod/Waw; se debe decir que "se comporta como" Pe-Yod en estas formas.

### Qal Imperfecto
La י/ו (R1) se ELIDE y la vocal se compensa:
- ילד → יֵלֵד «parirá» (R1 י desaparece; preformativo recibe ṣêrê)
- ישב → יֵשֵׁב «se sentará»
- הלך → יֵלֵךְ «irá» (la ה cae; el verbo adopta el patrón vocálico de Pe-Yod)

### Qal Imperativo
Pierde la R1 (como el imperfecto sin preformativo):
- ישב → שֵׁב «¡siéntate!»
- הלך → לֵךְ «¡ve!» (solo quedan R2 + R3: ל + ך; sigue el patrón de Pe-Yod)
- ירד → רֵד «¡baja!»

### Qal Infinitivo Constructo
Pierde la R1 y recibe terminación ת-:
- ישב → שֶׁבֶת «sentarse»
- הלך → לֶכֶת «ir»

### Hifil
Preformativo הוֹ-: הוֹלִיד «engendró», הוֹרִיד «bajó», הוֹלִיךְ «condujo»

**CLASIFICACIÓN:** Para verbos genuinamente Pe-Yod (ילד, ישב, ידע, ירד, יצא):
verbType = I_YOD_WAW, rootClassification = null.
Para הלך: verbType = I_YOD_WAW (comportamiento), rootClassification = "Pe-He (פ״ה)".
NUNCA clasificar estos verbos como STRONG.
`,
  },

  {
    id: 'farfan-verb-weak-ii-waw-yod',
    topics: ['verbo débil', 'II-waw', 'II-yod', 'hueco', 'hollow', 'קום', 'שׂים', 'בוא', 'מות'],
    content: `
## Verbos Débiles II-Waw / II-Yod — Verbos Huecos (§ 51, Farfán + Lección 8)

Los verbos «huecos» (II-Waw/Yod) tienen como R2 una semivocal (ו o י) que se
comporta como VOCAL, no como consonante. Aunque visualmente la letra está presente,
NO funciona como una radical consonántica.

### Qal Perfecto
La ו/י de R2 se contrae en vocal larga:
- קום → קָם «se levantó» (R2 ו → qameṣ)
- מות → מֵת «murió» (R2 ו → ṣêrê)
- שׂים → שָׂם «puso»

### Qal Imperfecto
R2 se mantiene como vocal larga (ū/î):
- קום → יָקוּם «se levantará» (R2 = ו con shureq, función vocálica)
- בוא → יָבוֹא «vendrá» (R2 = ו con ḥolem)

### Qal Imperativo / Infinitivo Constructo
- קוּם «¡levántate!»; לָקוּם «levantarse»

**CLASIFICACIÓN verbType:** Estos verbos SON DÉBILES (verbType = II_WAW_YOD),
NUNCA deben clasificarse como STRONG. La Waw o Yod de R2 funciona como VOCAL,
no como consonante. La pista visual es: si R2 lleva shureq (וּ), ḥolem (וֹ), o
ḥireq gadol (י), está actuando como vocal → verbo hueco → verbType = II_WAW_YOD.
`,
  },

  {
    id: 'farfan-verb-weak-geminate',
    topics: ['verbo débil', 'geminado', 'II-duplicada', 'סבב', 'גלל', 'ארר'],
    content: `
## Verbos Débiles Geminados (II-Duplicada) (§ 52, Farfán)

Los verbos geminados tienen R2 = R3 (la misma consonante). Se comportan de manera
similar a los verbos huecos porque se contraen frecuentemente.

### Qal Perfecto
- סבב → סָבַב «rodeó» (puede contraerse a סַב con sufijos)
### Qal Imperfecto
- סבב → יָסֹב «rodeará» (contracción: solo una consonante visible)

**CLASIFICACIÓN verbType:** Estos verbos SON DÉBILES (verbType = GEMINATE).
R2 y R3 son idénticas. No confundir con un verbo fuerte bisilábico.
`,
  },

  {
    id: 'farfan-verb-type-classification-rules',
    topics: ['verbo', 'verbType', 'clasificación', 'fuerte', 'débil', 'raíz', 'tipo raíz'],
    content: `
## REGLAS DE CLASIFICACIÓN DE verbType y rootClassification

Estos dos campos son CRÍTICOS para el análisis pedagógico. Debes clasificar CADA verbo
usando DOS NIVELES DISTINTOS:

### NIVEL 1: verbType — COMPORTAMIENTO MORFOLÓGICO (cómo actúa el verbo en esta forma)
Indica el patrón funcional que el verbo sigue. Se usa para el análisis morfológico.

### NIVEL 2: rootClassification — IDENTIDAD LÉXICA DE LA RAÍZ (qué ES la raíz)
Indica la clasificación REAL de la raíz lexicográfica. Solo se usa cuando DIFIERE
del verbType. Si son iguales, rootClassification = null.

### EJEMPLO CLAVE: הלך
- Raíz: ה-ל-ך → R1 es ה → identidad léxica = Pe-He (פ״ה)
- Pero en Qal imperfecto/imperativo, la ה cae como si fuera י → comportamiento = Pe-Yod
- Resultado:
  - verbType = "I_YOD_WAW" (comportamiento funcional)
  - rootClassification = "Pe-He (פ״ה) — se comporta como Pe-Yod en esta forma"

### CUÁNDO rootClassification = null (la mayoría de los verbos):
Si la identidad léxica coincide con el comportamiento, rootClassification es null:
- ילד: R1 = י → identidad = Pe-Yod → verbType = I_YOD_WAW → rootClassification = null
- קום: R2 = ו vocálica → identidad = Hueco → verbType = II_WAW_YOD → rootClassification = null
- נפל: R1 = נ → identidad = Pe-Nun → verbType = I_NUN → rootClassification = null

### VALORES DE verbType (seleccionar según el COMPORTAMIENTO):

1. **STRONG**: Las 3 radicales presentes como consonantes. Ejemplo: כתב, שׁמר, קטל.
2. **I_YOD_WAW**: R1 cae o se vocaliza (incluye verbos Pe-He que se comportan así).
3. **I_NUN**: R1 = נ que se asimila (dagesh forte en R2).
4. **I_ALEF**: R1 = א que quiesce.
5. **II_WAW_YOD**: R2 = ו/י que funciona como vocal (verbos huecos).
6. **III_HE**: R3 = ה que se elide o muta.
7. **III_ALEF**: R3 = א quiescente.
8. **GEMINATE**: R2 = R3 (misma consonante).
9. **GUTURAL_R1/R2/R3**: Radical gutural con compensación vocálica menor.

### REGLA DE MORFEMAS:
Si una radical de la raíz NO aparece en los morfemas de la forma analizada,
el verbo NO PUEDE ser clasificado como STRONG. La ausencia de una radical indica
un verbo débil.

### REGLA DE REDACCIÓN PEDAGÓGICA (explanation y recognitionClues):

Cuando rootClassification ≠ null (es decir, la identidad léxica de la raíz DIFIERE
de su comportamiento morfológico), la redacción en "explanation" y "recognitionClues"
DEBE distinguir claramente entre los dos niveles. NUNCA reclasificar implícitamente la raíz.

**TERMINOLOGÍA CORRECTA (usar siempre):**
- "La raíz הלך es Pe-He (פ״ה), pero en esta forma **sigue el patrón** de los verbos Pe-Yod."
- "La R1 (ה) se elide, y el verbo **adopta un patrón vocálico similar al** de los verbos I-Yod/Waw."
- "Aunque la raíz es Pe-He, en imperativo Qal **se comporta como** un verbo Pe-Yod."

**TERMINOLOGÍA INCORRECTA (NUNCA usar):**
- ❌ "Es un verbo de tipo I-Yod-Waw" (reclasifica la raíz)
- ❌ "Las características son propias de los verbos I-Yod/Waw" (sugiere pertenencia)
- ❌ "Es un verbo débil de tipo I-Yod-Waw, aunque su raíz léxica es Pe-He" (contradice)

**PRINCIPIO:** La raíz es una entidad léxica ESTABLE (הלך siempre es Pe-He).
El comportamiento es un fenómeno CONTEXTUAL que varía según la forma verbal.
Separarlos explícitamente es fundamental para que el alumno no internalice
una clasificación errónea de la raíz.
`,
  },

  // ── Wayyiqtol and Narrative ──────────────────────────────────────────────────

  {
    id: 'farfan-wayyiqtol',
    topics: ['wayyiqtol', 'ו consecutivo', 'narración', 'pasado narrativo', 'וַי', 'secuencial'],
    content: `
## Wayyiqtol — El Imperfecto Consecutivo (§ 55, Farfán)

El **wayyiqtol** (וַ + imperfecto) es la forma narrativa más frecuente del Antiguo Testamento.
Expresa una secuencia de acciones pasadas (el «pasado narrativo secuencial»):
«Y hizo X, y hizo Y, y hizo Z...»

**Formación:**
1. וְ copulativo → וַ (con pataḥ) ante el preformativo
2. El preformativo recibe **dagesh forte** (la ו se asimila): וַיִּ-, וַתִּ-, וָאֶ-
3. El acento suele **retroceder** una sílaba (nasog aḥor)

**Formas comunes:**
- 3ms: וַיִּקְטֹל «y mató» (< יִקְטֹל)
- 3fs/2ms: וַתִּקְטֹל «y ella mató / y tú mataste»
- 1cs: וָאֶקְטֹל «y yo maté»
- 3mp: וַיִּקְטְלוּ «y ellos mataron»

**Ante guturales:** la ו toma pataḥ pero el dagesh forte no aparece (compensación vocal).

**Valor semántico:** principal herramienta narrativa de la prosa hebrea.
Marca continuidad temporal: «y... y... y...»

**Distinción con imperfecto simple:** el imperfecto solo (sin ו consecutivo) tiene valor futuro,
modal, o habitual; el wayyiqtol tiene valor de pasado narrativo.
`,
  },

  // ── Volitives ────────────────────────────────────────────────────────────────

  {
    id: 'farfan-volitivos',
    topics: ['yusivo', 'cohortativo', 'imperativo', 'volitivo', 'prohibición', 'אַל', 'לֹא', 'deseo'],
    content: `
## Volitivos: yusivo, cohortativo, imperativo — y la prohibición

- **Cohortativo** (1.ª persona, suele llevar ָה): «hagamos», «que yo vaya».
- **Imperativo** (2.ª persona, positivo): «ve», «escucha».
- **Yusivo** (3.ª y 2.ª persona): deseo o mandato indirecto, «que haga», «que no haga».

**Prohibición — la partícula decide la etiqueta:**
- **אַל + forma de prefijo = YUSIVO.** Prohibición o ruego negativo puntual: אַל־תִּפְגְּעִי־בִי «no insistas conmigo» (Rut 1:16). Nunca se usa אַל con imperativo.
- **לֹא + forma de prefijo = IMPERFECTO.** Prohibición categórica o permanente: לֹא תִרְצָח «no matarás».

**Fórmula de juramento** כֹּה יַעֲשֶׂה … וְכֹה יֹסִיף: sus dos verbos son YUSIVOS de valor volitivo: «así me haga YHWH, y aún me añada» (Rut 1:17; 1 S 3:17). NO es futuro («él hará»). Lo mismo con otras fórmulas de juramento (חַי־יְהוָה, אִם / אִם־לֹא de juramento): el valor es volitivo o de aseveración, no temporal.

**Valor ≠ forma:** en "temporalValue" describe el VALOR en contexto (pasado narrativo, futuro, habitual, modal, VOLITIVO/desiderativo…). La traducción sigue al valor.

**Forma y etiqueta:** en la mayoría de los verbos, el yusivo de 2.ª y 3.ª persona se escribe IGUAL que el imperfecto. Sólo se distingue en algunos débiles: III-he apocopado (יַעַשׂ por יַעֲשֶׂה), huecos (יָקֹם por יָקוּם) e Hifil (יַקְטֵל por יַקְטִיל). Cuando la forma no lo muestra, la etiqueta la decide la partícula o el contexto, no la forma.
`,
  },

  // ── Clause connection ────────────────────────────────────────────────────────

  {
    id: 'farfan-clausulas-conexion',
    topics: ['cláusula', 'disyuntiva', 'asíndeton', 'asindética', 'waw', 'conexión', 'contraste', 'circunstancial'],
    content: `
## Cómo se unen las cláusulas: la waw y su ausencia

**Waw + verbo** continúa: וַ + prefijo es la cadena narrativa (wayyiqtol); וְ + perfecto
(weqatal) continúa en futuro o modo; וְ + otro verbo coordina («y»).

**Waw + NO verbo = cláusula disyuntiva.** Cuando tras la waw viene el sujeto, el
objeto o un adverbio y DESPUÉS el verbo (o no hay verbo), la cláusula interrumpe la
secuencia. Según el contexto expresa:
- **contraste**: «Orpá besó a su suegra, **pero** Rut se quedó con ella» (Rut 1:14);
- **circunstancia** simultánea o de fondo: «**mientras** …», «estando …»;
- **paréntesis** o información de trasfondo para el lector;
- **comienzo** de una nueva escena.

**Asíndeton** (sin conjunción): una cláusula que entra sin waw ni partícula. Marca
énfasis, clímax, explicación o enumeración solemne: «tu pueblo, mi pueblo; y tu Dios,
mi Dios» (Rut 1:16). No se le agrega «y» al traducir.

**Oración nominal**: sin verbo finito; la cópula se suple («será», «es»). Puede ser
asindética o unida con waw.
`,
  },

  // ── Syntax ───────────────────────────────────────────────────────────────────

  {
    id: 'farfan-syntax-clause',
    topics: ['oración', 'oración nominal', 'oración verbal', 'sintaxis', 'sujeto', 'predicado', 'cópula'],
    content: `
## Sintaxis de la Oración Hebrea (§ 60–65, Farfán)

### Oración Nominal
No tiene verbo explícito. La cópula "ser/estar" está implícita:
הָאִישׁ טוֹב «el hombre (es) bueno»
Expresa estados, condiciones, o verdades atemporales.

### Oración Verbal
El predicado es un verbo conjugado.
**Orden básico: Verbo — Sujeto — Complementos**
וַיֹּאמֶר יְהוָה אֶל־מֹשֶׁה «Y dijo el Señor a Moisés»

**Nota:** El orden puede variar para énfasis:
- Sujeto delante del verbo: contraste o énfasis en el sujeto
- Complemento delante del verbo: énfasis en el complemento

### Concordancia verbal
El verbo concuerda con el sujeto en persona, género y número.
Con sujeto de **pluralia tantum** (חַיִּים, פָּנִים): verbo singular o plural.
Con sujeto colectivo: verbo a menudo en singular.

### Acusativo del objeto directo
El objeto directo definido lleva la partícula אֶת (o אֵת con maqqef: אֶת־).
Los pronominales se expresan con sufijos verbales.
`,
  },

];
