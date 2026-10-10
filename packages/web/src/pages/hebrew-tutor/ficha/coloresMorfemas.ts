/**
 * Qué significa cada color de los morfemas (la «Guía de colores en esta
 * palabra» del antiguo panel «Tutor interactivo», sin cambios).
 */
export const COLORES_MORFEMAS: Readonly<Record<string, { label: string; desc: string } | undefined>> = {
  prefix: { label: 'Prefijo (Azul)', desc: 'Elementos añadidos al principio, como artículos definidos, conjunciones (Waw) y preposiciones.' },
  root: { label: 'Raíz (Gris/Texto)', desc: 'Las 3 letras consonantes que cargan el significado léxico fundamental (Raíz Trilitera).' },
  vowel_a: { label: 'Vocal Clase A (Rojo)', desc: 'Vocales Pataj o Qamets que determinan la conjugación.' },
  vowel_ei: { label: 'Vocal Clase E/I (Verde)', desc: 'Vocales Segol, Tsere o Jireq que indican el patrón del binyan.' },
  vowel_ou: { label: 'Vocal Clase O/U (Naranja)', desc: 'Vocales Jolem, Qibbuts o Shureq que marcan formas pasivas o específicas.' },
  sheva: { label: 'Shevá / Reducidas (Púrpura)', desc: 'Shevá simple o compuesto (Hatef) que indica vocales breves o silenciamiento.' },
  vowel_generic: { label: 'Vocal Temática (Ámbar)', desc: 'Vocales que determinan el binyan, forma o conjugación particular del verbo.' },
  dagesh: { label: 'Dagesh (Dorado)', desc: 'Punto que duplica la consonante, crucial para reconocer binyanim como el Piel/Pual.' },
  suffix: { label: 'Sufijo (Violeta)', desc: 'Terminaciones de género, número o sufijos pronominales.' },
  neutral: { label: 'Neutro', desc: 'Elementos no clasificables o que no afectan directamente las reglas principales.' }
};
