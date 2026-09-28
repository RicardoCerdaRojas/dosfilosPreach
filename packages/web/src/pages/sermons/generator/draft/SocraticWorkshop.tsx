import { useCallback, useEffect, useState } from 'react';
import { PanelDivider } from '@/components/ui/PanelDivider';
import { PanelGroup } from '@/components/ui/PanelGroup';
import { useTranslation } from '@/i18n';
import type { ElementsPromptInput, SermonElement, WalkSection } from '@dosfilos/domain';
import { SermonMap } from './SermonMap';
import { SectionElementsPanel } from './SectionElementsPanel';
import { SectionProsePanel } from './SectionProsePanel';
import { useWriteSection } from '@/hooks/useWriteSection';
import { scriptureLookupRef } from '@dosfilos/domain';
import { LocalBibleService } from '@/services/LocalBibleService';

interface Props {
    walk: readonly WalkSection[];
    activeSection: WalkSection;
    elements: Record<string, SermonElement[]>;
    onSelectSection: (sectionId: string) => void;
    onChangeElements: (sectionId: string, elements: SermonElement[]) => void;
    prose: Record<string, string>;
    onChangeProse: (sectionId: string, prose: string) => void;
    audienceRigor?: 'beginner' | 'seminary';
    passage: string;
    proposition?: string;
    points?: readonly string[];
    /** El estudio exegético, para que las propuestas salgan de SU trabajo. */
    study?: ElementsPromptInput['study'];
    /** Palabras clave del estudio, formateadas: la sección por punto las ofrece sin modelo. */
    studyKeyWords?: readonly string[];
}

const ANCHO_MIN = 200;
const PROSA_MIN = 320;
const PROSA_MAX = 720;
const PROSA_INICIAL = 460;
const CLAVE_PROSA = 'dosfilos.socraticProseWidth';
const ANCHO_MAX = 480;
const ANCHO_INICIAL = 288;
/** El ancho del mapa es preferencia de escritorio, no dato del sermón. */
const CLAVE_ANCHO = 'dosfilos.socraticMapWidth';

function anchoGuardado(clave: string, inicial: number, min: number, max: number): number {
    const crudo = Number(localStorage.getItem(clave));
    if (!Number.isFinite(crudo) || crudo <= 0) return inicial;
    return Math.min(max, Math.max(min, crudo));
}

/**
 * El taller socrático completo: mapa a la izquierda, sección activa a la derecha.
 *
 * EL MAPA SE REDIMENSIONA Y SE PLIEGA con el `PanelDivider` compartido —
 * no un control nuevo. Los títulos de los puntos son frases largas ("I. Dios
 * habla y revela su voluntad (vv. 1-2)"), así que un ancho fijo los parte en
 * tres líneas y el mapa deja de leerse de un vistazo, que es su único trabajo.
 *
 * El ancho se guarda en `localStorage` y no en el sermón: es una preferencia del
 * escritorio de quien trabaja, no un dato del sermón. Guardarlo en el documento
 * lo haría viajar entre pantallas de distinto tamaño, y ahí el valor correcto
 * en una es el equivocado en la otra.
 */
