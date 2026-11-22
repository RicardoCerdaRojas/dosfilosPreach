import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Un secreto aleatorio en base64url (códigos, tokens, ids de solicitud). */
export function secreto(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
}

/** Lo que se guarda de un secreto: su huella, nunca el secreto. */
export function huella(valor: string): string {
    return createHash('sha256').update(valor).digest('hex');
}

/** PKCE S256: base64url(sha256(verifier)) === challenge, comparado en tiempo constante. */
export function pkceValido(verifier: string, challenge: string): boolean {
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
    const calculado = Buffer.from(createHash('sha256').update(verifier).digest('base64url'));
    const esperado = Buffer.from(challenge);
    return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

/** Un challenge S256 bien formado: 43 caracteres base64url. */
export function challengeValido(challenge: unknown): challenge is string {
    return typeof challenge === 'string' && /^[A-Za-z0-9_-]{43}$/.test(challenge);
}
