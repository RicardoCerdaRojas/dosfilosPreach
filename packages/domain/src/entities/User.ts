import { Subscription } from './Subscription';
import type { SupportedLanguage } from '../types/i18n';

/**
 * User role enumeration
 */
export type UserRole = 'user' | 'super_admin';

/**
 * User analytics tracking data
 */
export interface UserAnalytics {
    // Activity metrics
    lastLoginAt: Date;
    lastActivityAt: Date;
    loginCount: number;
    sessionCount: number;
    totalSessionDuration: number; // in minutes

    // Feature usage - Content counters
    sermonsCreated: number;
    sermonsPublished: number;        // NEW: Only published sermons
    sermonsGenerated: number;        // AI-generated sermons
    greekTutorSessions: number;
    greekTutorCompleted: number;     // NEW: Completed sessions
    libraryUploads: number;
    seriesCreated: number;           // NEW: Sermon series
    preachingPlansCreated: number;   // NEW: Preaching plans

    // Important timestamps
    firstSermonAt?: Date;
    firstAIGenerationAt?: Date;
    lastContentCreatedAt?: Date;     // NEW: Last content creation

    // Daily activity tracking (resets daily)
    contentCreatedToday: number;     // NEW: Counter for today's content
    contentCreatedThisWeek: number;  // NEW: Counter for this week's content

    // Engagement metrics (computed)
    engagementScore: number; // 0-100
    riskLevel: 'low' | 'medium' | 'high'; // Churn risk
}

/**
 * Processing balance for the credit-pack model (see PRICING_PROCESSING_ROADMAP).
 *
 * Two extractors with different unit economics (Gemini Flash standard vs
 * LlamaParse premium) × two origin buckets (plan-monthly vs prepaid pack):
 *
 *   - `plan{Standard,Premium}Pages` — quota included in the user's monthly
 *     subscription. RESET to the plan's `{standard,premium}PagesPerMonth`
 *     on each billing-cycle invoice (no rollover; unused pages are lost
 *     at month boundary). Initially seeded by `bonusInitial` at activation
 *     so the user can start using on day 1.
 *   - `pack{Standard,Premium}Pages` — pages purchased via credit packs.
 *     Persistent (no automatic reset). Don't expire for 12 months from
 *     purchase per the legal copy in the dialog.
 *
 * Consumption order is plan FIRST, then pack — the plan resets monthly so
 * letting it expire wastes value, while pack pages persist. This is also
 * the spirit of how SaaS plans typically advertise "X pages included":
 * the included quota gets used before paid extras kick in.
 *
 * The legacy `*Available` fields (kept for backward-compat with admin UI,
 * Library banner, etc.) are TOTAL = plan + pack. Writers MUST keep them
 * in sync — `ProcessingBalanceService.recomputeAvailable()` is the
 * canonical helper.
 */
export interface ProcessingBalance {
    /** Plan-included pages — reset monthly by Stripe invoice webhook. */
    planStandardPages: number;
    planPremiumPages: number;
    /** Pack-purchased pages — persistent, 12-month expiration window. */
    packStandardPages: number;
    packPremiumPages: number;
    /**
     * Aggregate available = plan + pack. Kept as concrete fields (not
     * computed) because Firestore doesn't support derived properties and
     * existing consumers (admin UI, Library banner, gating in
     * LibraryManager) read these directly. Writers update them alongside
     * the underlying buckets.
     */
    standardPagesAvailable: number;
    premiumPagesAvailable: number;
    /** Lifetime spent counters for analytics / dashboard. */
    standardSpentTotal: number;
    premiumSpentTotal: number;

    // ── Exégesis bucket (added 2026-05 — see EXEGESIS_PRICING_INTEGRATION.md) ──
    //
    // Tracks LLM spend for the exegesis module in USD (not pages).
    // Surfaces in the UI as "estudios" via STUDY_UNIT_USD = $2 / study,
    // but the canonical bucket is USD because each operation has a
    // different LLM cost (analyzeVerseCanonically ~$0.10, composer
    // académico ~$0.20, etc.). All four fields default to 0 for users
    // on plans that don't include exegesis (Free / Personal); the
    // reserve use case rejects with QuotaExceededError when the UC
    // tries to spend against an empty bucket.

