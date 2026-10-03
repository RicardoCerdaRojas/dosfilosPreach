import type { SermonContent, SermonElement } from '@dosfilos/domain';
import { SocraticWorkshop } from './SocraticWorkshop';
import { StudyReadingSheet } from './StudyReadingSheet';
import { WorkshopDraftActions } from './WorkshopDraftActions';
import { studyFromExegesis, studyKeyWordsFromExegesis } from './workshopStudyProps';

interface WorkshopBaseProps {
    walk: any[];
    homiletics: any;
    exegesis: any;
    /** Decisiones y prosa POR SECCIÓN — la clave es el id de la sección. */
    elements: Record<string, SermonElement[]>;
    prose: Record<string, string>;
    audienceRigor: any;
    /** El estilo del manuscrito que guardó el usuario; ausente = el del sistema. */
    manuscriptStyle?: string;
}

/**
 * EL TALLER TIENE DOS SUPERFICIES Y VIVEN EN ARCHIVOS SEPARADOS A PROPÓSITO.
 *
 * El panel ocupa su pestaña; sus acciones viajan en la banda del paso. ARMAR EL
 * BORRADOR ES ACCIÓN DEL PASO, NO DEL PANEL: cuando el botón vivía dentro del
 * taller, se perdía al cambiar de pestaña — el pastor decidía todo y después no
 * encontraba con qué armarlo.
 */

export interface WorkshopPanelProps extends WorkshopBaseProps {
    activeSection: any;
    passage: string;
    onSelectSection: (id: string) => void;
    // Reciben el id de la sección: quien escribe siempre dice DÓNDE escribe.
    onChangeElements: (sectionId: string, elements: SermonElement[]) => void;
    onChangeProse: (sectionId: string, prose: string) => void;
}

export function WorkshopPanel(props: WorkshopPanelProps) {
    return (
        <SocraticWorkshop
            walk={props.walk}
            activeSection={props.activeSection}
            elements={props.elements}
            onSelectSection={props.onSelectSection}
            onChangeElements={props.onChangeElements}
            prose={props.prose}
            onChangeProse={props.onChangeProse}
            audienceRigor={props.audienceRigor}
            manuscriptStyle={props.manuscriptStyle}
            passage={props.passage}
            proposition={props.homiletics.homileticalProposition}
            points={(props.homiletics.outline?.mainPoints ?? []).map((p: any) => p.title)}
            study={studyFromExegesis(props.exegesis)}
            studyKeyWords={studyKeyWordsFromExegesis(props.exegesis)}
        />
    );
}

export interface WorkshopActionsProps extends WorkshopBaseProps {
    hasDraft: boolean;
    onProseChange: (sectionId: string, prose: string) => void;
    onAssemble: (armado: SermonContent) => Promise<void>;
}

export function WorkshopActions(props: WorkshopActionsProps) {
    return (
        <>
            {/* El estudio A UN GESTO mientras decide. Releerlo exigía salir del
                taller y perder la sección activa. */}
            {props.exegesis && <StudyReadingSheet study={props.exegesis} />}
            <WorkshopDraftActions
                walk={props.walk}
                elements={props.elements}
                prose={props.prose}
                points={(props.homiletics.outline?.mainPoints ?? []) as any[]}
                proposition={props.homiletics.homileticalProposition}
                audienceRigor={props.audienceRigor}
                manuscriptStyle={props.manuscriptStyle}
                onProseChange={props.onProseChange}
                onAssemble={props.onAssemble}
                hasDraft={props.hasDraft}
                homiletics={props.homiletics}
            />
        </>
    );
}
