# LogProcyon — Refatoração de UI para o design Lovable — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a estética dark/CRT-amber/monoespaçada do frontend LogProcyon pelo design Lovable cream, sem alterar comportamento, rotas ou dados.

**Architecture:** O frontend já consome tokens via `var(--*)`. Reescrever os tokens em `src/index.css` mantendo os aliases legados remapeados para valores cream faz ~70% da mudança cascatear. Redefinir `--font-mono` para o stack sans elimina a monoespaçada em todo o app de uma vez. O resto é limpeza dirigida de valores hardcoded (enumerados aqui) + restilização dos utilitários CSS.

**Tech Stack:** React 19, Vite 6, Tailwind v4, react-router-dom 7, recharts 2, lucide-react. Sem suíte de testes — verificação por `npm run build` (tsc + vite) + checagem visual no dev server.

**Branch:** `feat/ui-lovable-redesign` (já criada).

---

## Transformation Ruleset (referência única — DRY)

Aplicar em todo arquivo `.tsx`/`.ts` tocado. Valores hardcoded → substituir por `var(--*)`:

| Hardcoded encontrado | Substituir por |
|---|---|
| `#3b82f6`, `#6366f1`, `#8b5cf6`, `#020617`, `#050505`, qualquer azul/roxo de acento | `var(--ink)` (ou `var(--accent-info)` se for ícone de categoria) |
| `#22c55e`, `rgba(16,185,129,*)` (sucesso/verde) | `var(--ok)` |
| `rgba(239,68,68,*)`, `rgba(217,59,59,*)` (erro/vermelho) | `var(--down)` |
| `rgba(245,158,11,*)`, `rgba(255,176,0,*)` (amber/aviso) | `var(--warn)` |
| `rgba(59,130,246,0.0x)` (fundo/realce azul) | `var(--tint)` fundo, `var(--line)` borda |
| `rgba(0,0,0,0.7)` + `backdropFilter blur` (overlay de modal) | `var(--overlay)` |
| `'0 8px 24px rgba(0,0,0,0.35)'`, `'0 8px 32px rgba(0,0,0,0.5)'` (boxShadow escura) | remover (borda contém) ou `var(--shadow-soft)` |
| `"'JetBrains Mono', monospace"`, qualquer `monospace`/`fontFamily` mono | remover a prop (herda o sans global) |
| `#0f172a`, `#0e0e0e` (fundo escuro) | `var(--cream)` |
| `#e2e8f0`, `#64748b` (texto sobre escuro) | `var(--ink)` / `var(--ink-muted)` |

Qualquer `var(--bg-*)`, `var(--ink-*)`, `var(--rule-*)`, `var(--signal*)`, `var(--accent-*)`, `var(--text-*)`, `var(--border-*)`, `var(--font-*)` **não precisa mudar** — cascateia pelos aliases redefinidos no Task 1.

Verificação padrão de cada task (não há testes unitários):
- Run: `cd frontend && npm run build` → Espera: build sem erros de tipo.
- Visual: `npm run dev`, abrir a tela tocada, confirmar fundo cream, sem dark remanescente, fontes sans, sem monoespaçada.

---

## Task 1: Reescrever o sistema de tokens (`src/index.css`)

**Files:**
- Modify (substituir conteúdo inteiro): `frontend/src/index.css`

- [ ] **Step 1: Substituir todo o conteúdo de `frontend/src/index.css` por:**

