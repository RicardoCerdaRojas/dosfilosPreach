import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { customManuscriptStyle, DEFAULT_MANUSCRIPT_STYLE } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n';

interface Props {
    /** El estilo guardado por el usuario; ausente = el del sistema. */
    value: string | undefined;
    /** Recibe lo que hay que guardar: `undefined` cuando es el del sistema. */
    onChange: (value: string | undefined) => void;
}

/**
 * El estilo del manuscrito, editable (#5 del ejercicio de Jonás 4:5-11).
 *
 * El texto vive en un estado propio: si siguiera a `value`, borrar la caja
 * entera para reescribirla la volvería al del sistema en el acto. Lo que sube
 * es `customManuscriptStyle`: igual al del sistema o vacío no se guarda.
 */
export function ManuscriptStyleCard({ value, onChange }: Props) {
    const { t } = useTranslation('settings');
    const [text, setText] = useState(value?.trim() ? value : DEFAULT_MANUSCRIPT_STYLE);

    // La configuración llega después del primer render: sincronizar sólo
    // cuando lo guardado no es lo que ya muestra la caja.
    useEffect(() => {
        if ((customManuscriptStyle(text) ?? undefined) !== (value?.trim() || undefined)) {
            setText(value?.trim() ? value : DEFAULT_MANUSCRIPT_STYLE);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const own = customManuscriptStyle(text) !== null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('manuscriptStyle.title')}</CardTitle>
                <CardDescription>{t('manuscriptStyle.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium" aria-live="polite">
                        {t(own ? 'manuscriptStyle.usingOwn' : 'manuscriptStyle.usingSystem')}
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!own}
                        onClick={() => {
                            setText(DEFAULT_MANUSCRIPT_STYLE);
                            onChange(undefined);
                        }}
                    >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        {t('manuscriptStyle.reset')}
                    </Button>
                </div>
                <Textarea
                    aria-label={t('manuscriptStyle.title')}
                    value={text}
                    rows={16}
                    className="font-mono text-xs leading-relaxed"
                    onChange={e => {
                        setText(e.target.value);
                        onChange(customManuscriptStyle(e.target.value) ?? undefined);
                    }}
                />
                <p className="text-xs text-muted-foreground">{t('manuscriptStyle.register')}</p>
                <p className="text-xs text-muted-foreground">{t('manuscriptStyle.saveHint')}</p>
            </CardContent>
        </Card>
    );
}
