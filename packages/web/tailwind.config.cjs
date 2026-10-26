/** @type {import('tailwindcss').Config} */
export default {
	darkMode: ['class'],
	content: [
		'./index.html',
		'./src/**/*.{js,ts,jsx,tsx}',
	],
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					// Botones llenos: AA con texto blanco en todos los temas (index.css).
					solid: 'hsl(var(--primary-solid))',
					'solid-hover': 'hsl(var(--primary-solid-hover))',
					// Texto e íconos en el color de la marca: AA sobre la tarjeta y
					// los fondos tintados en todos los temas (`text-primary-text`).
					text: 'hsl(var(--primary-text))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))',
					// Botón destructivo lleno: AA con texto blanco en claro y en
					// oscuro; el hover oscurece (index.css, `barraUnica.test.tsx`).
					solid: 'hsl(var(--destructive-solid))',
					'solid-hover': 'hsl(var(--destructive-solid-hover))'
				},
				// El anillo de foco (`ring-focus`): el tono del texto de la marca,
				// ≥ 3:1 sobre la tarjeta y el fondo en todos los temas.
				focus: 'hsl(var(--focus))',
				// ── Semantic status tokens ──────────────────────────────────────
				// Theme-agnostic colours for stateful UI (success/warning/info).
				// Each has a solid + subtle variant. Don't use raw colour literals
				// (text-amber-X, bg-emerald-X) — use these tokens instead.
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))',
					subtle: 'hsl(var(--success-subtle))',
					'subtle-foreground': 'hsl(var(--success-subtle-foreground))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))',
					subtle: 'hsl(var(--warning-subtle))',
					'subtle-foreground': 'hsl(var(--warning-subtle-foreground))'
				},
				info: {
					DEFAULT: 'hsl(var(--info))',
					foreground: 'hsl(var(--info-foreground))',
					subtle: 'hsl(var(--info-subtle))',
					'subtle-foreground': 'hsl(var(--info-subtle-foreground))'
				},
				// ── Sermon-workflow phase brand colours ─────────────────────────
				// Identity for the three workflow phases + a generic/fallback.
				// These are brand colours (not status). Use for icons, accents,
				// and chips that mark a phase or store.
				phase: {
					exegesis: 'hsl(var(--phase-exegesis))',
					homiletics: 'hsl(var(--phase-homiletics))',
					drafting: 'hsl(var(--phase-drafting))',
					generic: 'hsl(var(--phase-generic))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			fontFamily: {
				sans: [
					'Inter',
					'sans-serif'
				],
				// D8 — La voz de ENTREGA es la misma en las dos superficies.
				// El sermón que se predica desde la tablet y el que se predica
				// desde el navegador son el mismo sermón, la misma semana: no
				// pueden estar en dos tipografías. Se unifica por ARTEFACTO
				// (entrega vs estudio), no por plataforma — el estudio conserva
				// su serif, que es correcta para leer sentado y en silencio.
				delivery: [
					'Lexend',
					'Inter',
					'sans-serif'
				],
				serif: [
					'Merriweather',
					'serif'
				],
				bible: [
					'Crimson Pro',
					'serif'
				],
				// Dedicated family for Biblical Hebrew text — Ezra SIL has full
				// OpenType mark/mkmk tables for niqqud + cantillation + dagesh
				hebrew: [
					'Ezra SIL',
					'Ezra SIL SR',
					'SBL Hebrew',
					'Times New Roman',
					'serif'
				],
				// Dedicated family for Biblical/Koine Greek — polytonic accents + breathings
				greek: [
					'SBL Greek',
					'GFS Didot',
					'Gentium Plus',
					'Gentium',
					'Times New Roman',
					'serif'
				],
				// Reading-optimized serif for assistant message bodies (long-form theology)
				reading: [
					'Source Serif 4',
					'Source Serif Pro',
					'Charter',
					'Iowan Old Style',
					'Georgia',
					'serif'
				]
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
};
