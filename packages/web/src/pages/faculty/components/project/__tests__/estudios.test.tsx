import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));
const { ProjectStudiesSection } = await import('../ProjectStudiesSection');
beforeEach(cleanup);

const pasaje = { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 1, verseEnd: 10 };
const estudio = (id: string, over: Record<string, unknown> = {}) => ({ id, passage: pasaje, phase: 'in-progress', updatedAt: new Date(), projectId: 'teo2', linkedProjectIds: [], ...over });

describe('ProjectStudiesSection', () => {
    it('cada estudio abre su trabajo; el que colabora se rotula', () => {
        render(<MemoryRouter><ProjectStudiesSection projectId="teo2" onNewStudy={vi.fn()} studies={[
            estudio('tp8', { title: 'TP #8' }),
            estudio('serie', { title: 'Santiago 4', projectId: 'otro', linkedProjectIds: ['teo2'] }),
        ] as never} /></MemoryRouter>);
        expect(screen.getByText('TP #8').closest('a')!.getAttribute('href')).toBe('/dashboard/exegesis/tp8');
        expect(screen.getAllByText('studies.linked')).toHaveLength(1);
    });

    it('cada estudio de origen lleva su tipo de trabajo; uno vinculado o con un tipo borrado, no (etapa 1b)', () => {
        render(<MemoryRouter><ProjectStudiesSection projectId="teo2" onNewStudy={vi.fn()} workTypes={[{ id: 'tp', label: 'TP Semanal' }, { id: 'pf', label: 'Paper final' }]} studies={[
            estudio('tp8', { title: 'TP #8', projectWorkTypeId: 'tp' }),
            estudio('viejo', { title: 'Viejo', projectWorkTypeId: 'borrado' }),
            estudio('serie', { title: 'Santiago 4', projectId: 'otro', linkedProjectIds: ['teo2'], projectWorkTypeId: 'pf' }),
        ] as never} /></MemoryRouter>);
        expect(screen.getByText('TP Semanal')).toBeInTheDocument();
        expect(screen.queryByText('Paper final')).toBeNull();
    });

    it('«Nuevo estudio» y el vacío', () => {
        const onNewStudy = vi.fn();
        render(<MemoryRouter><ProjectStudiesSection projectId="teo2" onNewStudy={onNewStudy} studies={[]} /></MemoryRouter>);
        expect(screen.getByText('studies.empty')).toBeInTheDocument();
        fireEvent.click(screen.getByText('studies.new'));
        expect(onNewStudy).toHaveBeenCalled();
    });
});