    /** Plan-included exégesis $USD — reset monthly by Stripe invoice webhook. */
    planExegesisUsd?: number;
    /** Pack-purchased exégesis $USD — persistent, no expiration on the value (pack itself may expire 12mo). */
    packExegesisUsd?: number;
    /** Aggregate available = plan + pack. Same dual-write semantics as the page buckets. */
    exegesisUsdAvailable?: number;
    /** Lifetime exégesis spend in USD. Useful for telemetry + breakdown drawer. */
    exegesisSpentTotalUsd?: number;

    /** Last time the balance changed, used in admin/usage dashboards. */
    updatedAt?: Date;
}

/**
 * User metadata for tracking source and context
 */
export interface UserMetadata {
    source: 'organic' | 'referral' | 'campaign';
    referralCode?: string;
    utmParams?: Record<string, string>;
    deviceInfo?: {
        platform: string;
        browser: string;
    };
}

/**
 * Canonical list of feature flags toggleable per-user. Add new entries here
 * so consumers (`useFeatureFlag`) get a narrow union and the admin UI can
 * enumerate them.
 *
 * Defaults are `false` when absent — code must treat missing flags as off.
 */
export const FEATURE_FLAG_NAMES = [
    /**
     * Gates the Pastoral Fidelity reformed wizard (six-step spine, three
     * witnesses, claim/source fidelity, etc.). When false the user stays on
     * the legacy sermon generator surface. Phase 0 of the initiative wires
     * this flag; subsequent phases consume it.
     */
    'pastoral_fidelity_flow',
    /**
     * Phase 1.5 sub-flag — gates the new `PastoralWordStudyModal` that
     * replaces the `GreekTutorOverlay` embed inside `MorphologyStep`.
     * Requires `pastoral_fidelity_flow` to also be on; otherwise the
     * step component shows nothing at all. When this flag is off and the
     * parent is on, MorphologyStep keeps the Phase 1 interim degraded
     * surface (greek tutor embed) per ADR-016.
     */
    'pastoral_word_study',
    /**
     * Phase 2 sub-flag — gates the three-witnesses validation gate
     * (`WitnessGate`) that runs after the six-step seed completes and
     * before the draft (ADR-011). Requires `pastoral_fidelity_flow` to
     * also be on. When this flag is off and the parent is on, the seed
     * wizard's "Continuar al borrador" behaves as in Phase 1 (no
     * witness validation). Default off → blast radius 0 until toggled.
     */
    'three_witnesses',
    /**
     * Phase 2.5 sub-flag — gates the Study Companion: the coverage badge in
     * the wizard + per-step orientation ("Pedir orientación", ADR-026) +
     * (PR B/C) Faculty evidence and the pre-generation gate. Requires
     * `pastoral_fidelity_flow` to also be on. Default off → blast radius 0
     * until toggled.
     */
    'study_depth',
    /**
     * Phase 3 sub-flag — gates the claim/source fidelity pass: the second
     * LLM evaluator that scores every `[N]` marker in a generated sermon
     * (supports/partial/unrelated/contradicts), the FidelityReviewPanel in
     * the sermon editor, and (later PRs) the pre-publish gate + plurality
     * + authority + attribution-footer validators (ADR-029). Requires
     * `pastoral_fidelity_flow` to also be on. Default off → blast radius 0
     * until toggled.
     *
     * 🛑 DORMANT (ADR-032). Per ADR-030/031 the per-marker claim↔source pass is
     * a PAPER feature, not a sermon feature; on the published sermon it also
     * hits a content-shape mismatch (string content + top-level manifest). Keep
     * this OFF — do NOT flip on for the sermon without revisiting ADR-032. The
     * machinery relocates to the paper in Phase 7.
     */
    'fidelity_pass',

    /**
     * Phase 4 PR 1 sub-flag (ADR-033) — gates the contra-scan pre-publish
     * confrontation: before publishing a sermon, the system surfaces library
     * chunks that DISSENT from the pastor's central idea (`findDissentingChunks`
     * callable, personal→CORE priority per ADR-031) and requires the pastor to
     * consider at least one with a ≥100-char note of their own (soft-block,
     * overridable with an audit-logged justification). Implements P3 (Acts 20:27).
     * Independent of `fidelity_pass` (which is dormant per ADR-032) — this is the
     * ACTIVE confrontation on the sermon. Requires `pastoral_fidelity_flow` to
     * also be on. Default off → legacy publish, blast radius 0.
     */
    'contra_scan',

    /**
     * Fase 4 sub-feature 3 — LA VOZ DEL PREDICADOR. Pasa fragmentos de sermones
     * que ESTE pastor armó en el taller como muestra de estilo, para que el
     * borrador generado suene a él y no a un texto genérico.
     *
     * Sólo aprende de sermones armados en el taller: uno generado de
     * una vez enseñaría NUESTRA voz de vuelta, un bucle que se cierra sobre sí
     * mismo. Sin material suyo no hace nada y no avisa de ninguna carencia.
     *
     * Nada sale de su cuenta y nada entrena a ningún modelo: es su propio texto
     * en su propia generación. Requiere `pastoral_fidelity_flow`. Default off.
     */
    'voice_fingerprint',

    /**
     * Conducción afectiva (manifiesto de conducción formativa v1.3) — gatea el
     * botón "Conducir el corazón" en el panel de construcción del Estudio Madre:
     * la conducción guiada C1–C5 que elicita la dimensión afectiva (`aplicacion`
     * subtipo `corazon`) anclada a la intención autoral del texto. Independiente
     * de `pastoral_fidelity_flow` (el Estudio Madre vive en Faculty, no en el
     * wizard del sermón). El examen del corazón YA está desplegado (callable
     * `examenCorazon`, consumido por `useValidarEstudioMadre`), así que la
     * condición que mantenía este flag apagado quedó cumplida: entra al set de
     * defaults.
     */
    'conduccion_corazon',

    /**
     * ADR-035 sub-flag — gatea el perfil del pasaje (Capa 1) + cobertura
     * adaptativa: el detector `profilePassage` corre al activar el estudio y
     * (PR1) registra en sombra; (PR2/PR3) condiciona nudges por paso + el
     * colector de cobertura. Requiere `pastoral_fidelity_flow`. Default off →
     * blast radius 0. Se mantiene off hasta adjudicar precisión del detector en
     * sombra (plan §5: ≥20 estudios reales + 2 cortes) antes del flip a enforce.
     */
    'passage_profile',

    /**
     * ADR-035 enforce — gatea la APLICACIÓN del perfil (nudges por paso +
     * confront de lectura errónea retenido + colector de cobertura al cierre).
     * Separado de `passage_profile` (sombra) a propósito, como el par
     * shadow/enforce de la grieta doxológica: `passage_profile` mide precisión
     * del detector en sombra; este flag enciende el enforcement SOLO tras
     * adjudicar los dos cortes (plan §5). Requiere `passage_profile`. Default
     * off → el perfil cristaliza/registra pero no confronta ni nudgea.
     */
    'passage_profile_enforce',
    /**
     * ADR-036 PR6 enforce — gatea el VERIFY-DROP de las lecturas erróneas que
     * propone el DETECTOR en runtime: descarta las que no anclan a un verso real
     * antes de mergear el piso curado. El piso curado (PR5) NO depende de este
     * flag — siempre va verificado. Requiere `passage_profile` (misma baranda
     * anti-fail-open: no se descarta sin medir antes el corte 1 en sombra).
     * Default off → mide la tasa de falla del detector pero no descarta.
     */
    'anchor_fidelity_enforce',
    /**
     * Redacción v2 — sombra del draft. Mide (non-blocking) tasa de authorityQuote
     * fabricada, cita-verso-equivocado (proxy) y — con el juez — FCF/principio/
     * cumplimiento del enfoque. NO gatea nada; instrumentación prerrequisito de todo
     * validador. Requiere `pastoral_fidelity_flow`.
     */
    'sermon_draft_shadow',
    /**
     * Redacción v2 Fase 1 (§4.4) enforce — gatea la CONFRONTACIÓN del override de
     * género socrático en el paso 2 (el dispatch `maybeGenreConfront`). SEPARADO
     * del enforce de cobertura a propósito: adjudicación y datos distintos
     * (`genreOverride` en sombra). El juez de engagement de género + la medición
     * en sombra corren bajo `passage_profile`; este flag SOLO enciende que el
     * sistema confronte al pastor. Requiere `passage_profile`. Default off → mide
     * el discernimiento en sombra pero no confronta (shadow-first).
     */
    'genre_override_enforce',
    /**
     * Redacción v2 Fase 1 (§4.5) — ayuda estructural sensible al género en el
     * paso 3 (guía por género confirmado + ejemplos curados). Andamiaje FORMATIVO
     * (no juicio, no shadow/enforce), pero el texto pastoral-facing (`guidance`)
     * requiere revisión del fundador antes de embarcar live → detrás de este flag,
     * default off. Requiere `pastoral_fidelity_flow`. Off ⇒ prompt clásico del
     * paso 3.
     */
    'step3_genre_help',
    /**
     * ADR-037 — redacción socrática por ELEMENTOS. El pastor decide qué idea va
     * en cada sección (la aporta él, o elige/edita una propuesta) y la prosa se
     * escribe DESPUÉS, a partir de esas decisiones. Es lo que hace medible la
     * autoría: un texto generado de una vez no tiene costuras y no hay nada que
     * atribuir dentro de él.
     *
     * Entra como SPIKE de una sola sección (contexto histórico) para adjudicar
     * con datos —no con estimación— si el modelo propone elementos útiles o
     * genéricos, y cuánto cuesta la llamada por sección. Si propone relleno, el
     * diseño necesita otra vuelta, y es mejor saberlo con una sección que con
     * veintiséis. Requiere `pastoral_fidelity_flow`. Default off.
     */
    'socratic_drafting',
] as const;

