#!/usr/bin/env bash
#
# Corre los tests de CADA paquete CON SU PROPIA configuración.
#
# POR QUÉ NO `vitest run` DESDE LA RAÍZ: `packages/web` necesita el entorno
# jsdom que declara su `vitest.config.ts`. Desde la raíz no se toma esa config,
# así que sus ~190 tests fallan con "document is not defined" — un FALSO ROJO.
#
# Ese falso rojo es lo que motivó el `continue-on-error: true` del workflow, y
# el remedio resultó peor que la enfermedad: el paso reportaba verde PASE LO QUE
# PASE, así que también se tragaba las fallas REALES de dominio y de functions,
# que sí corren bien desde la raíz. El test de paridad del allowlist de flags
# —escrito justamente para impedir que la lista del callable se desincronice—
# falló en local durante horas mientras CI decía verde, y el flag nuevo llegó a
# producción sin poder activarse.
#
# NO CORTA AL PRIMER FALLO. Corre los cinco y reporta el resumen: si dominio
# falla, hay que seguir viendo si web también, o el segundo arreglo llega en un
# ciclo aparte.
set -uo pipefail

cd "$(dirname "$0")/.."

PAQUETES=(domain application infrastructure functions web)
FALLARON=()

for p in "${PAQUETES[@]}"; do
    printf '\n\033[1m── %s ─────────────────────────────\033[0m\n' "$p"
    if npx vitest run --root "packages/$p"; then
        continue
    fi
    FALLARON+=("$p")
done

# Los tests del banco de pruebas de extracción viven fuera de `packages/`, así
# que el bucle de arriba no los ve. Se corren igual: son lo que sostiene la
# confianza en las métricas de fidelidad de griego y hebreo, y una métrica que
# se pudre en silencio es peor que no tenerla, porque igual se decide con ella.
# Corren desde la raíz sin config propia (no necesitan jsdom).
printf '\n\033[1m── extraction-bakeoff ─────────────────────────────\033[0m\n'
if ! npx vitest run scripts/extraction-bakeoff scripts/llm-bakeoff scripts/language-structure; then
    FALLARON+=("extraction-bakeoff")
fi

printf '\n\033[1mResumen\033[0m\n'
if [ ${#FALLARON[@]} -eq 0 ]; then
    printf '  \033[32m✓\033[0m %d paquetes + banco de extracción en verde.\n' "${#PAQUETES[@]}"
    exit 0
fi

printf '  \033[31m✗\033[0m Fallaron: %s\n' "${FALLARON[*]}"
exit 1
