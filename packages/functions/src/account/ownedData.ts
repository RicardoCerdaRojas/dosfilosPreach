/**
 * Dónde vive lo de un usuario (B2 de la fase Púlpito premium).
 *
 * Borrar una cuenta (Apple 5.1.1(v), política de borrado de Play) es borrar
 * TODO lo suyo. El borrado de administración que existía sólo borraba
 * `users/{uid}` y la cuenta de Auth: los sermones viven en `sermons` con
 * `userId`, los papers en `exegeticalPapers` con `ownerId`, y así unas
 * veinticinco colecciones más. Esta lista es la fuente de verdad, y una prueba
 * (`ownedData.test.ts`) exige que TODA colección esté clasificada: las de
 * `firestore.rules` y también las que el CÓDIGO escribe (functions,
 * infrastructure, application, web, mobile) — la primera versión sólo miraba
 * las reglas y se le escaparon las que escriben sólo las funciones (revisión
 * adversarial de B2).
 */

/** Colecciones donde un campo nombra al dueño. */
export const OWNED_BY_FIELD: ReadonlyArray<{ collection: string; field: string }> = [
    // userId
    { collection: 'sermons', field: 'userId' },
    { collection: 'greek_sessions', field: 'userId' },
    { collection: 'hebrewDetectiveSessions', field: 'userId' },
    { collection: 'hebrew_user_sessions', field: 'userId' },
    { collection: 'pastoralSeeds', field: 'userId' },
    { collection: 'confessionChangeAudit', field: 'userId' },
    { collection: 'workflow_configs', field: 'userId' },
    { collection: 'series', field: 'userId' },
    { collection: 'sermon_series', field: 'userId' },
    { collection: 'library_resources', field: 'userId' },
    { collection: 'document_chunks', field: 'userId' },
    { collection: 'preaching_plans', field: 'userId' },
    { collection: 'ai_projects', field: 'userId' },
    { collection: 'extractions', field: 'userId' },
    // Escritas por funciones con el uid del usuario (no figuran con dueño en
    // las reglas porque el cliente no las lee).
    { collection: 'user_activities', field: 'userId' },
    { collection: 'cancellation_feedback', field: 'userId' },
    { collection: 'doxologicalGateShadow', field: 'userId' },
    { collection: 'funnel_events', field: 'userId' },
    { collection: 'geo_events', field: 'userId' },
    { collection: 'extraction_runs', field: 'userId' },
    { collection: 'passageProfileShadow', field: 'userId' },
    { collection: 'sermonDraftShadow', field: 'userId' },
    // Desde B2 llevan `userId`; las anteriores se borran por su sermón o su
    // sesión (OWNED_VIA_PARENT).
    { collection: 'witnessResults', field: 'userId' },
    { collection: 'heartExamResults', field: 'userId' },
    // ownerId
    { collection: 'teachingClasses', field: 'ownerId' },
    { collection: 'teachingPlans', field: 'ownerId' },
    { collection: 'teachingBrands', field: 'ownerId' },
    { collection: 'teachingPlanJobs', field: 'ownerId' },
    { collection: 'teachingCanvasComponents', field: 'ownerId' },
    { collection: 'exegeticalPapers', field: 'ownerId' },
    { collection: 'userStyleGuides', field: 'ownerId' },
    { collection: 'workProfiles', field: 'ownerId' },
    { collection: 'userRubrics', field: 'ownerId' },
    { collection: 'userAssignmentBriefs', field: 'ownerId' },
    { collection: 'teachingCanvasForms', field: 'ownerId' },
];

/**
 * Cachés que NO guardaban el dueño, sólo el sermón, la semilla o la sesión de
 * la que salieron. Se borran por esos ids, que se leen ANTES de borrar los
 * documentos padre.
 */
export const OWNED_VIA_PARENT: ReadonlyArray<{
    collection: string;
    field: string;
    parent: 'sermons' | 'pastoralSeeds' | 'ai_sessions';
}> = [
    { collection: 'witnessResults', field: 'sermonId', parent: 'sermons' },
    { collection: 'witnessResults', field: 'seedId', parent: 'pastoralSeeds' },
    { collection: 'heartExamResults', field: 'estudioId', parent: 'ai_sessions' },
];

/** Contadores donde el usuario es una CLAVE de un mapa (`byUser.{uid}`). */
export const OWNED_IN_MAP: ReadonlyArray<{ collection: string; map: string }> = [
    { collection: 'llmUsageDaily', map: 'byUser' },
    { collection: 'llmUsageMonthly', map: 'byUser' },
];

/** Subcolecciones de `users/{uid}`: caen con `recursiveDelete` del usuario. */
export const SUBCOLLECTIONS_OF_USERS: readonly string[] = [
    'bibleMarks',
    'bibleInk',
    'greekFindings',
    'ai_sessions',
    'bonus_grants',
    'credit_pack_purchases',
    'monthly_grants',
    'quota_warnings',
    'wp_publishes_hourly',
];

/** Colecciones donde el id del documento ES el uid (con sus subcolecciones). */
export const OWNED_BY_DOC_ID: readonly string[] = [
    // users/{uid} arrastra bibleMarks, bibleInk, greekFindings, …
    'users',
    'user_analytics',
    'academicVoiceProfiles',
    'termGlossaries',
];

/** Colecciones que guardan el EMAIL de la persona (antes de tener cuenta, o sin uid). */
export const OWNED_BY_EMAIL: ReadonlyArray<{ collection: string; field: string }> = [
    { collection: 'contact_leads', field: 'email' },
    { collection: 'lead_magnet_submissions', field: 'email' },
    { collection: 'pending_registrations', field: 'email' },
];

/** Carpeta de Storage del usuario: sermones, biblioteca, perfil, portadas. */
export const storagePrefix = (uid: string) => `users/${uid}/`;

/**
 * Colecciones que NO se borran, con el motivo. Si una regla les da dueño, la
 * prueba exige que figuren acá a propósito.
 */
export const NOT_PERSONAL: Readonly<Record<string, string>> = {
    passage_cache: 'caché compartida por pasaje, sin dueño',
    quiz_cache: 'caché compartida, sin dueño',
    syntax_analysis_cache: 'caché compartida por pasaje, sin dueño',
    hebrew_analysis_cache: 'caché compartida por pasaje, sin dueño',
    greek_insight_cache: 'caché compartida por pasaje, sin dueño',
    greekWordCache: 'caché compartida por palabra, sin dueño',
    expositoryAssistantCache: 'caché compartida, sin dueño',
    pastoralWordAnalyses: 'caché compartida por palabra, sin dueño',
    tags: 'catálogo del sistema',
    confessions: 'catálogo del sistema',
    bibleCrossReferences: 'catálogo del sistema',
    verifiedMisreadings: 'catálogo del sistema',
    ai_agents: 'configuración del sistema',
    plans: 'catálogo de planes de pago',
    plan_translations: 'catálogo de planes de pago',
    llamaparseAccounts: 'cuentas del sistema',
    rate_limits: 'contadores por IP, caducan solos',
    daily_metrics: 'métricas agregadas, sin datos personales',
    global_metrics: 'métricas agregadas, sin datos personales',
    global_metrics_daily: 'métricas agregadas, sin datos personales',
    admin_audit_log: 'registro de auditoría: se conserva por obligación (el borrado mismo queda anotado, sin correo)',
    sections: 'subcolección de las confesiones del sistema',
    config: 'configuración del sistema',
    account_deletions: 'registro del propio borrado: queda sólo el uid y las fechas',
};