export type FeatureFlagName = (typeof FEATURE_FLAG_NAMES)[number];

export type FeatureFlags = Partial<Record<FeatureFlagName, boolean>>;

/**
 * Prerequisitos DIRECTOS de cada flag (el flag no funciona — queda activo pero
 * inerte — si su prerequisito está off). Fuente única de la topología de flags;
 * la UI de admin la consume para encender hacia arriba (cierre transitivo) y
 * avisar hacia abajo (descendientes activos) — nunca cascada silenciosa.
 *
 * Es un ÁRBOL de 2 niveles: `pastoral_fidelity_flow` es la raíz; el resto son
 * hijos directos (hermanos, ninguno depende del otro). Cuando se agregue
 * `doxological_enforce`, su prereq será `three_witnesses` (2 saltos: enforce →
 * three_witnesses → pastoral_fidelity_flow) — la baranda anti-fail-open horneada
 * en la topología: el gate NO puede bloquear sin estar corriendo antes.
 */
export const FEATURE_FLAG_PREREQUISITES: Record<FeatureFlagName, readonly FeatureFlagName[]> = {
    pastoral_fidelity_flow: [],
    pastoral_word_study: ['pastoral_fidelity_flow'],
    three_witnesses: ['pastoral_fidelity_flow'],
    study_depth: ['pastoral_fidelity_flow'],
    fidelity_pass: ['pastoral_fidelity_flow'],
    contra_scan: ['pastoral_fidelity_flow'],
    voice_fingerprint: ['pastoral_fidelity_flow'],
    conduccion_corazon: ['pastoral_fidelity_flow'],
    passage_profile: ['pastoral_fidelity_flow'],
    // Enforce cuelga del flag de sombra: no se puede enforce sin perfilar antes
    // (baranda anti-fail-open horneada en la topología).
    passage_profile_enforce: ['passage_profile'],
    // Verify-drop del detector: cuelga de la sombra por la misma baranda.
    anchor_fidelity_enforce: ['passage_profile'],
    sermon_draft_shadow: ['pastoral_fidelity_flow'],
    // Enforce del override de género cuelga de la sombra del perfil (misma
    // baranda anti-fail-open: no confronta sin medir antes en sombra).
    genre_override_enforce: ['passage_profile'],
    // La ayuda del paso 3 ramifica por el GÉNERO CONFIRMADO en el paso 2, que
    // produce la maquinaria de PR1 detrás de `passage_profile`. Prereq
    // passage_profile (no el parent directo): la cadena EXPRESA la dependencia
    // funcional — no se puede encender la ayuda con el subsistema de género
    // apagado. Transitivo → passage_profile → pastoral_fidelity_flow.
    step3_genre_help: ['passage_profile'],
    socratic_drafting: ['pastoral_fidelity_flow'],
};

