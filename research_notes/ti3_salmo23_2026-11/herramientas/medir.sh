#!/bin/zsh
# medir.sh <borrador.md> <nombre_unico>  -> docx + pdf en el contenedor de Word; imprime páginas.
# Word no acepta «close» por AppleScript: el documento queda abierto; por eso cada medición usa un nombre nuevo.
R="$(cd "$(dirname "$0")" && pwd)"; T="$R/plantilla_ti2"
W="$HOME/Library/Containers/com.microsoft.Word/Data/medir_ti3"
python3 -I $R/md2docx_tms.py $T "$1" "$W/$2.docx" >/dev/null || exit 1
rm -f "$W/$2.pdf"
osascript -e "with timeout of 300 seconds
tell application \"Microsoft Word\"
open file name \"$W/$2.docx\"
save as document \"$2.docx\" file name \"$W/$2.pdf\" file format format PDF
end tell
end timeout" >/dev/null
pdfinfo "$W/$2.pdf" | grep Pages
