import { Link } from 'react-router-dom';
import { Trans } from 'react-i18next';
import type { TFunction } from 'i18next';

/**
 * Un texto legal de `legal.json` con sus marcas: `<strong>`, `<code>`, el
 * correo de privacidad (`<mail>`) y el enlace a la página de borrado
 * (`<page>`). Los textos legales viven en i18n como todo lo demás.
 *
 * NO `<link>`: es un elemento vacío de HTML y el parser de `Trans` le tira el
 * texto (el enlace salía en blanco; lo atrapó la prueba).
 */
export function LegalText({ t, k }: { t: TFunction; k: string }) {
    return (
        <Trans
            i18nKey={k}
            t={t}
            components={{
                strong: <strong />,
                code: <code />,
                mail: <a href="mailto:privacy@dosfilos.app" />,
                page: <Link to="/delete-account" />,
            }}
        />
    );
}

/** Cuántos elementos tiene una lista de `legal.json`. */
export function countOf(t: TFunction, key: string): number {
    const value = t(key, { returnObjects: true }) as unknown;
    return Array.isArray(value) ? value.length : 0;
}