/**
 * Flags que NUNCA deben activarse (dormantes). La UI los hace INACTIVABLES, no
 * solo "no recomendados". `fidelity_pass` queda dormante per ADR-032 (se reubica
 * al paper en Fase 7; flipearlo no hace nada útil y confunde).
 */
export const DORMANT_FEATURE_FLAGS: readonly FeatureFlagName[] = ['fidelity_pass'];

export function isDormantFeatureFlag(flag: FeatureFlagName): boolean {
    return DORMANT_FEATURE_FLAGS.includes(flag);
}

/**
 * Flags encendidos por defecto para toda cuenta.
 *
 * Hasta 2026-08-19 no existía ningún default: cada flag se encendía a mano por
 * usuario desde el admin. El resultado fue silencioso y caro — TODA cuenta nueva
 * (incluidas las de pago) estrenaba la app SIN el flujo de fidelidad pastoral, es
 * decir sin el trabajo de las fases 1 a 4. No fue una decisión de rollout: fue una
 * omisión que se tomó sola.
 *
 * CRITERIO (el mismo que decide si un flag entra acá):
 * - ENTRA lo validado en producción y lo que MIDE en sombra.
 * - NO ENTRA nada que ACTÚE sobre el pastor sin datos que lo respalden (los
 *   `*_enforce`), lo dormante, ni lo que espera revisión de catálogo del fundador.
 *   Confrontar con una vara sin revisar no puede ser un default.
 *
 * Los tests hacen cumplir el criterio, no solo lo documentan.
 */
