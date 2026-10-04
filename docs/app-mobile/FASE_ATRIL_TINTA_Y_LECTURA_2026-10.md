# Fase «Atril: tinta y lectura»

Abierta el 2026-10-04, después de la primera prueba del fundador en su iPad con la Etapa C instalada (build `preview`). Pedido textual:

1. En la Biblia la goma no funciona. En el sermón borra un trazo y después ya no borra.
2. La tinta no tiene «limpiar todo», el ícono de la goma parece un lápiz, y le faltan funciones para ser premium. Las marcas tienen que quedar en la pantalla o sección donde se hicieron, y conservarse.
3. Revisar la lectura y el avance en el atril: a veces la página tiene 1/4 de texto y a veces está casi llena. Analizar técnicas de discurso y herramientas de este tipo para proponer mejoras.

Cada afirmación lleva su rótulo: **medido** (se ejecutó o se ve en las capturas del fundador), **leído** (se vio en el código) o **supuesto**.

---

## 1. Lo que está roto, y por qué

### T-1 · La goma deja un trazo que no se puede borrar (Biblia y sermón) — leído

`InkLayer` dibuja un **trazo puente** al soltar el dedo, para tapar el cuadro vacío hasta que la nota guardada aparece en pantalla. El puente se muestra mientras el total de trazos sea **menor o igual** al que había al soltar.

Cuando la goma borra un trazo, el total baja, y el puente del último trazo dibujado **reaparece**. Ese trazo no existe como nota, así que la goma no lo encuentra:
- **En la Biblia**, si se dibuja una raya y se borra, la raya «vuelve» en el mismo lugar: parece que la goma no funciona.
- **En el sermón**, se borran los otros trazos y el último queda pegado.

Es exactamente lo que describe el fundador.

### T-2 · Arrastrar la goma puede borrar trazos vecinos — leído

Cada movimiento del dedo borra «el trazo número *i* de la nota» antes de que la pantalla se vuelva a dibujar. El mismo toque repite el mismo número, y como los números se corren al borrar, se llevan puestos otros trazos.

### T-3 · En la Biblia la tinta no acompaña al texto cuando se desplaza — leído

Los versículos se miden en coordenadas de **pantalla** una sola vez, y la capa de tinta está fija encima de la lista que se desplaza. Al bajar en el capítulo, el texto se mueve y la tinta se queda donde estaba. En el sermón no pasa, porque las páginas no se desplazan.

### T-4 · La tinta del sermón se ancla al párrafo entero — leído

Hoy está bien porque un párrafo nunca se parte entre páginas. Si la paginación pasa a partir párrafos (propuesta L-1), una nota escrita en la segunda mitad de un párrafo largo quedaría dibujada en la página donde el párrafo *empieza*. Hay que anclar a la **oración**.

### R-1 · Texto ensuciado en el atril — medido en las capturas

- `&#x20;` literal al final de oraciones. El editor web guarda así un espacio final, y la limpieza de markdown del atril no decodifica entidades HTML.
- `\[...]` con la barra invertida: no se quitan los escapes de markdown.
- Un `*` solo al final de una página: una línea con sólo el asterisco se toma como párrafo.

### R-2 · Páginas a medio llenar — medido en las capturas, causa leída

La paginación trata cada **párrafo entero** como una pieza que no se parte, y un subtítulo arrastra al párrafo que le sigue. Si un párrafo largo no entra en lo que queda, pasa entero a la página siguiente y deja 1/3 o 2/3 en blanco. En la captura de «Cita de autoridad» → «Ilustración» queda el 60 % vacío.

Además, cada movimiento empieza en una página nueva, así que la última página de cada movimiento también suele quedar corta.

La regla del atril es que **la página no corta una oración**, y eso no exige que no corte un párrafo. Hoy se está aplicando una regla más dura que la necesaria.

---

## 2. Lo que dicen las técnicas de discurso y las herramientas del oficio

No es teoría para adornar: cada punto termina en una propuesta.

