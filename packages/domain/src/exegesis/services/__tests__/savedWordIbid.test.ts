import { describe, expect, it } from 'vitest';
import { reviewSavedWordIbid, shortFormForIbid } from '../savedWordIbid';

/** XML con la forma del que guarda Word: llamadas en el cuerpo, notas aparte, y las marcas de página. */
const llamada = (id: number) => `<w:r><w:footnoteReference w:id="${id}"/></w:r>`;
const SALTO = '<w:r><w:lastRenderedPageBreak/><w:t>sigue</w:t></w:r>';
const notas = (...textos: string[]) =>
    '<w:footnotes><w:footnote w:type="separator" w:id="-1"><w:p/></w:footnote><w:footnote w:type="continuationSeparator" w:id="0"><w:p/></w:footnote>'
    + textos.map((t, i) => `<w:footnote w:id="${i + 1}"><w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p></w:footnote>`).join('')
    + '</w:footnotes>';
const ROSS = 'Allen P. Ross, A Commentary on the Psalms, vol. 1 (Grand Rapids: Kregel, 2011), 565.';

describe('reviewSavedWordIbid — el «Ibid.» que abre página (guía, hoja 22)', () => {
    it('marca la nota con «Ibid.» que cae en una página distinta de la anterior', () => {
        const doc = `<w:body><w:p>${llamada(1)}</w:p><w:p>${SALTO}${llamada(2)}</w:p></w:body>`;
        const r = reviewSavedWordIbid(doc, notas(ROSS, 'Ibid., 566.'));
        expect(r).toMatchObject({ paginated: true, pages: 2, notes: 2 });
        expect(r.findings).toEqual([{ note: 2, page: 2, text: 'Ibid., 566.', previousNote: 1, workNote: ROSS }]);
    });

    it('«Ibid.» en la misma página no se marca (el TI #2: sus tres «Ibid.» caen con su nota anterior)', () => {
        const doc = `<w:body><w:p>${llamada(1)} ${llamada(2)}</w:p><w:p>${SALTO}${llamada(3)}</w:p></w:body>`;
        const r = reviewSavedWordIbid(doc, notas(ROSS, 'Ibid., 566.', 'Craigie, Psalms 1–50, 208.'));
        expect(r.findings).toEqual([]);
        expect(r.notes).toBe(3);
    });

    it('la obra es la de la última nota que la nombra, aunque haya un «Ibid.» en medio', () => {
        const doc = `<w:body><w:p>${llamada(1)}${llamada(2)}</w:p><w:p>${SALTO}${llamada(3)}</w:p></w:body>`;
        const [f] = reviewSavedWordIbid(doc, notas(ROSS, 'Ibid., 566.', 'Ibid.')).findings;
        expect(f).toMatchObject({ note: 3, previousNote: 2, workNote: ROSS });
    });

    it('un Word sin marcas de página (no lo guardó Word) no se da por bueno: lo dice', () => {
        const doc = `<w:body><w:p>${llamada(1)}</w:p><w:p>${llamada(2)}</w:p></w:body>`;
        const r = reviewSavedWordIbid(doc, notas(ROSS, 'Ibid., 566.'));
        expect(r.paginated).toBe(false);
        expect(r.findings).toEqual([]);
    });

    it('«Ibíd.» con tilde y entidades del XML se leen igual', () => {
        const doc = `<w:body><w:p>${llamada(1)}</w:p><w:p>${SALTO}${llamada(2)}</w:p></w:body>`;
        const r = reviewSavedWordIbid(doc, notas('Waltke y O&apos;Connor, Introduction, 436.', 'Ibíd., 438.'));
        expect(r.findings[0]).toMatchObject({ text: 'Ibíd., 438.', workNote: "Waltke y O'Connor, Introduction, 436." });
    });
});

describe('shortFormForIbid — la forma abreviada que va en lugar del «Ibid.»', () => {
    const FICHA_ROSS = { author: 'Allen P. Ross', authorSorted: 'Ross, Allen P.', title: 'A Commentary on the Psalms', shortTitle: 'Commentary on the Psalms' };

    it('con la página del «Ibid.»', () => {
        expect(shortFormForIbid({ text: 'Ibid., 566.', workNote: ROSS }, [FICHA_ROSS])).toBe('Ross, *Commentary on the Psalms*, 566.');
    });

    it('«Ibid.» solo repite la página de la nota de la obra', () => {
        expect(shortFormForIbid({ text: 'Ibid.', workNote: ROSS }, [FICHA_ROSS])).toBe('Ross, *Commentary on the Psalms*, 565.');
    });

    it('si la obra no está en las fichas, no inventa', () => {
        expect(shortFormForIbid({ text: 'Ibid., 3.', workNote: 'Otro autor, Otro libro, 2.' }, [FICHA_ROSS])).toBeNull();
    });
});
