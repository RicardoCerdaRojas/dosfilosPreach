import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { PASTORAL_SEED_THRESHOLDS, type PaperReferenceItem, type WordStudy } from '@dosfilos/domain';
import { adaptedDiscoveryState } from './adaptedDiscovery';

type Seed = NonNullable<PaperReferenceItem['wordStudySeed']>;

interface Props {
    seed: Seed;
    onClose: () => void;
    onAdd: (study: WordStudy) => Promise<void>;
}

const MIN = PASTORAL_SEED_THRESHOLDS.wordStudies.pastorDiscoveryMinChars;

/**
 * Lleva una palabra del paper al estudio del pastor, con la explicación
 * completa para que él la adapte. Sólo se agrega lo que el pastor dejó
 * (ver `adaptedDiscoveryState`).
 */
export function AdaptWordStudyDialog({ seed, onClose, onAdd }: Props) {
    const { t } = useTranslation('wordStudy');
    const [discovery, setDiscovery] = useState(seed.explanation);
    const [saving, setSaving] = useState(false);
    const state = adaptedDiscoveryState(seed.explanation, discovery, MIN);

    const add = async () => {
        if (state !== 'ready') return;
        setSaving(true);
        try {
            await onAdd({
                word: seed.word,
                lemma: seed.lemma,
                reference: seed.reference,
                language: seed.language,
                pastorDiscovery: discovery.trim(),
            });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open onOpenChange={o => !o && onClose()}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {t('fromPaper.title', { word: seed.word })}
                    </DialogTitle>
                    <DialogDescription>{t('fromPaper.subtitle')}</DialogDescription>
                </DialogHeader>

                <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <dt className="text-xs text-muted-foreground">{t('fromPaper.reference')}</dt>
                        <dd className="font-medium">{seed.reference}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">{t('fromPaper.language')}</dt>
                        <dd className="font-medium">{t(`form.languages.${seed.language}`)}</dd>
                    </div>
                </dl>

                <div className="space-y-1.5">
                    <label htmlFor="adapt-word-study" className="text-sm font-medium">
                        {t('fromPaper.discovery')}
                    </label>
                    <Textarea
                        id="adapt-word-study"
                        value={discovery}
                        onChange={e => setDiscovery(e.target.value)}
                        rows={10}
                        className="text-sm leading-relaxed"
                    />
                    <p className={`text-xs ${state === 'ready' ? 'text-muted-foreground' : 'text-warning'}`}>
                        {state === 'unchanged' && t('fromPaper.unchanged')}
                        {state === 'too-short' && t('fromPaper.tooShort', { min: MIN })}
                        {state === 'ready' && `${discovery.trim().length} / ${MIN}`}
                    </p>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        {t('fromPaper.cancel')}
                    </Button>
                    <Button type="button" onClick={add} disabled={state !== 'ready' || saving}>
                        {t('fromPaper.add')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
