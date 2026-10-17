import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, GraduationCap, Pencil, Sparkles } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface PlanTypeOption {
    key: 'expository' | 'thematic' | 'manual';
    icon: React.ComponentType<{ className?: string }>;
    href: string;
    recommended: boolean;
}

const PLAN_TYPE_OPTIONS: PlanTypeOption[] = [
    {
        key: 'expository',
        icon: BookOpen,
        href: '/dashboard/plans/pericope',
        recommended: true,
    },
    {
        key: 'thematic',
        icon: GraduationCap,
        href: '/dashboard/planner',
        recommended: false,
    },
    {
        key: 'manual',
        icon: Pencil,
        href: '/dashboard/plans/new',
        recommended: false,
    },
];

interface NewPlanDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const NewPlanDialog: React.FC<NewPlanDialogProps> = ({ open, onOpenChange }) => {
    const { t } = useTranslation('series');
    const navigate = useNavigate();

    const handleSelect = (href: string) => {
        onOpenChange(false);
        navigate(href);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="font-reading text-[24px] leading-tight">
                        {t('newPlanDialog.title')}
                    </DialogTitle>
                    <DialogDescription className="text-[14px] leading-relaxed">
                        {t('newPlanDialog.description')}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                    {PLAN_TYPE_OPTIONS.map(({ key, icon: Icon, href, recommended }) => (
                        <Card
                            key={key}
                            onClick={() => handleSelect(href)}
                            className={cn(
                                'group flex flex-col p-5 gap-3 transition-all cursor-pointer',
                                recommended
                                    ? 'border-primary/40 bg-gradient-to-b from-primary/[0.04] via-card to-card shadow-md hover:shadow-lg'
                                    : 'border-muted hover:border-primary/60 hover:shadow-md',
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <Icon className="h-4.5 w-4.5" />
                                </div>
                                {recommended && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]">
                                        <Sparkles className="h-3 w-3" />
                                        {t('newPlanDialog.recommendedBadge')}
                                    </span>
                                )}
                            </div>
                            <div className="space-y-1 flex-1">
                                <h3 className="font-reading text-[17px] leading-tight text-foreground">
                                    {t(`newPlanDialog.options.${key}.label`)}
                                </h3>
                                <p className="text-[13px] leading-relaxed text-muted-foreground">
                                    {t(`newPlanDialog.options.${key}.description`)}
                                </p>
                            </div>
                            <Button
                                variant={recommended ? 'default' : 'ghost'}
                                size="sm"
                                className={cn(
                                    'justify-between w-full transition-colors',
                                    !recommended && 'group-hover:bg-primary-solid group-hover:text-primary-foreground',
                                )}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelect(href);
                                }}
                            >
                                {t(`newPlanDialog.options.${key}.cta`)}
                                <ArrowRight className="h-3.5 w-3.5 ml-2 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </Card>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
};
