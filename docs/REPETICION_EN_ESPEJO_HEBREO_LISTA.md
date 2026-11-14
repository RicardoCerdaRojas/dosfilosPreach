# Repetición en espejo: la lista curada del AT hebreo

Esta es la lista que se muestra en el analizador hebreo (`packages/domain/src/language-structure/hebrewMirrorList.ts`). Pendientes de la revisión del profesor, 2026-11-13: el espejo de Stg 2:18 llevado al hebreo. **Se generó para que la revise el fundador:** se puede marcar cualquier fila para quitarla o corregir su par.

**Cómo se armó (2026-11-13):**
1. El detector (el mismo criterio del griego, sobre el lema de OSHB) propuso 284 candidatos en el AT.
2. Tres revisores independientes los juzgaron con las páginas de Lund (*Chiasmus in the New Testament*, 1942) y Bullinger (*Figures of Speech Used in the Bible*, reimpresión Baker 1968). Marcaron 123 como espejo y corrigieron 6 pares (Ec 8:14, 2 R 5:18, Ez 18:20, Ez 5:10, Ez 46:9, Is 50:1).
3. Un cuarto revisor, a ciegas y con criterio estricto («ante la duda, no»), juzgó esos 123 mezclados con 30 de control. Confirmó 74. De los 30 de control rechazó 29, es decir, coincidió con los primeros revisores.
4. Entran sólo los 74 que aprobaron las dos revisiones, más 3 que Bullinger da como inversión y el detector no ve (Éx 9:31, Is 5:20, Is 6:10).
5. Quedó fuera lo que la revisión a ciegas rechazó: fórmulas legales o rituales (Lv 18:7, Lv 20:9), respuestas que repiten la pregunta (1 R 10:3), listas y medidas, y el orden verbo-sujeto de la narración.

**Fuente:** la página impresa, cotejada con `scripts/language-rules/cotejar-citas.py`. Lund casi no trata el AT: ninguno de estos versículos aparece en él. «—» quiere decir que ninguna de las dos obras trata el versículo como inversión, y que el juicio es de los revisores. La versificación es la hebrea; Bullinger usa la inglesa.

**2 R 5:18** abarca 24 palabras; es el único que pasa de 15. El marco «לַדָּבָר … יִסְלַח | יִסְלַח … בַּדָּבָר» lo eligió la revisión, a propósito.

**Lo que no cubre:** el paralelismo poético con sinónimos (lo más común en Salmos y Proverbios: el espejo es de sentido, no de la misma palabra) y el quiasmo que cruza de un versículo a otro.

**Total: 77 versículos.** Con fuente: 4.

