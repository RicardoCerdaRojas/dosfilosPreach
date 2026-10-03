import { useState } from 'react';
import { Loader2, PenLine, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import {
    assembleDraft,
    assembleTransitions,
    missingForDraft,
    scriptureLookupRef,
    type SermonElement,
    type WalkSection,
} from '@dosfilos/domain';
import type { HomileticalAnalysis, SermonContent } from '@dosfilos/domain';
import { LocalBibleService } from '@/services/LocalBibleService';
import { useWriteSection } from '@/hooks/useWriteSection';

interface Props {
    walk: readonly WalkSection[];
    elements: Record<string, SermonElement[]>;
    prose: Record<string, string>;
    points: readonly { title?: string; application?: string; scriptureReferences?: string[] }[];
    /** Bosquejo completo: `assembleTransitions` compone el recordatorio desde él. */
    homiletics: HomileticalAnalysis;
    proposition?: string;
    audienceRigor?: 'beginner' | 'seminary';
    manuscriptStyle?: string;
    onProseChange: (sectionId: string, prose: string) => void;
    onAssemble: (draft: SermonContent) => void | Promise<void>;
    /** Ya existe un borrador: entonces esta acción lo REHACE, no lo crea. */
    hasDraft?: boolean;
}

/**
 * Las dos acciones que cierran el taller: escribir lo que falta y armar el
 * borrador con lo escrito.
 *
 * "ESCRIBIR TODO" NO ES UN ATAJO PARA SALTARSE LAS DECISIONES. Sólo redacta
 * secciones que YA tienen algo decidido; las vacías las deja vacías y las
 * informa. Si escribiera igual, sería la puerta de atrás que vuelve inútil el
 * flujo entero — el pastor pulsaría el botón grande y volvería a tener un sermón
 * que nadie decidió.
 */
export function WorkshopDraftActions(props: Props) {
    const { t } = useTranslation('generator');
    const { write } = useWriteSection();
    const [escribiendo, setEscribiendo] = useState<{ hechas: number; total: number } | null>(null);
    /**
     * Huella de lo que había cuando se armó por última vez.
     *
     * Sirve para APAGAR el botón cuando no hay nada nuevo que incorporar. Un
     * botón siempre activo se lee como una tarea pendiente —el fundador
     * preguntó dos veces por qué seguía ahí— y además invita a rearmar de balde,
     * lo que archiva una versión idéntica y ensucia el historial.
     *
     * Arranca en null y no se persiste: al recargar no se sabe con qué se armó
     * el borrador guardado, y ahí lo seguro es dejar rearmar.
     */
    const [huellaArmada, setHuellaArmada] = useState<string | null>(null);

    const entrada = {
        walk: props.walk,
        elements: props.elements,
        prose: props.prose,
        points: props.points,
        // Los encabezados de la introducción son texto de cara al usuario: el
        // dominio devuelve claves y la traducción se inyecta desde acá.
        t,
    };

    /**
     * Ensamblar y COMPONER las transiciones.
     *
     * `assembleTransitions` ya existía y arma el recordatorio —proposición +
     * puntos— con datos verbatim del bosquejo. Reusarlo evita una segunda forma
     * de construir lo mismo: duplicarlo es exactamente cómo se llegó a tener dos
     * prompts del regenerador que divergieron.
     */
    const componer = (prosa: Record<string, string>) =>
        assembleTransitions(assembleDraft({ ...entrada, prose: prosa }), props.homiletics);
    const faltantes = missingForDraft(entrada);
    const primeraFaltante = faltantes[0];

    /**
     * Con decisiones y sin prosa: son las que este botón puede redactar.
     *
     * Las `cubierta` ENTRAN: la decisión ya está tomada, pero lo que él escribió
     * en el bosquejo son notas y llevarlas al sermón tal cual sería publicar su
     * borrador de trabajo.
     */
    const redactables = props.walk.filter(
        (s) =>
            s.mode === 'elements' &&
            // Los ítems finales (palabras clave) no se redactan: entran al
            // borrador tal cual. Redactarlos produciría un párrafo donde el
            // sermón espera una lista de datos.
            !s.definition.itemsAreFinal &&
            !props.prose[s.id]?.trim() &&
            ((props.elements[s.id] ?? []).some((e) => e.provenance !== 'descartado') ||
                // Sólo si su material ES contenido. El recordatorio de la
                // transición es CONTEXTO: redactar desde él produciría prosa que
                // repite la proposición, que es justo el duplicado recién
                // corregido.
                (s.coveredIsContent === true && (s.coveredBy ?? []).length > 0)),
    );

    /**
     * Redacta lo pendiente y arma. UN SOLO PASO, porque es el caso normal.
     *
     * Estaban separados para permitir armar a medio camino, y eso sigue
     * disponible en el botón secundario. Pero el fundador esperaba que armar
     * escribiera primero —"¿primero se escriben las que faltan y luego se
     * construye?"— y tenía razón: obligarlo a descubrir la secuencia hace que
     * el camino habitual dependa de adivinarla, y quien no la adivine arma un
     * esqueleto sin saber por qué.
     */
    const hayPendientes = redactables.length > 0;

    /**
     * Qué contenido entraría hoy al borrador. Se comparan los TEXTOS, no las
     * referencias: reordenar el mapa o volver a renderizar no es un cambio del
     * sermón, y apagar el botón por identidad de objeto lo dejaría encendido
     * siempre.
     */
    const huellaActual = JSON.stringify([
        Object.entries(props.prose)
            .map(([k, v]) => [k, v.trim()])
            .sort(),
        Object.entries(props.elements)
            .map(([k, els]) => [k, els.filter((e) => e.provenance !== 'descartado').map((e) => e.text)])
            .sort(),
    ]);
    const sinCambios = huellaArmada === huellaActual;

    const armar = (prosa: Record<string, string>) => {
        void props.onAssemble(componer(prosa));
        setHuellaArmada(
            JSON.stringify([
                Object.entries(prosa)
                    .map(([k, v]) => [k, v.trim()])
                    .sort(),
                Object.entries(props.elements)
                    .map(([k, els]) => [k, els.filter((e) => e.provenance !== 'descartado').map((e) => e.text)])
                    .sort(),
            ]),
        );
    };

    const escribirYArmar = async () => {
        const prosaNueva = await escribirTodo();
        armar({ ...props.prose, ...prosaNueva });
    };

    const escribirTodo = async (): Promise<Record<string, string>> => {
        setEscribiendo({ hechas: 0, total: redactables.length });
        // Se acumula acá y se devuelve: el estado de React no se habrá
        // actualizado todavía cuando el ensamblado corra a continuación, y
        // armar con el mapa viejo produciría el esqueleto que se acaba de
        // evitar escribiendo.
        const escritas: Record<string, string> = {};
        for (const [i, seccion] of redactables.entries()) {
            const proposicion = seccion.parentId
                ? (props.elements[`${seccion.parentId}.proposition`] ?? [])
                      .filter((e) => e.provenance !== 'descartado')
                      .map((e) => e.text)
                      .join(' ')
                      .trim() || undefined
                : undefined;
            const desdeElBosquejo = (seccion.coveredIsContent ? (seccion.coveredBy ?? []) : []).map((text, i) => ({
                id: `${seccion.id}.covered.${i}`,
                sectionId: seccion.id,
                text,
                kind: 'elemento' as const,
                provenance: 'pastor' as const,
                decidedAt: new Date(),
            }));
            const propios = (props.elements[seccion.id] ?? []).filter((e) => e.provenance !== 'descartado');

            const texto = await write({
                section: seccion,
                sectionLabel: t(seccion.labelKey, seccion.labelParams),
                sectionJob: t(seccion.jobKey),
                elements: propios.length > 0 ? propios : desdeElBosquejo,
                passage: '',
                proposition: props.proposition,
                pointTitle: seccion.parentLabel,
                pointProposition: proposicion,
                scriptureText:
                    LocalBibleService.getVerses(scriptureLookupRef(seccion.scriptureRef) ?? '') ?? undefined,
                audienceRigor: props.audienceRigor,
                manuscriptStyle: props.manuscriptStyle,
            });
            if (texto) {
                escritas[seccion.id] = texto;
                props.onProseChange(seccion.id, texto);
            }
            setEscribiendo({ hechas: i + 1, total: redactables.length });
        }
        setEscribiendo(null);
        return escritas;
    };

    return (
        /* SIN BORDE NI PADDING PROPIOS. Los tenía de cuando estas acciones
           vivían al pie del taller y necesitaban separarse del contenido de
           arriba. En la banda del paso ese `pt-3` corría la fila entera hacia
           abajo y la botonera del Taller quedaba más baja que la del Borrador,
           que es la misma banda. */
        <div className="flex flex-wrap items-center gap-2">
                {/* La acción principal hace el camino completo. La parcial queda
                    disponible al lado, sin que haya que adivinar el orden. */}
                <Button
                    size="sm"
                    onClick={() => void (hayPendientes ? escribirYArmar() : armar(props.prose))}
                    disabled={!!escribiendo || (!hayPendientes && sinCambios)}
                    /* SE AVISA LO QUE FALTA, PERO NO SE BLOQUEA. El pastor puede
                       querer armar a medio camino para verlo tomar forma. En la
                       banda no cabe una segunda línea, así que el aviso viaja en
                       el botón: cuántas faltan lo dice el contador del título y
                       CUÁLES lo dice el mapa, con su círculo vacío. */
                    title={
                        primeraFaltante
                            ? t('drafting.assemble.missing', {
                                  count: faltantes.length,
                                  first: t(primeraFaltante.labelKey, primeraFaltante.labelParams),
                              })
                            : undefined
                    }
                >
                    {escribiendo ? (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                        <FileText className="h-4 w-4 mr-1.5" />
                    )}
                    {escribiendo
                        ? t('drafting.assemble.writingProgress', escribiendo)
                        : hayPendientes
                          ? t('drafting.assemble.writeAndBuild', { count: redactables.length })
                          : sinCambios
                            ? t('drafting.assemble.upToDate')
                            : t(props.hasDraft ? 'drafting.assemble.rebuild' : 'drafting.assemble.build')}
                </Button>

                {hayPendientes && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => armar(props.prose)}
                        disabled={!!escribiendo}
                    >
                        <PenLine className="h-4 w-4 mr-1.5" />
                        {t('drafting.assemble.buildPartial')}
                    </Button>
                )}
        </div>
    );
}
