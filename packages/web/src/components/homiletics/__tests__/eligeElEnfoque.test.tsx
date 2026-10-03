import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { HomileticalApproachPreview } from '@dosfilos/domain';
import { approachRoute } from '../approachRoute';
import { ApproachSelectionView } from '@/pages/sermons/generator/homiletics/ApproachSelectionView';

/**
 * «Elige el enfoque» (#31 del ejercicio de Jonás 4:5-11): «todo muy apretado
 * y mal diseñado». Las tarjetas se comparan en grilla, la idea central del
 * pastor va una sola vez arriba y el recorrido se lee como pasos.
 */
vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

describe('approachRoute', () => {
    it('parte por flechas', () => {
        expect(approachRoute('Introducción empática → Promesas de Dios → Aplicación práctica.')).toEqual([
            'Introducción empática',
            'Promesas de Dios',
            'Aplicación práctica',
        ]);
        expect(approachRoute('La planta -> El gusano -> La pregunta')).toHaveLength(3);
    });
    it('parte por números si no hay flechas', () => {
        expect(approachRoute('1. El enojo de Jonás 2. La planta 3. La pregunta de Dios')).toEqual([
            'El enojo de Jonás',
            'La planta',
            'La pregunta de Dios',
        ]);
    });
    it('sin marcas queda un solo paso; vacío, ninguno', () => {
        expect(approachRoute('Un recorrido narrativo por el capítulo')).toEqual(['Un recorrido narrativo por el capítulo']);
        expect(approachRoute('')).toEqual([]);
        expect(approachRoute(undefined)).toEqual([]);
    });
});

const preview = (id: string, direction: string): HomileticalApproachPreview => ({
    id,
    type: 'pastoral',
    tone: 'exhortativo',
    direction,
    purpose: 'Propósito',
    targetAudience: 'Creyentes',
    suggestedStructure: 'A → B → C',
    rationale: 'Porque sí.',
} as unknown as HomileticalApproachPreview);

function renderView(selectedId?: string, thesis?: string) {
    const onSelect = vi.fn();
    const onConfirm = vi.fn();
    render(
        <ApproachSelectionView
            previews={[preview('a', 'La compasión de Dios'), preview('b', 'El enojo del profeta')]}
            selectedId={selectedId}
            onSelect={onSelect}
            onConfirm={onConfirm}
            onRegenerate={() => {}}
            developing={false}
            regenerating={false}
            thesis={thesis}
        />,
    );
    return { onSelect, onConfirm };
}

describe('ApproachSelectionView', () => {
    it('las opciones son un grupo de radios y se eligen con teclado', () => {
        const { onSelect } = renderView();
        const radios = screen.getAllByRole('radio');
        expect(radios).toHaveLength(2);
        expect(screen.getByRole('radiogroup')).toBeTruthy();
        fireEvent.keyDown(radios[1]!, { key: 'Enter' });
        expect(onSelect).toHaveBeenCalledWith('b');
    });

    it('«Desarrollar» espera una elección; la elegida va en la barra', () => {
        renderView();
        expect(screen.getByRole('button', { name: /selection.develop/ })).toBeDisabled();
        expect(screen.getByText('homiletics.selection.none')).toBeTruthy();
    });

    it('con elección, la barra la nombra y «Desarrollar» confirma', () => {
        const { onConfirm } = renderView('b');
        expect(screen.getAllByRole('radio')[1]).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByText(/· El enojo del profeta/)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /selection.develop/ }));
        expect(onConfirm).toHaveBeenCalled();
    });

    it('la idea central del pastor aparece una vez, y sólo si existe', () => {
        renderView(undefined, 'Dios tiene compasión de los que no la merecen.');
        expect(screen.getAllByText('Dios tiene compasión de los que no la merecen.')).toHaveLength(1);
    });

    it('sin idea central no hay sección de tesis', () => {
        renderView(undefined, '   ');
        expect(screen.queryByText('homiletics.selection.thesisLabel')).toBeNull();
    });

    it('la ayuda empieza plegada', () => {
        renderView();
        expect(screen.queryByText('homiletics.typesTitle')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /helpToggle/ }));
        expect(screen.getByText('homiletics.typesTitle')).toBeTruthy();
    });
});

describe('approachRoute — números que no son pasos (revisión adversarial)', () => {
    it('«Salmo 23.» dentro de un paso no abre otro', () => {
        expect(approachRoute('1. El pastor del Salmo 23. El Señor guía 2. La mesa preparada')).toEqual([
            'El pastor del Salmo 23. El Señor guía',
            'La mesa preparada',
        ]);
    });
    it('sin «1.» al comienzo no es una lista', () => {
        expect(approachRoute('Como el Salmo 23. El pastor cuida')).toEqual(['Como el Salmo 23. El pastor cuida']);
    });
});