```css
@import "tailwindcss";

:root {
  /* ── Lovable cream foundation ─────────────────────────────── */
  --cream:        #f7f4ed;
  --off-white:    #fcfbf8;
  --ink:          #1c1c1c;
  --ink-strong:   rgba(28, 28, 28, 0.82);
  --ink-muted:    #5f5f5d;
  --ink-40:       rgba(28, 28, 28, 0.4);
  --line:         #eceae4;
  --line-strong:  rgba(28, 28, 28, 0.4);
  --tint:         rgba(28, 28, 28, 0.03);
  --tint-2:       rgba(28, 28, 28, 0.05);
  --overlay:      rgba(28, 28, 28, 0.32);
  --shadow-soft:  rgba(0, 0, 0, 0.1) 0px 4px 12px;
  --inset:
    rgba(255,255,255,0.2) 0px 0.5px 0px 0px inset,
    rgba(0,0,0,0.2) 0px 0px 0px 0.5px inset,
    rgba(0,0,0,0.05) 0px 1px 2px 0px;

  /* ── Functional color (only where it carries meaning) ─────── */
  --ok:           #2f7d3a;
  --down:         #b23b3b;
  --warn:         #b06a1f;
  --tcp:          #1d6fb8;
  --udp:          #7a5bb5;
  --icmp:         #b06a1f;
  --accent-info:  #5f5f5d;   /* ícones de categoria neutros */

  /* ── Legacy aliases remapped → cascade does the heavy lift ── */
  --bg-0: var(--cream);  --bg-1: var(--cream);  --bg-2: var(--cream);  --bg-3: var(--cream);
  --bg-primary: var(--cream); --bg-secondary: var(--cream);
  --bg-tertiary: var(--cream); --bg-elevated: var(--cream); --bg-card: var(--cream);

  --rule-1: var(--line); --rule-2: var(--line); --rule-3: var(--line-strong);
  --border-subtle: var(--line); --border-medium: var(--line); --border-strong: var(--line-strong);

  --ink-0: var(--ink); --ink-1: var(--ink-strong); --ink-2: var(--ink-muted);
  --ink-3: var(--ink-muted); --ink-4: var(--ink-40);
  --text-primary: var(--ink); --text-secondary: var(--ink-strong);
  --text-muted: var(--ink-muted); --text-dim: var(--ink-40);

  --signal: var(--ink); --signal-hi: var(--ink); --signal-lo: var(--ink-strong);
  --signal-bg: var(--tint); --signal-line: var(--line-strong);
  --accent-cyan: var(--ink); --accent-cyan-glow: var(--tint);
  --accent-blue: var(--ink); --accent-purple: var(--ink);
  --accent-green: var(--ok); --accent-amber: var(--warn); --accent-red: var(--down);

  /* ── Typography (Camera Plain não instalada → fallback) ───── */
  --font-text:    'Camera Plain Variable', ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-text);
  --font-mono:    var(--font-text);   /* mata a monoespaçada em todo o app */

  --shadow-card:  none;

  --topbar-h: 48px;
  --nav-h:    54px;
}

/* ── Reset / base ───────────────────────────────────────────── */
* { scrollbar-width: thin; scrollbar-color: var(--line-strong) transparent; }
*::-webkit-scrollbar       { width: 8px; height: 8px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb { background: rgba(28,28,28,0.18); border-radius: 9999px; }
*::-webkit-scrollbar-thumb:hover { background: var(--line-strong); }

body {
  margin: 0;
  background: var(--cream);
  color: var(--ink);
  font-family: var(--font-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ── Top nav links (cream, editorial) ───────────────────────── */
.topnav-link {
  padding: 7px 12px;
  font-size: 14px;
  font-weight: 400;
  letter-spacing: normal;
  text-transform: none;
  color: var(--ink-muted);
  text-decoration: none;
  border-radius: 6px;
  border: 1px solid transparent;
  transition: color 0.12s, background 0.12s;
}
.topnav-link:hover { color: var(--ink); background: var(--tint); }
.topnav-link.active { color: var(--ink); background: var(--tint-2); }

/* ── Animations (mantidas) ──────────────────────────────────── */
@keyframes fade-up { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
@keyframes glow-pulse { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
@keyframes spin-slow { from { transform:rotate(0); } to { transform:rotate(360deg); } }
.animate-card { animation: fade-up 0.24s ease-out both; }
.animate-card:nth-child(1){animation-delay:.01s}.animate-card:nth-child(2){animation-delay:.03s}
.animate-card:nth-child(3){animation-delay:.05s}.animate-card:nth-child(4){animation-delay:.07s}
.animate-card:nth-child(5){animation-delay:.09s}.animate-card:nth-child(6){animation-delay:.11s}
.live-dot { animation: glow-pulse 1.6s ease-in-out infinite; }

/* ── Log table row ──────────────────────────────────────────── */
.log-row { transition: background 0.1s; }
.log-row:hover { background: var(--tint) !important; }

/* ── Density modifier (telas de varredura: Logs/Judicial) ───── */
.dense table td { padding: 6px 14px !important; font-size: 13px !important; }
.dense table th { padding: 8px 14px !important; font-size: 12px !important; }

/* ── Recharts (tema cream) ──────────────────────────────────── */
.recharts-default-tooltip {
  background: var(--cream) !important;
  border: 1px solid var(--line) !important;
  border-radius: 8px !important;
  box-shadow: var(--shadow-soft) !important;
  padding: 8px 12px !important;
}
.recharts-tooltip-label { color: var(--ink) !important; font-family: var(--font-text) !important; font-size: 12px !important; margin-bottom: 2px !important; }
.recharts-tooltip-item  { color: var(--ink-strong) !important; font-family: var(--font-text) !important; font-size: 13px !important; }
.recharts-cartesian-grid-horizontal line,
.recharts-cartesian-grid-vertical line { stroke: var(--line) !important; }
.recharts-text { fill: var(--ink-muted) !important; font-family: var(--font-text) !important; font-size: 12px !important; }

/* ── Form inputs ────────────────────────────────────────────── */
input, select, textarea { font-family: var(--font-text); }
input::placeholder, textarea::placeholder { color: var(--ink-muted); }
input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--line-strong) !important;
  box-shadow: var(--shadow-soft);
}

/* ── Badges (pill neutro + variantes funcionais) ────────────── */
.badge {
  display: inline-flex; align-items: center;
  padding: 2px 9px; border-radius: 9999px;
  font-size: 12px; font-weight: 400; letter-spacing: normal;
  text-transform: none; font-family: var(--font-text);
  color: var(--ink-strong); border: 1px solid var(--line-strong);
}
.badge-tcp  { color: var(--tcp);  border-color: rgba(29,111,184,0.35); }
.badge-udp  { color: var(--udp);  border-color: rgba(122,91,181,0.35); }
.badge-icmp { color: var(--icmp); border-color: rgba(176,106,31,0.35); }
.badge-ok   { color: var(--ok);   border-color: rgba(47,125,58,0.35); }
.badge-down { color: var(--down); border-color: rgba(178,59,59,0.35); }

/* ── Button utilities (assinatura inset) ────────────────────── */
.btn-dark {
  background: var(--ink); color: var(--off-white);
  padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer;
  font-family: var(--font-text); font-size: 14px; font-weight: 400;
  box-shadow: var(--inset); transition: opacity 0.12s;
}
.btn-dark:hover, .btn-dark:active { opacity: 0.8; }
.btn-dark:focus-visible { box-shadow: var(--shadow-soft); outline: none; }
.btn-ghost {
  background: transparent; color: var(--ink);
  padding: 8px 16px; border-radius: 6px; cursor: pointer;
  border: 1px solid var(--line-strong);
  font-family: var(--font-text); font-size: 14px; transition: opacity 0.12s;
}
.btn-ghost:hover { opacity: 0.8; }
.btn-cream {
  background: var(--cream); color: var(--ink);
  padding: 8px 16px; border-radius: 6px; border: 1px solid var(--line); cursor: pointer;
  font-family: var(--font-text); font-size: 14px; transition: opacity 0.12s;
}
.btn-cream:hover { opacity: 0.8; }
.btn-pill {
  background: var(--cream); color: var(--ink);
  border-radius: 9999px; border: none; cursor: pointer;
  box-shadow: var(--inset); opacity: 0.6; transition: opacity 0.12s;
}
.btn-pill:hover { opacity: 0.85; }

/* ── Card helper ────────────────────────────────────────────── */
.lv-card { background: var(--cream); border: 1px solid var(--line); border-radius: 12px; }

/* ── NOC utility classes (re-tematizadas) ───────────────────── */
.hairline   { border: 1px solid var(--line); }
.hairline-b { border-bottom: 1px solid var(--line); }
.dashed-r   { border-right: 1px solid var(--line); }
.tabular    { font-variant-numeric: tabular-nums; }

/* ── Topbar (era statusbar tmux) ────────────────────────────── */
.statusbar {
  background: var(--cream);
  border-bottom: 1px solid var(--line);
  padding: 0 20px;
  font-size: 13px;
  color: var(--ink-muted);
  display: flex; align-items: center; gap: 18px;
  height: var(--topbar-h);
}
.statusbar > span + span,
.statusbar .right > span + span,
.statusbar .right > button { border-left: none; padding-left: 0; }
.statusbar .pill {
  background: var(--ink); color: var(--off-white);
  padding: 4px 12px; border-radius: 9999px;
  font-weight: 600; letter-spacing: -0.01em; text-transform: none; font-size: 12px;
}
.statusbar .k { color: var(--ink-muted); margin-right: 6px; text-transform: none; letter-spacing: normal; font-size: 12px; font-weight: 400; }
.statusbar b  { color: var(--ink); font-weight: 600; font-variant-numeric: tabular-nums; }
.statusbar .right { margin-left: auto; display: flex; align-items: center; gap: 18px; color: var(--ink-muted); }
.statusbar .right b { color: var(--ink); }

/* ── Title row (editorial) ──────────────────────────────────── */
.title-row { padding: 28px 24px 12px; display: flex; align-items: baseline; gap: 18px; }
.title-row h2 {
  margin: 0; font-family: var(--font-text);
  font-size: 36px; font-weight: 600; letter-spacing: -0.9px; color: var(--ink);
}
.title-row h2 .accent { color: var(--ink); }
.title-row .meta { font-size: 13px; color: var(--ink-muted); letter-spacing: normal; text-transform: none; margin-left: auto; }
.title-row .right { display: flex; gap: 8px; }
.title-row .right:not(:first-of-type) { margin-left: 0; }
.title-row > .right { margin-left: 12px; }

/* ── Readout (faixa de KPIs) ────────────────────────────────── */
.readout { display: grid; padding: 0 24px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.readout .cell { padding: 16px 20px; border-right: 1px solid var(--line); text-align: left; }
.readout .cell:last-child { border-right: none; }
.readout .cell .k { font-size: 13px; letter-spacing: normal; text-transform: none; color: var(--ink-muted); font-weight: 400; }
.readout .cell .v { font-size: 28px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; letter-spacing: -0.5px; margin-top: 6px; line-height: 1; }
.readout .cell .v.signal { color: var(--ink); }
.readout .cell .d { font-size: 13px; color: var(--ink-muted); margin-top: 6px; letter-spacing: normal; }
.readout .cell .d.up { color: var(--ok); }

/* ── Section head ───────────────────────────────────────────── */
.section-head { display: flex; justify-content: space-between; padding: 16px 24px 8px; font-size: 13px; letter-spacing: normal; text-transform: none; color: var(--ink-muted); font-weight: 400; }
.section-head .right { color: var(--ink-muted); }
.section-head .right b { color: var(--ink); }
```

