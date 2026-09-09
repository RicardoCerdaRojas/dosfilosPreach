import { lazy, Suspense, useEffect } from 'react';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { FirebaseProvider } from '@/context/firebase-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { SessionTracker } from '@/components/analytics/SessionTracker';
import { LanguageSyncBridge } from '@/i18n';

// ── EAGER: public + auth routes ─────────────────────────────────────────
//
// Anything on the landing/funnel critical path stays in the main bundle
// so first paint isn't blocked by an extra network round trip. Auth
// pages are also eager because they're tiny and almost always the next
// step after a landing visit.
import { Landing } from '@/pages/Landing';
import { LandingV0 } from '@/pages/LandingV0';
import { ManualPredicacionLandingPage } from '@/pages/recursos/ManualPredicacionLandingPage';
import { ManualPredicacionThankYouPage } from '@/pages/recursos/ManualPredicacionThankYouPage';
import { LoginPage } from '@/pages/auth/login';
import { RegisterPage } from '@/pages/auth/register';
import { ForgotPasswordPage } from '@/pages/auth/forgot-password';
import { RegistrationSuccessPage } from '@/pages/auth/registration-success';
import { VerifyEmailPage } from '@/pages/auth/verify-email';
import { ActionPage } from '@/pages/auth/action';
import { PublicSermonPage } from '@/pages/public/sermon';
import { PricingPage } from '@/pages/public/pricing';
import { TermsOfServicePage } from '@/pages/legal/TermsOfService';
import { PrivacyPolicyPage } from '@/pages/legal/PrivacyPolicy';
import { DMCAPolicyPage } from '@/pages/legal/DMCAPolicy';
import { CreditsPage } from '@/pages/legal/Credits';

// ── LAZY: authenticated app routes ──────────────────────────────────────
//
// These chunks load on demand when the user navigates into them. The
// landing chunk drops from ~24MB to <1MB which moves mobile LCP from
// ~4-6s on 3G to ~1.5s, directly improving Meta ad quality score.
//
// The `.then(m => ({ default: m.X }))` boilerplate is required because
// React.lazy expects a default export and many of these pages use
// named exports. Pages with native default exports omit the `.then`.

const DashboardLayout = lazy(() => import('@/components/layout/dashboard-layout').then(m => ({ default: m.DashboardLayout })));
const DashboardPage = lazy(() => import('@/pages/dashboard').then(m => ({ default: m.DashboardPage })));

const TeachingSuitePage = lazy(() => import('@/pages/teaching-suite').then(m => ({ default: m.TeachingSuitePage })));
const TeachingSuiteMarcaPage = lazy(() => import('@/pages/teaching-suite-marca').then(m => ({ default: m.TeachingSuiteMarcaPage })));
const TeachingSuiteGenerarPage = lazy(() => import('@/pages/teaching-suite-generar').then(m => ({ default: m.TeachingSuiteGenerarPage })));
const TeachingSuiteCursoPage = lazy(() => import('@/pages/teaching-suite-curso').then(m => ({ default: m.TeachingSuiteCursoPage })));
const SermonsPage = lazy(() => import('@/pages/sermons').then(m => ({ default: m.SermonsPage })));
const SermonNewPage = lazy(() => import('@/pages/sermons/new').then(m => ({ default: m.SermonNewPage })));
const SermonTutorPage = lazy(() => import('@/pages/sermons/tutor').then(m => ({ default: m.SermonTutorPage })));
const SermonDetailPage = lazy(() => import('@/pages/sermons/detail').then(m => ({ default: m.SermonDetailPage })));
const SermonEditPage = lazy(() => import('@/pages/sermons/edit').then(m => ({ default: m.SermonEditPage })));
const PreachModePage = lazy(() => import('@/pages/sermons/preach').then(m => ({ default: m.PreachModePage })));
const SermonWizard = lazy(() => import('./pages/sermons/generator/SermonWizard').then(m => ({ default: m.SermonWizard })));

const SeriesList = lazy(() => import('@/pages/series/SeriesList').then(m => ({ default: m.SeriesList })));
const SeriesForm = lazy(() => import('@/pages/series/SeriesForm').then(m => ({ default: m.SeriesForm })));
const SeriesDetail = lazy(() => import('@/pages/series/SeriesDetail').then(m => ({ default: m.SeriesDetail })));
const ExpositoryAssistantPage = lazy(() => import('@/pages/series/ExpositoryAssistantPage').then(m => ({ default: m.ExpositoryAssistantPage })));

