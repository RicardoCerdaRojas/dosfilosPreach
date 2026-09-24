import { MAX_VOICE_SAMPLES, selectAcademicVoiceSamples, selectVoiceSamples } from '@dosfilos/domain';
import type {
    AcademicVoiceSample,
    IResourceContentReader,
    IUserProseReader,
    IVoiceProfileRepository,
} from '@dosfilos/domain';

export interface VoiceSampleDeps {
    voiceProfileRepository?: IVoiceProfileRepository;
    contentReader: IResourceContentReader;
    proseReader?: IUserProseReader;
}

/**
 * Unos párrafos de la prosa del autor, de un texto que él declaró suyo.
 *
 * Vive en un servicio y no dentro de un caso de uso porque las TRES piezas
 * del documento la necesitan igual: los versículos, la introducción y la
 * conclusión. Estaba sólo en el compositor de versículos, de modo que el
 * cuerpo del trabajo salía con la voz del autor y las dos partes que un
 * profesor lee con más atención —cómo abre y cómo cierra— salían con la del
 * modelo. Tres copias de esta lógica serían tres criterios distintos sobre
 * qué es la voz de una persona.
 *
 * Un fallo de lectura devuelve lista vacía: componer sin su registro es
 * molesto; no componer es peor.
 */
export async function loadAcademicVoiceSamples(
    ownerId: string,
    deps: VoiceSampleDeps,
): Promise<AcademicVoiceSample[]> {
    if (!deps.voiceProfileRepository) return [];
    try {
        const perfil = await deps.voiceProfileRepository.getProfile(ownerId);
        if (!perfil) return [];

        // Manda el texto académico: es el registro que este trabajo pide.
        // Los sermones rellenan lo que falte, y sólo si el autor los eligió:
        // son prosa suya con certeza, pero predicar no es escribir un trabajo.
        const deTexto = perfil.resourceId
            ? selectAcademicVoiceSamples((await deps.contentReader.getTextContent(perfil.resourceId)) ?? '')
            : [];
        if (deTexto.length >= MAX_VOICE_SAMPLES || !perfil.useSermons || !deps.proseReader) {
            return deTexto.slice(0, MAX_VOICE_SAMPLES);
        }

        const sermones = await deps.proseReader.workshopSermons(ownerId, 8);
        const delTaller = selectVoiceSamples(sermones, { maxSamples: MAX_VOICE_SAMPLES - deTexto.length });
        // Las posiciones de los sermones CONTINÚAN las del texto en vez de
        // volver a empezar en cero: la lista se lee como una sola secuencia, y
        // dos muestras distintas con la misma posición describen mal de dónde
        // salieron.
        return [
            ...deTexto,
            ...delTaller.map((muestra, i) => ({
                excerpt: muestra.excerpt,
                position: (deTexto.length + i) / MAX_VOICE_SAMPLES,
            })),
        ];
    } catch (err) {
        console.warn('[academicVoiceSamples] no se pudo leer el perfil de voz:', err);
        return [];
    }
}
