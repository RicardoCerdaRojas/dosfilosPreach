import { useEffect, useState } from 'react';
import { AIProject, CREATABLE_PROJECT_TYPES, ProjectColor, ProjectType } from '@dosfilos/domain';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';
import { Sparkles, Loader2 } from 'lucide-react';
import { PROJECT_TYPES } from '@/pages/projects/projectRoadmaps';
import { cn } from '@/lib/utils';

const COLOR_OPTIONS: { value: ProjectColor; label: string; bg: string; ring: string }[] = [
    { value: 'amber',   label: 'Ámbar',    bg: 'bg-amber-500',   ring: 'ring-amber-500' },
    { value: 'emerald', label: 'Esmeralda', bg: 'bg-emerald-500', ring: 'ring-emerald-500' },
    { value: 'sky',     label: 'Azul',      bg: 'bg-sky-500',     ring: 'ring-sky-500' },
    { value: 'rose',    label: 'Rosa',      bg: 'bg-rose-500',    ring: 'ring-rose-500' },
    { value: 'violet',  label: 'Violeta',   bg: 'bg-violet-500',  ring: 'ring-violet-500' },
    { value: 'slate',   label: 'Pizarra',   bg: 'bg-slate-500',   ring: 'ring-slate-500' },
    { value: 'orange',  label: 'Naranja',   bg: 'bg-orange-500',  ring: 'ring-orange-500' },
    { value: 'teal',    label: 'Teal',      bg: 'bg-teal-500',    ring: 'ring-teal-500' },
];

interface ProjectEditDialogProps {
    /** If provided, we are editing an existing project. Otherwise creating. */
    project?: AIProject;
    /** When creating, pre-selects this type instead of the default 'general'. */
    initialType?: ProjectType;
    onClose: () => void;
}