- [ ] **Step 2: Build**

Run: `cd frontend && npm run build`
Expected: build conclui sem erro de tipo.

- [ ] **Step 3: Commit**

```bash
cd /Users/gabrielmafra/Desktop/CerebroNovo/log
git add frontend/src/index.css
git commit -m "feat(ui): reescreve tokens para o design Lovable cream"
```

---

## Task 2: Limpar `index.html`

**Files:**
- Modify: `frontend/index.html`

- [ ] **Step 1: Remover os preconnects + link do Google Fonts e trocar o favicon.**

Remover estas três linhas do `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

Substituir o atributo `href` do favicon por (fundo cream, marca charcoal):

```html
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%23f7f4ed'/><text y='22' x='6' font-size='15' font-family='system-ui' font-weight='600' fill='%231c1c1c'>LP</text></svg>" />
```

- [ ] **Step 2: Build + commit**

```bash
cd frontend && npm run build && cd /Users/gabrielmafra/Desktop/CerebroNovo/log
git add frontend/index.html
git commit -m "feat(ui): remove Google Fonts, favicon cream"
```

---

## Task 3: App shell (`src/App.tsx`)

**Files:**
- Modify: `frontend/src/App.tsx` (linha 203, e revisão visual do shell)

Os `var(--*)` inline (`var(--bg-0)`, `var(--signal)`, etc.) já cascateiam pelo Task 1 — não tocar. Único valor hardcoded:

- [ ] **Step 1: Trocar o boxShadow escuro do dropdown.**

Em `frontend/src/App.tsx:203`, substituir:

```js
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
```

por:

```js
            boxShadow: 'var(--shadow-soft)',
