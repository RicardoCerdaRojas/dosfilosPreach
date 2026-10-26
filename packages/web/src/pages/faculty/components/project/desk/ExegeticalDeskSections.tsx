import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AIProject, DeskPhase, DeskSermonInput, ProjectDeskModel } from '@dosfilos/domain';
import { ProjectFramingConsolidateDialog } from '../ProjectFramingConsolidateDialog';
import { ProjectFramingDialog } from '../ProjectFramingDialog';
import { ProjectFramingLogDialog, type FramingStudy } from '../ProjectFramingLogDialog';
import { SourcesSection } from './SourcesSection';
import { isLaterEmptyPhase } from './primitives';
import { PericopeTable } from './exegetical/PericopeTable';
import { ReadingHistoryDialog } from './exegetical/ReadingHistoryDialog';
import { ReadingSection } from './exegetical/ReadingSection';
import { SynthesisSection } from './exegetical/SynthesisSection';
import { useExegeticalDeskActions, useOldNoteText } from './exegetical/useExegeticalDeskActions';

export interface ExegeticalDeskSectionsProps {
    project: AIProject;
    desk: ProjectDeskModel;
    /** «Editar»: el diálogo del encuadre del panel, tal como está guardado. */
    onOpenFraming: () => void;
    /**
     * Los sermones del usuario, si el panel los tiene: la mesa abre la copia
     * publicada y reconoce el sermón de un estudio fuera de la serie.
     */
    sermons?: ReadonlyArray<DeskSermonInput>;
    /** Los sermones no se pudieron leer: la columna «Sermón» dice «—», no «sin sermón». */
    sermonsFailed?: boolean;
}

/**
 * Las secciones del escritorio Exegético, en el orden del trabajo
 * (`docs/FASE_ESCRITORIO_PROYECTO_2026-10.md` §3): 1 Tu lectura del libro ·
 * 2 Fuentes · 3 y 4 La mesa de perícopas · 5 Síntesis. Cada una lleva su
 * ancla `fase-<id>` para el recorrido. Todo lo que se escribe lo escribe el
 * pastor: la nota de antes se precarga y él confirma; las anotaciones y la
 * idea revisada son suyas.
 */
export function ExegeticalDeskSections({ project, desk, onOpenFraming, sermons, sermonsFailed = false }: ExegeticalDeskSectionsProps) {
    const navigate = useNavigate();
    const acciones = useExegeticalDeskActions(project);
    const ex = desk.exegetical;
    const nota = useOldNoteText(project, ex?.framing.oldNote ?? null);
    const [anotar, setAnotar] = useState<{ studyId: string | null } | null>(null);
    const [revisar, setRevisar] = useState(false);
    const [historia, setHistoria] = useState(false);
    const [pasarNota, setPasarNota] = useState(false);

    const estudios = useMemo<FramingStudy[]>(
        () => desk.studies.map(s => ({ id: s.id, title: s.title || null, passage: s.passage })),
        [desk.studies],
    );
    if (!ex) return null;

    const fase = (id: string): DeskPhase | undefined => desk.phases.find(p => p.id === id);
    const framing = project.framing ?? null;
    // El vacío completo, solo en la fase activa; las posteriores por empezar, en una línea.
    const despues = (id: string) => isLaterEmptyPhase(desk.phases, desk.activePhaseId, id);

    return (
        <>
            <ReadingSection
                project={project}
                framing={ex.framing}
                phase={fase('passage')}
                onEdit={onOpenFraming}
                onPassNote={() => setPasarNota(true)}
                note={nota}
            />
            <SourcesSection projectId={project.id} sources={ex.sources} phase={fase('sources')} phaseNumber={2} later={despues('sources')} />
            <PericopeTable
                project={project}
                desk={ex}
                division={fase('division')}
                pericopes={fase('pericopes')}
                studies={desk.studies}
                sermons={sermons}
                sermonsFailed={sermonsFailed}
                later={despues('division')}
                onAnnotate={studyId => setAnotar({ studyId })}
                onNavigate={to => navigate(to)}
            />
            <SynthesisSection
                synthesis={ex.synthesis}
                framing={ex.framing}
                phase={fase('synthesis')}
                studies={estudios}
                later={despues('synthesis')}
                onAnnotate={() => setAnotar({ studyId: null })}
                onRevise={() => setRevisar(true)}
                onShowHistory={() => setHistoria(true)}
            />

            <ProjectFramingLogDialog
                open={!!anotar}
                onOpenChange={o => { if (!o) setAnotar(null); }}
                studies={estudios}
                initialStudyId={anotar?.studyId ?? null}
                saving={acciones.saving}
                onSave={async entry => { await acciones.annotate(entry); setAnotar(null); }}
            />
            <ProjectFramingConsolidateDialog
                open={revisar}
                onOpenChange={setRevisar}
                framing={framing}
                studies={estudios}
                saving={acciones.saving}
                onSave={async input => { await acciones.consolidate(input); setRevisar(false); }}
            />
            <ReadingHistoryDialog
                open={historia}
                onOpenChange={setHistoria}
                originalIdea={ex.framing.originalIdea}
                log={framing?.hypothesisLog ?? []}
                revision={framing?.revision ?? null}
                stale={ex.framing.revision === 'stale'}
                studies={estudios}
            />
            {/* «Pasar tu nota al encuadre»: el mismo diálogo, con la nota precargada. */}
            <ProjectFramingDialog
                project={project}
                open={pasarNota}
                onOpenChange={setPasarNota}
                prefillNote={nota.text}
                saving={acciones.saving}
                onSave={async save => { await acciones.saveFraming(save); setPasarNota(false); }}
            />
        </>
    );
}
