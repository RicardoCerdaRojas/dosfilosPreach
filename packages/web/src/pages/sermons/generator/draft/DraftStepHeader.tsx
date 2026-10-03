import { MessageCircleQuestion, ArrowLeft, BookOpen, Eye, Loader2, Save, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/i18n';
import { WizardStepHeader } from '../WizardStepHeader';
import { ToolbarIconButton } from '../ToolbarIconButton';
import { RegenerateDraftAction } from './RegenerateDraftAction';

export interface DraftStepHeaderProps {
    activeTab: 'draft' | 'workshop';
    /** Con taller hay pestañas; sin él, la banda va sola. */
    hasWorkshop: boolean;
    title: string;
    /** Secciones listas / totales — sólo se lee en el taller. */
    readySections: { done: number; total: number };
    /** De dónde salió el borrador. Ausente en los anteriores al campo. */
    assembledFrom?: 'workshop' | 'generated';
    passage: string;
    onTogglePassage: () => void;
    generating: boolean;
    workshopHasDecisions: boolean;
    onGoToWorkshop: () => void;
    onRegenerate: (opciones: { archivar?: boolean }) => void;
    /** Las acciones propias del taller (hoja de estudio + armar borrador). */
    workshopActions: React.ReactNode;
    onBack: () => void;
    /** Abre el chat de consulta (hallazgo 32): transversal a las pestañas. */
    onConsult: () => void;
    onPreview: () => void;
    onSaveAndExit: () => void;
    onPublish: () => void;
    publishing: boolean;
    scanning: boolean;
    canPublish: boolean;
}

/**
 * LA BANDA DEL PASO ES UNA SOLA Y LAS PESTAÑAS VAN DENTRO.
 *
 * Vivía adentro del cuerpo del borrador, o sea dentro de la pestaña Borrador: al
 * pasar al Taller desaparecían el título y TODOS los botones del paso —publicar
 * incluido— y no quedaba forma de publicar sin volver a la otra pestaña.
 *
 * El reparto izquierda/derecha ES la regla: a la izquierda del separador, lo
 * que cambia con la pestaña (en el taller, armar; en el borrador, pasaje y
 * regenerar); a la derecha, lo que pertenece al SERMÓN y no al modo de trabajo
 * (volver, ver, guardar, publicar).
 *
 * Debe montarse DENTRO de un `<Tabs>` cuando hay taller: el `TabsList` necesita
 * el contexto de Radix.
 */
export function DraftStepHeader(props: DraftStepHeaderProps) {
    const { t } = useTranslation('generator');

    return (
        <WizardStepHeader
            leading={
                /* EL TALLER VA PRIMERO: se lee de izquierda a derecha en el
                   orden del trabajo —decidir y después armar—, el mismo que el
                   asistente ya usa arriba. El borrador es el resultado, no el
                   punto de partida. */
                props.hasWorkshop ? (
                    <TabsList>
                        <TabsTrigger value="workshop">{t('drafting.tabs.workshop')}</TabsTrigger>
                        <TabsTrigger value="draft">{t('drafting.tabs.draft')}</TabsTrigger>
                    </TabsList>
                ) : undefined
            }
            title={props.title}
            meta={
                props.activeTab === 'workshop'
                    ? t('drafting.sections.pendingCount', props.readySections)
                    : /* ADR-037: EL BORRADOR DICE DE DÓNDE VIENE. Armado desde
                         el taller o generado de una vez — y los anteriores a
                         este campo no dicen NADA: la ausencia de dato no es
                         evidencia, nunca se acusa por falta de registro. */
                      props.assembledFrom && (
                          <span
                              className={
                                  props.assembledFrom === 'workshop'
                                      ? 'rounded bg-primary/10 px-1.5 py-0.5 text-[11px] leading-none text-primary'
                                      : 'rounded bg-muted px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground'
                              }
                          >
                              {t(`drafting.provenance.${props.assembledFrom}`)}
                          </span>
                      )
            }
            documentActions={
                props.activeTab === 'workshop' ? (
                    props.workshopActions
                ) : (
                    <>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 bg-background border-primary/20 text-primary hover:text-primary hover:bg-primary/5"
                            onClick={props.onTogglePassage}
                        >
                            <BookOpen className="h-4 w-4" />
                            <span className="text-xs font-medium">{props.passage}</span>
                        </Button>

                        {/* REHACER DESDE CERO ES LA SALIDA DE EMERGENCIA, no una
                            herramienta de la barra. Estaba acá con el mismo peso
                            que el pasaje, siendo la acción que se salta el taller
                            entero. */}
                        <RegenerateDraftAction
                            loading={props.generating}
                            workshopHasDecisions={props.hasWorkshop && props.workshopHasDecisions}
                            onGoToWorkshop={props.onGoToWorkshop}
                            onRegenerate={props.onRegenerate}
                        />
                    </>
                )
            }
            navigationActions={
                <>
                    {/* ÍCONO + TOOLTIP para lo secundario; el texto queda en la
                        primaria. Abreviar no es ocultar: los tres son
                        universales (volver, ver, guardar) y el nombre vive en el
                        tooltip. */}
                    <ToolbarIconButton label={t('drafting.consult.open')} onClick={props.onConsult}>
                        <MessageCircleQuestion className="h-4 w-4" />
                    </ToolbarIconButton>

                    <ToolbarIconButton label={t('drafting.backToHomiletics')} onClick={props.onBack}>
                        <ArrowLeft className="h-4 w-4" />
                    </ToolbarIconButton>

                    <ToolbarIconButton label={t('drafting.preview')} onClick={props.onPreview}>
                        <Eye className="h-4 w-4" />
                    </ToolbarIconButton>

                    <ToolbarIconButton label={t('drafting.saveAndExit')} onClick={props.onSaveAndExit}>
                        <Save className="h-4 w-4" />
                    </ToolbarIconButton>

                    <Button
                        onClick={props.onPublish}
                        disabled={props.publishing || props.scanning || !props.canPublish}
                        size="sm"
                        // UNA PRIMARIA POR CONTEXTO: en el taller la acción del
                        // siguiente paso es armar el borrador; publicar espera
                        // su turno como secundaria y recupera el peso en la
                        // pestaña del borrador, donde sí es el paso natural.
                        variant={props.activeTab === 'workshop' ? 'outline' : 'default'}
                    >
                        {/* EL BOTÓN DICE LO QUE ESTÁ PASANDO, NO LO QUE SE PIDIÓ.
                            Antes mostraba "Publicando…" también durante el
                            contra-scan, que es la etapa LENTA (un callable de
                            1 GB que recorre la biblioteca: ~11 s en el caso
                            real). El pastor leía "Publicando", esperaba, no veía
                            nada, y concluía que se había roto — cuando sólo
                            estaba trabajando. Le costó un intento entero. */}
                        {props.scanning ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t('drafting.scanningLibrary')}
                            </>
                        ) : props.publishing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t('drafting.publishing')}
                            </>
                        ) : (
                            <>
                                <Upload className="mr-2 h-4 w-4" />
                                {t('drafting.publishSermon')}
                            </>
                        )}
                    </Button>
                </>
            }
        />
    );
}
