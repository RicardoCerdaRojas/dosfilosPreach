#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# El SDK de Gemini no entra a los paquetes que empaqueta el navegador.
#
# POR QUÉ EXISTE: `VITE_GEMINI_API_KEY` vivió meses inlineada en el bundle, y al
# ir a borrarla apareció que era EL MISMO VALOR que el secret `GEMINI_API_KEY`
# del servidor. No era "un tercero puede quemar cuota del navegador": la clave
# pública era la credencial del backend. Se rotó (2026-08-20) y todas las
# llamadas al modelo salen por callables.
#
# Esta regla cierra la puerta de reentrada. El SDK no necesita la clave para
# volver al bundle: alcanza con que algo del grafo del navegador lo importe, y un
# `export *` en el barrel de infrastructure basta. Fue exactamente lo que pasó —
# lo arrastraban un enum (`SchemaType`, seis strings constantes), una clase que
# se instanciaba con clave vacía solo para reusar sus prompts, y dos archivos
# muertos que nadie construía.
#
# `packages/functions` queda fuera A PROPÓSITO: corre en el servidor, tiene la
# clave legítimamente y es donde el SDK debe vivir.
#
# Uso:
#   ./scripts/check-gemini-sdk-boundary.sh
#
# Exit codes:
#   0 = limpio
#   1 = alguien volvió a importar el SDK del lado del cliente
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Paquetes que terminan dentro del bundle del navegador.
CLIENT_SRC=(
    "$ROOT/packages/web/src"
    "$ROOT/packages/domain/src"
    "$ROOT/packages/application/src"
    "$ROOT/packages/infrastructure/src"
)

red()   { printf '\033[31m%s\033[0m' "$*"; }
green() { printf '\033[32m%s\033[0m' "$*"; }

# Solo imports reales. Las menciones en comentarios (que explican justamente por
# qué el SDK no está) no deben disparar la regla.
HITS="$(
    grep -rnE "(from|import|require\()[[:space:]]*['\"]@google/(generative-ai|genai)" \
        "${CLIENT_SRC[@]}" 2>/dev/null | sed "s|$ROOT/||" || true
)"

if [ -z "$HITS" ]; then
    echo "  $(green "✓") Ningún import del SDK de Gemini (@google/genai ni el viejo @google/generative-ai) en web/domain/application/infrastructure."
    exit 0
fi

COUNT="$(printf '%s\n' "$HITS" | wc -l | tr -d ' ')"
printf '%s\n' "$HITS" | sed "s|^|  $(red "✗") |"
echo "  $(red "✗") $COUNT import(s) del SDK de Gemini en paquetes que el navegador empaqueta."
echo "      Las llamadas al modelo salen por callables (packages/functions)."
echo "      Si solo necesitas los tipos de esquema, usa el SchemaType local de"
echo "      packages/infrastructure/src/llm/schemaType.ts."
exit "$COUNT"
