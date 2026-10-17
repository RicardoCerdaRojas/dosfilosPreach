# Fase: barra única y contenido a todo el ancho · octubre 2026

> **Estado: APROBADA (2026-10-17).** La primera etapa estrena la barra en la Biblioteca. **El resto de las páginas queda pendiente de migrar** (ver «Adopción»).
>
> Maqueta: https://claude.ai/artifact/2cR71H9DuRQzZxmpyQXKi8

## Por qué

El fundador pidió un encabezado discreto, sin títulos redundantes ni bajadas explicativas, y que el contenido use todo el ancho.

En la Biblioteca, medido en una captura de 1279 px de ancho, la caja de búsqueda de Consultar empezaba a unos 455 px del borde superior: el 45 % del alto de la pantalla. Antes de ella había cuatro capas:

1. la barra de la app (64 px, vacía salvo el menú, el idioma y el tema);
2. el rótulo «Tu entorno · Biblioteca» con el título grande y el botón;
3. las pestañas;
4. «Pregúntale a tus libros» con su bajada.

El contenido se cortaba en 1280 px (`max-w-7xl`).

## Decisiones del fundador

1. **La barra única es de toda la app.** Cada página pone ahí su título, sus pestañas y sus botones. Se estrena en la Biblioteca y las demás páginas se migran después; mientras tanto, siguen como están.
2. **El historial de Consultar es plegable.** Está abierto por defecto en pantallas anchas y se recuerda en el navegador.
3. **Los botones llenos usan un tono «sólido» del primario.** Es una variable de cada tema (`--primary-solid`) y no un color fijo, para que funcione al cambiar de tema. Con `--primary`, el texto blanco daba:
   - 2,6:1 en el tema verde;
   - 2,9:1 en el naranja;
   - 4,0:1 en el violeta.

   AA pide 4,5:1. El acento (`--primary`) no cambia.

## Lo que se hace (etapa 1, un PR)

### 1. Contraste de los botones
- **`--primary-solid` en cada tema**, en claro y en oscuro: índigo igual, violeta 58 %, verde 28 % y naranja 38 % de luminosidad. En Tailwind es `bg-primary-solid`.
- **El botón base** (`Button`, variante por defecto) y el `Badge` lo usan.
- **Los botones hechos a mano** que pintaban texto sobre `bg-primary` también lo usan: unos 40 archivos.
- **Una prueba** lee `index.css` y exige AA en cada tema; con el verde de antes falla.

### 2. La barra única
- **La barra de la app pasa a 52 px.** De izquierda a derecha:
  - el menú;
  - un espacio que llena cada página con `<BarraDePagina titulo dato controles acciones>`, montada por portal sobre el contexto que ofrece `DashboardLayout`;
  - **idioma y tema en un solo botón** (`PreferenciasDeVista`).
- **Una página que no usa `BarraDePagina`** deja ese espacio vacío y se ve como antes.

### 3. Biblioteca
- **Barra:** «Biblioteca · N recursos · N listos», las vistas Mis libros / Consultar como control segmentado y, en Mis libros, la pastilla de avisos y «Agregar recurso».
- **Fuera:** el encabezado editorial (`LibraryHeader`, borrado) y las pestañas en su propia fila.
- **Avisos de estado en una pastilla** «N avisos» (`AvisosDeLaBiblioteca`) que abre la lista con sus botones: por procesar, extrayendo, índice fallido, extracción fallida y sin calibrar.
  - El saldo y el aviso de metadatos quedan a la vista. El de metadatos guarda estado propio y se perdería al cerrar la pastilla.
- **Todo el ancho**, y 5 columnas de libros en 2xl.
- **Consultar:**
  - el título y la bajada sólo aparecen la primera vez (sin consultas guardadas), con los ejemplos;
  - las notas bajo la caja pasan a un ⓘ en la barra de consulta;
  - el historial es plegable;
  - el botón negro «Nueva consulta» pasa a ser un «＋ Nueva» chico en el encabezado del historial;
  - dentro de una conversación, la nota del costo sigue bajo la caja fija de abajo: no empuja nada.

## Adopción: lo que falta (pendiente)

Cada página que hoy tiene su propio encabezado (rótulo, título grande, bajada o botones en una fila aparte) debe pasar a `BarraDePagina` y, donde corresponda, a todo el ancho. Por orden de uso:

| Página | Ruta | Encabezado hoy |
|---|---|---|
| Inicio | `/dashboard` | rótulo + título editorial |
| Sermones | `/dashboard/sermons` | título + botones |
| Exégesis (trabajos) | `/dashboard/exegesis` | barra propia `max-w-7xl` + título |
| Planes y series | `/dashboard/plans` | título + botones |
| Facultad y su biblioteca | `/dashboard/faculty`, `/dashboard/faculty/library` | encabezado de proyecto propio |
| Proyectos | `/dashboard/projects` | título + vacío propio |
| Tutores de griego y hebreo | `/dashboard/greek-tutor`, `/dashboard/hebrew-tutor` | encabezado propio |
| Suite de enseñanza | `/dashboard/teaching-suite` | rótulo + título editorial, `max-w-7xl` |
| Configuración | `/dashboard/settings` | título + pestañas |
| Administración | `/dashboard/admin/*` | títulos con flecha «volver» |

Las pantallas completas (Biblia, planificador, generador, detalle de sermón, selector de hojas) se miran una por una: algunas no deben tener título en la barra.

**Regla para migrar:**
- el título va chico en la barra y no se repite en la página;
- las pestañas de la vista van en `controles`;
- los botones de la página van en `acciones`;
- las bajadas explicativas pasan a un ⓘ o al estado vacío;
- el contenedor deja `max-w-7xl`, y los textos largos conservan su medida de lectura.

## Riesgos

- **Una página que se monte sin `DashboardLayout`** (pruebas, rutas públicas) no muestra su `BarraDePagina`. Así está pensado; esas páginas no la usan.
- **Ancho angosto:** el dato junto al título se oculta bajo `sm` y el botón «Agregar» queda sólo con su ícono.
- **Botones hechos a mano con otras combinaciones** de `bg-primary` (sin `text-primary-foreground`) no se tocaron. Si alguno lleva texto blanco, se migra al verlo.
