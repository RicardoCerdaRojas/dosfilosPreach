import { describe, it, expect } from 'vitest';
import { TMS_COVER_STYLE, coverStyleOf } from '../coverSuggestion';
import { buildDefaultStyleManifest, validateStyleGuideManifest } from '../../entities/StyleGuideManifest';

const DEFAULT_STYLE_GUIDE_MANIFEST = buildDefaultStyleManifest();

describe('coverStyleOf', () => {
    it('sin guía o sin portada en ella, la de TMS', () => {
        expect(coverStyleOf(null)).toBe(TMS_COVER_STYLE);
        expect(coverStyleOf({})).toBe(TMS_COVER_STYLE);
    });
    it('la de la guía cuando la declara', () => {
        const propia = { ...TMS_COVER_STYLE, byLine: 'BY' };
        expect(coverStyleOf({ cover: propia })).toBe(propia);
    });
});

describe('validateStyleGuideManifest — portada', () => {
    it('renglones fuera de rango son un error', () => {
        const m = { ...DEFAULT_STYLE_GUIDE_MANIFEST, cover: { ...TMS_COVER_STYLE, layout: { ...TMS_COVER_STYLE.layout, afterTitle: -1 } } };
        expect(validateStyleGuideManifest(m)).toContainEqual(expect.objectContaining({ path: 'cover.layout.afterTitle', code: 'cover-blank-lines-out-of-range' }));
    });
    it('una portada válida no agrega problemas', () => {
        const base = validateStyleGuideManifest(DEFAULT_STYLE_GUIDE_MANIFEST).length;
        expect(validateStyleGuideManifest({ ...DEFAULT_STYLE_GUIDE_MANIFEST, cover: TMS_COVER_STYLE })).toHaveLength(base);
    });
});

describe('paperCoverStyle — la foto de la guía manda (revisión adversarial de C5)', () => {
    it('con foto, la de la foto aunque la guía viva haya cambiado', async () => {
        const { paperCoverStyle, TMS_COVER_STYLE } = await import('../coverSuggestion');
        const foto = { ...TMS_COVER_STYLE, byLine: 'PRESENTADO POR' };
        const viva = { ...TMS_COVER_STYLE, byLine: 'POR' };
        expect(paperCoverStyle({ styleGuideSnapshot: { manifest: { cover: foto } } }, { cover: viva }).byLine).toBe('PRESENTADO POR');
    });
    it('sin foto, la viva; sin ninguna, la de TMS', async () => {
        const { paperCoverStyle, TMS_COVER_STYLE } = await import('../coverSuggestion');
        const viva = { ...TMS_COVER_STYLE, uppercase: false };
        expect(paperCoverStyle({ styleGuideSnapshot: null }, { cover: viva }).uppercase).toBe(false);
        expect(paperCoverStyle({}, null)).toEqual(TMS_COVER_STYLE);
    });
});
