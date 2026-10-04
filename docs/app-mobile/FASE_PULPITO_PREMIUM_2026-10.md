# Fase «Púlpito premium»: de la tablet de prueba a las tiendas

Análisis del 2026-10-03 sobre `main` (`fe73ff42`), pedido por el fundador: revisar la app mobile (Púlpito, `packages/mobile`), su estado y sus funciones, y planear las mejoras para una versión premium y usable antes de publicarla en App Store y Google Play.

El análisis se hizo leyendo el código y ejecutando los chequeos; **no se probó en un dispositivo**. Cada afirmación lleva su rótulo: **medido** (se ejecutó), **leído** (se vio en el código) o **supuesto** (inferencia o política de tienda).

Plan anterior y decisiones vigentes: `docs/app-mobile/pulpito-plan.md` (M-01…M-09, roadmap F0–F4).

---

## 1. Estado en una página

**Lo que ya es bueno.** La app tiene más producto del que dice el plan: F1 completo y buena parte de F2 y F3.
- **Atril:** paginación que no corta oraciones, presupuesto por movimiento, riel de tiempo y línea de vuelo.
- **Lectura y marcas:** cinco modos de luz, subrayado por palabra sincronizado con Firestore y tinta con Skia.
- **Biblia:** RVR1960 y ASV con búsqueda, paralelo, marcas y tinta.
- **Planes de predicación** y un tablero de inicio con datos reales.

El código está sano en lo básico (medido):
- Typecheck con 0 errores.
- Lint con 0 errores y 21 advertencias.
- Sin copy que exponga «IA».
- Sin secretos en el bundle.

**Lo que impide publicarla hoy.** Cuatro motivos de rechazo seguro en las tiendas y un login roto en Android (§3.2). Además, la promesa central del producto, **«el domingo sin WiFi no falla»**, hoy no se cumple (§3.1).

**Lo que la separa de «premium».** Defectos que un pastor notaría en el púlpito:
- Un doble toque apaga la pantalla.
- El botón «atrás» de Android sale sin registrar la predicación.
- El cronómetro se pierde al bloquear la pantalla.

También hay errores que se muestran como «no tienes sermones», una Biblia que traba la escritura al buscar y cero pruebas automáticas en mobile.

**Hallazgo fuera de la app, de toda la plataforma (P0).** La regla de Firestore deja a cualquier usuario con sesión listar los sermones de **todos** los usuarios (§3.0). Se arregla antes que todo lo demás, en su propio PR.

---

## 2. Inventario funcional

### 2.1 Pantallas

| Pantalla | Qué hace | Estado |
|---|---|---|
| Ingreso | Email y contraseña, Google y Apple (nonce SHA-256), recuperar contraseña. El registro es sólo web | Funciona. Al fallar, borra el email escrito (leído) |
| Inicio | Próximo a predicar, plan activo, seguir leyendo, marcas recientes, progreso de la serie | **Sin estado de error**: un fallo se ve como «no hay sermones» (leído) |
| Biblia | Lector RVR/ASV, libro y capítulo, paralelo, búsqueda por ámbitos, ajustes, marcas por palabra, tinta, «Llevar al sermón» | Funciona. Búsqueda síncrona en cada tecla (§3.3) |
| Sermones | Publicados por serie, sin duplicar versiones, búsqueda y refresco; dos paneles en pantallas anchas | Funciona, con error y reintento |
| Planes | Planes de la serie, estados deducidos, semanas | **No enlaza los sermones publicados** (§3.1). Sin estado de error |
| Detalle | Lectura de estudio, «Marcar predicado», «Preparar sin conexión», Biblia en cajón, «Editar», «Modo púlpito» | Funciona. El maletín no sirve de respaldo (§3.1) |
| Atril | Paginación, cronómetro, riel, línea de vuelo, citas `[N]`, subrayado, tinta, Biblia en cajón, ajustes, salida con informe y registro | Núcleo sólido. Defectos de gestos, cronómetro y errores (§3.1) |
| Editar (modal) | Título y todo el markdown en un solo campo | Edita la **copia publicada** (§3.4) |
| Pegar pasaje (modal) | Añade un pasaje al final de un sermón | Funciona, sin confirmación |
| Perfil | Modo de lectura, cuerpo, apariencia (incluye tinta electrónica), idioma, cerrar sesión | **Sin borrar cuenta ni privacidad** (§3.2) |
| `dev/preach` | Vista previa sin sesión | Queda accesible en release por deep link (leído) |

