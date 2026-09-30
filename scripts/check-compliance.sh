#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Compliance check for the dosfilosPreach codebase.
#
# Runs a battery of grep-based checks aligned with `.agent/rules/compliance_gate.md`:
#   1. No Firebase SDK imports in `.tsx` files (must go through services).
#   2. No `defaultValue:` in i18next calls (fail-loud i18n policy).
#   3. No raw color literals (`bg-red-500`, `text-slate-900`, etc.) in semantic JSX.
#   4. File-size soft (>300) and hard (>500) limits for `.tsx` files under `pages/`.
#   5. No Gemini SDK imports (`@google/genai`, legacy `@google/generative-ai`) in the packages the browser bundles.
#
# Usage:
#   ./scripts/check-compliance.sh           # check the whole codebase
#   ./scripts/check-compliance.sh --staged  # only check files staged for commit
#   ./scripts/check-compliance.sh --soft    # don't exit non-zero on warnings
#
# Exit codes:
#   0 = clean (or only soft warnings if --soft)
#   1 = hard violation detected
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_SRC="$ROOT/packages/web/src"

MODE_STAGED=0
MODE_SOFT=0
for arg in "$@"; do
    case "$arg" in
        --staged) MODE_STAGED=1 ;;
        --soft)   MODE_SOFT=1 ;;
    esac
done

# Allowlists — known intentional exceptions (documented in code as palettes /
# editorial design language). These paths are skipped by the colour-literal check.
COLOR_ALLOWLIST=(
    "packages/web/src/pages/landing/"
    "packages/web/src/pages/library/ResourceCard.tsx"
    "packages/web/src/pages/sermons/preach/highlightRenderer.ts"
    "packages/web/src/pages/sermons/components/list/"
    "packages/web/src/pages/sermons/generator/exegesis/greek-tutor/components/GreekTutorIntroView.tsx"
    "packages/web/src/pages/hebrew-tutor/components/discovery/DiscoveryEmptyState.tsx"
    "packages/web/src/pages/admin/leads/LeadCard.tsx"
    "packages/web/src/pages/admin/CoreLibraryAdmin.tsx"
)

# Files / paths explicitly allowed to import from `firebase/*`. The context
# directory hosts the React adapters that bridge Firebase to the application
# layer — Firebase imports there are part of the architecture, not a violation.
FIREBASE_ALLOWLIST=(
    "packages/web/src/context/"
)

HARD_FAIL=0
SOFT_WARN=0

red()    { printf '\033[31m%s\033[0m' "$*"; }
yellow() { printf '\033[33m%s\033[0m' "$*"; }
green()  { printf '\033[32m%s\033[0m' "$*"; }
bold()   { printf '\033[1m%s\033[0m' "$*"; }

is_allowlisted() {
    local file="$1"
    shift
    local entry
    for entry in "$@"; do
        case "$file" in
            *"$entry"*) return 0 ;;
        esac
    done
    return 1
}

# ── File source selection ────────────────────────────────────────────────────
collect_files() {
    if [ "$MODE_STAGED" -eq 1 ]; then
        git diff --cached --name-only --diff-filter=ACMR \
            | grep -E '^packages/web/src/.*\.(tsx|ts)$' || true
    else
        find "$WEB_SRC" -type f \( -name '*.tsx' -o -name '*.ts' \) \
            -not -path '*/node_modules/*' \
            | sed "s|$ROOT/||"
    fi
}

FILES_RAW="$(collect_files)"
if [ -z "$FILES_RAW" ]; then
    echo "$(green "✓") No files to check."
    exit 0
fi

# Portable IFS-newline split into FILES array (compatible with bash 3.x on macOS).
FILES=()
while IFS= read -r line; do
    [ -n "$line" ] && FILES+=("$line")
done <<< "$FILES_RAW"

echo "$(bold "Compliance check") — ${#FILES[@]} file(s) ${MODE_STAGED:+(staged only)}"
echo

