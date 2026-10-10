# Herramientas: reglas extraídas de las gramáticas

Fase `docs/FASE_REGLAS_DESDE_GRAMATICAS_2026-10.md`. Sirven para medir un libro, sacar sus ejemplos y cotejar las citas.

**Regla de oro:** el texto de los libros nunca entra al repo. Las herramientas trabajan sobre una carpeta **fuera** del repo. Al repo sólo llegan:
- etiquetas de categoría;
- páginas;
- referencias bíblicas;
- la lista de citas cotejadas.

## Flujo

```bash
D=/tmp/libros/arnold-choi        # fuera del repo
# 1. Bajar el recurso (sólo lectura): PDF, capa de texto, extracción de la biblioteca, desfase.
node scripts/language-rules/bajar-recurso.cjs <resourceId> $D

# 2. Medirlo antes de construir encima.
python3 scripts/language-rules/medir-extraccion.py $D --lengua he

# 3. Sacar los ejemplos de un tramo (etiquetas + referencias, sin texto del libro).
python3 scripts/language-rules/ejemplos-del-libro.py $D --desde 3.4.1 --hasta 3.4.3 [--desfase <n>] \
  --edicion "Cambridge 2003, ISBN 978-0-521-82609-9" > packages/domain/src/language-structure/__tests__/fixtures/<nombre>.json

# 4. Cotejar las citas del registro con el ejemplar (R0).
(cd packages/domain && npx vite-node scripts/listar-fuentes.mts > /tmp/fuentes.json)
python3 scripts/language-rules/cotejar-citas.py /tmp/fuentes.json wallace=<capa>:36 arnoldChoi=$D/capa.txt:14 --aprobar packages/domain/src/language-structure/__tests__/cotejo-aprobado.json
```

## Qué mide `medir-extraccion.py`

| Medición | Para qué |
|---|---|
| Página impresa = hoja + desfase | Si falla, no se pueden citar páginas. Sin desfase guardado, lo infiere (Runge: −7). |
| Referencias en la capa contra la extracción de la biblioteca | Cuánto se perdió. |
| Hojas con menos de la mitad del texto que la capa | Contenido perdido que la cobertura de la biblioteca no ve. Arnold y Choi perdió p. 70–81 y 166–188. |
| Letras hebreas o griegas legibles en la capa | Con una fuente de codificación propia salen ilegibles: el texto bíblico se toma de OSHB o MorphGNT por la referencia. |

## Límites conocidos

- **Formato de los ejemplos:** `ejemplos-del-libro.py` entiende secciones numeradas («3.4.1») y subcategorías con letra («(b.3)»), como Arnold y Choi. Con Runge funciona a medias: la numeración se reinicia por capítulo (el tramo se corta en la primera sección fuera de rango) y no hay subcategorías. La jerarquía de Wallace (I. / A. / 1. / a.) queda pendiente.
- **Notas al pie:** no se distinguen. Una referencia en una nota se atribuiría a la subcategoría abierta. Medido: ninguna en los archivos de Arnold y Choi.
- **Otro Testamento:** `--lengua` toma uno solo. `medir-extraccion.py` informa cuántas referencias del otro quedan fuera.
- **Pruebas:** `python3 -m unittest discover -s scripts/language-rules -p 'test_*.py'` (no corren en CI).
- **Títulos en hebreo o griego con codificación propia** (las preposiciones del cap. 4 de Arnold y Choi) salen como `tituloIlegible`. Se completan a mano, verificados en el ejemplar.
- **Nombres de subcategorías:** sólo se guarda el nombre corto anterior a la raya («Temporal – …»). Sin raya, `nombre` queda vacío.