```

- [ ] **Step 2: Build**

Run: `cd frontend && npm run build` → Espera: sem erro.

- [ ] **Step 3: Verificação visual**

`npm run dev` → topbar cream com pill charcoal, nav com hover tint, dropdown cream com borda `#eceae4`, spinner charcoal, RoleGate cream. Sem barra dark.

- [ ] **Step 4: Commit**

```bash
cd /Users/gabrielmafra/Desktop/CerebroNovo/log
git add frontend/src/App.tsx
git commit -m "feat(ui): shell no design cream"
```

---

## Task 4: `LogTable.tsx` — badges funcionais + densidade

**Files:**
- Modify: `frontend/src/components/LogTable.tsx`

- [ ] **Step 1: Reescrever `ProtocolBadge` (linhas 30-43) para cores funcionais via classe:**

```tsx
function ProtocolBadge({ proto }: { proto: string }) {
  const cls: Record<string, string> = {
    TCP: 'badge-tcp', UDP: 'badge-udp', ICMP: 'badge-icmp',
  };
  const c = cls[proto?.toUpperCase()] ?? '';
  return <span className={`badge ${c}`}>{proto}</span>;
}
```

- [ ] **Step 2: Reescrever `NatBadge` (linhas 45-60) para neutro (diferenciado por texto):**

