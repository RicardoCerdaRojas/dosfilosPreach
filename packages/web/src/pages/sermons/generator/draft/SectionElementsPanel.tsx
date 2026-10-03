import { useState } from 'react';
import { useArrivingProposals } from './externalProposalsContext';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n';
import {
    splitElementLines,
    classifyContribution,
    type SermonElement,
    type ElementProvenance,
    type ContributionKind,
    scriptureLookupRef,
    type WalkSection,
} from '@dosfilos/domain';
import { useProposeElements, type ProposedElement } from '@/hooks/useProposeElements';
import { useProposeAuthorityQuotes } from '@/hooks/useProposeAuthorityQuotes';
import type { ElementsPromptInput } from '@dosfilos/domain';
import { FirestoreGreekFindingsRepository } from '@dosfilos/infrastructure';
import { useFirebase } from '@/context/firebase-context';
import { toast } from 'sonner';
import { SectionContextBlocks } from './SectionContextBlocks';
import { ElementProposals } from './ElementProposals';
import { DecidedElementsList } from './DecidedElementsList';
import { LocalBibleService } from '@/services/LocalBibleService';

interface Props {
    section: WalkSection;
    passage: string;
    proposition?: string;
    points?: readonly string[];
    /** Proposición decidida para el punto, si la sección no es esa misma. */
    pointProposition?: string;
    /**
     * Lo que él decidió decir en la exposición del punto.
     *
     * Es la declaración MÁS ESPECÍFICA de lo que el punto dice —"hijo de
     * Amitai", "capital del Imperio Asirio"— y por eso es mejor consulta para
     * buscar en su biblioteca que la frase-tesis sola, que encuentra lo
     * genérico del tema.
     */
    pointExpositionIdeas?: readonly string[];
    /** El estudio exegético, fuente primaria de las propuestas. */
    study?: ElementsPromptInput['study'];
    /**
     * Las palabras clave del estudio, ya formateadas para el sermón.
     *
     * Alimentan la sección de palabras por punto SIN pasar por el modelo:
     * son material trabajado y verificado por el pastor — pedirle a un LLM
     * que las "proponga" es darle ocasión de reescribir un dato léxico.
     */
    studyKeyWords?: readonly string[];
    /** Redacta la sección. Vive acá para que las acciones de la sección no se repartan. */
    onWriteSection?: () => void;
    writing?: boolean;
    hasProse?: boolean;
    elements: SermonElement[];
    onChange: (elements: SermonElement[]) => void;
}

let seq = 0;
const nextId = () => `el-${Date.now().toString(36)}-${seq++}`;

/**
 * ADR-037 — el taller de UNA sección: el pastor decide qué ideas van, y la
 * prosa se escribe después a partir de esas decisiones.
 *
 * DOS CAMINOS, Y EL ORDEN IMPORTA. "Yo aporto la idea" va PRIMERO y siempre
 * visible; "propóneme" es un botón que hay que pulsar. Invertirlo — abrir con
 * las propuestas — convierte el flujo en elegir de un menú, y elegir no es
 * originar: el número de autoría se desplomaría por diseño de la pantalla, no
 * por lo que el pastor sabe.
 */
