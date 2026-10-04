import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import legalEs from '@/i18n/locales/es/legal.json';
import legalEn from '@/i18n/locales/en/legal.json';
import { DeleteAccountPage } from '../DeleteAccount';
import { PrivacyPolicyPage } from '../PrivacyPolicy';

// El índice de `@/i18n` arrastra servicios con Firebase; aquí basta el hook.
vi.mock('@/i18n', async () => {
    const real = await import('react-i18next');
    return { useTranslation: (ns: string) => real.useTranslation(ns) };
});

/**
 * Las páginas legales pasaron a i18n (trinquete de texto hardcodeado). Lo que
 * importa que no se pierda en el camino: el texto entero, los enlaces y que
 * el inglés tenga la misma forma que el español.
 */
beforeAll(async () => {
    await i18n.use(initReactI18next).init({
        lng: 'es',
        fallbackLng: 'es',
        resources: { es: { legal: legalEs }, en: { legal: legalEn } },
        interpolation: { escapeValue: false },
    });
});
afterEach(() => cleanup());

const shape = (value: unknown): unknown =>
    Array.isArray(value)
        ? value.map(shape)
        : value && typeof value === 'object'
          ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]))
          : typeof value;
const tags = (value: unknown): string[] =>
    JSON.stringify(value).match(/<\/?[a-z]+>/g)?.sort() ?? [];

describe('páginas legales', () => {
    it('el inglés tiene las mismas claves, listas y marcas que el español', () => {
        expect(shape(legalEn)).toEqual(shape(legalEs));
        expect(tags(legalEn)).toEqual(tags(legalEs));
    });

    it('la página de borrado muestra cómo pedirlo, el plazo y el correo como enlace', () => {
        render(<MemoryRouter><DeleteAccountPage /></MemoryRouter>);
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(legalEs.deleteAccount.title);
        expect(screen.getAllByRole('listitem')).toHaveLength(legalEs.deleteAccount.how.length + legalEs.deleteAccount.after.length);
        expect(screen.getByText('A los 7 días:')).toBeTruthy();
        expect(screen.getByRole('link', { name: 'privacy@dosfilos.app' }).getAttribute('href')).toBe('mailto:privacy@dosfilos.app');
        expect(document.body.textContent).not.toMatch(/<\/?(strong|mail|page|code)>/);
    });

    it('la política muestra sus 11 secciones con listas, párrafos y enlaces', () => {
        render(<MemoryRouter><PrivacyPolicyPage /></MemoryRouter>);
        const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
        expect(titles).toEqual(legalEs.privacy.sections.map((s) => s.title));
        const items = legalEs.privacy.sections.reduce((n, s) => n + ((s as { items?: string[] }).items?.length ?? 0), 0);
        expect(screen.getAllByRole('listitem')).toHaveLength(items);
        expect(screen.getByText(/^Cada proveedor tiene/)).toBeTruthy();
        expect(screen.getByRole('link', { name: 'esta página' }).getAttribute('href')).toBe('/delete-account');
        expect(screen.getByText('userId').tagName).toBe('CODE');
        expect(document.body.textContent).not.toMatch(/<\/?(strong|mail|page|code)>/);
    });
});