| Versículo | A · B \| B′ · A′ | Fuente | Nota del revisor |
|---|---|---|---|
| Gn 2:4 | הַשָּׁמַ֛יִם · וְהָאָ֖רֶץ \| אֶ֥רֶץ · וְשָׁמָֽיִם | — | Quiasmo célebre «los cielos y la tierra / tierra y cielos» que articula 2:4a y 2:4b; Bullinger (hoja 704) cita el versículo solo por «en el día». |
| Gn 9:6 | שֹׁפֵךְ֙ · דַּ֣ם \| דָּמ֣וֹ · יִשָּׁפֵ֑ךְ | — | Antimetábole clásica: «el que derrama sangre … su sangre será derramada». |
| Gn 41:11 | וַנַּֽחַלְמָ֥ה · חֲל֛וֹם \| חֲלֹמ֖וֹ · חָלָֽמְנוּ | — | Inversión marcada: «soñamos un sueño … cada uno según su sueño soñamos». |
| Gn 41:12 | וַיִּפְתָּר · חֲלֹמֹתֵ֑ינוּ \| כַּחֲלֹמ֖וֹ · פָּתָֽר | — | Inversión marcada: «nos interpretó nuestros sueños; a cada uno según su sueño interpretó»; Bullinger (hoja 181) cita el versículo solo por el verbo פתר. |
| Gn 41:48 | וַיִּתֶּן · אֹ֖כֶל \| אֹ֧כֶל · נָתַ֥ן | — | Inversión marcada: «puso alimento en las ciudades; el alimento del campo … puso dentro de ella». |
| Gn 48:13 | בִּֽימִינוֹ֙ · מִשְּׂמֹ֣אל \| בִשְׂמֹאל֖וֹ · מִימִ֣ין | — | Contracambio derecha–izquierda / izquierda–derecha que describe el cruce de las manos. |
| Éx 8:22 | תּוֹעֲבַ֣ת · נִזְבַּ֖ח \| נִזְבַּ֞ח · תּוֹעֲבַ֥ת | — | Inversión con objeto antepuesto: «la abominación de Egipto sacrificamos / sacrificamos la abominación de Egipto». |
| Éx 9:6 | וַיָּ֕מָת · מִקְנֵ֣ה \| וּמִמִּקְנֵ֥ה · מֵ֥ת | — | Antimetábole antitética: «murió todo el ganado de Egipto / del ganado de Israel no murió uno»; Bullinger (hoja 666) cita el versículo solo por la sinécdoque de «todo». |
| Éx 9:31 | וְהַפִּשְׁתָּ֥ה · וְהַשְּׂעֹרָ֖ה \| הַשְּׂעֹרָה֙ · וְהַפִּשְׁתָּ֖ה | Bullinger, Epánodo, p. 299 | Lino · cebada \| cebada · lino (agregado a mano: Bullinger lo da como Epánodo). |
| Éx 16:35 | אָֽכְל֤וּ · הַמָּן֙ \| הַמָּן֙ · אָֽכְל֔וּ | — | Inversión marcada «comieron el maná … el maná comieron» con el objeto antepuesto; Bullinger (hoja 398) cita el versículo como Epibole (repetición), no como inversión. |
| Lv 17:11 | לְכַפֵּ֖ר · נַפְשֹׁתֵיכֶ֑ם \| בַּנֶּ֥פֶשׁ · יְכַפֵּֽר | — | «para expiar por vuestras almas, porque la sangre por el alma expía»: quiasmo célebre y compacto. Bullinger (hoja 596) cita el versículo sólo por metonimia (alma = vida). |
| Lv 20:25 | הַטְּהֹרָה֙ · לַטְּמֵאָ֔ה \| הַטָּמֵ֖א · לַטָּהֹ֑ר | — | «entre el animal limpio y el inmundo, y entre el ave inmunda y la limpia»: antimetábole directa. |
| Lv 23:42 | בַּסֻּכֹּ֥ת · תֵּשְׁב֖וּ \| יֵשְׁב֖וּ · בַּסֻּכֹּֽת | — | «en cabañas habitaréis … habitarán en cabañas»: quiasmo compacto y célebre. |
| Lv 26:20 | תִתֵּ֤ן · אַרְצְכֶם֙ \| הָאָ֔רֶץ · יִתֵּ֖ן | — | «vuestra tierra no dará su fruto, y el árbol de la tierra no dará su fruto»: dar-tierra / tierra-dar, quiasmo clásico. |
| Lv 26:29 | וַאֲכַלְתֶּ֖ם · בְּשַׂ֣ר \| וּבְשַׂ֥ר · תֹּאכֵֽלוּ | — | «comeréis la carne de vuestros hijos y la carne de vuestras hijas comeréis»: quiasmo compacto y enfático. |
| Lv 26:39 | יִמַּ֨קּוּ֙ · בַּֽעֲוֺנָ֔ם \| בַּעֲוֺנֹ֥ת · יִמָּֽקּוּ | — | «se pudrirán por su iniquidad … por las iniquidades de sus padres se pudrirán»: quiasmo nítido. |
| Lv 27:10 | ט֥וֹב · בְּרָ֖ע \| רַ֣ע · בְּט֑וֹב | — | «bueno por malo, o malo por bueno»: antimetábole pura. |
| Nm 5:21 | בִּשְׁבֻעַ֣ת · הָאָלָה֒ \| לְאָלָ֥ה · וְלִשְׁבֻעָ֖ה | — | «juramento de maldición … te haga YHWH maldición y juramento»: inversión compacta y perceptible. |
| Nm 33:2 | מוֹצָאֵיהֶ֛ם · לְמַסְעֵיהֶ֖ם \| מַסְעֵיהֶ֖ם · לְמוֹצָאֵיהֶֽם | — | «sus salidas según sus jornadas … sus jornadas según sus salidas»: antimetábole célebre. |
| Dt 7:10 | וּמְשַׁלֵּ֧ם · פָּנָ֖יו \| פָּנָ֖יו · יְשַׁלֶּם | — | «Da el pago en su cara … en su cara le dará el pago»: quiasmo nítido de retribución. |
| Jos 5:5 | מֻלִ֣ים · הָעָ֖ם \| הָ֠עָם · מָֽלוּ | — | «circuncidados estaban todo el pueblo … todo el pueblo nacido en el desierto … no fueron circuncidados»: quiasmo antitético claro. |
| Jos 9:18 | נְשִׂיאֵ֣י · הָֽעֵדָ֔ה \| הָעֵדָ֖ה · הַנְּשִׂיאִֽים | — | «los príncipes de la congregación … murmuró toda la congregación contra los príncipes»: inversión de papeles nítida. |
| Jue 5:30 | שְׁלַ֥ל · רִקְמָ֑ה \| רִקְמָתַ֖יִם · שָׁלָֽל | — | «botín de colores bordados, color de dos bordados para el cuello del botín»: el último colon invierte al anterior y cierra con «botín». |
| 1 S 15:22 | וּזְבָחִ֔ים · כִּשְׁמֹ֖עַ \| שְׁמֹ֨עַ֙ · מִזֶּ֣בַח | — | «¿Se complace YHWH en sacrificios como en obedecer…? El obedecer es mejor que el sacrificio»: cruce perceptible entre la pregunta y la respuesta; Bullinger (hoja 845) dispone la segunda mitad en alternancia, no como inversión, por eso no se cita. |
| 1 S 16:7 | יִרְאֶה֙ · הָאָדָ֔ם \| הָֽאָדָם֙ · יִרְאֶ֣ה | — | «No lo que ve el hombre, pues el hombre ve…»: inversión contigua que prepara el contraste con «YHWH ve el corazón»; Bullinger lo trata como elipsis (hoja 156), no como inversión. |
| 2 S 5:8 | הַפִּסְחִים֙ · הַ֣עִוְרִ֔ים \| עִוֵּ֣ר · וּפִסֵּ֔חַ | — | «Los cojos y los ciegos» vuelve invertido en el dicho «ciego y cojo no entrará», cita en espejo; Bullinger (hoja 203) cita el versículo por la aposiopesis, no por la inversión. |
| 2 S 12:22 | הַיֶּ֣לֶד · חַ֔י \| וְחַ֥י · הַיָּֽלֶד | — | «Mientras el niño vivía … y viva el niño»: inversión que enmarca el razonamiento de David. |
| 2 S 13:15 | שִׂנְאָה֙ · גְּדוֹלָ֣ה \| גְדוֹלָ֗ה · הַשִּׂנְאָה֙ | — | «Odio grande … grande el odio»: quiasmo contiguo y enfático, reforzado por la comparación con el amor. |
| 2 S 18:20 | וּבִשַּׂרְתָּ֖ · בְּי֣וֹם \| וְהַיּ֤וֹם · תְבַשֵּׂ֔ר | — | «Darás la noticia otro día, pero hoy no la darás»: antimetábole con contraste entre otro día y hoy y entre afirmación y negación. |
| 2 S 24:14 | נִפְּלָה · בְיַד \| וּבְיַד · אֶפֹּֽלָה | — | «Caigamos en la mano de YHWH … en la mano del hombre no caiga yo»: antimetábole con contraste entre YHWH y el hombre. |
| 1 R 12:7 | הַ֠יּוֹם · עֶ֜בֶד \| עֲבָדִ֖ים · הַיָּמִֽים | — | «Si hoy eres siervo … serán tus siervos todos los días»: antimetábole que invierte quién sirve a quién y opone hoy a siempre. |
| 1 R 18:10 | גּ֤וֹי · וּמַמְלָכָה֙ \| הַמַּמְלָכָה֙ · הַגּ֔וֹי | — | El binomio «nación y reino» vuelve invertido como «el reino y la nación» dentro del juramento de Abdías, como Gn 2:4. |
| 1 R 20:18 | תִּפְשׂ֣וּם · חַיִּ֑ים \| חַיִּ֥ים · תִּפְשֽׂוּם | — | «Prendedlos vivos … vivos prendedlos»: antimetábole exacta en dos condicionales paralelas (paz/guerra). |
| 2 R 5:18 | לַדָּבָ֣ר · יִסְלַ֥ח \| יִסְלַח · בַּדָּבָ֥ר | — | El marco «en esto perdone YHWH a tu siervo … perdone YHWH a tu siervo en esto» es la inversión principal (y dentro, casa de Rimón/postrarse se cruzan); Bullinger (hoja 856) trata el v. 19 como anfibología, no esta inversión. |
| 1 Cr 21:13 | אֶפְּלָה · בְיַד \| וּבְיַד · אֶפֹּֽל | — | «Caiga yo en la mano de YHWH … en la mano del hombre no caiga»: antimetábole con contraste explícito entre YHWH y el hombre. |
| 2 Cr 26:5 | לִדְרֹ֣שׁ · בִּימֵ֣י \| וּבִימֵי֙ · דָּרְשׁ֣וֹ | — | «Buscar a Dios en los días de Zacarías … en los días en que buscó a YHWH, Dios lo prosperó»: cruce cercano que liga búsqueda y prosperidad; Bullinger (hoja 472) lo cita como perífrasis, no como inversión. |
| Neh 5:5 | כֹ֠בְשִׁים · בְּנֹתֵ֜ינוּ \| מִבְּנֹתֵ֤ינוּ · נִכְבָּשׁוֹת֙ | — | «sujetamos a nuestros hijos y nuestras hijas … y de nuestras hijas algunas ya están sujetas»: cruce compacto y enfático en la queja. |
| Neh 5:8 | אַחֵ֨ינוּ · הַנִּמְכָּרִ֤ים \| תִּמְכְּר֥וּ · אֲחֵיכֶ֖ם | — | «rescatamos a nuestros hermanos vendidos … y vosotros vendéis a vuestros hermanos»: quiasmo antitético que sostiene el reproche. |
| Sal 27:8 | בַּקְּשׁ֣וּ · פָנָ֑י \| פָּנֶ֖יךָ · אֲבַקֵּֽשׁ | — | «Buscad mi rostro. Tu rostro, YHWH, buscaré»: quiasmo célebre. Bullinger (hoja 926) lo cita por antropopatía. |
| Sal 131:2 | נַ֫פְשִׁ֥י · כְּ֭גָמֻל \| כַּגָּמֻ֖ל · נַפְשִֽׁי | — | «mi alma como niño destetado … como niño destetado está mi alma»: espejo célebre. Bullinger lo cita por símil (hoja 780) y por epístrofe (hoja 294), no como inversión. |
| Pr 8:13 | שְֽׂנֹ֫את · רָ֥ע \| רָ֭ע · שָׂנֵֽאתִי | — | «aborrecer el mal … el camino del mal … aborrezco»: el verbo enmarca el catálogo de males en orden invertido. Bullinger (hoja 699) lo cita por sinécdoque. |
| Pr 22:29 | לִֽפְנֵֽי · יִתְיַצָּ֑ב \| יִ֝תְיַצֵּב · לִפְנֵ֥י | — | «delante de reyes estará; no estará delante de los oscuros»: quiasmo proverbial clásico. Bullinger (hoja 1003) lo cita sólo por erotesis. |
| Ec 6:3 | וְשָׁנִים֩ · רַבּ֨וֹת \| וְרַ֣ב · שָׁנָ֗יו | — | «Años muchos vive, y muchos son los días de sus años»: quiasmo contiguo y enfático. |
| Ec 8:14 | צַדִּיקִ֗ים · הָרְשָׁעִ֔ים \| רְשָׁעִ֔ים · הַצַּדִּיקִ֑ים | — | El espejo real es justos/impíos … impíos/justos (antimetábole de la retribución trastocada); el detector tomó כמעשה en lugar de צדיקים. |
| Is 5:20 | לָרַ֛ע · ט֖וֹב \| וְלַטּ֣וֹב · רָ֑ע | Bullinger, Antimetábole, p. 301 | Malo · bueno \| bueno · malo (agregado a mano; B y B′ van juntas y el detector no lo ve). |
| Is 6:10 | וְאָזְנָ֥יו · וְעֵינָ֣יו \| בְעֵינָ֜יו · וּבְאָזְנָ֣יו | Bullinger, Epánodo, p. 299 | Oídos · ojos \| ojos · oídos, dentro de corazón … corazón (agregado a mano; Mt 13:15 lo cita). |
| Is 7:22 | יֹאכַ֣ל · חֶמְאָ֑ה \| חֶמְאָ֤ה · יֹאכֵ֔ל | — | «comerá cuajada, porque cuajada y miel comerá»: cruce inmediato y perceptible verbo-objeto / objeto-verbo. |
| Is 27:5 | יַעֲשֶׂ֥ה · שָׁל֖וֹם \| שָׁל֖וֹם · יַֽעֲשֶׂה | — | Antimetábole estrecha: «haga paz conmigo, paz haga conmigo». |
| Is 50:1 | שִׁלַּחְתִּ֔יהָ · מָכַ֥רְתִּי \| נִמְכַּרְתֶּ֔ם · שֻׁלְּחָ֥ה | Bullinger, Paralelismo introvertido, p. 359 | Paralelismo invertido despedir–vender / vender–despedir, enmarcado además por «vuestra madre»; Bullinger lo trata como Parallelism (Introverted). |
| Is 51:17 | שָׁתִ֛ית · כּ֣וֹס \| כּ֧וֹס · שָׁתִ֖ית | — | Inversión poética marcada: «bebiste … la copa de su ira / el cáliz de la copa del vértigo bebiste». |
| Is 56:5 | וְנָתַתִּ֨י · וָשֵׁ֔ם \| שֵׁ֤ם · אֶתֶּן | — | Inversión marcada: «les daré … un nombre / un nombre eterno les daré». |
| Is 57:15 | וּשְׁפַל · ר֔וּחַ \| ר֣וּחַ · שְׁפָלִ֔ים | — | Antimetábole estrecha: «humilde de espíritu / espíritu de los humildes». |
| Is 59:8 | שָׁלוֹם֙ · יָדָ֔עוּ \| יָדַ֖ע · שָׁלֽוֹם | — | Inclusión invertida que enmarca el versículo: «camino de paz no conocieron … no conoce paz». |
| Jer 23:26 | בְּלֵ֥ב · הַנְּבִאִ֖ים \| וּנְבִיאֵ֖י · לִבָּֽם | — | «en el corazón de los profetas … profetas del engaño de su corazón»: inversión compacta que enmarca la acusación. |
| Jer 42:6 | בְּק֣וֹל · נִשְׁמָ֑ע \| נִשְׁמַ֔ע · בְּק֖וֹל | — | «en la voz de YHWH nuestro Dios … obedeceremos … obedeceremos la voz de YHWH nuestro Dios»: frase completa repetida en marco invertido. |
| Ez 1:27 | אֵ֤שׁ · מָתְנָ֖יו \| מָתְנָיו֙ · אֵ֔שׁ | — | Simetría de la visión: fuego–lomos hacia arriba / lomos hacia abajo–fuego. |
| Ez 5:10 | אָב֞וֹת · בָנִים֙ \| וּבָנִ֖ים · אֲבוֹתָ֑ם | — | Antimetábole «los padres comerán a los hijos, y los hijos comerán a sus padres»; se corrige el par a padres/hijos con el verbo como eje. |
| Ez 7:15 | וְהַדֶּ֥בֶר · וְהָרָעָ֖ב \| רָעָ֥ב · וָדֶ֖בֶר | — | Pestilencia y hambre / hambre y pestilencia, dentro de un arreglo cruzado afuera/adentro; Bullinger (hoja 656) solo cita la metonimia de «espada». |
| Ez 14:15 | חַיָּ֥ה · אַעֲבִ֥יר \| עוֹבֵ֔ר · הַחַיָּֽה | — | Inversión con juego de palabras: «haré pasar fieras … nadie pasa por causa de las fieras». |
| Ez 16:46 | וּבְנוֹתֶ֔יהָ · הַיּוֹשֶׁ֖בֶת \| הַיּוֹשֶׁ֨בֶת֙ · וּבְנוֹתֶֽיהָ | — | Samaria y sus hijas, que habita a tu izquierda / la que habita a tu derecha, Sodoma y sus hijas: cruce claro. |
| Ez 18:20 | בֵּ֞ן · הָאָ֗ב \| וְאָב֙ · הַבֵּ֔ן | — | Antimetábole hijo–padre / padre–hijo; el detector tomó «el pecado», que se repite en paralelo, y se corrige el par. |
| Ez 18:25 | יִתָּכֵ֖ן · דֶּ֣רֶךְ \| הֲדַרְכִּי֙ · יִתָּכֵ֔ן | — | Inversión retórica «no es recto el camino del Señor / ¿mi camino no es recto?», con el sustantivo antepuesto; Bullinger (hoja 1018) lo cita como Anticategoria, no como inversión. |
| Ez 18:29 | יִתָּכֵ֖ן · דֶּ֣רֶךְ \| הַדְּרָכַ֞י · יִתָּֽכְנּוּ֙ | — | Misma inversión retórica que 18:25: «no es recto el camino del Señor / ¿mis caminos no son rectos?». |
| Ez 21:16 | וַיִּתֵּ֥ן · לְמָרְטָ֖ה \| מֹרָ֔טָּה · לָתֵ֥ת | — | La espada «la dio para pulirla … está pulida para darla»: cruce que enmarca el versículo; Bullinger (hoja 957) solo lo menciona por la Apostrophe. |
| Ez 26:20 | ב֜וֹר · עוֹלָ֗ם \| מֵֽעוֹלָם֙ · ב֔וֹר | — | «Los que descienden a la fosa, al pueblo de antaño / ruinas de antaño, con los que descienden a la fosa»: cruce claro. |
| Ez 29:11 | תַעֲבָר · רֶ֣גֶל \| וְרֶ֥גֶל · תַעֲבָר | — | Antimetábole estrecha: «no pasará por ella pie de hombre, ni pie de bestia pasará por ella». |
| Ez 33:9 | מִדַּרְכּוֹ֙ · לָשׁ֣וּב \| שָׁ֖ב · מִדַּרְכּ֑וֹ | — | Cruce estrecho con B contiguos: «de su camino para volverse / no se vuelve de su camino». |
| Ez 33:17 | יִתָּכֵ֖ן · דֶּ֣רֶךְ \| דַּרְכָּ֥ם · יִתָּכֵֽן | — | Antimetábole antitética: «no es recto el camino del Señor / el camino de ellos no es recto»; Bullinger (hoja 1018) lo menciona como Anticategoria, no como inversión. |
| Ez 34:8 | צֹאנִ֨י · רֹעֶ֔ה \| רֹעַ֖י · צֹאנִ֑י | — | Cruce estrecho e irónico: ovejas–no hay pastor / mis pastores–mis ovejas. |
| Ez 36:26 | וְנָתַתִּ֤י · חָדָ֔שׁ \| חֲדָשָׁ֖ה · אֶתֵּ֣ן | — | Quiasmo claro: «os daré corazón nuevo / espíritu nuevo pondré»; Bullinger (hoja 419) trata 36:26-27 como correspondencia alternada, no como inversión. |
| Ez 46:9 | צָפ֜וֹן · נֶ֔גֶב \| נֶ֔גֶב · צָפ֑וֹנָה | — | Contracambio norte–sur / sur–norte en la norma de entrada y salida; el detector tomó «saldrá», se corrige el par. |
| Dn 2:24 | לְהוֹבָדָ֖ה · לְחַכִּימֵ֣י \| לְחַכִּימֵ֤י · תְּהוֹבֵ֔ד | — | «Destruir a los sabios de Babilonia … a los sabios de Babilonia no destruyas»: la contraorden de Daniel invierte la orden del rey con antítesis. |
| Am 4:7 | וְהִמְטַרְתִּי֙ · עִ֣יר \| עִ֥יר · אַמְטִ֑יר | — | «Hice llover sobre una ciudad, y sobre otra ciudad no hice llover»: antimetábole con contraste afirmación/negación. |
| Zac 8:2 | קִנֵּ֥אתִי · גְדוֹלָ֑ה \| גְדוֹלָ֖ה · קִנֵּ֥אתִי | — | «celé por Sion con celo grande, y con ira grande celé por ella»: quiasmo célebre. |
| Zac 8:6 | יִפָּלֵ֗א · בְּעֵינֵי֙ \| בְּעֵינַי֙ · יִפָּלֵ֔א | — | «si es maravilla a los ojos del remanente … ¿también a mis ojos será maravilla?»: antimetábole clara. Bullinger (hoja 1001) lo cita por erotesis. |
| Zac 12:4 | אַכֶּ֤ה · סוּס֙ \| ס֣וּס · אַכֶּ֖ה | — | «heriré a todo caballo … todo caballo de los pueblos heriré»: quiasmo compacto. |
| Mal 3:24 | אָבוֹת֙ · בָּנִ֔ים \| בָּנִ֖ים · אֲבוֹתָ֑ם | — | «hará volver el corazón de los padres hacia los hijos, y el corazón de los hijos hacia sus padres»: antimetábole clásica. Bullinger (hoja 131) menciona Mal 4:6 sólo de paso, por elipsis. |
