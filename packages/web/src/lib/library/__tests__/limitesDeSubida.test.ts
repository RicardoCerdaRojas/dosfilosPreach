import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_SIZE_MB, motivoDeRechazo } from '@/lib/library/limitesDeSubida';

/**
 * Las puertas de la subida, atadas a lo que el almacenamiento acepta de
 * verdad. Este camino corto se las saltaba: el archivo viajaba entero
 * para morir en la regla, con un error de permisos que no explica nada.
 */
const archivo = (type: string, mb = 1, name = 'ensayo') =>
    ({ name, type, size: mb * 1024 * 1024 });

describe('motivoDeRechazo', () => {
    it('un PDF dentro del tope y con consentimiento pasa', () => {
        expect(motivoDeRechazo(archivo('application/pdf', 10), true)).toBeNull();
        expect(motivoDeRechazo(archivo('application/epub+zip', 10), true)).toBeNull();
    });

    it('un EPUB mal rotulado por el navegador pasa por su extensión', () => {
        // Rechazarlo sería inventar un límite que la regla no pone.
        expect(motivoDeRechazo(archivo('application/octet-stream', 2, 'libro.epub'), true)).toBeNull();
    });

    it('un .docx se rechaza acá: `storage.rules` sólo admite PDF y EPUB', () => {
        expect(motivoDeRechazo(archivo('application/vnd.openxmlformats-officedocument.wordprocessingml.document'), true))
            .toBe('tipo');
        expect(motivoDeRechazo(archivo('text/plain'), true)).toBe('tipo');
    });

    it('el tope es el mismo que la regla de almacenamiento: 250 MB', () => {
        expect(MAX_UPLOAD_SIZE_MB).toBe(250);
        expect(motivoDeRechazo(archivo('application/pdf', 251), true)).toBe('tamano');
        expect(motivoDeRechazo(archivo('application/pdf', 250), true)).toBeNull();
    });

    it('sin consentimiento no se sube nada, y ése es el primer motivo', () => {
        // Manda sobre los demás: es la puerta que el flujo normal exige
        // antes de tocar el archivo.
        expect(motivoDeRechazo(archivo('text/plain', 500), false)).toBe('consentimiento');
    });
});
