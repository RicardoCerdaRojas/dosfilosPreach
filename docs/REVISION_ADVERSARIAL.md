# Revisión adversarial — antes de abrir cualquier PR

Este archivo NO es una lista de buenas prácticas. Cada pregunta está acá porque
un defecto real de este repo pasó la revisión y llegó a producción, y se cita el
PR donde mordió. Si una pregunta no tiene un defecto detrás, no pertenece a esta
lista.

**Cómo se usa:** con el diff a la vista, contestar cada pregunta por escrito —
«no aplica» es una respuesta válida, «creo que está bien» no lo es. El relato de
cada defecto vive en byblos; acá van sólo las preguntas.

Las cuatro primeras salieron todas del mismo día (2026-09-11, PRs #593-#596) y
tienen la misma forma:

> **Existía una afirmación, y nada verificaba que siguiera siendo cierta.**

---

## 1. ¿Esta constante tiene una hermana que gobierne la misma cantidad?

Si la respuesta es sí: **¿concuerdan, y hay una prueba que lo obligue?**

Mordió en **#594**. `MIN_PAGE_COVERAGE = 0.95` daba un libro por bueno con hasta
5% de pérdida, mientras el reintento de tanda exigía el 100%. Dos números del
mismo módulo, contradiciéndose, en funciones distintas. Una tanda de 43 páginas
a la que le faltaba UNA pagaba 182 s de relectura — y eso sacó la extracción del
techo de 900 s.

Cuando dos reglas deberían coincidir y viven aparte, terminan no coincidiendo.
El arreglo estructural no es «acordarse»: es **ponerlas en el mismo módulo** y
atar la relación con un invariante ejecutable (ver §5).

## 2. ¿Hay un comentario que AFIRME un comportamiento? ¿Existe la prueba que lo ata?

Un comentario que dice lo que el código hace es documentación. Un comentario que
dice lo que **otro** código hará es una promesa, y las promesas caducan.

Mordió en **#595**. El guardia de plazo escribía `failed` más su motivo, con este
comentario:

> «si la extracción termina bien después, su escritura lo pisa»

Pisaba sólo el ESTADO. Un libro quedó `ready`, completo, con 170 páginas, y
arrastrando «superó el tiempo máximo»: sano con cara de roto.

## 3. En cada alternancia de una expresión regular, ¿cuál rama gana y qué pasa con la otra?

`(?:a|b)` **parece** atender los dos casos. Toma el primero que aparezca y
descarta el resto en silencio.

Mordió en **#596**. El rescate de JSON usaba `"(?:text|md)"` y devolvía
`{page, text}` — sin campo donde guardar `md`. Toda tanda rescatada perdió
encabezados, listas y tablas: 63 páginas de una gramática hebrea entraron al
corpus con el texto intacto y la estructura borrada. Un paradigma verbal
conservó sus ~140 formas pero aplanadas, sin decir cuál corresponde a cada
persona.

Y no falló nada: devolvía las páginas, la cobertura daba 100%, el libro quedaba
`ready`.

## 4. ¿Esta prueba afirma el CONTRATO del llamador, o describe lo que la función ya hace?

La segunda clase es peor que no tener prueba: **cementa el defecto**.

Mordió en **#596**, y es lo más incómodo de ese PR. El comportamiento roto
estaba fijado como correcto:

```js
it('acepta la variante que usa «md» en vez de «text»', () => {
    expect(rescatarPaginas('...{"page":2,"md":"markdown"}...'))
        .toEqual([{ page: 2, text: 'markdown' }]);   // ← el defecto, certificado
});
```

Se escribió mirando lo que la función devolvía, no lo que el llamador
necesitaba. «Agregar más pruebas» de esta clase empeora las cosas.

**Contraste:** el llamador hacía `md: p.md`. Una prueba escrita desde ahí habría
fallado el primer día.

## 5. ¿Los números que se relacionan entre sí están atados por un invariante ejecutable?

Un invariante no depende de que alguien lea esta lista. Falla solo.

Ejemplo vivo, de **#594**, en `coberturaDePaginas.test.ts`: el umbral del
reintento no puede ser más estricto que el piso de cobertura. Ese estilo de
prueba —relación entre constantes, no ejemplos— es lo único de esta página que
sobrevive a un cambio de equipo.

## 6. ¿Toda cifra afirmada está CALCULADA, o estimada de memoria?

Aplica a lo que se le dice al usuario y a lo que se escribe en un PR, no sólo al
código.

Mordió el 2026-09-11 sin ser un defecto de código: se afirmó «4 tandas ≈ 840 s»
cuando eran 5 ≈ 906 s — no se contó que la primera tanda es conservadora ni que
el solapamiento agrega una. La cuenta estaba al alcance de la mano y no se hizo,
y esa cifra fijó una expectativa que después se incumplió.

Si una cifra va a sostener una decisión, se muestra la cuenta.

## 7. ¿La muestra con la que se midió es representativa, o es el peor caso?

Mordió el mismo día, al medir la rotura de JSON por tamaño de tanda: los tres
recortes se centraron en la zona de paradigmas —el contenido con más tablas y
más hebreo del libro— y dieron 0 de 2 limpios a 43 páginas. En producción, con
contenido mezclado, 3 de 5 tandas de ese tamaño parsearon limpio.

Concluir de ahí habría bajado un límite real por evidencia sesgada. **Decir de
dónde salió la muestra es parte del resultado.**

## 8. ¿Este código ESTIMA lo que hace otro código? ¿Se escribió leyendo a ese otro código?

Un medidor, un presupuesto, una vista previa, un «esto va a costar N»: todos
modelan a un consumidor que vive en otro archivo. Se escriben **leyendo al
consumidor de punta a punta** —qué recibe, qué recorta, qué tope aplica— y una
prueba los compara con el consumidor real, no con una copia de su cuenta.

Mordió en **#730**. El medidor del corpus sumaba todas las hojas elegidas como
si viajaran enteras; el analizador las consulta por versículo con un tope de
100.000 (`retrieveCurated` → `selectForPrompt`). Marcaba 129% con ~130.000
caracteres por versículo, y el autor sacó del trabajo fuentes que no hacía
falta sacar. La pregunta exacta —«qué se manda de verdad por paso»— estaba
anotada en la bitácora del ejercicio ANTES de escribir el medidor, y no se
contestó.

Si hay una pregunta abierta anotada sobre esa zona, se contesta antes de
escribir código.

## 9. Lo que se le dice al usuario que VA A PASAR, ¿se comprobó contra datos y código?

«Esto lo baja», «esto no falla», «con esto se arregla»: son predicciones, y
el usuario actúa sobre ellas. Antes de darlas se mide con datos reales (de sólo
lectura) y se lee el código que decide. En la respuesta, cada afirmación de
efecto dice de dónde sale: **medido** (con la cifra), **leído** (archivo:línea)
o **supuesto** (y entonces se ofrece medirlo).

Mordió dos veces el mismo día (Jonás 4:5-11, 2026-10-02): «volver a guardar
Burt y Sassom baja el 123%» —el medidor que se acababa de escribir no contaba
esos fragmentos— y «pasar Calvino y Fretheim a páginas lo baja» —subió a 129%—.
Las dos cuentas estaban a una consulta de distancia. Y al probar un arreglo,
una aserción que no podía fallar pasó en verde: **toda prueba nueva se rompe a
propósito una vez** (mutación a mano) para ver que falla.

---

## Lo que esta lista NO reemplaza

El `compliance_gate.md` sigue siendo el gate de reglas duras (i18n, tokens de
color, capas, tamaño de archivo). Esto es otra cosa: busca la clase de defecto
que **pasa** todos los gates porque nada falla.
