import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MessageSquareQuote } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ProjectType } from '@dosfilos/domain';
import { PROJECT_TYPES } from '@/pages/projects/projectRoadmaps';

interface FeaturedCard {
    type: ProjectType;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    description: string;
}

/**
 * Inclusive copy that addresses both pastoral and academic audiences.
 * Each card maps to an existing ProjectType (which carries its own
 * roadmap); the dialog opens with that type pre-selected.
 */
// De `PROJECT_TYPES`: dos copias de las etiquetas ya se habían separado
// (revisión de la etapa 1). Para predicar una serie está el Planificador.
const FEATURED_CARDS: FeaturedCard[] = (['course', 'study', 'exegetical'] as const).map(type => {
    const { label, description, icon } = PROJECT_TYPES[type];
    return { type, label, description, icon };
});

interface ProjectsEmptyStateProps {
    /**
     * Called when the user picks a project type. Caller handles plan-gating
     * (free tier shows upgrade modal before opening the create dialog).
     */
    onCreateProject: (type?: ProjectType) => void;
}

export const ProjectsEmptyState: React.FC<ProjectsEmptyStateProps> = ({ onCreateProject }) => {
    const navigate = useNavigate();

    return (
        <div className="container mx-auto py-10 md:py-12 px-4 space-y-8">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
                <h2 className="font-reading text-[28px] md:text-[34px] leading-[1.1] tracking-[-0.02em] text-foreground">
                    ¿Qué vas a estudiar?
                </h2>
                <p className="text-[14px] md:text-[15px] leading-relaxed text-muted-foreground">
                    Elige el tipo de proyecto. Cada uno tiene su propio flujo.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
                {FEATURED_CARDS.map(({ type, icon: Icon, label, description }) => (
                    <Card
                        key={type}
                        onClick={() => onCreateProject(type)}
                        className="group flex flex-col p-5 gap-4 border-muted hover:border-primary/60 hover:shadow-md transition-all cursor-pointer"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" />
                        </div>
                        <div className="space-y-1.5 flex-1">
                            <h3 className="font-reading text-[18px] leading-tight text-foreground">
                                {label}
                            </h3>
                            <p className="text-[13.5px] leading-relaxed text-muted-foreground">
                                {description}
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="justify-between w-full group-hover:bg-primary-solid group-hover:text-primary-foreground transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                onCreateProject(type);
                            }}
                        >
                            Comenzar
                            <ArrowRight className="h-3.5 w-3.5 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </Card>
                ))}
            </div>

            <div className="flex justify-center pt-2">
                <button
                    type="button"
                    onClick={() => navigate('/dashboard/faculty')}
                    className="inline-flex items-center gap-2 text-[13.5px] text-muted-foreground hover:text-foreground transition-colors"
                >
                    <MessageSquareQuote className="h-4 w-4" />
                    ¿Solo una pregunta puntual? Ve a Tutores sin crear un proyecto
                    <ArrowRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};
