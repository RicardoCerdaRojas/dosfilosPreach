import { createContext, useCallback, useContext } from 'react';
import { useTranslation } from '@/i18n';

type ReviewUnit = 'pregunta' | 'tema';

const ReviewUnitContext = createContext<ReviewUnit>('pregunta');

/** Qué son las filas de la revisión del corpus: preguntas del encuadre o versículos (A4). */
export const ReviewUnitProvider = ReviewUnitContext.Provider;

/**
 * La traducción de la revisión del corpus por unidad. Sin preguntas, las filas
 * son versículos y los textos dicen «versículo» donde decían «pregunta»: se
 * piden con el contexto `verse` de i18next (`clave_verse`), y lo que no tiene
 * variante usa el texto de siempre.
 */
export function useReviewTranslation(unit?: ReviewUnit) {
    const { t } = useTranslation('exegesis');
    const delContexto = useContext(ReviewUnitContext);
    const unidad = unit ?? delContexto;
    const tr = useCallback(
        (key: string, options?: Record<string, unknown>) =>
            unidad === 'tema' ? t(key, { ...options, context: 'verse' }) : t(key, options),
        [t, unidad],
    );
    return { t: tr as unknown as typeof t, unit: unidad };
}
