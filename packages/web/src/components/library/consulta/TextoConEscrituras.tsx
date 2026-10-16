import { Fragment, type ReactNode } from 'react';
import { partirPorEscritura } from './escrituras';

/** Un texto con el griego y el hebreo en su fuente (y su `lang`, para lectores de pantalla). */
export function TextoConEscrituras({ texto }: { texto: string }) {
    return (
        <>
            {partirPorEscritura(texto).map((t, i) => t.escritura === 'griego'
                ? <span key={i} lang="grc" className="font-greek text-[1.06em]">{t.texto}</span>
                : t.escritura === 'hebreo'
                    ? <span key={i} lang="hbo" dir="rtl" className="font-hebrew text-[1.1em]">{t.texto}</span>
                    : <Fragment key={i}>{t.texto}</Fragment>)}
        </>
    );
}

/** Los hijos de un nodo de markdown, con las cadenas pasadas por `TextoConEscrituras`. */
export function conEscrituras(children: ReactNode): ReactNode {
    if (typeof children === 'string') return <TextoConEscrituras texto={children} />;
    if (Array.isArray(children)) return children.map((c, i) => typeof c === 'string' ? <TextoConEscrituras key={i} texto={c} /> : c);
    return children;
}
