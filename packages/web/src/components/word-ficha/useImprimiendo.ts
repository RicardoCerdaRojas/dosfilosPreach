import React from 'react';
import { flushSync } from 'react-dom';

/**
 * ¿Se está imprimiendo? Las fichas completas de todas las palabras (lo que va
 * en papel en vez del panel) se dibujan sólo entonces: tenerlas siempre en la
 * página, ocultas, duplicaba el trabajo y los identificadores (revisión de la
 * ficha). `flushSync`: el navegador toma la página apenas termina `beforeprint`.
 */
export function useImprimiendo(): boolean {
    const [imprimiendo, setImprimiendo] = React.useState(false);
    React.useEffect(() => {
        const antes = () => flushSync(() => setImprimiendo(true));
        const despues = () => setImprimiendo(false);
        window.addEventListener('beforeprint', antes);
        window.addEventListener('afterprint', despues);
        return () => {
            window.removeEventListener('beforeprint', antes);
            window.removeEventListener('afterprint', despues);
        };
    }, []);
    return imprimiendo;
}