export const DEFAULT_FEATURE_FLAGS: readonly FeatureFlagName[] = [
    'pastoral_fidelity_flow',
    'pastoral_word_study',
    'three_witnesses',
    'study_depth',
    'contra_scan',
    'conduccion_corazon',
    // Sombra: no cambia lo que el pastor ve; produce el dato de calibración.
    'passage_profile',
    'sermon_draft_shadow',
];

/** El mapa listo para escribir en el perfil (`{flag: true}`). */
export function buildDefaultFeatureFlags(): FeatureFlags {
    return Object.fromEntries(DEFAULT_FEATURE_FLAGS.map((f) => [f, true])) as FeatureFlags;
}

/**
 * El documento `users/{uid}` de una cuenta Free recién registrada, sin las
 * fechas (las pone quien escribe, con la hora del servidor).
 *
 * Las reglas de Firestore (`altaFreeValida`) aceptan EXACTAMENTE esta forma:
 * sin rol, plan Free, sin saldo y los flags por defecto. Lo usan el registro
 * (`AuthService.registerFree`) y la prueba de reglas, para que no haya dos
 * copias que se separen: un campo nuevo acá sin tocar la regla dejaría al
 * usuario con cuenta en Auth y sin perfil.
 */
export function buildFreeUserProfile(input: { email: string; displayName: string; locale: string }) {
    return {
        email: input.email,
        displayName: input.displayName,
        photoURL: null,
        status: 'active' as const,
        preferredLanguage: input.locale,
        subscription: {
            planId: 'free' as const,
            status: 'active' as const,
            stripePriceId: null,
            cancelAtPeriodEnd: false,
        },
        metadata: { source: 'organic' as const },
        // Toda cuenta estrena el flujo de fidelidad pastoral. Sin esto el
        // usuario nuevo entra a la app pre-Pastoral Fidelity (pasó de verdad:
        // cuentas de pago usando la versión vieja del producto sin saberlo).
        featureFlags: buildDefaultFeatureFlags(),
    };
}

