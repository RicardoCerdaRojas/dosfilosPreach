import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

/** TP #9 (B33): reensamblar pisó sin aviso una edición del ensamble, que además no se verificó. */
let papel: unknown = null;
vi.mock('@/hooks/exegesis/useExegesisPaper', () => ({ useExegesisPaper: () => ({ paper: papel }) }));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
const { AssemblyHandEditNotice } = await import('../AssemblyHandEditNotice');

const conEnsamble = (version: Record<string, unknown>) => ({
    title: 'Santiago 4:11–17', displayLanguage: 'es', assignmentBrief: '',
    passage: { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 11, verseEnd: 17 },
    steps: [
        { id: 'v', kind: 'verse', order: 1, verseRef: { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 12, verseEnd: 12 }, state: 'accepted', accepted: { markdown: 'Prosa.' }, current: null },
        { id: 'a', kind: 'assembly', order: 99, verseRef: null, state: 'accepted', accepted: version, current: version },
    ],
});

beforeEach(() => cleanup());

describe('el aviso del ensamble editado a mano', () => {
    it('editado y sin verificar: avisa que reensamblar lo reemplaza y que no está verificado', () => {
        papel = conEnsamble({ origin: 'edited', markdown: '# Santiago 4:11–17\n\nCorregido a mano.' });
        render(<AssemblyHandEditNotice paperId="p" />);
        expect(screen.getByText('detail.steps.assembly.handEdit.title')).toBeInTheDocument();
        expect(screen.getByText('detail.steps.assembly.handEdit.body')).toBeInTheDocument();
        expect(screen.getByText('detail.steps.assembly.handEdit.unverified')).toBeInTheDocument();
    });

    it('verificado después: avisa solo de reensamblar', () => {
        papel = conEnsamble({ origin: 'edited', markdown: 'Otro.', verifications: { lastRunAt: new Date() } });
        render(<AssemblyHandEditNotice paperId="p" />);
        expect(screen.getByText('detail.steps.assembly.handEdit.body')).toBeInTheDocument();
        expect(screen.queryByText('detail.steps.assembly.handEdit.unverified')).toBeNull();
    });

    it('el ensamble generado no avisa', () => {
        papel = conEnsamble({ origin: 'generated', markdown: 'Otro.' });
        const { container } = render(<AssemblyHandEditNotice paperId="p" />);
        expect(container).toBeEmptyDOMElement();
    });
});