### 2.2 Contra el roadmap del plan

| Ítem del plan | Estado |
|---|---|
| Lista real, detalle, atril con 5 modos, cronómetro, `[N]`, Google y Apple Sign-In | HECHO |
| Subrayado por frase (F1) y selección fina (F2) | HECHO, por palabra y anclado por sección |
| Tinta (F2) | PARCIAL: dedo y lápiz por igual, sin rechazo de palma ni modo sólo lápiz |
| **Maletín offline (F2)** | **PARCIAL: guarda una copia que nadie lee** |
| Biblia en SQLite + FTS5 (M-06) | AUSENTE: JSON de 10 MB dentro del bundle; tablas de alias propias |
| Marcas de predicador / glifos (F2) | AUSENTE |
| Teclas de volumen y pasadores BT (F1/F3) | AUSENTE |
| Modo ensayo (F3) | PARCIAL: informe de tiempos en cada salida; no se guarda ni ajusta presupuestos |
| Registro post-predicación (F3) | PARCIAL: existe, pero exige lugar y no recuerda el último |
| Redactor (F4) | PARCIAL mínimo: un solo campo sobre el publicado |
| Beta interna (cierre de F1) | **No hecha.** Nunca se probó fuera del iPad del fundador |
| Pruebas mobile | AUSENTE: 0 archivos de prueba, sin script `test` |

---

## 3. Hallazgos por gravedad

### 3.0 P0 — Seguridad de toda la plataforma

**S0. Cualquier usuario autenticado puede listar todos los sermones.**
- La regla (leído, `firestore.rules:73`) es `allow list: if isAuthenticated() || isSuperAdmin();`. El comentario dice que la consulta lleva `userId`, pero la regla no lo exige.
- Riesgo: desde la consola del navegador, un usuario con sesión puede leer el contenido de los sermones de todos los demás.
- Costo del arreglo (leído, falta probar con el emulador):
  - Las consultas del cliente filtran por `userId == uid` o `isShared == true`. Son las de `FirebaseSermonRepository` y `UsageLimitsService`.
  - El único `findAll` sin filtro no tiene llamadores.
  - La regla puede exigir `resource.data.userId == request.auth.uid || resource.data.isShared == true`.
- No hay prueba de reglas para sermones (`tests/firestore-rules/` sólo cubre `pastoralSeeds`).
- **Va primero, en su propio PR, con pruebas de reglas.**

### 3.1 Bloqueante de producto — el domingo

1. **Sin red no se llega al sermón** (leído).
   - **El maletín no lee lo que guarda.** «Preparar sin conexión» guarda el sermón en AsyncStorage, pero el atril y el detalle leen sólo de Firestore (`getDoc`); la copia sólo pinta el check verde.
   - **La app abierta en frío no lista sermones.** La lista sale de un callable, y la caché de react-query no se guarda en disco.
   - **El atril sin datos queda en un spinner infinito** (`PreachModeScreen.tsx:303`).
2. **Doble toque = pantalla negra** (medido al leer, `PreachModeScreen.tsx:282-293`). Dos toques rápidos para avanzar dos páginas apagan la pantalla frente a la congregación. El plan pedía dos dedos.
3. **«Atrás» de Android sale del atril** sin la hoja de salida (leído: no hay `BackHandler`). Se pierden el informe y el registro.
4. **Cronómetro frágil** (leído).
   - **Arranque manual:** sin play, la predicación no se registra.
   - **Bloqueo de pantalla:** se pierde al bloquearla o al pasar a segundo plano (`setInterval` sin `AppState`).
   - **Objetivo fijo:** 30 min, igual para todos los sermones.
   - **Cambiar la duración** reinicia el reloj y deja el informe incoherente.
   - **Falta el pulso háptico** al 80 % del tiempo.
