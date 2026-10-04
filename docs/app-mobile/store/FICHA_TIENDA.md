# Ficha de tienda — Dos Filos Preach (tablet)

Material para App Store Connect y Google Play Console (B8 de la fase «Púlpito premium»).

La v1 es **sólo tablet** (decisión D1): iPad en App Store y tablets en Play. Los textos no exponen «IA» (regla de copy del proyecto) ni hablan de precios. La app no vende nada dentro de ella, y la ficha no puede llevar a comprar.

---

## 1. Textos

### Español (principal)

- **Nombre (30):** Dos Filos Preach
- **Subtítulo (App Store, 30):** Predica desde tu tablet
- **Descripción corta (Play, 80):** Tu sermón en el atril: páginas que no cortan la idea, reloj y Biblia a mano.
- **Texto promocional (App Store, 170):** Prepara tus sermones en Preach y predícalos desde la tablet: sin conexión, con tu reloj, tus marcas y la Biblia al costado.
- **Descripción:**

> Dos Filos Preach lleva al púlpito los sermones que preparas en Preach.
>
> **Pensado para predicar, no para leer en el escritorio**
> • Cada página termina donde termina una idea: nunca a mitad de oración.
> • Letra a tamaño de atril, cinco modos de luz (incluido uno para pantallas de tinta electrónica) y una línea que te devuelve al renglón cuando levantas la vista.
> • Pasa de página tocando el borde o deslizando. La pantalla no se apaga mientras predicas.
>
> **El tiempo, bajo control**
> • Un reloj que reparte el tiempo entre los movimientos del sermón y te muestra si vas a tiempo.
> • Un aviso que sólo sientes en la mano, sin sonido, cuando te acercas al final.
> • Al bajar del púlpito, cuánto duró cada movimiento contra lo que tenías previsto.
>
> **Tu sermón, también sin conexión**
> • Prepáralo el sábado y el domingo predícalo aunque la iglesia no tenga WiFi.
>
> **Tus marcas y la Biblia, a mano**
> • Subraya, resalta y escribe con el lápiz sobre el sermón. Tus marcas se guardan en tu cuenta.
> • La Biblia (RVR1960 y ASV) dentro del sermón, con búsqueda y texto en paralelo.
> • Las citas de tus fuentes, a un toque.
>
> **Tus planes de predicación**
> • El plan de la serie con lo que ya predicaste y lo que sigue.
>
> Para usar la app necesitas una cuenta de Preach. Los sermones se preparan en Preach desde tu computadora.

- **Palabras clave (App Store, 100):** sermón,predicar,pastor,púlpito,iglesia,biblia,predicación,homilética,atril,culto
- **URL de soporte:** https://app.preach.dosfilos.com
- **URL de marketing:** https://preach.dosfilos.com (confirmar)
- **URL de la política de privacidad:** https://app.preach.dosfilos.com/privacy
- **URL de borrado de cuenta (Play, «Data safety»):** https://app.preach.dosfilos.com/delete-account

### English

- **Name:** Dos Filos Preach
- **Subtitle:** Preach from your tablet
- **Short description (Play):** Your sermon on the pulpit: pages that never cut an idea, a clock and the Bible.
- **Promotional text:** Prepare your sermons in Preach and preach them from your tablet: offline, with your clock, your marks and the Bible beside you.
- **Description:** translation of the Spanish one, same structure, no AI mentions, no prices.
- **Keywords:** sermon,preach,pastor,pulpit,church,bible,preaching,homiletics,lectern,worship

---

## 2. Categoría y clasificación

- **Categoría:** Libros / Referencia (App Store: *Reference*; Play: *Books & Reference*). Alternativa: Productividad.
- **Clasificación de contenido:** sin violencia, sexo, apuestas, contenido generado por otros usuarios visible para terceros, ni compras. App Store 4+; IARC «Todos».

---

## 3. Privacidad (App Store) y seguridad de datos (Play)

Sale del código; ver `docs/app-mobile/FASE_PULPITO_PREMIUM_2026-10.md` §3.

| Dato | Para qué | Vinculado a la persona | Rastreo |
|---|---|---|---|
| Correo y nombre (cuenta, Google/Apple) | Funcionamiento de la app | Sí | No |
| ID de usuario | Funcionamiento de la app | Sí | No |
| Contenido del usuario: sermones, marcas, tinta, registro de predicación (puede incluir un lugar escrito a mano) | Funcionamiento de la app | Sí | No |
| Datos de fallos (Crashlytics) | Diagnóstico | No (sin uid ni correo) | No |
| Datos de rendimiento | No se recogen | — | — |
| Ubicación, contactos, fotos, micrófono | No se recogen | — | — |

- **Cifrado en tránsito:** sí (HTTPS / Firebase).
- **Borrado:** sí. Desde la app (Perfil → «Eliminar mi cuenta») y desde la URL de borrado.
- **Rastreo / ATT:** no hay. La app no usa IDFA ni publicidad.

---

## 4. Acceso para la revisión

Los revisores no pueden crear una cuenta en la app (el registro se hace en la web y cobra).

**Hace falta una cuenta demo** con:
- 3-4 sermones publicados en una serie;
- un plan de predicación activo;
- uno de los sermones preparado sin conexión.

Sus credenciales van en *App Review Information* (App Store) y en *App access* (Play).

**Pendiente del fundador:** crear la cuenta. Es una escritura en producción y requiere tu OK.

**Notas para el revisor (borrador):**

> Dos Filos Preach es la app complementaria de Preach (web) para predicar desde una tablet. Los sermones se crean en la web; la app los muestra en modo atril. Para revisarla, inicia sesión con la cuenta demo de arriba, abre «Sermones», elige uno y toca «Modo púlpito». Para probar sin conexión, activa el modo avión después de abrir el sermón «…» (ya está guardado). La cuenta se puede eliminar desde Perfil → «Eliminar mi cuenta».

---

## 5. Capturas

Se generan con la app real en el dispositivo. No hay simulador con sesión disponible en esta máquina.

**App Store:** iPad 13" (2064 × 2752), obligatorio por ser sólo tablet. 5 capturas:
1. El atril con un sermón real y el tablero (reloj y riel).
2. El atril en modo atril (oscuro), con una marca y una cita abierta.
3. La Biblia al costado del sermón.
4. El inicio con «Próximo a predicar» y el plan.
5. El informe de tiempos al salir del púlpito.

**Play:** tablet de 10" (mínimo 1080 px en el lado corto), las mismas 5, más la imagen destacada de 1024 × 500.

---

## 6. Envío

- **App Store Connect:** crear la app (`com.dosfilos.preach`, Team `9UHZPU2WCK`) y anotar su `ascAppId` en `eas.json` → `submit.production.ios`.
- **Play Console:**
  - Crear la app.
  - Hacer la primera subida a mano (AAB de `eas build -p android --profile production`).
  - Dejar la cuenta de servicio en `packages/mobile/play-service-account.json` (gitignoreada).
- **Prueba cerrada (supuesto):** si la cuenta de Play es personal y se creó después de noviembre de 2023, Play exige una prueba cerrada con 12 testers durante 14 días antes de pasar a producción.