**Leer, levantar la vista, decir.** La práctica de quien lee en público es leer una frase, levantar la vista y decirla mirando, y después volver al texto por la siguiente ([teleprompter.com](https://www.teleprompter.com/blog/how-to-read-a-teleprompter-naturally-and-engage-your-audience), [GoTranscript](https://gotranscript.com/public/read-from-a-teleprompter-naturally-5-practical-tips)). El costo está en **volver**: encontrar dónde se iba. → **L-3 (foco de lectura)** y **L-2 (marca de reanudación)**.

**Leer unas palabras por delante.** El ojo va adelante de la voz ([teleprompter.com](https://www.teleprompter.com/blog/how-to-read-a-teleprompter-naturally-and-engage-your-audience)). Una página que termina en blanco obliga a pasar antes de tiempo, y una página cortada en el medio de una idea obliga a pasar en el peor momento. → **L-1 (paginación por oración)**. El asomo de la página siguiente que ya existe sirve justamente para esto.

**Frases cortas, pausas intencionales.** Partir el texto en renglones de sentido construye la pausa ([GoTranscript](https://gotranscript.com/public/read-from-a-teleprompter-naturally-5-practical-tips)). → Ya existe: colometría (D6).

**Marcar el manuscrito para mirar a la gente.** La homilética recomienda marcar en el manuscrito los lugares donde levantar la vista, con un punto y una flecha hacia dónde mirar, y hacer contacto con personas de distintos sectores ([Ministry Magazine](https://www.ministrymagazine.org/archive/2017/09/Effective-sermon-delivery)). También recomienda resaltar palabras clave y dejar el texto espaciado ([Scribd: Manuscript Delivery](https://www.scribd.com/presentation/689963285/Manuscript-Delivery)). → Ya existe: glifo ◉ «mirar», resaltado, interlineado. Falta que el foco (L-3) se apoye en esas marcas.

**Lo que hacen las apps de partituras.** Son el pariente más cercano del atril: un músico lee, toca y no puede soltar las manos. forScore, la referencia en iPad, tiene ([forscore.co](https://forscore.co/?p=1415), [App Store](https://apps.apple.com/app/id363738376)):
- **media página** al pasar, para no perder el contexto;
- **pedal Bluetooth** para pasar con el pie;
- anotaciones en **capas** que se muestran u ocultan;
- **sellos** con los símbolos del oficio.

→ **L-4 (pasador Bluetooth)**, **T-8 (mostrar u ocultar la tinta)**. Los sellos ya los tenemos como glifos.

---

## 3. Propuestas

### Lectura y avance

| # | Propuesta | Por qué | Costo |
|---|---|---|---|
| **L-1** | **Paginación por oración.** La página se llena hasta la última oración que entra. Un párrafo puede seguir en la página siguiente, nunca a mitad de oración. Un subtítulo no queda solo al pie: necesita al menos 2 renglones de su texto. | Arregla R-2: páginas llenas y parejas. | Medio: dominio (`packPages`) + medición por oración + anclaje de tinta por oración (T-4). |
| **L-2** | **Marca de reanudación.** Al pasar página, la primera línea, que es la que se veía en el asomo, lleva una marca breve en el margen. | El ojo baja del público y sabe dónde seguir. | Bajo. |
| **L-3** | **Foco de lectura** (opcional). El párrafo en curso queda a pleno contraste y el resto un poco atenuado. Avanzar mueve el foco al siguiente párrafo, y en el último pasa la página. | Volver del público al lugar exacto es lo que más cuesta al leer en público. | Medio. Cambia qué hace el toque «adelante» cuando está encendido: por eso va como opción. |
| **L-4** | **Pasador Bluetooth / pedal.** Pasar página con el control de diapositivas o un pedal (AirTurn y similares mandan teclas de flecha). | Manos libres: el pastor no camina al atril para tocar la pantalla. | Medio-alto: hace falta un módulo nativo para escuchar teclas (build nuevo). Supuesto: en iPad funciona con los pasadores comunes. Verificar con uno. |
| **L-5** | **Movimientos de corrido** (opcional). Si en la última página de un movimiento queda más del 40 % libre, el siguiente empieza ahí, con su título como separador. | Se acaban las páginas de cola casi vacías. | Medio: el reloj y el riel hoy cuentan una página por movimiento. |
| **L-6** | **Texto limpio** (R-1): entidades, escapes, líneas sueltas. | Defecto. | Bajo. |

### Tinta

| # | Propuesta | Costo |
|---|---|---|
| **T-1/2** | Arreglar la goma: sin trazo puente fantasma, y cada trazo se borra una sola vez por gesto. | Bajo. |
| **T-3** | La tinta de la Biblia se mueve con el texto (capa dentro de la lista que se desplaza, medidas relativas al texto). | Medio. |
| **T-4** | Tinta anclada a la oración (requisito de L-1). Se conserva al cambiar el tamaño de letra, la familia o el modo, y al editarse el sermón en la web (reancla por texto, como hoy). | Medio. |
| **T-5** | **Barra de tinta clara:** ícono de goma de verdad, estado visible de qué herramienta está activa, y **deshacer / rehacer**. | Bajo. |
| **T-6** | **Limpiar:** borrar la tinta de esta página o de todo el sermón (capítulo, en la Biblia), con confirmación y deshacer. | Bajo. |
| **T-7** | **Resaltador a mano:** trazo ancho translúcido, además del lápiz, con dos grosores. | Bajo. |
| **T-8** | **Mostrar u ocultar la tinta** con un toque, sin borrarla, para predicar con el texto limpio. | Bajo. |
| **T-9** | **Sólo el Apple Pencil escribe** (opcional): con el lápiz activo, el dedo sigue pasando página. Hoy el dedo dibuja. | Medio. Supuesto: `react-native-gesture-handler` informa el tipo de puntero; verificar en el iPad. |

---

## 4. Orden propuesto

1. **Primero los defectos** (T-1/2, R-1/L-6, T-3): el pastor no puede predicar el domingo con una goma que no borra.
2. **L-1 con T-4**: páginas llenas, sin perder la tinta.
3. **Tinta premium**: T-5, T-6, T-7, T-8.
4. **Lectura**: L-2 y, si se aprueban, L-3, L-5 y T-9.
5. **L-4 (pasador)** al final, porque pide build nativo y un dispositivo de prueba.

Todo en un PR, un commit por unidad, con revisión adversarial antes de abrirlo. Las unidades que son sólo JS pueden llegar al iPad por actualización OTA (`expo-updates` con `fingerprint`); L-4 y T-9 piden build nuevo.

## 5. Decisiones del fundador (2026-10-04)

**Entran:**
- todos los arreglos;
- la tinta premium (T-5 a T-8);
- L-1 y L-2;
- **L-3** foco de lectura, **L-5** movimientos de corrido y **T-9** sólo Apple Pencil, los tres como opciones.

**Queda para después:** **L-4** (pasador Bluetooth).

## 6. Estado

**Hecho en esta fase:**
- T-1/T-2, R-1, T-3, L-1 + T-4, T-5 a T-8, L-2, L-3 y T-9;
- de paso, la selección de la Biblia, que también perdía la posición al desplazar.

**L-5 (movimientos de corrido): aplazado, con razón.**
- Hoy cada movimiento se pagina por separado. La tinta, las marcas, los glifos, el reloj y la sesión ubican todo por posición dentro del texto de ESE movimiento.
- Que el siguiente empiece en la misma página obliga a paginar el sermón entero de una vez. Además, esas cinco piezas tendrían que convivir con dos movimientos en pantalla: es una reforma de casi todo el atril.
- Con L-1 las páginas dentro de un movimiento ya salen llenas. Quedan cortas sólo las de cierre de cada movimiento, que además marcan la estructura del sermón.
- Se propone como fase propia («paginación del sermón entero»), si después de probar L-1 en el iPad las colas cortas siguen molestando.

**T-9:** sólo en el atril. En la Biblia el dedo tendría que desplazar el capítulo por debajo de la capa de tinta.

