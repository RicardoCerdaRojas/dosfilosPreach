import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Check } from 'lucide-react';

/** Prueba del fundador (NT785): cumplido el estado del arte, su página quedaba sin entrada. */
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
const { ProjectRoadmap } = await import('../ProjectRoadmap');

const fase = (id: string, kind: string) => ({ phase: { id, title: id, description: '', icon: Check, isComplete: () => true, cta: { label: `abrir ${id}`, kind } }, complete: true });

describe('las fases del recorrido se pueden abrir', () => {
    it('una fase ya cumplida abre su página', () => {
        const onPhaseCta = vi.fn();
        render(<ProjectRoadmap typeLabel="Curso" onPhaseCta={onPhaseCta} roadmap={{ phases: [fase('Encargo', 'charge'), fase('Estado del arte', 'stateOfArt'), { ...fase('Entregas', 'study'), complete: false }], activeIndex: 2, allComplete: false } as never} />);
        fireEvent.click(screen.getByRole('button', { name: /Estado del arte/ }));
        expect(onPhaseCta).toHaveBeenCalledWith('stateOfArt');
    });
});
