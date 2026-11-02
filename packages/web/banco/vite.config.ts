import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * El banco de tarjetas: solo para desarrollo, nunca entra al build. Monta el
 * `StepCard` real, con el CSS real y sin sesión: lo que habla con el servidor se
 * reemplaza por `vacios.tsx`.
 */
const web = path.resolve(__dirname, '..');
const vacios = path.resolve(__dirname, 'vacios.tsx');
const reemplazados = [
    '@/hooks/exegesis/useExegesisPapers',
    '@/hooks/exegesis/useReopenStep',
    '@/hooks/exegesis/useExegesisPaper',
    '@/context/firebase-context',
    '@/components/exegesis/citation/SourceViewerProvider',
    '@/components/exegesis/canonical/CanonicalAnalysisStudyView',
    '@/components/exegesis/CitationVerificationDialog',
    '@/components/exegesis/AgregarIdeaDialog',
    '@/components/exegesis/ExegesisOutOfCreditsDialog',
    '@/components/exegesis/ExegesisPreConfirmDialog',
    '@/pages/library/components/CreditPacksDialog',
    '@dosfilos/application',
];

export default defineConfig({
    root: web,
    plugins: [react()],
    resolve: {
        alias: [
            ...reemplazados.map(modulo => ({ find: new RegExp(`^${modulo}$`), replacement: vacios })),
            { find: /^@\//, replacement: `${path.resolve(web, 'src')}/` },
            { find: '@dosfilos/domain', replacement: path.resolve(web, '../domain') },
            { find: '@dosfilos/infrastructure', replacement: path.resolve(web, '../infrastructure') },
        ],
    },
    optimizeDeps: { exclude: ['@dosfilos/domain', '@dosfilos/application', '@dosfilos/infrastructure'] },
    server: { port: 5199, strictPort: true },
});