```tsx
function NatBadge({ tipo }: { tipo: string }) {
  return <span className="badge">{tipo?.toUpperCase()}</span>;
}
```

- [ ] **Step 3: Coluna IP Público neutra.** Em `frontend/src/components/LogTable.tsx:110`, trocar `style={{ color: 'var(--accent-cyan)' }}` por `style={{ color: 'var(--ink)' }}` e adicionar `tabular-nums` à `className` das `<td>` de IPs/portas (linhas 107, 110, 113) se ainda não tiver.

- [ ] **Step 4: Build**

Run: `cd frontend && npm run build` → Espera: sem erro.

- [ ] **Step 5: Commit**

```bash
cd /Users/gabrielmafra/Desktop/CerebroNovo/log
git add frontend/src/components/LogTable.tsx
git commit -m "feat(ui): LogTable badges funcionais + tabular-nums"
```

---

## Task 5: `Charts.tsx` — tema cream do recharts

**Files:**
- Modify: `frontend/src/components/Charts.tsx`

- [ ] **Step 1: Substituir as constantes de cor/tooltip (linhas 11-24) por:**

```tsx
const PRIMARY      = 'var(--ink)';
const GRID_COLOR   = 'var(--line)';
const AXIS_COLOR   = 'var(--line)';
const LABEL_COLOR  = 'var(--ink-muted)';

const tooltipStyle = {
  background: 'var(--cream)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontFamily: 'var(--font-text)',
  color: 'var(--ink)',
  boxShadow: 'var(--shadow-soft)',
};
```

