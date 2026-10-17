# Fase: el cobro de la exégesis pasa al servidor · octubre 2026

> **Estado: APROBADA (2026-10-17).** Orden: primera de las tres. Se enciende en sombra unos días y pasa a obligatorio con el OK del fundador. `CreateUserRubricFromText` recibe una etiqueta propia sin costo (sigue gratis, como hoy).

## Por qué

Hoy el saldo de exégesis se descuenta **desde el navegador** (`ExegesisCreditReservation` → `ProcessingBalanceService.consumeExegesis`). Eso trae tres problemas:

1. **El servidor no revisa el saldo.** `runLlmPrompt`, que es por donde pasan todas las llamadas al modelo de la exégesis, no sabe nada de saldos. Una app modificada podría no descontar nada.
2. **El reembolso no funciona.** Desde #785, las reglas sólo dejan **bajar** el saldo desde el navegador. Cuando una operación falla antes de llamar al modelo, se pierde lo reservado, que va de US$0,02 a 0,20. Es un *supuesto* que esto pase poco: no está medido.
3. **Nada es atómico.** El descuento y los abonos del servidor (webhook de Stripe, cuota mensual, packs) leen y después escriben sin transacción, así que dos escrituras simultáneas se pueden pisar.

## Lo que se relevó (leído en el código, 2026-10-17)

- **Operaciones:** 18 aperturas de reserva en 16 casos de uso, con 17 operaciones del catálogo (`ExegesisOperationCatalog.ts`). Los costos van de US$0,001 a US$0,20.
- **Un solo punto de llegada:** todas llegan al modelo por un único callable, `runLlmPrompt`, con una etiqueta `feature` que elige el cliente. Son 14 etiquetas que cobran.
- **Una operación puede ser varias llamadas:** la verificación de citas hace una por cada cita que no coincide, los compositores reintentan y el cliente reintenta hasta 5 veces ante un 503.
- **El servidor ya acredita,** pero no descuenta: hay `addExegesisPackAdmin` y `setExegesisPlanQuotaAdmin`, sin un `consume` del lado del servidor.
- **El aviso de saldo insuficiente** (`InsufficientExegesisCreditsError`) sólo se muestra en `StepCard`. Las demás pantallas muestran un aviso genérico, y eso ya es así hoy.

## Lo que se hace (un PR)

1. **El catálogo de costos en el servidor.** Copia de `ExegesisOperationCatalog` en functions, con prueba de paridad, el mismo patrón que los feature flags. Para cada operación: su costo, las etiquetas de `runLlmPrompt` que puede usar, un tope de llamadas y una vigencia (15 minutos). **El costo sale siempre de este catálogo**: el navegador sólo dice qué operación va a hacer.
2. **`abrirReservaDeExegesis({ operacion, reservaId })`.** El id lo genera el navegador para que repetir la llamada no cobre dos veces. En una transacción:
   - si la reserva ya existe, la devuelve;
   - si plan más pack no alcanza, responde «saldo insuficiente» con lo que hace falta y lo disponible. Así el aviso de `StepCard` sigue funcionando igual;
   - si alcanza, descuenta primero del plan y después del pack, y crea `users/{uid}/exegesis_reservas/{id}`.
3. **`runLlmPrompt` comprueba la reserva.** Para las etiquetas que cobran, toma la reserva abierta más antigua que admita esa etiqueta y que no haya llegado a su tope de llamadas. Antes de llamar al modelo marca `llmContactedAt`. **Lo marca el servidor, no el navegador**, así que no se puede pedir un reembolso falso.
4. **`liberarReservaDeExegesis({ reservaId })`.** Devuelve el saldo sólo si el modelo nunca se llamó. Un barrido programado devuelve las reservas vencidas sin uso, por ejemplo si se cerró la pestaña. **Así el reembolso vuelve a funcionar.**
5. **El navegador** usa los dos callables. `ExegesisCreditReservation` conserva su forma, así que los 16 casos de uso no cambian. La telemetría de reservas pasa al servidor.
6. **Los abonos del servidor pasan a transacciones** (packs, cuota mensual, cambio de plan).
7. **Se enciende de a poco**, con un interruptor en la configuración:
   - **en sombra:** el servidor registra las llamadas que cobran sin reserva válida, pero no las rechaza;
   - **obligatorio:** las rechaza, y las reglas dejan de permitir que el navegador toque `processingBalance`.

   Se despliega en sombra, se mira unos días que no haya llamadas legítimas sin reserva, y recién entonces se pasa a obligatorio, con tu OK.

## Lo que queda abierto (para decidir)

- **`CreateUserRubricFromText` hoy no cobra,** pero usa la misma etiqueta que tres operaciones que sí cobran. Hay que darle una etiqueta propia sin costo o cobrarla.
- **Riesgo residual:** el prompt lo arma el navegador, así que una app modificada podría etiquetar trabajo de exégesis con una etiqueta que no cobra. Lo acotan los topes de modelo y de largo por etiqueta, más la conciliación con el costo real, que `recordLlmUsage` ya calcula. **La solución de fondo** es que cada operación tenga su callable con el prompt armado en el servidor. Es una fase posterior, más grande, porque mueve 17 constructores de prompt.

## Revisión antes del PR

Pruebas de la transacción (saldo justo, pack, idempotencia, carrera entre dos reservas), de `runLlmPrompt` en sombra y en obligatorio, y de las reglas. Mutaciones y revisión adversarial.

## Lo que cambió con la revisión adversarial (2026-10-17)

- **`CreateUserRubricFromText` tiene etiqueta propia** (`exegesis.createUserRubric`), que no cobra y no pide reserva, como dice el diseño. La primera versión le daba una operación de costo cero con la etiqueta compartida, y eso abría reservas gratis sin límite.
- **La reserva se toma sin bloqueos.** Se lee, se toma la fresca con una precondición sobre su hora de actualización y, si otra llamada la tomó primero, se vuelve a elegir: en el reintento, al azar entre las frescas. Una reserva ya usada sólo suma una llamada, sin transacción. Medido en el emulador: **40 citas en paralelo pasaron de 7,6 s a menos de 0,1 s**, y 15 operaciones simultáneas toman cada una su reserva.
- **Sólo se leen las reservas vigentes** (índice `estado + creada`): la consulta no crece con el historial.
- **El barrido no se traba:** una reserva que falla no frena a las demás, y la de una cuenta borrada se cierra sin escribir saldo.
- **Más resguardos:**
  - `abrirReservaDeExegesis` tiene un tope por hora (300);
  - los dos callables reintentan si la sesión venció, como `runLlmPrompt`;
  - la imagen se valida antes de cobrar;
  - la métrica de la sombra se anota sin esperar.
- **Se quitaron** dos métodos del navegador que subían el saldo y que nadie llamaba.

## Deploy (en este orden)

1. **Merge.** El workflow publica la web antes que las funciones. Mientras `abrirReservaDeExegesis` no exista, el navegador nuevo sigue sin reserva, sin fallar: el servidor está en sombra.
2. **Pide OK:** cargar la ruta `exegesis.createUserRubric` (Gemini 3.8 Flash, igual que `extractRubric`) en `config/llmRouting`. Mientras no esté, esa llamada usa el modelo que pide el navegador.
3. **Mirar `metricas_cobro_exegesis` unos días.** `sinReserva` debería quedar en cero, salvo pestañas con la versión vieja abierta.
4. **Pide OK:** poner `cobroExegesis: 'obligatorio'` en `config/llmBudget`, y en otro PR chico cerrar `processingBalance` al cliente en las reglas.