export function SectionElementsPanel(props: Props) {
    const { t } = useTranslation('generator');
    const { section } = props;
    /** En `verbatim` lo que escribe ES el texto final del sermón, no una idea sobre él. */
    const esVerbatim = section.mode === 'verbatim';
    /**
     * Una sección de UNA sola decisión: no se parte por líneas y escribir otra
     * reemplaza. Lo que cuenta como unidad lo declara la sección.
     */
    const esUnaIdea = section.oneIdea === true;
    /** Ni `verbatim` ni una imagen se trocean por saltos de línea. */
    const unaSolaEntrada = esVerbatim || esUnaIdea;
    /**
     * Texto propio de la sección verbatim. Cada una declara el suyo: compartir
     * uno hacía que la proposición del punto pidiera "El título del sermón".
     */
    const vk = (sufijo: string) => `${section.verbatimKey ?? ''}.${sufijo}`;

    /**
     * El texto bíblico de la sección, a la vista mientras decide.
     *
     * La proposición del punto resume lo que la congregación tiene que ver EN
     * el versículo: escribirla de memoria es peor, y obligarlo a abrir otra
     * pestaña para consultarlo es fricción en el momento exacto en que está
     * pensando. Lectura local y síncrona, sin llamada de red.
     */
    /** Para el prompt de propuestas: proponer de memoria es lo que se evita. */
    const versiculo = LocalBibleService.getVerses(scriptureLookupRef(section.scriptureRef) ?? '');
    const { propose, loading, error } = useProposeElements();
    const { propose: proponerCitas, loading: buscandoCitas } = useProposeAuthorityQuotes();
    const { user } = useFirebase();
    /** La cita se SELECCIONA de su biblioteca; no se pide "una idea de cita". */
    /**
     * El texto multilínea entra como UNA unidad aunque la sección acumule:
     * una cita pegada con sus saltos de línea no son tres citas. Es la mitad
     * que sobrevive de la vieja decisión-única de las citas.
     */
    const noPartir = unaSolaEntrada || section.id.endsWith('.authorityQuote');
    const esCitaDeAutoridad = section.id.endsWith('.authorityQuote');
    /** Ítems finales (palabras clave): no se redactan y se proponen SIN modelo. */
    const esItemsFinales = Boolean(section.definition?.itemsAreFinal);
    const [mine, setMine] = useState('');
    const [proposals, setProposals] = useState<ProposedElement[]>([]);

    // Lo que llega del chat de consulta («Llevar a mis ideas») entra como
    // propuesta de ESTA sección: se elige, se edita o se descarta.
    useArrivingProposals(section.id, llegadas => setProposals(prev => [...prev, ...llegadas]));

    const decided = props.elements.filter((e) => e.provenance !== 'descartado');

    /**
     * Agrega VARIAS ideas de un tirón.
     *
     * El pastor escribe listas —una idea por línea— y esperar que pulse el
     * botón por cada una convierte en tedio lo que hace natural. El plural no
     * es una comodidad: es un solo `onChange`, y encadenar el singular desde
     * React perdería todas las escrituras menos la última.
     */
    const add = (
        texts: readonly string[],
        provenance: ElementProvenance,
        proposedText?: string,
        // La fuente de la propuesta, SIN el fragmento: el excerpt sirve para
        // decidir y vive en la propuesta; al elemento sólo viaja lo que la
        // bibliografía imprime. Guardar el fragmento entero por elemento
        // engordaría el autosave con texto que ya nadie muestra.
        source?: { title: string; author?: string; page?: string },
    ) => {
        const nuevos: SermonElement[] = texts
            .map((t) => t.trim())
            .filter((t) => t.length > 0)
            .map((text) => {
                // El sistema clasifica; el pastor NO tiene que hacerlo. Si se
                // equivoca, lo corrige con un clic y `kindAuto` conserva lo que
                // se había propuesto, para saber cuánto se equivoca.
                const kind = classifyContribution(text);
                return {
                    id: nextId(),
                    sectionId: section.id,
                    text,
                    provenance,
                    kind,
                    kindAuto: kind,
                    proposedText,
                    ...(source ? { source: { title: source.title, ...(source.author ? { author: source.author } : {}), ...(source.page ? { page: source.page } : {}) } } : {}),
                    decidedAt: new Date(),
                };
            });
        if (nuevos.length === 0) return;
        if (!unaSolaEntrada) {
            props.onChange([...props.elements, ...nuevos]);
            return;
        }
        // SECCIÓN DE UNA SOLA DECISIÓN. Dos matices que costaron trabajo real:
        //
        // 1. DESCARTAR NO REEMPLAZA. El descarte es un REGISTRO, no una
        //    decisión de contenido: descartar una propuesta borraba la cita ya
        //    elegida — pérdida silenciosa que el fundador encontró eligiendo
        //    tres citas seguidas.
        // 2. Los descartes anteriores SE CONSERVAN al decidir: qué rechazó
        //    dice tanto como qué aceptó.
        if (provenance === 'descartado') {
            props.onChange([...props.elements, ...nuevos]);
            return;
        }
        const habiaDecision = props.elements.some((e) => e.provenance !== 'descartado');
        props.onChange([...props.elements.filter((e) => e.provenance === 'descartado'), ...nuevos]);
        // El reemplazo se AVISA. La regla es deliberada —"un punto se respalda
        // con una voz"— pero ejecutarla en silencio se lee como pantalla rota:
        // "agregué tres y solo veo una".
        if (habiaDecision) toast.info(t('drafting.elements.replacedPrevious'));
    };

    const remove = (id: string) => props.onChange(props.elements.filter((e) => e.id !== id));

    /** El pastor corrige la clasificación. Su corrección manda siempre. */
    const flipKind = (id: string) =>
        props.onChange(
            props.elements.map((e) =>
                e.id === id
                    ? { ...e, kind: (e.kind === 'elemento' ? 'directiva' : 'elemento') as ContributionKind }
                    : e,
            ),
        );

    const handlePropose = async () => {
        // LAS CITAS PRIMERO: también son ítems finales (no se redactan), pero
        // su mecanismo de propuesta es OTRO — se buscan en la biblioteca, no
        // en el estudio de palabras. Con la rama genérica antes, este botón
        // le traería palabras hebreas a la sección de citas.
        if (esCitaDeAutoridad) {
            const r = await proponerCitas({
                // La cita debe respaldar lo que el punto AFIRMA, no el pasaje
                // en general: la proposición es la mejor consulta que hay.
                // La consulta suma la tesis del punto y lo que decidió decir en
                // él: cuanto más específica, más probable que NO encuentre nada
                // — y decirle la verdad sobre lo que va a predicar es mejor que
                // traerle algo tangencial al tema general.
                query: [props.pointProposition, ...(props.pointExpositionIdeas ?? [])]
                    .filter(Boolean)
                    .join(' ')
                    .trim() || section.parentLabel || props.passage,
                userId: user?.uid,
                passage: props.passage,
                pointTitle: section.parentLabel,
                pointProposition: props.pointProposition,
            });
            if (r.kind === 'ok') setProposals(r.quotes);
            // Los tres casos sin resultado se distinguen: que su biblioteca no
            // tenga nada del tema no es lo mismo que tener y que no encaje, y
            // ninguno de los dos es un error.
            else toast.info(t(`drafting.elements.quotes.${r.kind}`));
            return;
        }
        if (esItemsFinales) {
            // DETERMINISTA: las palabras vienen del estudio Y de los hallazgos
            // que el pastor guardó en el analizador griego — no del modelo. Se
            // filtran las que ya decidió o descartó: re-proponer su propio
            // trabajo es la forma más rápida de que abandone el flujo.
            const yaVistas = new Set(props.elements.map((e) => e.text.trim()));
            const delEstudio = (props.studyKeyWords ?? [])
                .filter((k) => !yaVistas.has(k.trim()))
                .map((text) => ({ text, why: t('drafting.elements.keyWords.fromStudy') }));
            // EL PUENTE DEL ANALIZADOR: hallazgos por USUARIO, no por sermón —
            // desde el analizador no se sabe en qué sermón se usarán, y acá
            // decidir cuál pertenece a este punto es su gesto de siempre.
            let delAnalizador: { text: string; why: string }[] = [];
            if (user?.uid) {
                try {
                    const findings = await new FirestoreGreekFindingsRepository().list(user.uid);
                    delAnalizador = findings
                        .filter((f) => !yaVistas.has(f.formatted.trim()))
                        .map((f) => ({
                            text: f.formatted,
                            why: t('drafting.elements.keyWords.fromAnalyzer', { reference: f.reference }),
                        }));
                } catch (err) {
                    // Sin hallazgos no se bloquea el estudio: quedan las del estudio.
                    console.warn('[taller] no se pudieron leer los hallazgos del analizador', err);
                }
            }
            const vistos = new Set<string>();
            const restantes = [...delEstudio, ...delAnalizador].filter((p) =>
                vistos.has(p.text.trim()) ? false : (vistos.add(p.text.trim()), true),
            );
            if (restantes.length === 0) {
                toast.info(t('drafting.elements.keyWords.sinPalabras'));
                return;
            }
            setProposals(restantes);
            return;
        }

        const nuevos = await propose({
            passage: props.passage,
            sectionLabel: t(section.labelKey, section.labelParams),
            sectionJob: t(section.jobKey),
            // El botón propone DESDE el versículo y la proposición, no en el
            // aire: los elementos de la exposición son las partes que desglosan
            // esa frase.
            pointProposition: props.pointProposition,
            scriptureText: versiculo ?? undefined,
            proposition: props.proposition,
            points: props.points,
            study: props.study,
            // Lo ya decidido viaja al prompt: re-proponer su propio trabajo es
            // la forma más rápida de que abandone el flujo.
            // Sus indicaciones del bosquejo cuentan como ya decidido: proponerle
            // de vuelta lo que él mismo escribió vacía el flujo.
            alreadyDecided: [...(section.coveredBy ?? []), ...decided.map((e) => e.text)],
        });
        setProposals(nuevos);
    };

    const consume = (index: number) => setProposals((p) => p.filter((_, i) => i !== index));

    // SIN MARCO. La tarjeta con borde de acento hacía que el panel se leyera
    // como un objeto flotando junto al mapa, en vez de como la columna de
    // trabajo del taller. El encabezado ya dice dónde está.
    return (
        <div className="px-5 py-4 space-y-5">
            <div className="space-y-1">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                    {t(section.labelKey, section.labelParams)}
                </h3>
                <p className="text-sm text-muted-foreground">{t(section.jobKey)}</p>
            </div>

            <SectionContextBlocks section={section} pointProposition={props.pointProposition} />

            {/* SECCIÓN CUBIERTA: se muestra y se corta acá. Volver a preguntar lo
                que ya decidió le pediría decidir dos veces la misma cosa, con el
                riesgo de que la segunda contradiga a la primera. */}
            {section.status === 'cubierta' ? null : (
              <>
            {/* Camino 1 — su idea. Primero y siempre abierto. */}
            <div className="space-y-2">
                <label htmlFor="mi-idea" className="text-sm font-medium">
                    {esVerbatim ? t(vk('label')) : t('drafting.elements.myIdeaLabel')}
                </label>
                <Textarea
                    id="mi-idea"
                    value={mine}
                    onChange={(e) => setMine(e.target.value)}
                    placeholder={t(esVerbatim ? vk('placeholder') : 'drafting.elements.myIdeaPlaceholder')}
                    rows={esVerbatim ? 2 : 4}
                    className="resize-none"
                />
                {!noPartir && (
                    <p className="text-xs text-muted-foreground">{t('drafting.elements.onePerLine')}</p>
                )}
                {esUnaIdea && (
                    <p className="text-xs text-muted-foreground">{t('drafting.elements.oneIdeaHint')}</p>
                )}
                <Button
                    size="sm"
                    onClick={() => {
                        // En `verbatim` hay UN texto final: escribir otro reemplaza
                        // el anterior en vez de acumular. Un sermón no tiene dos
                        // títulos, y dejar los dos obligaría a borrar a mano el
                        // que sobra.
                        add(noPartir ? [mine] : splitElementLines(mine), 'pastor');
                        setMine('');
                    }}
                    disabled={(noPartir ? [mine.trim()].filter(Boolean) : splitElementLines(mine)).length === 0}
                >
                    <Plus className="h-4 w-4 mr-1.5" />
                    {esVerbatim ? t(vk('add')) : t('drafting.elements.addMine')}
                </Button>
            </div>

            <ElementProposals
                proposeKey={
                    esCitaDeAutoridad
                        ? 'drafting.elements.quotes.propose'
                        : esItemsFinales
                          ? 'drafting.elements.keyWords.propose'
                          : esVerbatim
                            ? vk('propose')
                            : 'drafting.elements.propose'
                }
                proposeMoreKey={
                    esCitaDeAutoridad
                        ? 'drafting.elements.quotes.proposeMore'
                        : esItemsFinales
                          ? 'drafting.elements.keyWords.proposeMore'
                          : esVerbatim
                            ? vk('proposeMore')
                            : 'drafting.elements.proposeMore'
                }
                loading={loading || buscandoCitas}
                error={error}
                proposals={proposals}
                onPropose={handlePropose}
                onUse={(p, i) => {
                    add([p.text], 'elegido', undefined, p.source);
                    consume(i);
                }}
                onEdit={(p, i, texto) => {
                    // El texto propuesto viaja con el elemento: sin el original,
                    // `editado` no es auditable y la procedencia deja de
                    // significar algo.
                    add([texto], 'editado', p.text, p.source);
                    consume(i);
                }}
                onWriteSection={esItemsFinales ? undefined : props.onWriteSection}
                writing={props.writing}
                hasProse={props.hasProse}
                canWrite={decided.length > 0}
                onDiscard={(p, i) => {
                    // Descartar SE REGISTRA aunque no entre al sermón: qué
                    // rechazó dice tanto como qué aceptó.
                    add([p.text], 'descartado');
                    consume(i);
                }}
            />
              </>
            )}

            <DecidedElementsList
                elements={props.elements}
                titleKey={esVerbatim ? vk('decided') : 'drafting.elements.decidedTitle'}
                singleEntry={unaSolaEntrada}
                onFlipKind={flipKind}
                onRemove={remove}
            />

            {/* CONSEJO, NO LÍMITE — decisión del fundador: varias citas se
                permiten, y este argumento se le muestra al pastor para que
                decida con él. Mismo contrato que el resto del taller: "se te
                señala; tú decides. No bloquea." */}
            {esCitaDeAutoridad && decided.length >= 2 && (
                <p className="text-xs text-muted-foreground italic">
                    {t('drafting.elements.quotes.multiVoiceAdvice')}
                </p>
            )}

        </div>
    );
}