const LibraryManager = lazy(() => import('@/pages/library/LibraryManager').then(m => ({ default: m.LibraryManager })));
const PageNumberingPage = lazy(() => import('@/pages/library/PageNumberingPage').then(m => ({ default: m.PageNumberingPage })));
const PlannerWizard = lazy(() => import('@/pages/planner/PlannerWizard').then(m => ({ default: m.PlannerWizard })));
const GeneratorSettings = lazy(() => import('@/pages/settings/GeneratorSettings').then(m => ({ default: m.GeneratorSettings })));
const ConfessionSettings = lazy(() => import('@/pages/settings/ConfessionSettings').then(m => ({ default: m.ConfessionSettings })));
const IntegrationsSettings = lazy(() => import('@/pages/settings/IntegrationsSettings').then(m => ({ default: m.IntegrationsSettings })));
const SubscriptionPage = lazy(() => import('@/pages/subscription/SubscriptionPage'));

// Admin
const AdminLeads = lazy(() => import('@/pages/admin/AdminLeads').then(m => ({ default: m.AdminLeads })));
const AdminLeadMagnets = lazy(() => import('@/pages/admin/AdminLeadMagnets').then(m => ({ default: m.AdminLeadMagnets })));
const AdminEmailPreviews = lazy(() => import('@/pages/admin/AdminEmailPreviews').then(m => ({ default: m.AdminEmailPreviews })));
const CoreLibraryAdmin = lazy(() => import('@/pages/admin/CoreLibraryAdmin'));
const ConfessionsAdmin = lazy(() => import('@/pages/admin/ConfessionsAdmin').then(m => ({ default: m.ConfessionsAdmin })));
const CrossReferencesAdmin = lazy(() => import('@/pages/admin/CrossReferencesAdmin').then(m => ({ default: m.CrossReferencesAdmin })));
const VerifiedMisreadingsAdmin = lazy(() => import('@/pages/admin/VerifiedMisreadingsAdmin').then(m => ({ default: m.VerifiedMisreadingsAdmin })));
const AnalyticsDashboard = lazy(() => import('@/pages/admin/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })));
const GeographicDashboard = lazy(() => import('@/pages/admin/GeographicDashboard').then(m => ({ default: m.GeographicDashboard })));
const UserManagement = lazy(() => import('@/pages/admin/UserManagement').then(m => ({ default: m.UserManagement })));
const UserDetailPage = lazy(() => import('@/pages/admin/users/UserDetailPage').then(m => ({ default: m.UserDetailPage })));
const AuditLogPage = lazy(() => import('@/pages/admin/AuditLogPage').then(m => ({ default: m.AuditLogPage })));
const LlmCostDashboard = lazy(() => import('@/pages/admin/LlmCostDashboard').then(m => ({ default: m.LlmCostDashboard })));
const LlamaParseMonitoring = lazy(() => import('@/pages/admin/LlamaParseMonitoring'));
const TutorManagement = lazy(() => import('@/pages/admin/TutorManagement'));
const TutorEditor = lazy(() => import('@/pages/admin/TutorEditor'));
const HintCatalogPage = lazy(() => import('@/pages/admin/HintCatalogPage'));
const LexiconCatalogPage = lazy(() => import('@/pages/admin/LexiconCatalogPage'));
const PastoralSeedInspector = lazy(() => import('@/pages/admin/PastoralSeedInspector').then(m => ({ default: m.PastoralSeedInspector })));
const DoxologicalShadowDashboard = lazy(() => import('@/pages/admin/DoxologicalShadowDashboard').then(m => ({ default: m.DoxologicalShadowDashboard })));

// Tutors + bible + faculty + exegesis + projects
const GreekTutorPage = lazy(() => import('@/pages/greek-tutor/GreekTutorPage').then(m => ({ default: m.GreekTutorPage })));
const GreekTutorProvider = lazy(() => import('./pages/sermons/generator/exegesis/greek-tutor/GreekTutorProvider').then(m => ({ default: m.GreekTutorProvider })));
const GreekTutorDashboardView = lazy(() => import('./pages/sermons/generator/exegesis/greek-tutor/GreekTutorDashboardView').then(m => ({ default: m.GreekTutorDashboardView })));
const HebrewTutorPage = lazy(() => import('@/pages/hebrew-tutor/HebrewTutorPage').then(m => ({ default: m.HebrewTutorPage })));
const BiblePage = lazy(() => import('@/pages/bible/BiblePage').then(m => ({ default: m.BiblePage })));
const BibleProvider = lazy(() => import('@/context/BibleContext').then(m => ({ default: m.BibleProvider })));
const FacultyChatPage = lazy(() => import('@/pages/faculty/chat').then(m => ({ default: m.FacultyChatPage })));
const FacultyLibraryPage = lazy(() => import('@/pages/faculty/library').then(m => ({ default: m.FacultyLibraryPage })));
const ProjectLibraryPage = lazy(() => import('@/pages/faculty/ProjectLibraryPage').then(m => ({ default: m.ProjectLibraryPage })));
const ProjectDashboard = lazy(() => import('@/pages/faculty/ProjectDashboard').then(m => ({ default: m.ProjectDashboard })));
const ExegesisPage = lazy(() => import('@/pages/exegesis/ExegesisPage').then(m => ({ default: m.ExegesisPage })));
const ExegesisCreatePage = lazy(() => import('@/pages/exegesis/ExegesisCreatePage').then(m => ({ default: m.ExegesisCreatePage })));
const ExegesisPaperPage = lazy(() => import('@/pages/exegesis/ExegesisPaperPage').then(m => ({ default: m.ExegesisPaperPage })));
const ExegesisPaperSetupPage = lazy(() => import('@/pages/exegesis/ExegesisPaperSetupPage').then(m => ({ default: m.ExegesisPaperSetupPage })));
const SeriesExegesisConfigPage = lazy(() => import('@/pages/series/SeriesExegesisConfigPage').then(m => ({ default: m.SeriesExegesisConfigPage })));
const ExegesisSourcePagesPage = lazy(() => import('@/pages/exegesis/ExegesisSourcePagesPage').then(m => ({ default: m.ExegesisSourcePagesPage })));
const ProjectsListPage = lazy(() => import('@/pages/projects/ProjectsListPage').then(m => ({ default: m.ProjectsListPage })));

// Redirect: old /faculty/project/:projectId → /projects/:projectId
function RedirectFacultyProject() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    if (projectId) navigate(`/dashboard/projects/${projectId}`, { replace: true });
  }, [projectId, navigate]);
  return null;
}

