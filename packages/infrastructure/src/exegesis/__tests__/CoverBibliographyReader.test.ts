import { describe, expect, it, vi } from 'vitest';
import { buildCoverPrompt, parseCoverJson, readBibliographyFromCover } from '../CoverBibliographyReader';
import type { FirebaseLibraryRepository } from '../../firebase/FirebaseLibraryRepository';

const CREDITOS = [
    'A Commentary on the Psalms',
    'Volume 1 (1-41)',
    'Allen P. Ross',
    '© 2011 by Allen P. Ross',
    'Published by Kregel Publications, Grand Rapids, Michigan 49501',
    'ISBN 978-0-8254-2562-2',
    'All rights reserved. No part of this book may be reproduced, stored in a',
    'retrieval system, or transmitted in any form or by any means without the',
    'prior written permission of the publisher, except brief quotations in',
    'printed reviews. Printed in the United States of America.',
].join('\n');

/** Una biblioteca que devuelve el libro que se le diga, sin red. */
const bibliotecaCon = (textContent: string) => ({
    findById: vi.fn().mockResolvedValue({ textContent, title: 'Ross Salmos', author: 'Ross' }),
}) as unknown as FirebaseLibraryRepository;

describe('readBibliographyFromCover', () => {
    it('acepta lo impreso y descarta lo que el modelo puso de memoria', () => {
        const modelo = vi.fn().mockResolvedValue(JSON.stringify({
            author: 'Allen P. Ross',
            title: 'A Commentary on the Psalms',
            city: 'Grand Rapids',
            publisher: 'Kregel Publications',
            year: '2011',
            translator: 'Nancy Bedford',
        }));
        return readBibliographyFromCover('r1', 'm', bibliotecaCon(CREDITOS), modelo).then(res => {
            expect(res.hasText).toBe(true);
            expect(res.data.publisher).toBe('Kregel Publications');
            expect(res.data.year).toBe('2011');
            // Nadie tradujo este libro: el nombre no está impreso.
            expect(res.data.translator).toBeUndefined();
            expect(res.discarded).toEqual(['translator']);
        });
    });

    it('el ISBN sale del libro y no del modelo', async () => {
        const modelo = vi.fn().mockResolvedValue(JSON.stringify({ isbn: '9788425421235' }));
        const res = await readBibliographyFromCover('r1', 'm', bibliotecaCon(CREDITOS), modelo);
        expect(res.data.isbn).toBe('9780825425622');
    });

    it('un libro sin texto extraído no gasta una llamada al modelo', async () => {
        const modelo = vi.fn();
        const res = await readBibliographyFromCover('r1', 'm', bibliotecaCon(''), modelo);
        expect(res.hasText).toBe(false);
        expect(modelo).not.toHaveBeenCalled();
    });

    it('una respuesta ilegible deja la ficha vacía en vez de romper', async () => {
        const modelo = vi.fn().mockResolvedValue('lo siento, no encontré nada');
        const res = await readBibliographyFromCover('r1', 'm', bibliotecaCon(CREDITOS), modelo);
        expect(res.data).toEqual({ isbn: '9780825425622' });
    });
});

describe('buildCoverPrompt', () => {
    it('dice explícitamente cuándo el ejemplar no trae créditos', () => {
        const prompt = buildCoverPrompt({ cover: 'Portada', credits: '' });
        expect(prompt).toContain('NO trae página de créditos');
    });

    it('avisa que el título guardado es una pista y no la portada', () => {
        const prompt = buildCoverPrompt({ cover: 'Portada', credits: 'X' }, 'nombre-de-archivo.pdf');
        expect(prompt).toContain('pista de quien lo subió');
        expect(prompt).toContain('nombre-de-archivo.pdf');
    });
});

describe('parseCoverJson', () => {
    it('tolera las vallas de markdown', () => {
        expect(parseCoverJson('```json\n{"city":"Waco"}\n```')).toEqual({ city: 'Waco' });
    });

    it('devuelve nulo ante un arreglo o ante basura', () => {
        expect(parseCoverJson('[1,2]')).toBeNull();
        expect(parseCoverJson('no es json')).toBeNull();
    });
});
