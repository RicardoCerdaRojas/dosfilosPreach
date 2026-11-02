/**
 * Lo que el banco reemplaza: sin servidor, sin sesión y sin diálogos pesados. Las
 * acciones no hacen nada; el banco mira qué se ofrece y cómo se ve, no qué hace.
 */
const nada = () => null;
const mutacion = { mutate: () => undefined, mutateAsync: async () => ({}), isPending: false };

export const useExegesisPapers = () => new Proxy({}, { get: () => mutacion });
export const useReopenStep = () => mutacion;
export const useExegesisPaper = () => ({ paper: { sources: [] } });
export const useFirebase = () => ({ user: { uid: 'banco' } });
export const useRegisterCitationSink = () => undefined;
export const useSourceViewer = () => ({ open: nada, openCitation: nada });
export const exegesisService = new Proxy({}, { get: () => ({ execute: async () => ({}) }) });

export const CanonicalAnalysisStudyView = nada;
export const CitationVerificationDialog = nada;
export const AgregarIdeaDialog = nada;
export const ExegesisOutOfCreditsDialog = nada;
export const ExegesisPreConfirmDialog = nada;
export const CreditPacksDialog = nada;
