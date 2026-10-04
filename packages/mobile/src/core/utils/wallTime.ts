/**
 * Una hora de pared corta, «11:45», para la hora de término del atril (C7).
 *
 * Sin a. m./p. m. y en 12 horas a propósito: en medio del culto nadie duda de
 * si es de mañana o de tarde, y la cifra corta se lee de reojo. Tampoco
 * depende del `Intl` del dispositivo, que cambia el formato según el idioma.
 */
export function formatWallTime(ms: number): string {
    const date = new Date(ms);
    const hours = date.getHours() % 12 || 12;
    return `${hours}:${String(date.getMinutes()).padStart(2, '0')}`;
}
