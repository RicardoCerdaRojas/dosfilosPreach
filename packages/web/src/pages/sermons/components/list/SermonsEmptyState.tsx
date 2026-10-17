import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, NotebookPen, MessageSquareQuote, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';

type PathKey = 'project' | 'exegesis' | 'tutor';

const PATHS: Array<{
    key: PathKey;
    icon: React.ComponentType<{ className?: string }>;
    href: string;
}> = [
    { key: 'project', icon: FolderKanban, href: '/dashboard/projects' },
    { key: 'exegesis', icon: NotebookPen, href: '/dashboard/exegesis' },
    { key: 'tutor', icon: MessageSquareQuote, href: '/dashboard/faculty' },
];

export const SermonsEmptyState: React.FC = () => {
    const { t } = useTranslation('sermons');
    const navigate = useNavigate();

    return (
        <div className="container mx-auto py-12 px-4 space-y-10">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
                <h2 className="text-3xl font-semibold tracking-tight">{t('empty.title')}</h2>
                <p className="text-muted-foreground text-lg">{t('empty.description')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
                {PATHS.map(({ key, icon: Icon, href }, index) => (
                    <Card
                        key={key}
                        className="group flex flex-col p-6 gap-4 border-muted hover:border-primary/60 hover:shadow-md transition-all cursor-pointer"
                        onClick={() => navigate(href)}
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <Icon className="h-5 w-5" />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">
                                {t('empty.paths.step', { n: index + 1 })}
                            </span>
                        </div>
                        <div className="space-y-2 flex-1">
                            <h3 className="text-lg font-semibold">{t(`empty.paths.${key}.title`)}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {t(`empty.paths.${key}.description`)}
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            className="justify-between w-full group-hover:bg-primary-solid group-hover:text-primary-foreground transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate(href);
                            }}
                        >
                            {t(`empty.paths.${key}.cta`)}
                            <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </Card>
                ))}
            </div>

            <p className="text-center text-sm text-muted-foreground italic max-w-xl mx-auto">
                {t('empty.footer')}
            </p>
        </div>
    );
};