(Remover a constante `MONO` e qualquer uso dela.)

- [ ] **Step 2: Limpar usos de `MONO` e cores escuras.** Nas linhas 50 e 56 remover `fontFamily: MONO` dos `tick`. Na linha 61 trocar `cursor={{ stroke: 'rgba(59,130,246,0.15)', strokeWidth: 1 }}` por `cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}`. Na linha 69 trocar `stroke: '#0f172a'` por `stroke: 'var(--cream)'`.

- [ ] **Step 3: Build + verificação visual + commit**

```bash
cd frontend && npm run build && cd /Users/gabrielmafra/Desktop/CerebroNovo/log
git add frontend/src/components/Charts.tsx
git commit -m "feat(ui): recharts no tema cream"
```

Visual: Dashboard → gráfico com linha charcoal, grid `#eceae4`, tooltip cream.

---

## Task 6: `FilterBar.tsx` + `SessionView.tsx`

**Files:**
- Modify: `frontend/src/components/FilterBar.tsx`, `frontend/src/components/SessionView.tsx`

- [ ] **Step 1: `FilterBar.tsx:128`** — trocar `color: '#020617'` por `color: 'var(--off-white)'` (texto sobre botão escuro). Aplicar o Transformation Ruleset ao resto do arquivo (ler o arquivo, trocar hex hardcoded restantes conforme a tabela).

- [ ] **Step 2: `SessionView.tsx:42`** — trocar `style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}` por `style={{ background: 'var(--overlay)', backdropFilter: 'blur(4px)' }}`. Aplicar o ruleset ao resto.

- [ ] **Step 3: Build + commit**

```bash
cd frontend && npm run build && cd /Users/gabrielmafra/Desktop/CerebroNovo/log
git add frontend/src/components/FilterBar.tsx frontend/src/components/SessionView.tsx
git commit -m "feat(ui): FilterBar + SessionView no design cream"
```

---

## Task 7: Fatia de prova — `Dashboard.tsx` + `LogSearch.tsx`

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`, `frontend/src/pages/LogSearch.tsx`

- [ ] **Step 1: Dashboard** — ler `frontend/src/pages/Dashboard.tsx`, aplicar o Transformation Ruleset (não há hex hardcoded conhecido; é majoritariamente cascata — confirmar visualmente KPIs/`.readout`, título `.title-row`, cards).

- [ ] **Step 2: LogSearch** — ler `frontend/src/pages/LogSearch.tsx`. Em `LogSearch.tsx:90` trocar `style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}` por `style={{ background: 'var(--tint)', border: '1px solid var(--line)' }}`. Adicionar a classe `dense` ao container que envolve `<LogTable>` (densidade compacta de varredura).

- [ ] **Step 3: Build + verificação visual**

`npm run dev` → Dashboard e Logs 100% cream, fontes sans, KPIs editoriais, tabela de Logs em densidade compacta, badges de protocolo coloridos, NAT neutro.

- [ ] **Step 4: Commit**

```bash
cd /Users/gabrielmafra/Desktop/CerebroNovo/log
git add frontend/src/pages/Dashboard.tsx frontend/src/pages/LogSearch.tsx
git commit -m "feat(ui): Dashboard + LogSearch (fatia de prova) no design cream"
```

---

## Task 8: Páginas restantes — grupo A (`Login`, `JudicialSearch`, `Inputs`)

**Files:**
- Modify: `frontend/src/pages/Login.tsx`, `frontend/src/pages/JudicialSearch.tsx`, `frontend/src/pages/Inputs.tsx`

- [ ] **Step 1: `Login.tsx`** — ler o arquivo. Linhas 60 e 137: `color: '#050505'` → `var(--off-white)`. Linhas 96-97: `background: 'rgba(217, 59, 59, 0.07)'` → `var(--tint)`, `border: '1px solid rgba(217, 59, 59, 0.3)'` → `1px solid var(--down)` (mensagem de erro). Aplicar ruleset ao resto.

- [ ] **Step 2: `JudicialSearch.tsx`** — ler o arquivo. Linha 199: `color: '#050505'` → `var(--off-white)`. Linha 218: bloco vermelho → `background: 'var(--tint)', border: '1px solid var(--down)'`. Linha 232: `result.total > 0 ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)'` → `result.total > 0 ? 'var(--tint)' : 'var(--tint)'` e usar a cor da borda para o sinal: borda `var(--ok)` quando `total>0`, senão `var(--down)`. Linhas 256-257 e 320: realces azul/amber → `background: 'var(--tint)'`, `border: '1px solid var(--line)'`. Adicionar classe `dense` ao container da tabela de resultados (varredura judicial). Aplicar ruleset ao resto.

