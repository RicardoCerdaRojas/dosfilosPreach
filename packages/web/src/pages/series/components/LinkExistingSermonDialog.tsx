import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { filterLinkableSermons, linkableSermonsFor, type LinkableSermon } from '@dosfilos/domain';
import { sermonService } from '@dosfilos/application';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface Props {
    /** El título o pasaje de la perícopa, para el encabezado. */
    pericopeLabel: string;
    pericopePassage: string;
    seriesId: string;
    userId: string;
    /** Borradores que ya ocupan una perícopa de esta serie. */
    linkedIds: ReadonlySet<string>;
    onLink: (sermonId: string) => Promise<boolean>;
    onClose: () => void;
}

/**
 * «Vincular sermón existente…» (#3 del ejercicio de Jonás). El orden y la
 * regla de la copia publicada son `linkableSermonsFor`.
 */
export function LinkExistingSermonDialog({
    pericopeLabel,
    pericopePassage,
    seriesId,
    userId,
    linkedIds,
    onLink,
    onClose,
}: Props) {
    const { t } = useTranslation('series');
    const k = (key: string) => `detail.table.linkExisting.${key}`;
    const [candidates, setCandidates] = useState<LinkableSermon[] | null>(null);
    const [query, setQuery] = useState('');
    const [chosen, setChosen] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let vivo = true;
        sermonService
            .getUserSermonSummaries(userId)
            .then(list => vivo && setCandidates(linkableSermonsFor(list, pericopePassage, seriesId, linkedIds)))
            .catch(() => vivo && setCandidates([]));
        return () => {
            vivo = false;
        };
    }, [userId, pericopePassage, seriesId, linkedIds]);

    const visible = useMemo(() => filterLinkableSermons(candidates ?? [], query), [candidates, query]);

    const link = async () => {
        if (!chosen) return;
        setSaving(true);
        const ok = await onLink(chosen);
        setSaving(false);
        if (ok) onClose();
    };

    return (
        <Dialog open onOpenChange={o => !o && onClose()}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{t(k('title'), { pericope: pericopeLabel })}</DialogTitle>
                    <DialogDescription>{t(k('description'))}</DialogDescription>
                </DialogHeader>

                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                    <Input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder={t(k('search'))}
                        aria-label={t(k('search'))}
                        className="pl-8"
                    />
                </div>

                <div className="max-h-80 overflow-y-auto rounded-md border" role="radiogroup">
                    {candidates === null ? (
                        <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> {t(k('loading'))}
                        </p>
                    ) : visible.length === 0 ? (
                        <p className="p-4 text-sm text-muted-foreground">
                            {t(k(candidates.length === 0 ? 'empty' : 'noResults'))}
                        </p>
                    ) : (
                        visible.map(s => (
                            <button
                                key={s.id}
                                type="button"
                                role="radio"
                                aria-checked={chosen === s.id}
                                disabled={s.inOtherSeries}
                                onClick={() => setChosen(s.id)}
                                className={cn(
                                    'flex w-full items-start justify-between gap-3 border-b px-3 py-2.5 text-left last:border-b-0',
                                    'disabled:cursor-not-allowed disabled:opacity-50',
                                    chosen === s.id ? 'bg-primary/10' : 'hover:bg-accent/50',
                                )}
                            >
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium">{s.title}</span>
                                    <span className="block text-xs font-mono text-muted-foreground">
                                        {s.passage || t(k('noPassage'))}
                                    </span>
                                </span>
                                <span className="flex shrink-0 flex-col items-end gap-1">
                                    {s.match === 'overlap' && <Badge variant="secondary">{t(k('matchOverlap'))}</Badge>}
                                    {s.match === 'same-book' && <Badge variant="outline">{t(k('matchSameBook'))}</Badge>}
                                    {s.inOtherSeries && (
                                        <span className="text-[11px] text-muted-foreground">{t(k('otherSeries'))}</span>
                                    )}
                                </span>
                            </button>
                        ))
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        {t(k('cancel'))}
                    </Button>
                    <Button type="button" onClick={link} disabled={!chosen || saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t(k('confirm'))}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