export function ProjectEditDialog({ project, initialType, onClose }: ProjectEditDialogProps) {
    const [title, setTitle] = useState(project?.title || '');
    const [color, setColor] = useState<ProjectColor>(project?.color || 'amber');
    // Un proyecto existente sin tipo arranca en «General», que es lo que hoy
    // muestra: guardar sin elegir no le cambia nada.
    // `initialType` solo vale si es un tipo conocido: un llamador que pasa el
    // evento del clic dejaba el estado con un objeto, y guardar fallaba.
    const tipoValido = (t: unknown): t is ProjectType => typeof t === 'string' && Object.prototype.hasOwnProperty.call(PROJECT_TYPES, t);
    const tipoInicial = (): ProjectType => (project ? project.type ?? 'general' : tipoValido(initialType) ? initialType : 'general');
    const [type, setType] = useState<ProjectType>(tipoInicial);
    const [contextNote, setContextNote] = useState(project?.contextNote || '');

    const { createProject, updateProject, generateContext } = useFacultyProjects();

    const isEditing = !!project;
    /** Creado antes de que el tipo se guardara: se le puede elegir uno, una vez. */
    const sinTipo = isEditing && !project.type;
    const isLoading = createProject.isPending || updateProject.isPending;
    const isGenerating = generateContext.isPending;

    // Sync state when switching between create/edit
    useEffect(() => {
        setTitle(project?.title || '');
        setColor(project?.color || 'amber');
        setType(tipoInicial());
        setContextNote(project?.contextNote || '');
    }, [project, initialType]);

    const [error, setError] = useState<string | null>(null);

    const handleSave = async () => {
        if (!title.trim()) return;
        setError(null);
        try {
            if (isEditing) {
                // El tipo se elige al crear. Editar solo lo manda si el proyecto
                // no tenía (los creados antes de la etapa 0 quedaron sin tipo):
                // antes viajaba siempre y uno sin tipo pasaba a «Sermón» solo.
                await updateProject.mutateAsync({
                    // Vacía viaja como null: así se borra (antes se descartaba y la nota volvía).
                    projectId: project.id, title, color, contextNote: contextNote.trim() || null,
                    ...(sinTipo ? { type } : {}),
                });
            } else {
                await createProject.mutateAsync({ title, color, type, contextNote: contextNote || undefined });
            }
            onClose();
        } catch (err: any) {
            console.error('Error saving project:', err);
            setError(err?.message || 'Ocurrió un error al guardar el proyecto.');
        }
    };


    const handleGenerateContext = async () => {
        if (!project) return; // Can only generate from sessions if the project exists
        const suggested = await generateContext.mutateAsync(project.id);
        setContextNote(suggested);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="relative w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border p-6 mx-4 max-h-[90vh] overflow-y-auto">
                <h2 className="text-lg font-semibold text-foreground mb-5">
                    {isEditing ? 'Editar proyecto' : 'Nuevo proyecto'}
                </h2>

                {/* Type — on create, or once for a project saved without one (changing
                    a type later breaks roadmap continuity) */}
                {(!isEditing || sinTipo) && (
                    <div className="mb-5">
                        <span className="text-sm font-medium text-muted-foreground mb-2 block">
                            Tipo de proyecto
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {CREATABLE_PROJECT_TYPES.map(tipo => PROJECT_TYPES[tipo]).map((meta) => {
                                const Icon = meta.icon;
                                const selected = type === meta.type;
                                return (
                                    <button
                                        key={meta.type}
                                        type="button"
                                        onClick={() => setType(meta.type)}
                                        className={cn(
                                            'flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all',
                                            selected
                                                ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20'
                                                : 'border-border hover:border-foreground/30 hover:bg-muted/40'
                                        )}
                                    >
                                        <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', selected ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground')} />
                                        <div className="min-w-0">
                                            <div className={cn('text-[13px] font-medium', selected ? 'text-foreground' : 'text-foreground/90')}>
                                                {meta.label}
                                            </div>
                                            <div className="text-[11.5px] leading-snug text-muted-foreground mt-0.5">
                                                {meta.description}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Title */}
                <label className="block mb-4">
                    <span className="text-sm font-medium text-muted-foreground mb-1.5 block">Nombre del proyecto</span>
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Ej: Teología II – Cristología"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-muted-foreground/60"
                        maxLength={60}
                        autoFocus
                    />
                </label>

                {/* Color picker */}
                <div className="mb-4">
                    <span className="text-sm font-medium text-muted-foreground mb-2 block">Color</span>
                    <div className="flex flex-wrap gap-2">
                        {COLOR_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                title={opt.label}
                                onClick={() => setColor(opt.value)}
                                className={`w-7 h-7 rounded-full transition-all ${opt.bg} ${color === opt.value ? `ring-2 ring-offset-2 ring-offset-card ${opt.ring}` : 'opacity-60 hover:opacity-100'}`}
                            />
                        ))}
                    </div>
                </div>

                {/* contextNote */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-muted-foreground">Contexto del proyecto</span>
                        {isEditing && (
                            <button
                                type="button"
                                onClick={handleGenerateContext}
                                disabled={isGenerating}
                                className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                {isGenerating
                                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Generando...</>
                                    : <><Sparkles className="w-3 h-3" /> Generar desde sesiones</>
                                }
                            </button>
                        )}
                    </div>
                    <textarea
                        value={contextNote}
                        onChange={e => setContextNote(e.target.value)}
                        placeholder="Descripción opcional: audiencia, nivel teológico, objetivo... El orquestador la usará en cada sesión de este proyecto."
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-muted-foreground/60 resize-none"
                        maxLength={400}
                    />
                    <p className="text-xs text-muted-foreground/70 mt-1 text-right">{contextNote.length}/400</p>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                    {error && (
                        <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 rounded-lg px-3 py-2 border border-rose-200 dark:border-rose-900">
                            {error}
                        </p>
                    )}
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={!title.trim() || isLoading}
                            className="px-4 py-2 text-sm rounded-lg bg-foreground hover:bg-foreground/90 text-background font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear proyecto'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
