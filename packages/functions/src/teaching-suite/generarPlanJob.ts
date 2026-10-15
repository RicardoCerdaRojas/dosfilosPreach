import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { generarPlan, slugify } from './planGeneration';
import type { GeneroSoportado, Modalidad } from './buildPlanPrompt';

/**
 * Teaching Suite F3 (Slice B) — trigger que genera el plan de un job encolado.
 *
 * Corre cuando `encolarPlanSesion` crea un doc en `teachingPlanJobs/{jobId}`.
 * Lee el estudio, llama a Anthropic (vía planGeneration) y escribe el plan +
 * estado final en el mismo job. La web lo escucha por onSnapshot, así que no hay
 * timeout de cliente; el trigger dispone de hasta 540s.
 *
 * `retry: false` + guardia de estado: sin reintentos automáticos (evita duplicar
 * gasto de API); si el trigger se re-dispara, solo procesa jobs en 'generando'.
 */
export const generarPlanJob = onDocumentCreated(
  {
    document: 'teachingPlanJobs/{jobId}',
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '512MiB',
    secrets: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY'],
    retry: false,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const job = snap.data() as {
      ownerId?: string;
      estudioId?: string;
      estudioTitulo?: string;
      genero?: string;
      modalidad?: string | null;
      marcaId?: string;
      alcance?: string | null;
      erroresPrevios?: string[] | null;
      estado?: string;
    };
    const jobId = event.params.jobId;

    if (job.estado !== 'generando') return; // idempotencia

    const fail = (mensaje: string) =>
      snap.ref.set({ estado: 'error', error: mensaje, updatedAt: FieldValue.serverTimestamp() }, { merge: true });


    const db = getFirestore();
    try {
      const estudioId = String(job.estudioId ?? '');
      const marcaId = String(job.marcaId ?? '');
      const genero = job.genero as GeneroSoportado;
      const estudioSnap = await db.collection('extractions').doc(estudioId).get();
      if (!estudioSnap.exists) {
        await fail('Estudio no encontrado.');
        return;
      }
      const estudioData = estudioSnap.data() as { markdown?: string; estudioMadre?: { objetivos?: unknown } };
      const material = String(estudioData.markdown ?? '').trim();
      if (material.length < 40) {
        await fail('El estudio no tiene contenido suficiente.');
        return;
      }

      const plan = await generarPlan({
        estudio: material,
        genero,
        modalidad: (job.modalidad as Modalidad | null) ?? undefined,
        marcaId,
        idSugerido: slugify(job.estudioTitulo ?? '', 'clase'),
        alcance: job.alcance ?? undefined,
        erroresPrevios: job.erroresPrevios ?? undefined,
        // Atribución del gasto: el job corre en background, así que el dueño del
        // trabajo es la única forma de saber a quién cobrarle la llamada.
        userId: job.ownerId,
      });

      // Gap 1: los objetivos los DERIVA el cliente del Estudio Madre (single-source
      // en domain) y viven en el sobre; aquí solo se COPIAN al plan (functions no
      // importa @dosfilos/domain). Si el estudio no tiene sobre/objetivos, el plan
      // queda sin objetivos — el modelo NO los inventa.
      if (estudioData.estudioMadre?.objetivos) {
        plan.objetivos = estudioData.estudioMadre.objetivos;
      }

      await snap.ref.set(
        { estado: 'listo', plan, error: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      console.log(`[generarPlanJob] ✅ ${jobId}: plan listo (${(plan.diapositivas as unknown[]).length} diapos)`);
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo generar el plan.';
      console.error(`[generarPlanJob] ❌ ${jobId}: ${mensaje}`);
      await fail(mensaje);
    }
  },
);
