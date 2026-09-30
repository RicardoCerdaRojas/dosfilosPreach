/** Formatos del panel de extracción. Sin texto que traducir: sólo números. */

export function formatUsd(n: number): string {
    if (n === 0) return '$0';
    return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(n < 10 ? 2 : 0)}`;
}

export function formatDuration(ms: number | null | undefined): string {
    if (typeof ms !== 'number') return '—';
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s} s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min ${s % 60} s`;
    return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export function formatPct(ratio: number): string {
    return `${Math.round(ratio * 100)}%`;
}
