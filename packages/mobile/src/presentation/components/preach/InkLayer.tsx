import React, { useRef, useState } from 'react';
import { GestureResponderEvent, View } from 'react-native';
import { Canvas, Group, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { InkColor, InkStroke, InkTool } from '@dosfilos/domain';
import { toNoteSpace, toScreenSpace } from '@dosfilos/domain';

import { ReadingModeTokens } from '@/core/theme/readingModes';
import { Gesture, GestureDetector, PointerType } from 'react-native-gesture-handler';
import { inkColorFor, inkSignature, inkTouchMode, nearestStroke, showsBridge, touchWrites } from './inkGeometry';

/**
 * Lo ÚNICO que la capa necesita de una nota: su id y sus trazos.
 *
 * Era `InkNote`, el tipo del sermón, con su ancla de texto y su reanclado. La
 * Biblia no necesita nada de eso —un versículo no se edita— pero sí necesita
 * exactamente el mismo lienzo. Pedir menos es lo que deja usarlo en los dos
 * lados sin que uno le imponga su modelo al otro.
 */
export interface InkDrawable {
    id: string;
    strokes: InkStroke[];
}

/** Dónde está en pantalla el párrafo al que se ancla una nota. */
export interface AnchorRect {
    x: number;
    y: number;
    height: number;
}

interface Props {
    tokens: ReadingModeTokens;
    notes: InkDrawable[];
    anchorRectFor: (note: InkDrawable) => AnchorRect | null;
    bodySize: number;
    penActive: boolean;
    /** Párrafo más cercano al punto donde empezó el trazo. */
    anchorAt: (screenX: number, screenY: number) => { offset: number; rect: AnchorRect } | null;
    onFinishStroke: (offset: number, stroke: InkStroke) => void;
    color: InkColor;
    /** Lápiz o resaltador (T-7). */
    tool: InkTool;
    /** Grosor del trazo nuevo, en unidades del cuerpo. */
    strokeWidthEm: number;
    eraser: boolean;
    /** Borra UN trazo, no la nota entera. Va el trazo mismo, no su número. */
    onErase: (noteId: string, stroke: InkStroke) => void;
    /** Alto del chrome superior: la capa arranca debajo para no taparlo. */
    top: number;
    /** Alto del tablero inferior, por la misma razón. */
    bottom: number;
    /**
     * Cuánto se desplazó el texto que está debajo, si se desplaza (la Biblia).
     *
     * Las anclas y los trazos viven en coordenadas del TEXTO —las de pantalla
     * más este desplazamiento—, y el lienzo se corre con él. Antes la tinta
     * quedaba fija en la pantalla mientras el capítulo se movía debajo.
     */
    scrollOffset?: SharedValue<number>;
    /**
     * Sólo el Apple Pencil escribe (T-9). El dedo sigue navegando: su toque
     * o su deslizamiento se le pasan a `onFingerGesture` con la X donde
     * empezó y donde terminó.
     */
    pencilOnly?: boolean;
    onFingerGesture?: (startX: number, endX: number) => void;
    /**
     * El texto de abajo se desplaza (la Biblia): con la tinta activa, la capa
     * lo mueve ella misma, a esta altura. Dos dedos desplazan siempre; con
     * «sólo Apple Pencil», también uno.
     */
    onScrollTo?: (y: number) => void;
}

/** Lo más que dura el trazo puente: el hueco que tapa es de un cuadro. */
const BRIDGE_MAX_MS = 600;

/** El resaltador se lee a través: translúcido. */
const HIGHLIGHTER_OPACITY = 0.3;
const opacityOf = (tool: InkTool | undefined) => (tool === 'highlighter' ? HIGHLIGHTER_OPACITY : 1);
/** Puntos más juntos que esto son ruido del dedo, no intención. */
const MIN_POINT_DISTANCE = 1.5;

const inkColor = (color: InkColor, tokens: ReadingModeTokens, highlighter = false) =>
    inkColorFor(color, tokens, highlighter);

/**
 * Construye el trazo con curvas cuadráticas entre puntos medios.
 *
 * Unir los puntos con rectas produce el trazo "robótico": se ven los
 * segmentos. Curvar entre los puntos medios, usando el punto capturado como
 * control, da una curva continua que atraviesa la mano del que escribe en vez
 * de perseguirla.
 */
function buildPath(points: { x: number; y: number }[]): SkPath {
    const path = Skia.Path.Make();
    if (!points.length) return path;
    path.moveTo(points[0].x, points[0].y);
    if (points.length === 1) return path;
    for (let i = 1; i < points.length - 1; i += 1) {
        const mid = {
            x: (points[i].x + points[i + 1].x) / 2,
            y: (points[i].y + points[i + 1].y) / 2,
        };
        path.quadTo(points[i].x, points[i].y, mid.x, mid.y);
    }
    const last = points[points.length - 1];
    path.lineTo(last.x, last.y);
    return path;
}

/**
 * La capa de tinta.
 *
 * ANCLADA AL PÁRRAFO. Cada nota se ata al bloque sobre el que se empezó a
 * escribir, y sus puntos se guardan relativos a ese bloque en unidades del
 * cuerpo. Al dibujar se pregunta dónde está ese párrafo AHORA: la nota lo
 * sigue cuando cambia el cuerpo, la sangría, la colometría o la reserva del
 * tercio inferior.
 *
 * Antes se anclaba a la PALABRA. Era más preciso y demasiado frágil: cientos
 * de posiciones por página que sólo se actualizaban si `onLayout` volvía a
 * dispararse, cosa que RN no hace si la vista no se movió. Apagar el tablero
 * dejaba quietas a las palabras de arriba, nadie re-reportaba, y la tinta se
 * quedaba sin dónde dibujarse. Un párrafo es igual de significativo como
 * referencia y son unos pocos por página.
 *
 * EL TRAZO NO PASA POR REACT. Los puntos van a un valor compartido que Skia
 * dibuja directo. Meterlos en el estado provocaba un render por punto: lento,
 * con muestras perdidas, y de ahí los segmentos rectos.
 */
export function InkLayer({
    tokens,
    notes,
    anchorRectFor,
    bodySize,
    penActive,
    anchorAt,
    onFinishStroke,
    color,
    tool,
    strokeWidthEm,
    eraser,
    onErase,
    top,
    bottom,
    scrollOffset,
    pencilOnly = false,
    onFingerGesture,
    onScrollTo,
}: Props) {
    // Fuera del React Compiler: el gesto del lápiz (T-9) se arma en el render
    // con callbacks que leen refs, y el compilador no distingue que corren
    // DESPUÉS, en el gesto. La capa ya evita re-renders a mano (el trazo vive
    // en un valor compartido de Skia), así que no pierde nada.
    'use no memo';
    /** Un toque en pantalla, llevado a coordenadas del texto. */
    const toDoc = (pageX: number, pageY: number) => ({ x: pageX, y: pageY + (scrollOffset?.value ?? 0) });
    // El lienzo se corre con el texto en el hilo de la interfaz, sin pasar por React.
    const scrollTransform = useDerivedValue(() => [{ translateY: -(scrollOffset?.value ?? 0) }]);
    const livePath = useSharedValue<SkPath>(Skia.Path.Make());
    /**
     * Dónde arranca el lienzo, en coordenadas de PANTALLA.
     *
     * Los toques llegan con `pageX/pageY`, que son de la ventana entera, y el
     * lienzo dibuja en las suyas. Antes se restaba sólo `top`, dando por
     * sentado que a la izquierda no había nada — cierto en el púlpito, que
     * ocupa toda la pantalla. En la Biblia hay un rail de 130 puntos a la
     * izquierda, así que cada trazo aparecía corrido ese mismo ancho hacia la
     * derecha. Se MIDE en vez de suponerse: así también sobrevive al panel
     * dividido y a cualquier cosa que se ponga al costado.
     */
    const [origin, setOrigin] = useState({ x: 0, y: top });
    const canvas = useRef<View | null>(null);
    const points = useRef<{ x: number; y: number }[]>([]);
    const anchor = useRef<{ offset: number; rect: AnchorRect } | null>(null);
    /**
     * El trazo recién soltado, dibujado tal cual quedó en pantalla.
     *
     * EL PARPADEO ERA UN FRAME VACÍO. Al levantar el dedo se borraba el trazo
     * vivo, pero la nota guardada todavía no había llegado al render: entre
     * una cosa y la otra no había nada dibujado y eso es lo que se ve como un
     * pestañeo. Este trazo puente cubre el hueco y se apaga solo cuando la
     * nota aparece — no con un efecto ni un temporizador, sino comparando
     * cuántos trazos había cuando se soltó contra cuántos hay ahora.
     */
    const [pending, setPending] = useState<{ path: SkPath; signature: string } | null>(null);
    /** Trazos que el gesto de goma en curso ya borró: no se borran dos veces. */
    const erasedInGesture = useRef(new Set<InkStroke>());

    // Lo dibujado AHORA. Si cambió desde que se soltó el dedo —llegó la nota,
    // se borró algo, se pasó de página—, el trazo puente sobra.
    const signature = inkSignature(notes);

    const toCanvas = (p: { x: number; y: number }) => ({
        x: p.x - origin.x,
        y: p.y - origin.y,
    });

    const eraseAt = (pageX: number, pageY: number) => {
        const { x, y } = toDoc(pageX, pageY);
        const hit = nearestStroke(notes, anchorRectFor, bodySize, x, y, erasedInGesture.current);
        if (!hit) return;
        erasedInGesture.current.add(hit.stroke);
        onErase(hit.noteId, hit.stroke);
    };

    const begin = (e: GestureResponderEvent) => beginAt(e.nativeEvent.pageX, e.nativeEvent.pageY);
    const beginAt = (pageX: number, pageY: number) => {
        // Un gesto nuevo: el puente del trazo anterior ya cumplió.
        setPending(null);
        if (eraser) {
            erasedInGesture.current = new Set();
            eraseAt(pageX, pageY);
            return;
        }
        const at = toDoc(pageX, pageY);
        anchor.current = anchorAt(at.x, at.y);
        points.current = [at];
        livePath.value = buildPath(points.current.map(toCanvas));
    };

    const extend = (e: GestureResponderEvent) => extendAt(e.nativeEvent.pageX, e.nativeEvent.pageY);
    const extendAt = (pageX: number, pageY: number) => {
        // Con la goma, arrastrar sigue borrando: se pasa por encima de varios
        // trazos como se pasaría una goma de verdad.
        if (eraser) {
            eraseAt(pageX, pageY);
            return;
        }
        if (!anchor.current) return;
        const at = toDoc(pageX, pageY);
        const last = points.current[points.current.length - 1];
        if (last && Math.hypot(at.x - last.x, at.y - last.y) < MIN_POINT_DISTANCE) return;
        points.current.push(at);
        // Asignar el valor compartido redibuja en Skia sin re-renderizar React.
        livePath.value = buildPath(points.current.map(toCanvas));
    };

    /** Descarta el trazo en curso sin guardarlo (llegó un segundo dedo: era desplazar). */
    const cancelStroke = () => {
        anchor.current = null;
        points.current = [];
        livePath.value = Skia.Path.Make();
    };

    const finish = () => {
        if (eraser) return;
        const held = anchor.current;
        const captured = points.current;
        anchor.current = null;
        points.current = [];
        livePath.value = Skia.Path.Make();
        // Un trazo sin ancla no se guarda: mejor perder un garabato suelto que
        // guardar tinta que no sabe a qué se refiere.
        if (!held || captured.length < 2) return;
        const bridge = { path: buildPath(captured.map(toCanvas)), signature };
        setPending(bridge);
        // El puente tapa un cuadro, no más. Antes vivía hasta que la firma
        // cambiara, y deshacer, ocultar o limpiar la devolvían a la de ese
        // momento: el trazo fantasma volvía (revisión adversarial).
        setTimeout(() => setPending((current) => (current === bridge ? null : current)), BRIDGE_MAX_MS);
        onFinishStroke(held.offset, {
            points: captured.map((p) => toNoteSpace(p, held.rect, bodySize)),
            width: strokeWidthEm,
            color,
            tool,
        });
    };

    /**
     * Sólo Apple Pencil (T-9). El gesto se activa a mano y sólo con el lápiz;
     * con el dedo falla, y su toque se le pasa a la navegación del atril.
     */
    const fingerStart = useRef<number | null>(null);
    /** El toque del lápiz que escribe (su id), o `null`. La palma no lo corta ni lo mueve. */
    const pencilTouch = useRef<number | null>(null);
    /** En este gesto hubo más de un toque (palma apoyada): no es un toque de navegación. */
    const multiTouch = useRef(false);
    // Los callbacks del gesto leen refs, pero corren en el gesto y no en el
    // render: el compilador no puede verlo a través del constructor encadenado.
    /* eslint-disable react-hooks/refs */
    const pencilGesture = Gesture.Pan()
        .enabled(penActive && pencilOnly)
        .manualActivation(true)
        .runOnJS(true)
        .onTouchesDown((e, manager) => {
            const touch = e.changedTouches[0];
            if (!touch) return;
            if (e.numberOfTouches > 1) multiTouch.current = true;
            if (pencilTouch.current !== null) return;
            if (touchWrites(e.pointerType === PointerType.STYLUS, true)) {
                pencilTouch.current = touch.id;
                manager.activate();
                beginAt(touch.absoluteX, touch.absoluteY);
            } else if (fingerStart.current === null) {
                fingerStart.current = touch.absoluteX;
            }
        })
        // Se sigue el toque del lápiz, no el centro de todos los toques: con
        // la palma apoyada, el centro cae entre los dos.
        .onTouchesMove((e) => {
            const touch = e.allTouches.find((t) => t.id === pencilTouch.current);
            if (touch) extendAt(touch.absoluteX, touch.absoluteY);
        })
        .onTouchesUp((e, manager) => {
            // Se levantó el lápiz: el trazo termina, aunque la palma siga apoyada.
            if (pencilTouch.current !== null && e.changedTouches.some((t) => t.id === pencilTouch.current)) {
                pencilTouch.current = null;
                finish();
                return;
            }
            const start = fingerStart.current;
            const lastTouch = e.numberOfTouches <= 1;
            if (lastTouch) fingerStart.current = null;
            // Mientras el lápiz escribe, levantar la palma no hace nada.
            if (pencilTouch.current !== null || start === null || !lastTouch) return;
            const wasMulti = multiTouch.current;
            multiTouch.current = false;
            manager.fail();
            // Un toque de navegación es de UN dedo: la palma no pasa página.
            if (!wasMulti) onFingerGesture?.(start, e.changedTouches[0]?.absoluteX ?? start);
        })
        .onFinalize(() => {
            if (pencilTouch.current !== null) finish();
            pencilTouch.current = null;
            fingerStart.current = null;
            multiTouch.current = false;
        });

    /**
     * La tinta sobre un texto que se desplaza (la Biblia). Toque a toque se
     * decide escribir o desplazar (`inkTouchMode`), y si se desplaza la capa
     * mueve la lista ella misma: los toques no le llegan, porque la capa está
     * encima.
     */
    const scroll = useRef<{ startOffset: number; startY: number } | null>(null);
    const drawTouch = useRef<number | null>(null);
    const drawIsStylus = useRef(false);
    /** Hasta dónde se mandó desplazar la última vez: `scrollOffset` llega un cuadro tarde. */
    const lastScrollTarget = useRef<number | null>(null);
    /** El gesto ya se activó: activarlo de nuevo es una transición inválida en UIKit. */
    const activated = useRef(false);
    /**
     * La goma espera a que el dedo se mueva o se levante. Si borrara al
     * apoyarse, el primer dedo de un desplazamiento con dos dedos borraba un
     * trazo antes de que llegara el segundo (revisión adversarial).
     */
    const pendingErase = useRef<{ x: number; y: number } | null>(null);
    const activate = (manager: { activate: () => void }) => {
        if (activated.current) return;
        activated.current = true;
        manager.activate();
    };
    const currentOffset = () => lastScrollTarget.current ?? scrollOffset?.value ?? 0;
    const averageY = (touches: { absoluteY: number }[]) =>
        touches.reduce((sum, t) => sum + t.absoluteY, 0) / Math.max(1, touches.length);
    const scrollGesture = Gesture.Pan()
        .enabled(penActive && !!onScrollTo)
        .manualActivation(true)
        .runOnJS(true)
        .onTouchesDown((e, manager) => {
            const touch = e.changedTouches[0];
            if (!touch) return;
            const stylus = e.pointerType === PointerType.STYLUS;
            // Un trazo de lápiz en curso no lo corta nada: ni la palma ni otro dedo.
            if (drawIsStylus.current) return;
            // El lápiz escribe siempre, aunque haya una palma apoyada desplazando.
            // OJO: RNGH toma el tipo de un toque CUALQUIERA del evento: con la
            // palma ya apoyada, el lápiz puede llegar como dedo (supuesto en el
            // dispositivo; arreglarlo pide parchear código nativo).
            if (stylus) {
                scroll.current = null;
                pendingErase.current = null;
                drawTouch.current = touch.id;
                drawIsStylus.current = true;
                activate(manager);
                beginAt(touch.absoluteX, touch.absoluteY);
                return;
            }
            if (inkTouchMode(e.numberOfTouches, false, pencilOnly) === 'scroll') {
                // Un trazo de dedo empezado era el comienzo de un desplazamiento.
                if (drawTouch.current !== null) {
                    drawTouch.current = null;
                    cancelStroke();
                }
                pendingErase.current = null;
                scroll.current = { startOffset: currentOffset(), startY: averageY(e.allTouches) };
                activate(manager);
                return;
            }
            if (scroll.current || drawTouch.current !== null) return;
            drawTouch.current = touch.id;
            activate(manager);
            if (eraser) pendingErase.current = { x: touch.absoluteX, y: touch.absoluteY };
            else beginAt(touch.absoluteX, touch.absoluteY);
        })
        .onTouchesMove((e) => {
            if (scroll.current) {
                const target = Math.max(0, scroll.current.startOffset + scroll.current.startY - averageY(e.allTouches));
                lastScrollTarget.current = target;
                onScrollTo?.(target);
                return;
            }
            const touch = e.allTouches.find((t) => t.id === drawTouch.current);
            if (!touch) return;
            if (pendingErase.current) {
                beginAt(pendingErase.current.x, pendingErase.current.y);
                pendingErase.current = null;
            }
            extendAt(touch.absoluteX, touch.absoluteY);
        })
        .onTouchesUp((e) => {
            if (drawTouch.current !== null && e.changedTouches.some((t) => t.id === drawTouch.current)) {
                drawTouch.current = null;
                drawIsStylus.current = false;
                // Un toque de goma sin moverse: borra donde se apoyó.
                if (pendingErase.current) {
                    beginAt(pendingErase.current.x, pendingErase.current.y);
                    pendingErase.current = null;
                }
                finish();
            }
            // Al levantar un dedo de dos, se sigue desplazando desde donde quedó.
            // `numberOfTouches` ya no cuenta al que se levantó: se mira a los que quedan.
            if (scroll.current) {
                const rest = e.allTouches.filter((t) => !e.changedTouches.some((c) => c.id === t.id));
                if (rest.length >= 1) scroll.current = { startOffset: currentOffset(), startY: averageY(rest) };
            }
        })
        .onFinalize(() => {
            if (drawTouch.current !== null) finish();
            drawTouch.current = null;
            drawIsStylus.current = false;
            pendingErase.current = null;
            scroll.current = null;
            activated.current = false;
            lastScrollTarget.current = null;
        });
    /* eslint-enable react-hooks/refs */

    const layer = (
        <View
            ref={canvas}
            onLayout={() =>
                canvas.current?.measureInWindow((x, y) =>
                    setOrigin((current) =>
                        current.x === x && current.y === y ? current : { x, y },
                    ),
                )
            }
            style={{ position: 'absolute', top, left: 0, right: 0, bottom }}
            pointerEvents={penActive ? 'auto' : 'none'}
            // UN DEDO ESCRIBE, DOS DESPLAZAN. Con el lápiz encendido la capa
            // se quedaba con todos los gestos, así que en un texto que scrollea
            // —la Biblia es un capítulo entero, no una página paginada— bajar
            // al versículo 10 dibujaba una raya en vez de desplazar. Al no
            // reclamar el gesto de dos dedos, éste baja al lector que está
            // debajo.
            onStartShouldSetResponder={(e) => penActive && !pencilOnly && !onScrollTo && e.nativeEvent.touches.length === 1}
            onMoveShouldSetResponder={(e) => penActive && !pencilOnly && !onScrollTo && e.nativeEvent.touches.length === 1}
            onResponderGrant={begin}
            onResponderMove={extend}
            onResponderRelease={finish}
            onResponderTerminate={finish}
        >
            <Canvas style={{ flex: 1 }} pointerEvents="none">
                <Group transform={scrollTransform}>
                {notes.map((note) => {
                    const rect = anchorRectFor(note);
                    if (!rect) return null;
                    return note.strokes.map((stroke, index) => (
                        <Path
                            key={`${note.id}-${index}`}
                            path={buildPath(
                                stroke.points.map((p) =>
                                    toCanvas(toScreenSpace(p, rect, bodySize)),
                                ),
                            )}
                            color={inkColor(stroke.color, tokens, stroke.tool === 'highlighter')}
                            opacity={opacityOf(stroke.tool)}
                            style="stroke"
                            strokeWidth={stroke.width * bodySize}
                            strokeCap="round"
                            strokeJoin="round"
                        />
                    ));
                })}

                {pending && showsBridge(pending.signature, signature) ? (
                    <Path
                        path={pending.path}
                        color={inkColor(color, tokens, tool === 'highlighter')}
                        opacity={opacityOf(tool)}
                        style="stroke"
                        strokeWidth={strokeWidthEm * bodySize}
                        strokeCap="round"
                        strokeJoin="round"
                    />
                ) : null}

                <Path
                    path={livePath}
                    color={inkColor(color, tokens, tool === 'highlighter')}
                    opacity={opacityOf(tool)}
                    style="stroke"
                    strokeWidth={strokeWidthEm * bodySize}
                    strokeCap="round"
                    strokeJoin="round"
                />
                </Group>
            </Canvas>
        </View>
    );

    if (onScrollTo) return <GestureDetector gesture={scrollGesture}>{layer}</GestureDetector>;
    return pencilOnly ? <GestureDetector gesture={pencilGesture}>{layer}</GestureDetector> : layer;
}
