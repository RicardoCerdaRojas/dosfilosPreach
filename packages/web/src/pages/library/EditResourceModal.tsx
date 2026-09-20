import { useState, useEffect } from 'react';
import {
    LibraryResourceEntity,
    ResourceType,
    type BibleBookId,
    type LibraryResourceScope,
} from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { ResourceMetadataEditor } from './components/ResourceMetadataEditor';

interface EditResourceModalProps {
    resource: LibraryResourceEntity | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (id: string, updates: {
        title: string;
        author: string;
        type: ResourceType;
        coversBibleBooks: ReadonlyArray<BibleBookId>;
        scope: LibraryResourceScope;
        authoredByUser: boolean;
    }) => Promise<void>;
}

// Resource types available in the editor — labels look up via i18n at render time.
type CategoryI18nKey = 'theology' | 'grammar' | 'criticalText' | 'commentary' | 'exegeticalCommentary' | 'theologicalDictionary' | 'bibleDictionary' | 'historicalContext' | 'biblicalSurvey' | 'article' | 'other';
const RESOURCE_TYPE_KEYS: Array<{ value: ResourceType; i18nKey: CategoryI18nKey }> = [
    { value: 'theology', i18nKey: 'theology' },
    { value: 'grammar', i18nKey: 'grammar' },
    { value: 'critical-text', i18nKey: 'criticalText' },
    { value: 'commentary', i18nKey: 'commentary' },
    { value: 'exegetical-commentary', i18nKey: 'exegeticalCommentary' },
    { value: 'theological-dictionary', i18nKey: 'theologicalDictionary' },
    { value: 'bible-dictionary', i18nKey: 'bibleDictionary' },
    { value: 'historical-context', i18nKey: 'historicalContext' },
    { value: 'biblical-survey', i18nKey: 'biblicalSurvey' },
    { value: 'article', i18nKey: 'article' },
    { value: 'other', i18nKey: 'other' },
];

export function EditResourceModal({ resource, open, onOpenChange, onSave }: EditResourceModalProps) {
    const { t } = useTranslation('library');
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [type, setType] = useState<ResourceType>('theology');
    const [coversBibleBooks, setCoversBibleBooks] = useState<ReadonlyArray<BibleBookId>>([]);
    const [scope, setScope] = useState<LibraryResourceScope>('book');
    // Quién escribió el texto. No se deduce de nada: un PDF no lo dice, y de
    // esta marca depende que el perfil de voz pueda aprender el registro del
    // autor sin devolverle el de otro.
    const [authoredByUser, setAuthoredByUser] = useState(false);
    const [saving, setSaving] = useState(false);

    // Reset form when resource changes
    useEffect(() => {
        if (resource) {
            setTitle(resource.title);
            setAuthor(resource.author);
            setType(resource.type);
            // v1.7 metadata. Repo deserializer defaults legacy docs to
            // [] + 'book' so these reads are always defined.
            setCoversBibleBooks(resource.coversBibleBooks ?? []);
            setAuthoredByUser((resource as { authoredByUser?: boolean }).authoredByUser === true);
            setScope(resource.scope ?? 'book');
        }
    }, [resource]);

    const handleSave = async () => {
        if (!resource) return;
        setSaving(true);
        try {
            await onSave(resource.id, {
                title,
                author,
                type,
                coversBibleBooks,
                scope,
                authoredByUser,
            });
            onOpenChange(false);
        } catch (error) {
            console.error('Error saving resource:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('editModal.title')}</DialogTitle>
                    <DialogDescription>
                        {t('editModal.description')}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="edit-title">{t('editModal.titleLabel')}</Label>
                        <Input
                            id="edit-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={t('editModal.titlePlaceholder')}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="edit-author">{t('editModal.authorLabel')}</Label>
                        <Input
                            id="edit-author"
                            value={author}
                            onChange={(e) => setAuthor(e.target.value)}
                            placeholder={t('editModal.authorPlaceholder')}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="edit-type">{t('editModal.categoryLabel')}</Label>
                        <Select value={type} onValueChange={(v: ResourceType) => setType(v)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {RESOURCE_TYPE_KEYS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {t(`editModal.categoryOptions.${opt.i18nKey}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <ResourceMetadataEditor
                        coversBibleBooks={coversBibleBooks}
                        scope={scope}
                        onCoversBibleBooksChange={setCoversBibleBooks}
                        onScopeChange={setScope}
                    />
                    <label className="flex items-start gap-2 text-sm text-foreground">
                        <input
                            type="checkbox"
                            checked={authoredByUser}
                            onChange={e => setAuthoredByUser(e.target.checked)}
                            className="mt-1"
                        />
                        <span>
                            {t('editModal.authoredByUser')}
                            <span className="block text-xs text-muted-foreground">
                                {t('editModal.authoredByUserHint')}
                            </span>
                        </span>
                    </label>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        {t('editModal.cancel')}
                    </Button>
                    <Button onClick={handleSave} disabled={saving || !title.trim()}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('editModal.save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
