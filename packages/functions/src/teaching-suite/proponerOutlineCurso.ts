import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import { clientePorRuta } from '../llm/clientePorRuta';
import { buildOutlinePrompt, type GeneroSoportado } from './buildOutlinePrompt';
import { MENSAJE_NO_DISPONIBLE } from './planGeneration';

/**
 * Teaching Suite F3 (curso) — propone el OUTLINE de un curso desde un estudio.
 *
 * Síncrono: la salida es pequeña (lista de sesiones), no el plan completo, así
 * que cabe holgada en el timeout del callable. El docente revisa/ajusta el
 * outline; luego cada sesión se genera por separado (job de Slice B) con su
 * `alcance`. No genera planes ni clases aquí.
 */

const GENEROS_SOPORTADOS: GeneroSoportado[] = ['exegesis', 'doctrina'];
const MAX_SESIONES = 12;

interface ProponerOutlineInput {
  estudioId?: string;
  genero?: string;
  sesionesSugeridas?: number;
}

interface Sesion {
  titulo: string;
  alcance: string;
  min: number;
}

function readPromptAsset(rel: string): string {
  return readFileSync(join(__dirname, 'assets', 'prompts', rel), 'utf-8');
}

function coerceOutline(raw: string): Sesion[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpsError('internal', 'El asistente no devolvió un esquema legible. Reintenta.');
  }
  const obj = parsed as { sesiones?: unknown };
  const arr = Array.isArray(obj?.sesiones) ? obj.sesiones : Array.isArray(parsed) ? parsed : null;
  if (!arr || arr.length === 0) {
    throw new HttpsError('internal', 'El esquema propuesto no tiene sesiones. Reintenta.');
  }
  const sesiones = arr.slice(0, MAX_SESIONES).map((s) => {
    const x = (s ?? {}) as Record<string, unknown>;
    return {
      titulo: String(x.titulo ?? '').trim() || 'Sesión',
      alcance: String(x.alcance ?? '').trim(),
      min: Number.isFinite(Number(x.min)) ? Math.round(Number(x.min)) : 45,
    } satisfies Sesion;
  });
  if (sesiones.some((s) => !s.alcance)) {
    throw new HttpsError('internal', 'Alguna sesión quedó sin alcance. Reintenta.');
  }
  return sesiones;
}

export const proponerOutlineCurso = onCall(
  { ...appCheckCallableOptions(), secrets: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY'], timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
    const ownerId = request.auth.uid;
    const input = (request.data ?? {}) as ProponerOutlineInput;

    const estudioId = String(input.estudioId ?? '').trim();
    const genero = input.genero as GeneroSoportado;
    if (!estudioId) throw new HttpsError('invalid-argument', 'estudioId requerido');
    if (!GENEROS_SOPORTADOS.includes(genero)) {
      throw new HttpsError('invalid-argument', 'genero no soportado (exegesis | doctrina)');
    }
    const sugeridas = Number(input.sesionesSugeridas);
    const sesionesSugeridas =
      Number.isFinite(sugeridas) && sugeridas > 0 ? Math.min(Math.round(sugeridas), MAX_SESIONES) : undefined;

    const db = getFirestore();
    const estudioSnap = await db.collection('extractions').doc(estudioId).get();
    if (!estudioSnap.exists) throw new HttpsError('not-found', 'Estudio no encontrado');
    const estudio = estudioSnap.data() as { userId?: string; markdown?: string };
    if (estudio.userId && estudio.userId !== ownerId) {
      throw new HttpsError('permission-denied', 'El estudio no es tuyo');
    }
    const material = String(estudio.markdown ?? '').trim();
    if (material.length < 40) {
      throw new HttpsError('failed-precondition', 'El estudio no tiene contenido suficiente');
    }

    const { system, prompt } = buildOutlinePrompt({
      refs: { skill: readPromptAsset('SKILL.md'), genero: readPromptAsset(`genero-${genero}.md`) },
      estudio: material,
      genero,
      sesionesSugeridas,
    });

    const llm = await clientePorRuta({
      usage: { feature: 'teachingSuite.proponerOutlineCurso', userId: ownerId },
      timeoutSeconds: 120,
    });
    let raw: string;
    try {
      raw = await llm.generate({
        system,
        prompt,
        responseMimeType: 'application/json',
        temperature: 0.4,
        maxOutputTokens: 2000,
      });
    } catch (err) {
      console.error('[teaching-suite] fallo del proveedor (outline):', err);
      throw new HttpsError('unavailable', MENSAJE_NO_DISPONIBLE);
    }

    return { sesiones: coerceOutline(raw) };
  },
);