// Redirect component for old sermon routes
function RedirectToSermon({ suffix = '' }: { suffix?: string }) {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      navigate(`/dashboard/sermons/${id}${suffix}`, { replace: true });
    }
  }, [id, suffix, navigate]);

  return null;
}

// Configure NProgress once at module load. Removes the default spinner
// (we only want the top bar) and tunes smoothing so the bar advances
// even when a chunk takes >2s.
NProgress.configure({
  showSpinner: false,
  trickleSpeed: 200,
  minimum: 0.15,
  easing: 'ease',
  speed: 400,
});

/**
 * Suspense fallback rendered while a lazy chunk loads. Drives a
 * GitHub/Linear-style top progress bar (NProgress) and keeps a
 * centered spinner for cases where the chunk takes long enough to
 * blank the viewport — without it the page reads as "frozen" between
 * route transitions.
 *
 * The progress bar starts on mount and finishes on unmount, so the
 * lifecycle matches the chunk-load window exactly.
 */
function RouteFallback() {
  useEffect(() => {
    NProgress.start();
    return () => {
      NProgress.done();
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
      <div
        role="status"
        aria-label="Cargando"
        className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent"
      />
      <p className="text-sm text-muted-foreground">Cargando…</p>
    </div>
  );
}

function App() {
  return (
    <FirebaseProvider>
      <BrowserRouter>
        <SessionTracker />
        <LanguageSyncBridge />
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public Landing Page - Root */}
          <Route path="/" element={<Landing />} />
          {/* Frozen v0 snapshot for visual side-by-side comparison
              while the conversion-optimization rewrite ships. Remove
              this route + the LandingV0 import + the pages/landing-v0
              folder when the new landing is finalized. */}
          <Route path="/landing-v0" element={<LandingV0 />} />
          {/* Lead-magnet funnel (Fase B). Public, no auth. */}
          <Route path="/recursos/manual-para-predicadores" element={<ManualPredicacionLandingPage />} />
          <Route path="/recursos/manual-para-predicadores/gracias" element={<ManualPredicacionThankYouPage />} />

          {/* Public Pricing Page */}
          <Route path="/pricing" element={<PricingPage />} />

          {/* Legal pages (publicly accessible — linked from upload consent modal and footer) */}
          <Route path="/terms" element={<TermsOfServicePage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/dmca" element={<DMCAPolicyPage />} />
          <Route path="/credits" element={<CreditsPage />} />

          {/* Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/registration-success" element={<RegistrationSuccessPage />} />
          <Route path="/auth/action" element={<ActionPage />} />
          <Route
            path="/auth/verify-email"
            element={
              <ProtectedRoute>
                <VerifyEmailPage />
              </ProtectedRoute>
            }
          />
          <Route path="/share/:token" element={<PublicSermonPage />} />

          {/* Redirect old sermon routes to new dashboard routes */}
          <Route path="/sermons" element={<Navigate to="/dashboard/sermons" replace />} />
          <Route path="/sermons/new" element={<Navigate to="/dashboard/sermons/new" replace />} />
          <Route path="/sermons/generate" element={<Navigate to="/dashboard/generate-sermon" replace />} />
          <Route path="/sermons/:id" element={<RedirectToSermon />} />
          <Route path="/sermons/:id/edit" element={<RedirectToSermon suffix="/edit" />} />
          <Route path="/sermons/:id/preach" element={<RedirectToSermon suffix="/preach" />} />

          {/* Preach Mode - Standalone route without sidebar */}
          <Route
            path="/dashboard/sermons/:id/preach"
            element={
              <ProtectedRoute>
                <PreachModePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/preach/:id"
            element={
              <ProtectedRoute>
                <PreachModePage />
              </ProtectedRoute>
            }
          />

          {/* Greek Tutor Active Session - Standalone route without dashboard sidebar (immersive experience) */}
          <Route
            path="/dashboard/greek-tutor/session"
            element={
              <ProtectedRoute>
                <GreekTutorPage />
              </ProtectedRoute>
            }
          />

          {/* Admin Routes (Protected by component) */}
          <Route path="/admin/leads" element={
            <ProtectedRoute>
              <AdminLeads />
            </ProtectedRoute>
          } />
          <Route path="/admin/lead-magnets" element={
            <ProtectedRoute>
              <AdminLeadMagnets />
            </ProtectedRoute>
          } />
          <Route path="/admin/email-previews" element={
            <ProtectedRoute>
              <AdminEmailPreviews />
            </ProtectedRoute>
          } />

          {/* Protected Dashboard Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />

            {/* Sermons Management */}
            <Route path="sermons">
              <Route index element={<SermonsPage />} />
              <Route path="new" element={<SermonNewPage />} />
              <Route path="generate" element={<SermonWizard />} />
              <Route path="tutor" element={<SermonTutorPage />} />
              <Route path=":id" element={<SermonDetailPage />} />
              <Route path=":id/edit" element={<SermonEditPage />} />
              {/* Preach mode removed - moved outside dashboard layout */}
            </Route>

            {/* Preaching Plans Management */}
            <Route path="plans">
              <Route index element={<SeriesList />} />
              <Route path="new" element={<SeriesForm />} />
              <Route path="pericope" element={<ExpositoryAssistantPage />} />
              <Route path=":id" element={<SeriesDetail />} />
              <Route path=":id/edit" element={<SeriesForm />} />
              {/* Configuración exegética: tres ajustes más un catálogo
                  navegable no entran en un diálogo. */}
              <Route path=":seriesId/exegesis" element={<SeriesExegesisConfigPage />} />
            </Route>
            <Route path="planner" element={<PlannerWizard />} />
            <Route path="library" element={<LibraryManager />} />
            <Route path="library/:resourceId/numeracion" element={<PageNumberingPage />} />
            {/* Legacy subscription route — folded into Settings tabs. Kept as a
                redirect so Stripe success/cancel callbacks and external links keep working. */}
            <Route path="subscription" element={<Navigate to="/dashboard/settings?tab=subscription" replace />} />

            {/* Bible Module */}
            <Route path="bible" element={
              <BibleProvider>
                <BiblePage />
              </BibleProvider>
            } />

            <Route path="generate-sermon" element={<SermonWizard />} />

            {/* Projects — first-class workspace entity */}
            <Route path="projects">
              <Route index element={<ProjectsListPage />} />
              <Route path=":projectId" element={<ProjectDashboard />} />
            </Route>

            {/* Legacy redirect: old project URL → new */}
            <Route
              path="faculty/project/:projectId"
              element={<RedirectFacultyProject />}
            />

            {/* Faculty Module — free conversations & directory */}
            <Route path="faculty">
              <Route index element={<FacultyChatPage />} />
              <Route path="library" element={<FacultyLibraryPage />} />
              <Route path="projects/:projectId/library" element={<ProjectLibraryPage />} />
              <Route path=":sessionId" element={<FacultyChatPage />} />
            </Route>

            {/* Exégesis Module — paper-writing wizard with step-by-step
                generation, project-scoped corpus, user-level style guide.
                v1: list of papers + setup. Detail routes added incrementally. */}
            <Route path="exegesis">
              <Route index element={<ExegesisPage />} />
              <Route path="new" element={<ExegesisCreatePage />} />
              <Route path=":paperId" element={<ExegesisPaperPage />} />
              <Route path=":paperId/setup" element={<ExegesisPaperSetupPage />} />
              {/* El selector de hojas es página y no diálogo: recorrer un
                  libro de 400 páginas pide el viewport entero, botón atrás y
                  una URL a la que volver. */}
              <Route path=":paperId/fuentes/:sourceId/paginas" element={<ExegesisSourcePagesPage />} />
            </Route>

            {/* Greek Tutor - Start page with sidebar for navigation */}
            <Route path="greek-tutor" element={<GreekTutorPage />} />

            {/* Suite de Enseñanza (F1) */}
            <Route path="teaching-suite" element={<TeachingSuitePage />} />
            <Route path="teaching-suite/generar" element={<TeachingSuiteGenerarPage />} />
            <Route path="teaching-suite/curso" element={<TeachingSuiteCursoPage />} />
            <Route path="teaching-suite/marca" element={<TeachingSuiteMarcaPage />} />
            <Route path="teaching-suite/marca/:id" element={<TeachingSuiteMarcaPage />} />

            {/* Greek Tutor Dashboard - Sessions list with sidebar */}
            <Route path="greek-tutor-dashboard" element={
              <GreekTutorProvider>
                <GreekTutorDashboardView />
              </GreekTutorProvider>
            } />

            {/* Hebrew Tutor - Verse Analyzer */}
            <Route path="hebrew-tutor" element={<HebrewTutorPage />} />

            {/* Settings — unified hub: Asistentes / Biblioteca / Integraciones / Suscripción / Avanzado as tabs */}
            <Route path="settings" element={<GeneratorSettings />} />
            <Route path="settings/confession" element={<ConfessionSettings />} />
            <Route path="settings/integrations" element={<Navigate to="/dashboard/settings?tab=integrations" replace />} />

            {/* 🎯 Admin Routes - Inside Dashboard Layout */}
            <Route path="admin/core-library" element={<CoreLibraryAdmin />} />
            <Route path="admin/confessions" element={<ConfessionsAdmin />} />
            <Route path="admin/confessions/:confessionId" element={<ConfessionsAdmin />} />
            <Route path="admin/cross-references" element={<CrossReferencesAdmin />} />
            <Route path="admin/verified-misreadings" element={<VerifiedMisreadingsAdmin />} />
            <Route path="admin/analytics" element={<AnalyticsDashboard />} />
            <Route path="admin/geographic" element={<GeographicDashboard />} />
            <Route path="admin/users" element={<UserManagement />} />
            <Route path="admin/users/:uid" element={<UserDetailPage />} />
            <Route path="admin/audit-log" element={<AuditLogPage />} />
            <Route path="admin/llm-cost" element={<LlmCostDashboard />} />
            <Route path="admin/llamaparse-monitoring" element={<LlamaParseMonitoring />} />
            <Route path="admin/tutors" element={<TutorManagement />} />
            <Route path="admin/tutors/new" element={<TutorEditor />} />
            <Route path="admin/tutors/:id" element={<TutorEditor />} />
            <Route path="admin/hebrew-tutor-hints" element={<HintCatalogPage />} />
            <Route path="admin/hebrew-lexicon" element={<LexiconCatalogPage />} />
            <Route path="admin/pastoral-seed/:sermonId" element={<PastoralSeedInspector />} />
            <Route path="admin/doxological-shadow" element={<DoxologicalShadowDashboard />} />
          </Route>
        </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </FirebaseProvider>
  );
}

export default App;