/**
 * Prerequisitos TRANSITIVOS (ancestros) de un flag — todo lo que debe estar ON
 * para que funcione. Encender el flag implica encender este conjunto (up auto).
 */
export function getFlagPrerequisites(flag: FeatureFlagName): FeatureFlagName[] {
    const out = new Set<FeatureFlagName>();
    const walk = (f: FeatureFlagName) => {
        for (const p of FEATURE_FLAG_PREREQUISITES[f] ?? []) {
            if (!out.has(p)) {
                out.add(p);
                walk(p);
            }
        }
    };
    walk(flag);
    return [...out];
}

/**
 * Dependientes TRANSITIVOS (descendientes) — flags que requieren `flag` directa
 * o transitivamente. Apagar `flag` los deja activos-pero-inertes → la UI avisa
 * y pide confirmación antes de apagar (nunca cascada silenciosa).
 */
export function getFlagDependents(flag: FeatureFlagName): FeatureFlagName[] {
    return FEATURE_FLAG_NAMES.filter(
        (f) => f !== flag && getFlagPrerequisites(f).includes(flag),
    );
}

/**
 * @deprecated Per [ADR-010](docs/pastoral-fidelity/decisions/ADR-010-confessional-witnesses-default-on.md)
 * the single-anchor model is replaced by multi-witness default-on. The
 * field stays on `User` for historical data preservation but is NOT
 * consumed by Phase 2 Testigo 3 anymore. New code should use
 * `useConfessionalWitnesses` instead.
 */
export type DeclaredConfessionId = string;

/**
 * @deprecated Same lifecycle as `DeclaredConfessionId` — kept for data
 * preservation, no longer consumed. New "non-confessional" flow uses
 * `useConfessionalWitnesses: false`.
 */
export const NON_CONFESSIONAL: DeclaredConfessionId = 'non-confessional';

/**
 * Visibility of a pastor's declared confession. Default `'private'`.
 * Kept for backwards compat with users who declared under ADR-007/009.
 */
export type ConfessionVisibility = 'private' | 'public-in-profile';

export interface User {
    id: string;
    email: string;
    displayName: string | null;
    photoURL: string | null;

    // Account status (soft disable/enable)
    status?: 'active' | 'disabled';

    // Role (for admin access)
    role?: UserRole;

    // Subscription fields
    stripeCustomerId?: string;    // Stripe customer ID (at root level)
    subscription?: Subscription;  // Current subscription details

    // Processing balance (credit-pack model)
    processingBalance?: ProcessingBalance;

    /**
     * UI + AI output language. Drives both the i18n bundle picked by the client
     * and the locale resolved for tutor/orchestrator system prompts. Stored at
     * the user-doc level (not under metadata) so it can be read in a single
     * Firestore round-trip from any AI use-case. Undefined = inherit
     * `DEFAULT_LANGUAGE` from `domain/types/i18n.ts`.
     */
    preferredLanguage?: SupportedLanguage;

    // Analytics & Engagement
    analytics?: UserAnalytics;

    // Metadata
    metadata?: UserMetadata;

    /**
     * Per-user feature toggles. Mutated only via the admin callable
     * `setUserFeatureFlags`; clients read but never write. See
     * `FEATURE_FLAG_NAMES` for the canonical list.
     */
    featureFlags?: FeatureFlags;

    /**
     * @deprecated Per ADR-010, single-anchor model retired. Field
     * preserved for historical data only. Multi-witness mode is now
     * controlled by `useConfessionalWitnesses`.
     */
    declaredConfession?: DeclaredConfessionId;
    confessionAffirmedAt?: Date;
    confessionVisibility?: ConfessionVisibility;