export function SocraticWorkshop(props: Props) {
    const { t } = useTranslation('generator');
    const [abierto, setAbierto] = useState(true);
    const [ancho, setAncho] = useState(ANCHO_INICIAL);
    const [prosaAbierta, setProsaAbierta] = useState(true);
    /**
     * La redacción se dispara desde el PANEL DE LA SECCIÓN, junto a las otras
     * acciones que le piden ayuda al modelo sobre esa misma sección. Vivía en
     * el riel de prosa: las acciones de una sección quedaban repartidas en dos
     * columnas y el pastor tenía que buscarlas.
     */
    const { write, writingId } = useWriteSection();
    const [anchoProsa, setAnchoProsa] = useState(PROSA_INICIAL);

    // Se lee después del primer render: en SSR/pruebas `localStorage` no existe,
    // y leerlo durante el render haría que el servidor y el cliente difieran.
    useEffect(() => {
        setAncho(anchoGuardado(CLAVE_ANCHO, ANCHO_INICIAL, ANCHO_MIN, ANCHO_MAX));
        setAnchoProsa(anchoGuardado(CLAVE_PROSA, PROSA_INICIAL, PROSA_MIN, PROSA_MAX));
    }, []);

    const redimensionar = useCallback((deltaPx: number) => {
        setAncho((previo) => {
            const siguiente = Math.min(ANCHO_MAX, Math.max(ANCHO_MIN, previo + deltaPx));
            localStorage.setItem(CLAVE_ANCHO, String(siguiente));
            return siguiente;
        });
    }, []);

    const redimensionarProsa = useCallback((deltaPx: number) => {
        setAnchoProsa((previo) => {
            const siguiente = Math.min(PROSA_MAX, Math.max(PROSA_MIN, previo + deltaPx));
            localStorage.setItem(CLAVE_PROSA, String(siguiente));
            return siguiente;
        });
    }, []);

    /**
     * La proposición YA DECIDIDA del punto al que pertenece la sección activa.
     *
     * La sección de exposición vive en `point.N.exposition` y la frase en
     * `point.N.proposition`: se busca por el `parentId`, así que basta con que
     * él la haya decidido para que la redacción la use. Si todavía no la
     * escribió, no viaja — y el prompt NO la inventa.
     */
    const proposicionDelPunto = props.activeSection.parentId
        ? (props.elements[`${props.activeSection.parentId}.proposition`] ?? [])
              .filter((e) => e.provenance !== 'descartado')
              .map((e) => e.text)
              .join(' ')
              .trim() || undefined
        : undefined;

    return (
        <div className="flex flex-col h-full min-h-[24rem]">
        {/* SIN ENCABEZADO PROPIO. El taller es una PESTAÑA del paso, no una
            pantalla aparte: el título del sermón, cuántas secciones van listas
            y la acción de armar el borrador viven en la banda del paso, junto a
            publicar y guardar. Cuando el taller tenía su propia banda, esa
            pestaña se quedaba sin los botones del paso —no había forma de
            publicar sin volver a Borrador— y el título aparecía dos veces al
            cambiar de pestaña. */}
        <PanelGroup className="items-stretch">
            {abierto && (
                <div style={{ width: ancho }} className="shrink-0 overflow-hidden">
                    <SermonMap
                        walk={props.walk}
                        elements={props.elements}
                        activeId={props.activeSection.id}
                        onSelect={props.onSelectSection}
                    />
                </div>
            )}

            <PanelDivider
                panelSide="left"
                isOpen={abierto}
                onToggle={() => setAbierto((v) => !v)}
                // Arrastrar con el riel plegado no tiene sentido: no hay nada
                // que ensanchar hasta que se abra.
                onResize={abierto ? redimensionar : undefined}
                title={t('drafting.sections.mapTitle')}
            />

            {/* COLUMNA DE TRABAJO: contenido acotado arriba, acciones al pie.
                Las acciones vivían en una barra propia bajo TODO el taller, y
                quedaban en una franja vacía compitiendo con la del paso. Acá
                pertenecen a la columna que el pastor está usando. */}
            <div className="flex-1 min-w-0 pl-1 flex flex-col">
              <div className="flex-1 overflow-y-auto">
                {/* MEDIDA DE LECTURA, ALINEADA A LA IZQUIERDA.
                    A todo el ancho las líneas pasaban de 200 caracteres y el ojo
                    pierde el renglón al volver. Pero CENTRAR el bloque fue peor:
                    el contenido se despegó del mapa y quedó flotando con un
                    vacío enorme a su izquierda. La medida se acota pegando el
                    texto al borde donde empieza la columna, no al medio. */}
                <div className="w-full max-w-3xl">
                <SectionElementsPanel
                    /* El panel guarda lo que es DE ESTA SECCIÓN: la idea a
                       medio escribir, las propuestas traídas y el aviso de que
                       no se pudieron traer. Sin `key`, React reusa la misma
                       instancia al cambiar de sección y esos tres quedan
                       colgando bajo el título de la siguiente: las propuestas
                       del contexto histórico aparecían como si fueran de la
                       conexión actual, con su explicación citando versículos
                       que la nueva sección no trata. La `key` monta un panel
                       por sección, que es lo que ya se estaba suponiendo. */
                    key={props.activeSection.id}
                    section={props.activeSection}
                    passage={props.passage}
                    proposition={props.proposition}
                    points={props.points}
                    study={props.study}
                    studyKeyWords={props.studyKeyWords}
                    elements={props.elements[props.activeSection.id] ?? []}
                    onChange={(els) => props.onChangeElements(props.activeSection.id, els)}
                    // No se le pasa a la sección que ES la proposición: se
                    // estaría mostrando a sí misma como insumo.
                    pointProposition={
                        props.activeSection.id.endsWith('.proposition') ? undefined : proposicionDelPunto
                    }
                    writing={writingId === props.activeSection.id}
                    hasProse={Boolean(props.prose[props.activeSection.id]?.trim())}
                    onWriteSection={async () => {
                        const texto = await write({
                            section: props.activeSection,
                            sectionLabel: t(props.activeSection.labelKey, props.activeSection.labelParams),
                            sectionJob: t(props.activeSection.jobKey),
                            elements: props.elements[props.activeSection.id] ?? [],
                            passage: props.passage,
                            proposition: props.proposition,
                            pointTitle: props.activeSection.parentLabel,
                            pointProposition: proposicionDelPunto,
                            scriptureText:
                                LocalBibleService.getVerses(
                                    scriptureLookupRef(props.activeSection.scriptureRef) ?? '',
                                ) ?? undefined,
                            audienceRigor: props.audienceRigor,
                        });
                        if (texto) props.onChangeProse(props.activeSection.id, texto);
                    }}
                    pointExpositionIdeas={
                        props.activeSection.parentId
                            ? (props.elements[`${props.activeSection.parentId}.exposition`] ?? [])
                                  .filter((e) => e.provenance !== 'descartado')
                                  .map((e) => e.text)
                            : undefined
                    }
                />
                </div>
              </div>

            </div>

            {/* El riel de prosa NO existe en las secciones `verbatim`: lo que el
                pastor escribió allí YA es el texto final, y abrir un editor
                vacío al lado sugeriría que falta redactarlo. */}
            {/* También en las secciones `cubierta`: la decisión está tomada,
                pero sus notas del bosquejo siguen necesitando redacción. */}
            {props.activeSection.mode === 'elements' && (
                <>
                    <PanelDivider
                        panelSide="right"
                        isOpen={prosaAbierta}
                        onToggle={() => setProsaAbierta((v) => !v)}
                        onResize={prosaAbierta ? redimensionarProsa : undefined}
                        title={t('drafting.prose.label')}
                    />
                    {prosaAbierta && (
                        <div style={{ width: anchoProsa }} className="shrink-0 overflow-hidden">
                            <SectionProsePanel
                                section={props.activeSection}
                                elements={props.elements[props.activeSection.id] ?? []}
                                prose={props.prose[props.activeSection.id]}
                                onProseChange={(texto) => props.onChangeProse(props.activeSection.id, texto)}
                                passage={props.passage}
                                proposition={props.proposition}
                                pointProposition={proposicionDelPunto}
                                audienceRigor={props.audienceRigor}
                            />
                        </div>
                    )}
                </>
            )}
        </PanelGroup>
        </div>
    );
}