# ── 1. Firebase imports in .tsx ──────────────────────────────────────────────
# Hard fail when a `pages/` file imports Firebase (the strict architectural
# boundary). Soft warning for `components/` violations — those are tracked
# separately as C7.3 follow-up and shouldn't block daily commits while the
# back-fill is in flight.
echo "$(bold "1. Firebase imports in .tsx")"
FIREBASE_HARD=0
FIREBASE_SOFT=0
for file in "${FILES[@]}"; do
    [[ "$file" == *.tsx ]] || continue
    [ -f "$ROOT/$file" ] || continue
    if is_allowlisted "$file" "${FIREBASE_ALLOWLIST[@]}"; then continue; fi
    if grep -qE "from 'firebase/(firestore|functions|auth|storage)'|await import\(['\"]firebase/" "$ROOT/$file" 2>/dev/null; then
        if [[ "$file" == packages/web/src/pages/* ]]; then
            echo "  $(red "✗") $file"
            FIREBASE_HARD=$((FIREBASE_HARD + 1))
        else
            echo "  $(yellow "!") $file"
            FIREBASE_SOFT=$((FIREBASE_SOFT + 1))
        fi
        grep -nE "from 'firebase/(firestore|functions|auth|storage)'|await import\(['\"]firebase/" "$ROOT/$file" \
            | sed 's/^/      /'
    fi
done
if [ "$FIREBASE_HARD" -eq 0 ] && [ "$FIREBASE_SOFT" -eq 0 ]; then
    echo "  $(green "✓") No Firebase imports in .tsx files."
else
    [ "$FIREBASE_HARD" -gt 0 ] && {
        echo "  $(red "✗") $FIREBASE_HARD pages/*.tsx file(s) import Firebase directly. Move to a service in packages/application/."
        HARD_FAIL=$((HARD_FAIL + FIREBASE_HARD))
    }
    [ "$FIREBASE_SOFT" -gt 0 ] && {
        echo "  $(yellow "!") $FIREBASE_SOFT components/*.tsx file(s) import Firebase (C7.3 follow-up)."
        SOFT_WARN=$((SOFT_WARN + FIREBASE_SOFT))
    }
fi
echo

# ── 2. defaultValue in i18next calls ─────────────────────────────────────────
# Hard fail in full-audit mode; soft warning in --staged so a routine commit to
# a file with legacy defaultValue calls isn't blocked. New code added in a
# commit is still expected to follow the fail-loud policy.
echo "$(bold "2. i18n fail-loud (no defaultValue: fallback)")"
DV_VIOLATIONS=0
for file in "${FILES[@]}"; do
    [[ "$file" == *.tsx || "$file" == *.ts ]] || continue
    [ -f "$ROOT/$file" ] || continue
    if grep -qE "t\([^)]*defaultValue:" "$ROOT/$file" 2>/dev/null; then
        echo "  $(red "✗") $file"
        grep -nE "t\([^)]*defaultValue:" "$ROOT/$file" | head -3 | sed 's/^/      /'
        DV_VIOLATIONS=$((DV_VIOLATIONS + 1))
    fi
done
if [ "$DV_VIOLATIONS" -eq 0 ]; then
    echo "  $(green "✓") No t() calls use defaultValue: as fallback."
else
    if [ "$MODE_STAGED" -eq 1 ]; then
        echo "  $(yellow "!") $DV_VIOLATIONS file(s) use defaultValue: fallback. Add the key to the locale instead."
        SOFT_WARN=$((SOFT_WARN + DV_VIOLATIONS))
    else
        echo "  $(red "✗") $DV_VIOLATIONS file(s) use defaultValue: fallback. Add the key to the locale instead."
        HARD_FAIL=$((HARD_FAIL + DV_VIOLATIONS))
    fi
fi
echo

# ── 3. Raw color literals in JSX ─────────────────────────────────────────────
# Match Tailwind colour palette names that are NOT semantic tokens. We look
# for prefix-color-shade patterns inside className attributes. Files in the
# COLOR_ALLOWLIST (decorative palettes, editorial design language) are skipped.
echo "$(bold "3. Raw colour literals in className")"
COLOR_PATTERN='(bg|text|border|ring|from|to|via|fill|stroke|decoration|outline|placeholder|caret|accent)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-(50|100|200|300|400|500|600|700|800|900|950)'
COLOR_VIOLATIONS=0
for file in "${FILES[@]}"; do
    [[ "$file" == *.tsx ]] || continue
    if is_allowlisted "$file" "${COLOR_ALLOWLIST[@]}"; then continue; fi
    if grep -qE "$COLOR_PATTERN" "$ROOT/$file" 2>/dev/null; then
        count=$(grep -cE "$COLOR_PATTERN" "$ROOT/$file")
        echo "  $(yellow "!") $file ($count literal(s))"
        COLOR_VIOLATIONS=$((COLOR_VIOLATIONS + 1))
    fi
done
if [ "$COLOR_VIOLATIONS" -eq 0 ]; then
    echo "  $(green "✓") No raw colour literals in JSX."
else
    echo "  $(yellow "!") $COLOR_VIOLATIONS file(s) use raw colour literals. Migrate to semantic tokens (success/warning/info/destructive/primary/muted/foreground)."
    SOFT_WARN=$((SOFT_WARN + COLOR_VIOLATIONS))
fi
echo

# ── 4. File-size limits for pages ────────────────────────────────────────────
# In --staged mode all file-size hits are soft warnings (we don't want to block
# a small commit because a pre-existing file is already too big). In full-audit
# mode hard limit is 500.
echo "$(bold "4. File size limits (pages/**/*.tsx)")"
SIZE_HARD=0
SIZE_SOFT=0
for file in "${FILES[@]}"; do
    [[ "$file" == packages/web/src/pages/*.tsx ]] || continue
    [ -f "$ROOT/$file" ] || continue
    lines=$(wc -l < "$ROOT/$file" | tr -d ' ')
    if [ "$lines" -gt 500 ] && [ "$MODE_STAGED" -eq 0 ]; then
        echo "  $(red "✗") $file — $lines lines (hard limit: 500)"
        SIZE_HARD=$((SIZE_HARD + 1))
    elif [ "$lines" -gt 300 ]; then
        echo "  $(yellow "!") $file — $lines lines (soft limit: 300)"
        SIZE_SOFT=$((SIZE_SOFT + 1))
    fi
done
if [ "$SIZE_HARD" -eq 0 ] && [ "$SIZE_SOFT" -eq 0 ]; then
    echo "  $(green "✓") All page files under 300 lines."
else
    [ "$SIZE_HARD" -gt 0 ] && HARD_FAIL=$((HARD_FAIL + SIZE_HARD))
    [ "$SIZE_SOFT" -gt 0 ] && SOFT_WARN=$((SOFT_WARN + SIZE_SOFT))
fi
echo

# ── 5. SDK de Gemini fuera del grafo del navegador ───────────────────────────
# Vive en su propio script porque CI lo corre solo: el audit completo tiene 67
# violaciones duras preexistentes (long tail de tamaño de archivo), así que no se
# puede poner entero en CI, y esta regla sí tiene que bloquear. Ver el encabezado
# de check-gemini-sdk-boundary.sh para el porqué.
#
# Se chequea SIEMPRE sobre todo el repo, no solo sobre lo staged: la regresión no
# es "este archivo cambió", es "el paquete volvió al grafo".
echo "$(bold "5. SDK de Gemini fuera del grafo del navegador")"
"$ROOT/scripts/check-gemini-sdk-boundary.sh"
GEMINI_SDK_COUNT=$?
[ "$GEMINI_SDK_COUNT" -gt 0 ] && HARD_FAIL=$((HARD_FAIL + GEMINI_SDK_COUNT))
echo

# ── Boy Scout opportunity (--staged only) ──────────────────────────────────
# When committing a file that already carries known long-tail violations, list
# them in a single high-visibility block so the dev sees "while you're here, fix
# what you can". Without this nudge, the warnings above scroll past and the
# debt persists indefinitely.
if [ "$MODE_STAGED" -eq 1 ] && [ "$SOFT_WARN" -gt 0 ]; then
    echo "$(bold "🪖 Boy Scout opportunity")"
    echo "  This commit touches files with pre-existing violations."
    echo "  Consider fixing what you can in this same commit before pushing."
    echo
    BS_REPORTED=0
    for file in "${FILES[@]}"; do
        [[ "$file" == *.tsx || "$file" == *.ts ]] || continue
        [ -f "$ROOT/$file" ] || continue
        # Aggregate per-file violation counts
        fb_count=0
        dv_count=0
        col_count=0
        size_lines=0
        # `grep -c` exits 1 when no matches but still prints "0", so we use a
        # plain `if grep -q` first and a separate counting pass to keep the
        # arithmetic happy.
        if ! is_allowlisted "$file" "${FIREBASE_ALLOWLIST[@]}" && \
           grep -qE "from 'firebase/(firestore|functions|auth|storage)'|await import\(['\"]firebase/" "$ROOT/$file" 2>/dev/null; then
            fb_count=$(grep -cE "from 'firebase/(firestore|functions|auth|storage)'|await import\(['\"]firebase/" "$ROOT/$file")
        fi
        if grep -qE "t\([^)]*defaultValue:" "$ROOT/$file" 2>/dev/null; then
            dv_count=$(grep -cE "t\([^)]*defaultValue:" "$ROOT/$file")
        fi
        if [[ "$file" == *.tsx ]] && ! is_allowlisted "$file" "${COLOR_ALLOWLIST[@]}" && \
           grep -qE "$COLOR_PATTERN" "$ROOT/$file" 2>/dev/null; then
            col_count=$(grep -cE "$COLOR_PATTERN" "$ROOT/$file")
        fi
        if [[ "$file" == packages/web/src/pages/*.tsx ]]; then
            size_lines=$(wc -l < "$ROOT/$file" 2>/dev/null | tr -d ' ')
            [ -z "$size_lines" ] && size_lines=0
        fi
        # Only print files with at least one violation
        if [ "$fb_count" -gt 0 ] || [ "$dv_count" -gt 0 ] || [ "$col_count" -gt 0 ] || [ "$size_lines" -gt 300 ]; then
            BS_REPORTED=1
            echo "  $(bold "$file"):"
            [ "$fb_count" -gt 0 ] && echo "    • $fb_count Firebase import(s) → move to a service in @dosfilos/application"
            [ "$dv_count" -gt 0 ] && echo "    • $dv_count t(…, { defaultValue }) call(s) → add the key to the locale and drop the fallback"
            [ "$col_count" -gt 0 ] && echo "    • $col_count colour literal(s) → migrate to semantic tokens (success/warning/info/destructive/primary/muted)"
            if [ "$size_lines" -gt 500 ]; then
                echo "    • $size_lines lines (over 500) → extract sub-components / hooks"
            elif [ "$size_lines" -gt 300 ]; then
                echo "    • $size_lines lines (over 300) → consider extracting"
            fi
        fi
    done
    [ "$BS_REPORTED" -eq 0 ] && echo "  (no per-file detail — see warnings above)"
    echo
    echo "  $(yellow "Mantra:") leave each file better than you found it."
    echo
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo "$(bold "Summary")"
if [ "$HARD_FAIL" -gt 0 ]; then
    echo "  $(red "✗") $HARD_FAIL hard violation(s)."
else
    echo "  $(green "✓") No hard violations."
fi
if [ "$SOFT_WARN" -gt 0 ]; then
    echo "  $(yellow "!") $SOFT_WARN soft warning(s)."
fi

if [ "$HARD_FAIL" -gt 0 ] && [ "$MODE_SOFT" -eq 0 ]; then
    exit 1
fi
exit 0