- [ ] **Step 3: `Inputs.tsx`** — ler o arquivo. Linha 17: o mapa de cores por fabricante (`nokia: '#3b82f6'`, etc.) → trocar todos por `var(--accent-info)` (ícones neutros; diferenciação por rótulo de texto). Linha 221: `background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)'` → `background: 'var(--tint)', border: '1px solid var(--line)'`. Aplicar ruleset ao resto.

- [ ] **Step 4: Build + verificação visual + commit**

```bash
cd frontend && npm run build && cd /Users/gabrielmafra/Desktop/CerebroNovo/log
git add frontend/src/pages/Login.tsx frontend/src/pages/JudicialSearch.tsx frontend/src/pages/Inputs.tsx
git commit -m "feat(ui): Login + Judicial + Inputs no design cream"
```

Visual: cada tela cream, erros em `--down`, sucesso judicial via borda `--ok`, ícones de fabricante neutros, tabela judicial compacta.

---

## Task 9: Páginas restantes — grupo B (`Users`, `Settings`, `Storage`, `CgnatPools`)

**Files:**
- Modify: `frontend/src/pages/Users.tsx`, `frontend/src/pages/Settings.tsx`, `frontend/src/pages/Storage.tsx`, `frontend/src/pages/CgnatPools.tsx`

- [ ] **Step 1: `Users.tsx`** — ler o arquivo. Linhas 143 e 209: `background: 'rgba(0,0,0,0.7)'` (overlay de modal) → `background: 'var(--overlay)'`. Aplicar ruleset ao resto.

- [ ] **Step 2: `Settings.tsx`** — ler o arquivo. Linha 181: `background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)'` (caixa de aviso) → `background: 'var(--tint)', border: '1px solid var(--warn)'`. Aplicar ruleset ao resto.

- [ ] **Step 3: `Storage.tsx`** — ler o arquivo. Linhas 79-82: `color="#3b82f6"`, `"#6366f1"`, `"#22c55e"`, `"#8b5cf6"` nos `StatCard` → trocar todos por `color="var(--accent-info)"` (ícones de categoria neutros). Aplicar ruleset ao resto.

- [ ] **Step 4: `CgnatPools.tsx`** — ler o arquivo. Sem hex hardcoded conhecido; aplicar o Transformation Ruleset (cascata + qualquer valor remanescente).

- [ ] **Step 5: Build + verificação visual + commit**

```bash
cd frontend && npm run build && cd /Users/gabrielmafra/Desktop/CerebroNovo/log
git add frontend/src/pages/Users.tsx frontend/src/pages/Settings.tsx frontend/src/pages/Storage.tsx frontend/src/pages/CgnatPools.tsx
git commit -m "feat(ui): Users + Settings + Storage + CgnatPools no design cream"
```

