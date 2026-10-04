import { describe, expect, it } from '@jest/globals';
import React from 'react';
import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { usePagination, type Pagination } from '../usePagination';

function Sonda({ onResult, header }: { onResult: (p: Pagination) => void; header?: React.ReactNode }) {
    const result = usePagination({
        blocks: [],
        availableHeight: 600,
        renderBlock: () => <Text>x</Text>,
        layoutKey: 'movimiento-vacio',
        header,
    });
    onResult(result);
    return <>{result.probe}</>;
}

describe('paginación del atril', () => {
    it('REGRESIÓN: un movimiento sin cuerpo no se queda «midiendo» (la página era invisible)', () => {
        let last: Pagination | undefined;
        act(() => {
            create(<Sonda onResult={(p) => (last = p)} />);
        });
        expect(last?.measuring).toBe(false);
        expect(last?.pages).toEqual([]);
    });
});
