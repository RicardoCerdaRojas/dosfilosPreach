import { createContext, useContext } from 'react';

/**
 * El espacio de la barra de la app donde cada página pone su título, sus
 * pestañas y sus botones (fase «barra única», 2026-10-17). Lo ofrece
 * `DashboardLayout`; una página lo ocupa con `<BarraDePagina>`. Una página
 * que no lo usa deja la barra como estaba.
 */
export const BarraDePaginaContexto = createContext<HTMLElement | null>(null);

export const useEspacioDeLaBarra = () => useContext(BarraDePaginaContexto);