---

## Task 10: `DESIGN.md` no projeto

**Files:**
- Create: `DESIGN.md` (raiz de `CerebroNovo/log`)

- [ ] **Step 1: Copiar o DESIGN.md base + adendo.**

Run:
```bash
cp /Users/gabrielmafra/Downloads/teste-lovable/DESIGN.md /Users/gabrielmafra/Desktop/CerebroNovo/log/DESIGN.md
```

- [ ] **Step 2: Acrescentar ao fim de `/Users/gabrielmafra/Desktop/CerebroNovo/log/DESIGN.md`:**

```markdown

## 10. Adendo LogProcyon (exceções operacionais)

LogProcyon é uma ferramenta de NOC/retenção de logs. Duas exceções
documentadas às regras gerais:

1. **Cor funcional contida.** Cor saturada é permitida SOMENTE onde carrega
   função: backend `--ok #2f7d3a` / `--down #b23b3b`; protocolo
   `--tcp #1d6fb8` / `--udp #7a5bb5` / `--icmp #b06a1f` (cor no texto + borda
   translúcida, sem fundo saturado). Badges de Tipo NAT (CGNAT/BPA/Estático)
   permanecem neutros — diferenciados por texto.
2. **Densidade por contexto.** As telas de varredura (Logs, Judicial) usam o
   modificador `.dense` (linhas compactas). Todas as demais telas seguem o
   ritmo confortável/editorial padrão.
3. **Fonte.** Camera Plain Variable não está empacotada no projeto; usar o
   fallback oficial `ui-sans-serif, system-ui, sans-serif`. Alinhamento
   numérico via `font-variant-numeric: tabular-nums`, nunca fonte mono.

Tokens canônicos vivem em `frontend/src/index.css`.
```

- [ ] **Step 3: Commit**

```bash
cd /Users/gabrielmafra/Desktop/CerebroNovo/log
git add DESIGN.md
git commit -m "docs: DESIGN.md (Lovable + adendo LogProcyon)"
```

---

## Task 11: Varredura final + polish

**Files:**
- Modify: qualquer arquivo com pendência encontrada

- [ ] **Step 1: Caçar dark/branco/mono remanescente.**

Run:
```bash
cd /Users/gabrielmafra/Desktop/CerebroNovo/log/frontend/src
grep -rnE '#fff|#ffffff|#0e0e0e|#0f172a|monospace|JetBrains|IBM Plex|Inter' --include='*.tsx' --include='*.ts' --include='*.css' .
```
Expected: nenhuma saída. Corrigir o que aparecer aplicando o Transformation Ruleset.

- [ ] **Step 2: Build final**

Run: `cd frontend && npm run build` → Espera: sem erro.

- [ ] **Step 3: Passada visual completa**

`npm run dev`, percorrer as 9 telas (Login → Dashboard → Logs → Judicial → Inputs → CGNAT → Storage → Users → Settings). Checklist por tela: fundo cream (sem branco/dark), fonte sans (sem mono), cinzas por opacidade, cor só nos pontos funcionais, Logs/Judicial compactos, demais confortáveis, sem outline duro de foco, botões com sombra inset.

- [ ] **Step 4: Commit (se houve correção)**

```bash
cd /Users/gabrielmafra/Desktop/CerebroNovo/log
git add -A frontend/src
git commit -m "fix(ui): varredura final de resíduos dark/mono"
```

---

## Critérios de aceite (do spec)

- [ ] Sem `#ffffff`/dark remanescente; sem Google Fonts; pesos só 400/600.
- [ ] Cinzas derivados de `#1c1c1c` por opacidade; cor só nos pontos funcionais.
- [ ] Logs e Judicial compactos; demais telas confortáveis.
- [ ] Comportamento, rotas e dados inalterados (`npm run build` ok, navegação manual ok).
- [ ] `DESIGN.md` presente e coerente.
