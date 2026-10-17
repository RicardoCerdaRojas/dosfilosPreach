# Fase: el reproceso en lote desde el panel de super admin · octubre 2026

> **Estado: APROBADA (2026-10-17).** Orden: tercera. Los PDF cifrados de más de 60 MB se rechazan con aviso, como en la subida.

## Por qué

El reproceso en lote (Gemini Batch, a mitad de precio) mejoró de verdad la biblioteca:
- `biblioteca2`: la calidad pasó de 4,8 a 8,7.
- Las gramáticas y el léxico de hebreo pasaron de 2–5 a 9,3–9,6.

Pero hoy sólo se puede correr desde una terminal, con `scripts/reprocesar-en-lote.ts`, y su estado vive en archivos locales. El fundador pidió manejarlo desde el panel.

## Lo que se relevó (2026-10-17)

- **La lógica ya es reutilizable.** Las decisiones son puras y están probadas en `loteDeExtraccion.ts`: tramos, lectura de respuestas, páginas en blanco, relleno con la capa de texto y comparación vieja contra nueva. Falta mover el estado (de archivos locales a Firestore y Storage) y la orquestación (a tareas en cola y a un sondeo programado).
- **Preparar no cabe en una sola invocación.** Preparar 30 libros tardó **23 minutos** (medido) y una invocación dura como mucho 15. Va **una tarea por libro**.
- **Memoria.** Ninguna función pasa hoy de 2 GiB. Un PDF de 250 MB con pdf-lib y pdfjs dentro de 2 GiB es dudoso. Para descifrar con qpdf hace falta unas 12 veces el tamaño del archivo.
- **Costo medido en los lotes reales:** unos **US$2 cada 1.000 páginas**. Va de US$1,95 a US$2,23, más un 10 a 30 % de reintentos. Desde el 2027-01-01 el precio del modelo se duplica.
- **Huecos del script que el servidor no debe heredar:**
  - no registra el gasto, que no aparece en el panel de costos;
  - `aplicar` no comprueba que el libro no se esté extrayendo ni que el PDF no haya cambiado;
  - empareja las respuestas por posición;
  - no tiene un candado contra dos ejecuciones simultáneas.
- **Plantilla para la pantalla:** el panel de extracción (`ExtractionRunsDashboard`) tiene página delgada, hook con react-query, función pura con pruebas y subtablas.

## Lo que se hace (tres PR, cada uno se prueba en la pantalla)

### PR 1. Ver, auditar y estimar (no gasta ni escribe)

Página **Admin → Reproceso en lote**:
- **Candidatos:** los libros de una biblioteca (la tuya por defecto). De cada uno muestra:
  - las páginas que faltan;
  - si el texto quedó vacío;
  - si lo leyó un modelo viejo y con qué versión;
  - si ya se reprocesó;
  - su tamaño y si está cifrado.

  Ordenados por lo que más conviene reprocesar. Al elegir libros se ve el **costo estimado en vivo**: el de lote y, para comparar, el de en línea.
- **Lotes:** los lotes pasados con su costo y su resultado. Sólo lectura.

Mientras tanto, el botón «Copiar comando» arma el `preparar …` para la terminal.

### PR 2. Lanzar y seguir

- **«Preparar lote»,** con la confirmación del costo. Una tarea por libro baja el PDF, lo descifra si hace falta, corta los tramos y los sube. La última tarea crea el lote.
- **Un sondeo cada 10–15 minutos** recoge lo que terminó, guarda las páginas en Storage (un archivo por ronda), **registra el gasto con el descuento de lote** y borra los archivos subidos.
- **Detalle del lote:** tramos por estado, rondas, costo real y los botones «Reintentar» (parte y repite lo que falló) y «Cancelar».
- **Estado en `admin_lotes/{id}`** (sólo el super admin lo lee y sólo el servidor lo escribe), con un candado para que el sondeo y un botón no corran a la vez.

### PR 3. Aplicar desde la pantalla

- **Por libro:** la comparación entre la versión actual y la nueva (páginas que faltan, hebreo, griego y el motivo).
- **«Aplicar»** de a uno o todos. Antes de escribir comprueba que el libro no se esté extrayendo, que el PDF siga siendo el mismo y que el libro exista. Guarda un respaldo, escribe y reindexa.
- **Queda registro:** el cambio entra en el registro de auditoría y en una ficha en `extraction_runs`.

## Lo que queda abierto (para decidir)

- **PDF cifrados de más de 60 MB:** rechazarlos como hace la subida (recomendado), o dar más memoria a esa tarea (4–8 GiB).
- **Bibliotecas:** si la página muestra sólo la tuya o la de cualquier usuario, para el soporte.

## Riesgos que fija el diseño

- **Tiempo:** nunca un callable largo; una tarea por libro.
- **Memoria:** los PDF grandes.
- **Pasos repetibles:** Cloud Tasks reintenta, así que repetir un paso no puede duplicar nada.
- **Lotes huérfanos:** cada lote lleva un nombre que se puede encontrar si algo se corta antes de guardarlo.
- **El barrido de 20 minutos** marca como fallido un libro que queda «en proceso» sin dar señales. Al aplicar, ese estado dura apenas un instante.
