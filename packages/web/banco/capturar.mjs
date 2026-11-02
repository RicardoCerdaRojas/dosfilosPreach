#!/usr/bin/env node
/**
 * Capturas e informe del banco de tarjetas: `yarn banco` desde packages/web.
 *
 * Monta las tarjetas en Chrome, en los anchos reales, y falla si una acción repite
 * ícono, si algo desborda o si las acciones se parten donde deben caber en una
 * fila. Deja las imágenes en `banco/.capturas/` para mirarlas ANTES de entregar:
 * el informe no ve si algo se entiende.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(aqui, '..');
const capturas = path.join(aqui, '.capturas');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PUERTO = 5199;

// Una tarjeta en la página del trabajo mide 842 px con la barra lateral abierta.
// Hasta `ANCHO_DE_UNA_FILA`, las acciones deben caber en una fila.
const ANCHOS = [842, 754, 390];
const ANCHO_DE_UNA_FILA = 842;
const POR_CAPTURA = 6;

// Otra aplicación en este puerto también contesta 200 a cualquier ruta: se mira el título.
const contesta = async () => {
    try {
        return await (await fetch(`http://localhost:${PUERTO}/banco/index.html`)).text();
    } catch {
        return null;
    }
};
const esElBanco = html => !!html?.includes('Banco de tarjetas');
// Lo que ya esté ahí serviría otro código, o sería otra aplicación.
if ((await contesta()) !== null) {
    console.error(`El puerto ${PUERTO} ya está en uso. Ciérralo o cambia el puerto.`);
    process.exit(2);
}

rmSync(capturas, { recursive: true, force: true });
mkdirSync(capturas, { recursive: true });
const perfil = mkdtempSync(path.join(tmpdir(), 'banco-chrome-'));
const servidor = spawn('npx', ['vite', '--config', 'banco/vite.config.ts'], { cwd: web, stdio: 'ignore', detached: true });

const espera = ms => new Promise(r => setTimeout(r, ms));
async function hastaQueResponda() {
    for (let i = 0; i < 60; i++) {
        if (esElBanco(await contesta())) return;
        await espera(500);
    }
    throw new Error(`El banco no respondió en el puerto ${PUERTO}`);
}

const chrome = (url, ...extra) => spawnSync(CHROME, [
    '--headless=new', '--disable-gpu', `--user-data-dir=${perfil}`, '--virtual-time-budget=20000', ...extra, url,
], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

let fallas = 0;
const falla = texto => { fallas++; console.log(`  ✗ ${texto}`); };

try {
    await hastaQueResponda();
    for (const ancho of ANCHOS) {
        const url = `http://localhost:${PUERTO}/banco/index.html?ancho=${ancho}`;
        const dom = chrome(url, '--dump-dom').stdout;
        const hallado = dom.match(/<pre id="informe"[^>]*>(.*?)<\/pre>/s);
        if (!hallado) throw new Error(`Sin informe a ${ancho} px. ¿Chrome en ${CHROME}?`);
        const texto = hallado[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        const { conInter, tarjetas } = JSON.parse(texto);
        if (!conInter) throw new Error('No cargó Inter: los anchos no valen. ¿Hay red?');
        for (let parte = 0; parte < Math.ceil(tarjetas.length / POR_CAPTURA); parte++) {
            chrome(`${url}&parte=${parte}`, `--window-size=${ancho + 48},1900`, `--screenshot=${path.join(capturas, `tarjetas-${ancho}-${parte}.png`)}`);
        }

        console.log(`\n${ancho} px — ${tarjetas.length} estados`);
        for (const t of tarjetas) {
            console.log(`  ${t.filas} fila(s) · ${t.estado} · «${t.subtitulo}» · ${t.accionesEncabezado} arriba · ${t.acciones.join(' | ')}`);
            if (t.desborda) falla(`${t.estado}: desborda`);
            if (ancho >= ANCHO_DE_UNA_FILA && t.filas > 1) falla(`${t.estado}: ${t.filas} filas`);
            for (const r of [...t.iconosPie, ...t.iconosEncabezado]) falla(`${t.estado}: ícono repetido (${r})`);
        }
    }
    console.log(`\nCapturas en ${capturas}. Míralas antes de entregar.`);
} finally {
    try { process.kill(-servidor.pid); } catch { /* ya terminó */ }
    rmSync(perfil, { recursive: true, force: true });
}

console.log(fallas ? `\n${fallas} falla(s).` : '\nSin fallas.');
process.exit(fallas ? 1 : 0);