5. **El registro exige el lugar** (leído, `PreachExitSheet.tsx:208`), aunque el comentario del propio archivo lo declara opcional. Tampoco recuerda el lugar del registro anterior.
6. **Planes sin sermones** (leído, `usePlanBoard.ts:46`). Busca el sermón del plan por el id del **borrador** entre las **copias publicadas**, que lo guardan en `sourceSermonId`. Es el mismo defecto que #728 arregló en la web.
   - **Efecto (supuesto, falta medirlo con datos):** «Púlpito» deshabilitado en el plan y el «próximo a predicar» mal elegido.
7. **Un movimiento sin texto deja la página invisible** (leído, `usePagination.tsx:63`): un `##` sin cuerpo no termina de medirse.
8. **Cerrar sesión no limpia nada** (leído). En una tablet compartida, el siguiente usuario ve las marcas, la tinta y los sermones del anterior.
9. **Errores tragados** (leído).
   - El inicio y los planes muestran «vacío» ante un fallo.
   - Las escrituras fallidas sólo van a `console.warn`.
   - El fallo de «Preparar» no se muestra.

### 3.2 Bloqueante de tienda

| # | Qué | Evidencia | Qué hace falta |
|---|---|---|---|
| T1 | El login enlaza al registro web, que cobra antes de crear la cuenta | `LoginScreen.tsx:25,278-295` (leído) | Quitar el enlace. Apple 3.1.1/3.1.3(f) y la política de pagos de Play lo rechazan (supuesto) |
| T2 | No se puede borrar la cuenta desde la app | `ProfileScreen.tsx:249-262`; `deleteUser` es sólo para super_admin (leído) | Google y Apple **crean** cuentas al ingresar (`signInWithCredential`, leído). Hace falta auto-borrado (Apple 5.1.1(v), Play) |
| T3 | No hay enlace a la política de privacidad ni a los términos | grep (leído) | Enlaces en el ingreso y el perfil; política actualizada con la app y Google/Apple Sign-In |
| T4 | Google Sign-In en Android sin SHA-1 | `google-services.json` sin cliente Android (leído) | Registrar SHA-1 y SHA-256 de EAS y de Play App Signing. Sin eso falla con DEVELOPER_ERROR (supuesto) |
| T5 | Revisión de la tienda con cuenta vacía | Todo el contenido se crea en la web (leído) | Cuenta demo con sermones y planes, con credenciales en las dos consolas |

### 3.3 Importante

- **App Check en builds de tienda.**
  - La lección registrada en byblos (2026-08-28, medida en el iPad) dice que en iOS la librería usa **DeviceCheck** aunque se pida App Attest, y el código muestra que hoy sólo App Attest está registrado (leído, `appCheck.ts:17-18`). Por eso hay que registrar DeviceCheck en la consola. No usar el respaldo `appAttestWithDeviceCheckFallback`, porque esconde el error real.
  - **Play Integrity:** hay que vincularlo en Play Console.
  - **Perfil `preview`:** necesita un token de debug como variable de EAS.
  - **Arranque:** `initAppCheck()` arranca sin esperar a que termine (leído).
- **Sin reporte de errores ni analítica** (leído). No hay Sentry ni Crashlytics. `definicion.md` prescribe Sentry sin datos personales.
- **Biblia.**
  - **Tamaño:** los JSON de 4 y 6 MB son más de la mitad del bundle (medido: `.hbc` de 18 MB). Las dos versiones se cargan al arrancar (leído) y cada OTA baja ~18 MB (supuesto).
  - **Búsqueda:** cuesta 200 ms por tecla en Node con JIT (medido); en Hermes probablemente más de 1 s (supuesto).
  - **Cambio de versión dentro del atril:** con Jonás abierto, cambiar a ASV abre Juan (leído).
  - **Choque de alias:** `Jud` resuelve Jueces o Judas según el camino (medido).
  - **ASV con nombres en español** (leído).
  - **Marcas sin red:** no aparecen hasta reconectar (leído).
- **Licencia de la RVR1960 (decisión del fundador).**
  - La web la presenta como de dominio público (`Credits.tsx:143`). La RVR1960 tiene copyright de Sociedades Bíblicas Unidas (supuesto, conocimiento general).
  - En una app de tienda, una denuncia baja la app.
  - **Hay que confirmar la licencia antes de publicar.** Afecta también a la web.
