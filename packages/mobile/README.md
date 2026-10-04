# Dos Filos Preach — app tablet

App móvil/tablet de Dos Filos para **predicar** (módulo Púlpito) y, en una segunda
entrega, **redactar** (módulo Redactor). El plan ejecutable vive en
[`docs/app-mobile/pulpito-plan.md`](../../docs/app-mobile/pulpito-plan.md); las decisiones
estructurales (M-01..M-09) y el roadmap F0–F4 están ahí.

- **Nombre**: Dos Filos Preach
- **Bundle id / package**: `com.dosfilos.preach` (iOS y Android)
- **Plataformas**: iOS y Android desde F0. Soporte e-ink de primera clase (BOOX) — ver M-09.

## Estado

Expo SDK 57, React Native 0.86, `@react-native-firebase` 26 con App Check. F0–F2 del plan
están hechos; la fase en curso es **Púlpito premium**
([`docs/app-mobile/FASE_PULPITO_PREMIUM_2026-10.md`](../../docs/app-mobile/FASE_PULPITO_PREMIUM_2026-10.md)):
confiabilidad del atril, requisitos de tienda y lo que la vuelve premium antes de publicarla.
La v1 en tiendas es **sólo tablet**.

## Desarrollo

```bash
# desde la raíz del monorepo
npm run mobile            # expo start
npm run mobile:ios        # build + run iOS
npm run mobile:android    # build + run Android

# desde packages/mobile
npx jest                  # pruebas (también corren en CI)
npx tsc --noEmit -p tsconfig.json
npx expo lint
```

La app no corre en Expo Go: usa dev builds (EAS). La pantalla del atril sin sesión se puede
mirar en desarrollo en `/dev/preach` (en release redirige).

## App Check

- **Release:** iOS pide App Attest (con el entitlement de producción en `app.json`) y Android
  Play Integrity. Ojo, medido en el iPad (2026-08-28): con `@react-native-firebase` 26 el
  cliente de iOS termina usando **DeviceCheck** aunque se configure App Attest. Por eso en la
  consola de Firebase hay que registrar **los dos** proveedores para la app de iOS.
- **Builds internos (`preview`):**
  - **iOS** usa el mismo App Check que la tienda: un build ad hoc firmado tiene DeviceCheck de verdad, y así funcionó en el iPad el 2026-08-28.
  - Con el modo de depuración encendido y sin token registrado, la app abría con las listas vacías. Por eso se quitó del perfil iOS el 2026-10-04.
  - **Android** (APK instalado a mano) no tiene Play Integrity. Ahí sí va `EXPO_PUBLIC_APPCHECK_DEBUG=1`, con el token en la variable de EAS `EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN`.
  - Ese token nunca se commitea: quien lo tenga pasa App Check. Se registra a mano en la consola.
  - `production` nunca lleva el modo de depuración.
- Las llamadas al servidor esperan `appCheckReady()` antes de salir.

## Trámites de consola (los hace el fundador)

Ninguno se puede hacer desde el código; sin ellos la app firmada no funciona o la tienda la
rechaza.

1. **Firebase → App Check → app iOS:** registrar DeviceCheck (clave `.p8` con DeviceCheck,
   Key ID y Team ID `9UHZPU2WCK`) además de App Attest.
2. **Firebase → configuración de la app Android:** agregar el SHA-1 y el SHA-256 de la firma
   de EAS (`eas credentials -p android`) y, después de la primera subida, los de Play App
   Signing. Volver a descargar `google-services.json` (sin esto Google Sign-In falla en
   Android). Vincular Play Integrity en Play Console.
3. **Firebase → Authentication → Apple:** configurar el proveedor (Services ID, Team ID, Key ID
   y clave privada) para que «Eliminar mi cuenta» pueda revocar el token de Apple.
4. **EAS:** variable `EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN` sólo para `preview` de Android.
5. **Correo:** que `privacy@dosfilos.app` reciba correo (lo nombran el borrado de cuenta y la
   política de privacidad).

## Estructura

- `app/` — rutas (Expo Router): `(auth)`, `(tabs)` con Inicio / Biblia / Sermones.
- `src/domain`, `src/data`, `src/core`, `src/presentation` — capas propias del cliente.
- `stitch_design.mobile/` — diseños de referencia (Stitch, feb 2026). Solo referencia
  visual; `preaching_mode_(tablet)` coincide con el plan de Púlpito.
