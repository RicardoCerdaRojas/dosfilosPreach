import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

/** Un campo del paso Insight con su etiqueta, ayuda y contador de caracteres. */
interface FieldProps {
    label: string;
    hint?: string;
    value: string;
    min: number;
    rows: number;
    onChange: (value: string) => void;
    onPaste: (e: React.ClipboardEvent) => void;
}

export function InsightField({ label, hint, value, min, rows, onChange, onPaste }: FieldProps) {
    const id = useId();
    const len = (value ?? '').trim().length;
    return (
        <div className="space-y-2">
            <label htmlFor={id} className="text-sm font-medium block">{label}</label>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            {rows <= 2 ? (
                <Input
                    id={id}
                    value={value ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                    onPaste={onPaste}
                />
            ) : (
                <Textarea
                    id={id}
                    value={value ?? ''}
                    rows={rows}
                    onChange={(e) => onChange(e.target.value)}
                    onPaste={onPaste}
                />
            )}
            <p className="text-right text-xs text-muted-foreground">
                {len} / {min}
            </p>
        </div>
    );
}
