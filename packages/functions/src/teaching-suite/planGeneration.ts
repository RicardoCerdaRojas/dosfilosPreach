import { readFileSync } from 'fs';
import { join } from 'path';
import { clientePorRuta } from '../llm/clientePorRuta';
import { buildPlanPrompt, type GeneroSoportado, type Modalidad, type PromptRefs } from './buildPlanPrompt';

/**
 * Teaching Suite F3 — núcleo de generación de un `plan` desde un estudio.
 *
 * Pieza reutilizable: el trigger asíncrono `generarPlanJob` la usa para una
 * sesión suelta, y el curso multi-sesión (Eje 2) la usará por cada sesión con su
 * `alcance`. Carga las refs congeladas del skill, arma el prompt, llama a
 * Anthropic y devuelve un candidato saneado a la forma mínima de un `plan` (la
 * validación dura del contrato corre client-side con validatePlan de domain).
 *
 * No lanza HttpsError (corre fuera de un callable): los fallos son Error planos
 * que el trigger persiste como estado 'error' del job.
 */

export const ARTEFACTOS_CLASE = ['presentacion', 'notas', 'hoja'];

/**
 * Mensaje genérico para el usuario cuando la llamada al proveedor de generación
 * falla (cuota/créditos, rate-limit, red, 5xx). NUNCA exponer el error crudo del
 * proveedor: filtra el nombre del servicio, saldo de créditos, request_id, etc.
 * (regla del proyecto: no exponer IA/proveedor en UI). El detalle real va a logs.
 */
export const MENSAJE_NO_DISPONIBLE =
  'El asistente no está disponible en este momento. Inténtalo de nuevo en unos minutos.';
/** Consejería 1-a-1: guía de sesión + hoja del aconsejado (sin presentación/notas). */
export const ARTEFACTOS_SESION = ['guia_sesion', 'hoja'];

/** Artefactos según género/modalidad (consejería-sesión es el único caso especial). */
export function artefactosPara(genero: GeneroSoportado, modalidad?: Modalidad): string[] {
  return genero === 'consejeria' && modalidad === 'sesion' ? [...ARTEFACTOS_SESION] : [...ARTEFACTOS_CLASE];
}

function readPromptAsset(rel: string): string {
  return readFileSync(join(__dirname, 'assets', 'prompts', rel), 'utf-8');
}

export function loadRefs(genero: GeneroSoportado): PromptRefs {
  return {
    skill: readPromptAsset('SKILL.md'),
    contrato: readPromptAsset('contrato-plan.md'),
    tipos: readPromptAsset('tipos-de-lamina.md'),
    genero: readPromptAsset(`genero-${genero}.md`),
  };
}

export function slugify(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

/** Sanea el candidato a la forma mínima de un `plan` (sin validar el contrato). */
export function coerceCandidate(
  raw: string,
  genero: GeneroSoportado,
  marcaId: string,
  idSugerido: string,
  modalidad?: Modalidad,
): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('El asistente no devolvió un plan legible.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('El asistente no devolvió un objeto plan.');
  }
  const plan = parsed as Record<string, unknown>;
  if (!Array.isArray(plan.diapositivas) || !Array.isArray(plan.bloques)) {
    throw new Error('El plan propuesto no tiene la forma esperada.');
  }
  // Fijar los campos que el cliente eligió (no confiar en que el modelo los
  // respete). El render resuelve la marca por `clase.marcaId`.
  plan.genero = genero;
  plan.marca = marcaId;
  if (genero === 'consejeria') {
    plan.modalidad = modalidad ?? 'sesion';
  }
  if (typeof plan.id !== 'string' || !/^[a-z0-9_-]+$/.test(plan.id)) {
    plan.id = idSugerido;
  }
  // Los artefactos los fija el género/modalidad (no se confía en el modelo).
  plan.artefactos = artefactosPara(genero, modalidad);
  return plan;
}

export interface GenerarPlanArgs {
  estudio: string;
  genero: GeneroSoportado;
  modalidad?: Modalidad;
  marcaId: string;
  idSugerido: string;
  alcance?: string;
  erroresPrevios?: string[];
  /** Para atribuir el gasto LLM a quien lo provoca. Opcional: sin él va a `unknown`. */
  userId?: string;
}

/** Genera un candidato a `plan` (una sesión). Lanza Error plano si falla. */
export async function generarPlan(args: GenerarPlanArgs): Promise<Record<string, unknown>> {
  const { estudio, genero, modalidad, marcaId, idSugerido, alcance, erroresPrevios, userId } = args;
  const { system, prompt } = buildPlanPrompt({
    refs: loadRefs(genero),
    estudio,
    genero,
    modalidad,
    marcaId,
    idSugerido,
    artefactos: artefactosPara(genero, modalidad),
    alcance,
    erroresPrevios,
  });

  const llm = await clientePorRuta({
    usage: { feature: 'teachingSuite.generarPlan', userId },
    timeoutSeconds: 540,
  });
  let raw: string;
  try {
    raw = await llm.generate({
      system,
      prompt,
      responseMimeType: 'application/json',
      temperature: 0.4,
      // Una sesión acotada (12–20 láminas) cabe holgada; tope generoso para no
      // truncar el JSON con los cuerpos HTML.
      maxOutputTokens: 16000,
    });
  } catch (err) {
    // Log crudo para ops; al usuario solo el mensaje genérico (sin proveedor).
    console.error('[teaching-suite] fallo del proveedor de generación:', err);
    throw new Error(MENSAJE_NO_DISPONIBLE);
  }

  return coerceCandidate(raw, genero, marcaId, idSugerido, modalidad);
}