- **Raíz del monorepo con React Native 0.76 y `overrides` de Expo 52** (medido: `package.json` raíz).
  - Es la trampa que byblos registra para los builds de EAS: el worker usa el binario de la raíz.
  - Hay que limpiarla y medir el fingerprint antes y después.
- **Permisos de Android de más** (leído). `expo-brightness` está instalado sin uso y su plugin agrega `WRITE_SETTINGS`. Falta declarar `android.permissions`.
- **Faltan los materiales de tienda** (leído):
  - Capturas: iPad 13" obligatoria por `supportsTablet`, iPhone y Android.
  - Imagen destacada de Play.
  - Textos ES/EN, URL de soporte y de privacidad, clasificación de contenido.
  - Configuración de `eas submit`.

### 3.4 Calidad y deuda

- **0 pruebas en mobile** (medido). La lógica de dominio que usa la app sí tiene pruebas (512 en verde, medido), pero no hay pruebas de:
  - la paginación del atril;
  - el cronómetro;
  - `sermonSections.ts`, una copia a mano de la web, sin prueba de paridad, de la que depende el anclaje de las marcas;
  - los repositorios de la Biblia;
  - el maletín y la sincronización.
- **Editar en la tablet modifica la copia publicada, no el borrador** (leído). Además, renombrar un `##` deja huérfanas las marcas de esa sección.
- **Pantallas grandes** (medido): atril con 818 líneas, Biblia con 592, inicio con 518. Hay lógica de negocio en pantallas y hooks (leído).
- **Dependencias** (medido, expo-doctor): 19 paquetes atrasados en parches de Expo 57. Sin uso: `expo-brightness`, `expo-image`, `expo-symbols`, `expo-web-browser`, `react-native-gesture-handler` e `i18n-js`.
- **Restos de la plantilla de Expo**, un README desactualizado y textos fijos en español en `+not-found` (leído).
- **Claves de traducción inexistentes:** `common:cancel` hace que el botón «Cancelar» de un diálogo muestre la clave literal (leído).
- **Accesibilidad.**
  - Botones de ícono sin `accessibilityLabel`: inicio 13 de 13, planes 8 de 8, atril 13 de 19 (leído).
  - Sin prueba con texto grande (supuesto).
- **Teléfono.** La app se instala en iPhone y en teléfonos Android, pero el atril y la Biblia no están pensados para 375 pt (supuesto). Por ejemplo, el cajón de la Biblia tiene un ancho mínimo de 380 (leído).

---

## 4. Decisiones que necesito del fundador

**Decididas el 2026-10-04:** Etapa 0 primero, en su propio PR; D1 sólo tablet; D3 pantalla neutra; D5 ocultar «Editar» en la v1. Siguen abiertas D2, D4 (forma), D6, D7 y D8.

| # | Pregunta | Recomendación |
|---|---|---|
| D1 ✅ | **¿Tablet sólo, o también teléfono?** → **Sólo tablet** | **Sólo tablet en la v1** (`ios.isTabletOnly` y equivalente en Play). El producto se diseñó para el atril de 11-13″. En teléfono habría que adaptar el atril y la Biblia, y las tiendas exigirían capturas y revisión en iPhone. El teléfono puede ser una v1.1 |
| D2 | **¿Qué hacemos con la RVR1960?** | Confirmar la licencia con Sociedades Bíblicas. Mientras tanto, preparar el cambio a un texto libre por si hace falta. Bloquea la publicación y alcanza también a la web |
| D3 ✅ | **¿Cómo resolvemos el registro?** → **Pantalla neutra** | Quitar de la app el enlace a la web. Para quien entra con Google o Apple sin cuenta, mostrar una pantalla neutra que no mencione planes ni precios. Además, decidir si se impide crear cuentas sin pago (función de bloqueo) o se permite una cuenta gratuita que sólo lee |
| D4 | **Borrado de cuenta** | Auto-borrado desde Perfil y desde una URL web: borrar datos, cancelar Stripe y revocar el token de Apple. Es obligatorio en las dos tiendas |
| D5 ✅ | **¿Qué editor queda en la v1?** → **Ocultar «Editar»** | **Ocultar «Editar» en la v1.** Hoy edita la copia publicada y rompe las marcas. El Redactor (F4) se hace bien después |
| D6 | **¿Reporte de errores con Crashlytics o con Sentry?** | **Crashlytics.** Ya usamos `@react-native-firebase` y Firebase, no suma otro proveedor y es gratis. Sin datos personales |
| D7 | **¿Quiénes son los beta testers y qué tipo de cuenta de Play tienen?** | 2-3 pastores, con un iPad y una tablet Android cada uno. Si la cuenta de Play es personal y nueva, Play exige una prueba cerrada de 12 testers durante 14 días antes de producción (supuesto): hay que confirmarlo |
| D8 | **¿Qué entra en la v1 y qué queda para después?** | **Para la v1:** gestos seguros, offline real, cronómetro confiable, registro, Biblia rápida y accesibilidad. **Después:** glifos de predicador, modo ensayo con presupuestos aprendidos, pasadores BT y Redactor |

