import * as pdfjsLib from 'pdfjs-dist';

/**
 * Configura el worker de pdf.js UNA vez, para toda la aplicación.
 *
 * Existe porque estaba configurado en dos pantallas y faltaba en una tercera,
 * y el efecto de esa falta no era un error sino un SILENCIO. El diagnóstico
 * previo de la biblioteca —el que dice si un PDF es un escaneo y qué motor
 * conviene— llamaba a `getDocument` sin worker, la llamada tiraba excepción, su
 * `catch` la traducía a «no se pudo leer», y la pantalla simplemente no mostraba
 * nada. La recomendación de motor quedaba muerta sin que nadie lo notara.
 *
 * Peor: dependía del ORDEN DE CARGA. Las otras dos pantallas fijan el global al
 * evaluarse su módulo, así que si el usuario pasaba antes por el selector de
 * páginas el diagnóstico funcionaba, y entrando directo a la biblioteca no. Un
 * defecto que aparece o no según por dónde entraste es de los que sobreviven a
 * las pruebas.
 *
 * El worker se empaqueta con la app en vez de traerse de un CDN: para que una
 * pantalla funcione no hace falta depender de un tercero.
 */
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

export { pdfjsLib };
