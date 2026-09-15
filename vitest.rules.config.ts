import { defineConfig } from 'vitest/config';

/**
 * Config APARTE de los tests de paquete (`scripts/test-all-packages.sh`).
 *
 * POR QUÉ NO VA EN EL BUCLE DE PAQUETES: estos tests necesitan el emulador de
 * Firestore corriendo. `test-all-packages.sh` no lo levanta, así que meterlos
 * ahí los convierte en rojo permanente en la máquina de cualquiera que no tenga
 * el emulador arriba — y un rojo que siempre está rojo se ignora, que es
 * exactamente cómo se pierde una prueba.
 *
 * Se corren con `yarn test:rules`, que levanta el emulador alrededor de vitest
 * vía `firebase emulators:exec`.
 */
export default defineConfig({
    /**
     * El `tsconfig.json` de la raíz es un archivo-solución (`"files": []`) que
     * además hace `extends: "expo/tsconfig.base"`, y `expo` está en `nohoist`
     * para mobile: no existe en el node_modules de la raíz. Si esbuild resuelve
     * ese tsconfig, la suite ni siquiera llega a cargarse
     * ("failed to resolve extends").
     *
     * Tiene que ser una CADENA: vite solo se salta `loadTsconfigJsonForFile`
     * cuando `tsconfigRaw` es string. Con un objeto igual lo resuelve para
     * fusionar `compilerOptions`, y vuelve a fallar.
     */
    esbuild: {
        tsconfigRaw: '{}',
    },
    test: {
        include: ['tests/firestore-rules/**/*.test.ts'],
        environment: 'node',
        /**
         * Un solo emulador para todas las suites: en paralelo se pisan los
         * documentos sembrados entre archivos.
         */
        fileParallelism: false,
        testTimeout: 20_000,
        hookTimeout: 30_000,
    },
});