---

## 5. Plan de mejoras

Una etapa por PR y un commit por unidad, como en las fases anteriores. Cada unidad trae sus pruebas y se rompe a propósito una vez (regla de rigor). Lo que sólo se puede comprobar en el dispositivo se marca así: **[dispositivo]**.

### Etapa 0 — Seguridad de sermones (PR propio, inmediato)

- **0.1** Regla `sermons` `list`: exigir la consulta por dueño o compartido. Pruebas de reglas en `tests/firestore-rules/sermons.test.ts` para dueño, ajeno, compartido y super_admin.
- **0.2** Correr las pantallas web que listan sermones contra el emulador (lista, versiones, planes, compartir, límites de uso).

### Etapa A — El domingo no falla (confiabilidad del atril)

- **A1 · Offline real.**
  - Guardar la caché de react-query en disco.
  - Que el atril y el detalle lean del maletín cuando Firestore no responde.
  - Mostrar cuáles sermones están en el maletín en la lista y en el inicio.
  - Permitir volver a preparar y quitar un sermón del maletín.
  - Indicador «sin conexión».
  - Al reconectar, volver a pedir los datos (NetInfo `onlineManager` y `focusManager`).
  - **[dispositivo]:** modo avión con la app cerrada → abrir → predicar.
- **A2 · Errores visibles.**
  - El atril, el detalle y el editor muestran el error con «Reintentar» en vez de un spinner infinito.
  - El inicio y los planes distinguen «vacío» de «falló».
  - Las escrituras fallidas avisan con un toast.
- **A3 · Gestos seguros.**
  - Pantalla negra con doble toque **de dos dedos**, o con un gesto que el pastor no pueda hacer por accidente.
  - `BackHandler` en Android → hoja de salida.
  - Prueba del manejador de toques.
- **A4 · Cronómetro confiable.**
  - Reloj de pared y `AppState`, para que sobreviva al bloqueo y al segundo plano.
  - Arranca solo con el primer avance.
  - Objetivo por sermón: el estimado de `estimateSpokenMinutes`, persistido.
  - Cambiar la duración no reinicia el reloj.
  - Pulso háptico al 80 %.
  - Lógica en dominio, con pruebas.
- **A5 · Registro de la predicación.**
  - El lugar es opcional y se recuerda el último.
  - Umbral razonable (el plan decía 10 min).
  - «Marcar predicado» con deshacer.
- **A6 · Planes enlazan los publicados.**
  - Indexar también por `sourceSermonId` con la regla de dominio de #728.
  - Corregir «Serie en curso» (hoy siempre N de N).
  - **Medir** con los planes reales antes y después.
- **A7 · Paginación.**
  - Un movimiento sin cuerpo se muestra.
  - La primera página descuenta los títulos.
  - Mover `sermonSections` a dominio con prueba de paridad contra la web, porque de esa función depende el anclaje de las marcas.
- **A8 · Cerrar sesión limpio.** Vaciar react-query y el maletín, y poner el uid en las claves de las marcas bíblicas.

### Etapa B — Lista para las tiendas

- **B1 · Ingreso sin llamada a pagar** (según D3): pantalla neutra y sin enlace al registro.
- **B2 · Borrado de cuenta.**
  - Callable de auto-borrado: Firestore, Stripe, Auth y revocación del token de Apple.
  - Botón en Perfil con confirmación.
  - URL web para Play.
  - Pruebas del callable.