    /**
     * Pastoral Fidelity (ADR-010) — whether the three-witness mechanism
     * uses **all** confessional traditions in the catalog as historical
     * witnesses (Testigo 3).
     *
     * Default `true` because historical theology is constitutive of the
     * method per the manifesto, not opt-in. Pastor can flip OFF in
     * `/settings/confession` with a written justification recorded in
     * `confessionChangeAudit/`. When OFF, only `core` ecumenical
     * doctrines still fire (universal, non-negotiable); `distinctive`
     * and `open-evangelical` checks are silenced.
     */
    useConfessionalWitnesses?: boolean;

    /**
     * Phase 2.5 PR C (ADR-027) — Pastor's preference for the Study Companion
     * "expert mode" at the pre-generation gate. Self-service-once-earned:
     * the toggle visible to the pastor only unlocks after they accumulate
     * `EXPERT_MODE_UNLOCK_THRESHOLD` sermons with `studyDepthSnapshot.
     * overallScore >= EXPERT_MODE_GOOD_SCORE` AND
     * `bypassedConfrontation === false`. Expert mode SOFTENS (collapses
     * the gate modal to a quiet card) but NEVER silences confrontation
     * on red dims — P3 stays intact. Super-admins may force-set this
     * field regardless of the threshold (audit-logged).
     */
    expertModeOn?: boolean;
    /** Set when the pastor (or admin) flips `expertModeOn` to true. */
    expertModeUnlockedAt?: Date;

    createdAt: Date;
    updatedAt: Date;
}

export class UserEntity implements User {
    constructor(
        public id: string,
        public email: string,
        public displayName: string | null = null,
        public photoURL: string | null = null,
        public stripeCustomerId?: string,
        public subscription?: Subscription,
        public role?: UserRole,
        public analytics?: UserAnalytics,
        public metadata?: UserMetadata,
        public createdAt: Date = new Date(),
        public updatedAt: Date = new Date(),
        public status?: 'active' | 'disabled',
    ) { }

    static create(data: Partial<User> & { id: string; email: string }): UserEntity {
        return new UserEntity(
            data.id,
            data.email,
            data.displayName ?? null,
            data.photoURL ?? null,
            data.stripeCustomerId,
            data.subscription,
            data.role,
            data.analytics,
            data.metadata,
            data.createdAt ?? new Date(),
            data.updatedAt ?? new Date()
        );
    }

    updateProfile(displayName: string, photoURL?: string): UserEntity {
        return new UserEntity(
            this.id,
            this.email,
            displayName,
            photoURL ?? this.photoURL,
            this.stripeCustomerId,
            this.subscription,
            this.role,
            this.analytics,
            this.metadata,
            this.createdAt,
            new Date()
        );
    }

    /**
     * Update user analytics data
     */
    updateAnalytics(analytics: Partial<UserAnalytics>): UserEntity {
        return new UserEntity(
            this.id,
            this.email,
            this.displayName,
            this.photoURL,
            this.stripeCustomerId,
            this.subscription,
            this.role,
            { ...this.analytics, ...analytics } as UserAnalytics,
            this.metadata,
            this.createdAt,
            new Date()
        );
    }

    /**
     * Check if user is super admin
     */
    isSuperAdmin(): boolean {
        return this.role === 'super_admin';
    }

    /**
     * Initialize default analytics for new users
     */
    static initializeAnalytics(): UserAnalytics {
        const now = new Date();
        return {
            lastLoginAt: now,
            lastActivityAt: now,
            loginCount: 0,
            sessionCount: 0,
            totalSessionDuration: 0,
            sermonsCreated: 0,
            sermonsPublished: 0,
            sermonsGenerated: 0,
            greekTutorSessions: 0,
            greekTutorCompleted: 0,
            libraryUploads: 0,
            seriesCreated: 0,
            preachingPlansCreated: 0,
            contentCreatedToday: 0,
            contentCreatedThisWeek: 0,
            engagementScore: 0,
            riskLevel: 'low',
        };
    }
}

