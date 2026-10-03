import { Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';

/**
 * Credits / source attributions page. Required by the open-source
 * licenses of the original-language biblical text sources we
 * consume in v1.6 (SBLGNT under CC BY-SA 4.0; the WLC via morphhb
 * is public domain but we credit the project anyway).
 *
 * Linked from the expository wizard's source-loaded toast and from
 * the global footer (when one exists). Lives outside the
 * authenticated dashboard so it's always reachable.
 */
export function CreditsPage() {
    return (
        <div className="max-w-3xl mx-auto px-6 py-12">
            <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
                <ArrowLeft className="h-4 w-4" />
                Volver
            </Link>

            <h1 className="text-3xl font-bold tracking-tight mb-2">
                Créditos y atribuciones
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
                Fuentes externas que el módulo expositivo (v1.6+) consume y los términos
                bajo los cuales se usan.
            </p>

            <div className="prose prose-slate dark:prose-invert max-w-none">
                <h2>Texto griego del Nuevo Testamento — SBLGNT</h2>
                <p>
                    El asistente expositivo analiza el texto griego del Nuevo Testamento usando
                    los datos del proyecto <strong>MorphGNT/SBLGNT</strong>:
                </p>
                <ul>
                    <li>
                        <a
                            href="https://github.com/morphgnt/sblgnt"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1"
                        >
                            morphgnt/sblgnt en GitHub <ExternalLink className="h-3 w-3" />
                        </a>
                    </li>
                    <li>
                        Editor: SBL (Society of Biblical Literature) Greek New Testament,
                        Michael W. Holmes (ed.), 2010.
                    </li>
                    <li>
                        Licencia: <strong>Creative Commons Attribution-ShareAlike 4.0
                        International</strong>{' '}
                        (
                        <a
                            href="https://creativecommons.org/licenses/by-sa/4.0/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1"
                        >
                            CC BY-SA 4.0 <ExternalLink className="h-3 w-3" />
                        </a>
                        ).
                    </li>
                </ul>
                <p>
                    El texto se descarga vía CDN (jsDelivr/GitHub) en tiempo de uso y se cachea
                    en memoria del navegador. Dos Filos no redistribuye el corpus; lo consume
                    como dependencia externa con la atribución requerida.
                </p>

                <h2>Texto hebreo del Antiguo Testamento — Westminster Leningrad Codex</h2>
                <p>
                    El asistente expositivo analiza el texto hebreo del Antiguo Testamento
                    usando los datos del proyecto <strong>OpenScriptures/morphhb</strong>:
                </p>
                <ul>
                    <li>
                        <a
                            href="https://github.com/openscriptures/morphhb"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1"
                        >
                            openscriptures/morphhb en GitHub <ExternalLink className="h-3 w-3" />
                        </a>
                    </li>
                    <li>
                        Base: Westminster Leningrad Codex con análisis morfológico de
                        OpenScriptures.
                    </li>
                    <li>
                        Estado: dominio público. La etiquetación morfológica de OpenScriptures
                        se distribuye también bajo licencia abierta.
                    </li>
                </ul>

                <p>
                    Para encontrar en los léxicos las páginas de cada palabra hebrea del pasaje,
                    se usa la tabla de lemas del diccionario de Strong preparada por el
                    <strong> Open Scriptures Hebrew Bible Project</strong>:
                </p>
                <ul>
                    <li>
                        <a
                            href="https://github.com/openscriptures/HebrewLexicon"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1"
                        >
                            openscriptures/HebrewLexicon en GitHub <ExternalLink className="h-3 w-3" />
                        </a>
                    </li>
                    <li>
                        Licencia: Creative Commons Attribution 4.0 International (CC BY 4.0). El
                        texto del diccionario de Strong es de dominio público.
                    </li>
                </ul>

                <h2>Modelos de IA</h2>
                <p>
                    El análisis exegético y la conversión a unidades predicables usa modelos
                    de la familia <strong>Gemini</strong> (Google) sobre la API oficial.
                    El uso está sujeto a los{' '}
                    <a
                        href="https://ai.google.dev/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1"
                    >
                        términos del API de Google <ExternalLink className="h-3 w-3" />
                    </a>
                    .
                </p>

                <h2>Traducciones bíblicas (fallback)</h2>
                <p>
                    Cuando los textos originales no pueden cargarse, el asistente cae a una
                    traducción como surrogate:
                </p>
                <ul>
                    <li>
                        <strong>Reina-Valera 1960</strong> (RVR1960) para español. Sociedades
                        Bíblicas Unidas, dominio público en la mayoría de jurisdicciones.
                    </li>
                    <li>
                        <strong>American Standard Version</strong> (ASV) para inglés. Dominio
                        público.
                    </li>
                </ul>

                <h2>Metodología</h2>
                <p>
                    El pipeline de 5 pases (panorama → macroestructura → microestructura →
                    conversión predicable → evaluación de fidelidad) se inspira en la
                    metodología homilética histórica de{' '}
                    <strong>Haddon Robinson</strong>, <strong>Bryan Chapell</strong> y{' '}
                    <strong>Sidney Greidanus</strong>, adaptada al flujo de trabajo asistido
                    por IA.
                </p>
            </div>
        </div>
    );
}