- **B3 · Privacidad y términos.** Enlaces en el ingreso y el perfil, y la política actualizada con la app.
- **B4 · App Check y firma.**
  - Registrar DeviceCheck en iOS.
  - Registrar SHA-1 y SHA-256 en Firebase y vincular Play Integrity.
  - Token de debug sólo en `preview`.
  - Esperar a que termine `initAppCheck`.
  - README con el procedimiento.
  - **[dispositivo]:** iPad, tablet Android y BOOX.
- **B5 · Crashlytics** (según D6), sin datos personales, más el manifiesto de privacidad y las declaraciones de datos de las dos tiendas.
- **B6 · Higiene nativa.**
  - Quitar las dependencias sin uso (sobre todo `expo-brightness`) y declarar `android.permissions`.
  - Excluir `dev/preach` de release.
  - Limpiar la raíz del monorepo (React Native 0.76 y `overrides` de Expo 52) **midiendo el fingerprint antes y después**.
  - Actualizar los parches de Expo 57.
  - Quitar los restos de la plantilla.
- **B7 · Tablet sólo** (según D1): configuración de dispositivos en las dos tiendas.
- **B8 · Material de tienda.**
  - Cuenta demo con sermones y planes reales de muestra.
  - Capturas de iPad y de tablet Android generadas con la app real.
  - Textos ES/EN, clasificación de contenido y `eas submit`.

### Etapa C — Premium usable

- **C1 · Biblia rápida y liviana.**
  - Mover los textos a SQLite con FTS5 y descargarlos en el primer uso o empaquetarlos fuera del bundle JS (M-06).
  - Búsqueda indexada, sin trabar la escritura.
  - Corregir el cambio de versión dentro del atril, los alias `Jud` y ASV, y las marcas optimistas sin red.
  - **Medir** el tamaño del bundle y el tiempo de búsqueda antes y después.
- **C2 · Accesibilidad.** Etiquetas en todos los botones de ícono y prueba con el texto del sistema al máximo **[dispositivo]**.
- **C3 · Pulido visual del atril y del inicio.**
  - Revisión pantalla por pantalla con capturas reales en iPad y tablet Android.
  - Modo tinta electrónica verificado en la BOOX: el reloj refresca por minuto y la navegación va sin animaciones.
- **C4 · Pruebas de mobile.** `jest-expo` en CI para la paginación, el cronómetro, los toques, el maletín y los repositorios de la Biblia.
- **C5 · Textos.** `common:cancel`, `+not-found` y los textos fijos.
- **C6 · Partir las pantallas grandes** (atril, Biblia, inicio), sacando la lógica a hooks y dominio. Se hace junto con A y C, no como una unidad aparte.

### Etapa D — Beta y publicación

- **D1 · Beta interna.** TestFlight interno y Play prueba interna o cerrada, con 2-3 pastores durante 2 domingos y un guion de prueba (preparar, modo avión, predicar, registrar).
- **D2 · Corregir lo que salga de la beta.**
- **D3 · Envío a revisión** en las dos tiendas, con la cuenta demo y las notas para el revisor.

### Después de la v1

- Glifos de predicador.
- Modo ensayo que aprende los presupuestos.
- Pasadores BT y teclas de volumen.
- Redactor F4 (editar borradores por secciones).
- Teléfono.
- Tinta sólo con lápiz y con rechazo de palma.

---

## 6. Orden propuesto y criterio de cierre

**Orden:**
1. **Etapa 0** (seguridad) apenas se apruebe.
2. Las decisiones **D1-D8**.
3. **Etapa A**, porque es lo que hace confiable al producto y no depende de las tiendas.
4. **Etapa B.** Sus trámites de consola (DeviceCheck, SHA-1, Play Integrity, cuentas) pueden avanzar en paralelo desde el inicio.
5. **Etapa C.**
6. **Etapa D.**

**La fase cierra cuando:**
- Un pastor de la beta predica dos domingos desde la tablet, uno en modo avión, sin ayuda.
- Las dos tiendas aprueban la app.
- Crashlytics no muestra fallos que se repitan.
