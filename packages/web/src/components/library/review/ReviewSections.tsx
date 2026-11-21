import { useTranslation } from 'react-i18next';
import { getBookById, type BibleBookId, type LibraryResource, type PdfReview, type PdfReviewInput } from '@dosfilos/domain';
import { Evidence, ReviewAction, ReviewSection } from './ReviewSection';

const nombre = (id: BibleBookId, lang: string) => {
    const b = getBookById(id);
    return b ? (lang.startsWith('en') ? b.nameEn : b.nameEs) : id;
};

export function IdentitySection({ review, resource }: { review: PdfReview; resource: LibraryResource }) {
    const { t, i18n } = useTranslation('library');
    const { identity } = review;
    const lista = (ids: ReadonlyArray<BibleBookId>) => ids.map(id => nombre(id, i18n.language)).join(', ');
    const tone = identity.verdict === 'coincide' ? 'ok' : identity.verdict === 'otro-libro' ? 'warn' : 'info';
    return (
        <ReviewSection id="revision-obra" title={t('review.identity.title')} tone={tone}>
            <p>{t(`review.identity.${identity.verdict}`, {
                book: lista(identity.found.filter(b => resource.coversBibleBooks?.includes(b))),
                declared: lista(resource.coversBibleBooks ?? []),
                found: lista(identity.found),
            })}</p>
            {identity.evidence && <Evidence>{t('review.evidence', { line: identity.evidence })}</Evidence>}
            {identity.verdict === 'otro-libro' && <p className="text-xs text-muted-foreground">{t('review.identity.fix')}</p>}
        </ReviewSection>
    );
}

export function EditionSection({ review, resource, cited, onSave, saving }: {
    review: PdfReview;
    resource: LibraryResource;
    cited: PdfReviewInput['cited'];
    onSave: (data: { year?: string; isbn?: string }) => void;
    saving: boolean;
}) {
    const { t } = useTranslation('library');
    const { edition } = review;
    const ficha = resource.bibliography ?? null;
    const anio = edition.year ? String(edition.year) : null;
    const guardar: { year?: string; isbn?: string } = {
        ...(anio && ficha?.year?.trim() !== anio ? { year: anio } : {}),
        ...(edition.isbn && ficha?.isbn !== edition.isbn ? { isbn: edition.isbn } : {}),
    };
    const tone = edition.vsCited === 'distinta' ? 'warn' : edition.year || edition.isbn ? 'ok' : 'info';
    const citada = cited ? [cited.publisher, cited.year].filter(Boolean).join(', ') : '';
    return (
        <ReviewSection id="revision-edicion" title={t('review.edition.title')} tone={tone}>
            {edition.year || edition.isbn ? (
                <p>{[anio && t('review.edition.year', { year: anio }), edition.isbn && t('review.edition.isbn', { isbn: edition.isbn })].filter(Boolean).join(' · ')}</p>
            ) : <p>{t('review.edition.noCredits')}</p>}
            {edition.evidence && <Evidence>{t('review.evidence', { line: edition.evidence })}</Evidence>}
            {cited
                ? <p>{t(`review.edition.vsCited.${edition.vsCited ?? 'sin-dato'}`, { cited: citada, year: anio ?? '—' })}</p>
                : <p className="text-muted-foreground">{t('review.edition.noCited')}</p>}
            {edition.vsBibliography === 'distinta' && <p>{t('review.edition.vsBibliography', { stored: ficha?.year })}</p>}
            {Object.keys(guardar).length > 0 && (
                <ReviewAction onClick={() => onSave(guardar)} disabled={saving}>
                    {t('review.edition.save', { fields: Object.values(guardar).join(' · ') })}
                </ReviewAction>
            )}
        </ReviewSection>
    );
}

export function PaginationSection({ review, ebook, storedConfirmed, canSave, onSave, onSaveNone, onCalibrate, onShowSheet, saving }: {
    review: PdfReview;
    ebook: boolean;
    /** Ya hay una numeración confirmada: si coincide con las hojas, no hay nada que guardar. */
    storedConfirmed: boolean;
    /** Hay una numeración que guardar: un desfase leído en al menos dos hojas (`numberingFromReview`). */
    canSave: boolean;
    onSave: () => void;
    onSaveNone: () => void;
    onCalibrate: () => void;
    onShowSheet: (sheet: number) => void;
    saving: boolean;
}) {
    const { t } = useTranslation('library');
    const p = review.pagination;
    const leidas = p.points.filter(x => x.offset !== null);
    const ejemplo = leidas[0];
    const regla = p.offset === null ? '' : t(p.offset <= 0 ? 'review.pagination.minus' : 'review.pagination.plus', { count: Math.abs(p.offset) });
    const verdict = ebook ? 'ebook' : p.verdict;
    const yaGuardada = storedConfirmed && p.storedAgrees;
    const tone = verdict === 'una' && !p.storedDisagrees ? 'ok' : 'warn';
    return (
        <ReviewSection id="revision-paginas" title={t('review.pagination.title')} tone={tone}>
            <p>{t(`review.pagination.${verdict}`, {
                sheet: ejemplo?.sheet, printed: ejemplo?.folio, rule: regla, have: leidas.length, total: p.points.length,
            })}</p>
            {!ebook && p.points.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                    {p.points.map(x => (
                        <li key={x.sheet}>
                            <button
                                type="button"
                                onClick={() => onShowSheet(x.sheet)}
                                className="min-h-8 rounded-md border border-border px-2 text-xs text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {x.folio ? t('review.pagination.point', { sheet: x.sheet, folio: x.folio }) : t('review.pagination.pointNone', { sheet: x.sheet })}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {p.storedDisagrees && <p className="text-warning-subtle-foreground">{t('review.pagination.storedDisagrees')}</p>}
            {yaGuardada && <p className="text-success">{t('review.pagination.storedAgrees')}</p>}
            <div className="flex flex-wrap gap-2">
                {canSave && !yaGuardada && (
                    <ReviewAction primary onClick={onSave} disabled={saving}>
                        {t(p.storedDisagrees ? 'review.pagination.replace' : 'review.pagination.save')}
                    </ReviewAction>
                )}
                {(verdict === 'sin-folios' || verdict === 'ebook') && (
                    <ReviewAction onClick={onSaveNone} disabled={saving}>{t('review.pagination.saveNone')}</ReviewAction>
                )}
                {!ebook && <ReviewAction onClick={onCalibrate}>{t('review.pagination.calibrate')}</ReviewAction>}
            </div>
        </ReviewSection>
    );
}

export function CopySection({ review }: { review: PdfReview }) {
    const { t } = useTranslation('library');
    return (
        <ReviewSection id="revision-copia" title={t('review.copy.title')} tone={review.signals.length ? 'warn' : 'ok'}>
            {review.signals.length === 0
                ? <p>{t('review.copy.none')}</p>
                : review.signals.map(s => <p key={s.kind}>{t(`review.copy.${s.kind}`, { detail: s.detail })}</p>)}
        </ReviewSection>
    );
}
