import React, { useRef, useState } from 'react';
import { GestureResponderEvent, View } from 'react-native';
import { Canvas, Group, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { InkColor, InkStroke } from '@dosfilos/domain';
import { toNoteSpace, toScreenSpace } from '@dosfilos/domain';

import { ReadingModeTokens } from '@/core/theme/readingModes';
import { inkSignature, nearestStroke, showsBridge } from './inkGeometry';

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
}

const STROKE_WIDTH_EM = 0.07;
/** Puntos más juntos que esto son ruido del dedo, no intención. */
const MIN_POINT_DISTANCE = 1.5;

function inkColor(color: InkColor, tokens: ReadingModeTokens): string {
    if (tokens.highlightUnderline) return tokens.textPrimary;
    if (color === 'red') return tokens.timerOver;
    if (color === 'blue') return tokens.accent;
    return tokens.textPrimary;
}

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
    eraser,
    onErase,
    top,
    bottom,
    scrollOffset,
}: Props) {
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

    const begin = (e: GestureResponderEvent) => {
        const { pageX, pageY } = e.nativeEvent;
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

    const extend = (e: GestureResponderEvent) => {
        // Con la goma, arrastrar sigue borrando: se pasa por encima de varios
        // trazos como se pasaría una goma de verdad.
        if (eraser) {
            eraseAt(e.nativeEvent.pageX, e.nativeEvent.pageY);
            return;
        }
        if (!anchor.current) return;
        const at = toDoc(e.nativeEvent.pageX, e.nativeEvent.pageY);
        const last = points.current[points.current.length - 1];
        if (last && Math.hypot(at.x - last.x, at.y - last.y) < MIN_POINT_DISTANCE) return;
        points.current.push(at);
        // Asignar el valor compartido redibuja en Skia sin re-renderizar React.
        livePath.value = buildPath(points.current.map(toCanvas));
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
        setPending({ path: buildPath(captured.map(toCanvas)), signature });
        onFinishStroke(held.offset, {
            points: captured.map((p) => toNoteSpace(p, held.rect, bodySize)),
            width: STROKE_WIDTH_EM,
            color,
        });
    };

    return (
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
            onStartShouldSetResponder={(e) => penActive && e.nativeEvent.touches.length === 1}
            onMoveShouldSetResponder={(e) => penActive && e.nativeEvent.touches.length === 1}
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
                            color={inkColor(stroke.color, tokens)}
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
                        color={inkColor(color, tokens)}
                        style="stroke"
                        strokeWidth={STROKE_WIDTH_EM * bodySize}
                        strokeCap="round"
                        strokeJoin="round"
                    />
                ) : null}

                <Path
                    path={livePath}
                    color={inkColor(color, tokens)}
                    style="stroke"
                    strokeWidth={STROKE_WIDTH_EM * bodySize}
                    strokeCap="round"
                    strokeJoin="round"
                />
                </Group>
            </Canvas>
        </View>
    );
}
