# LogProcyon — Refatoração de UI para o design Lovable

**Data:** 2026-05-18
**Status:** Aprovado (aguardando revisão do spec)

## Objetivo

Refatorar toda a UI do frontend do LogProcyon (React 19 + Vite + Tailwind v4),
substituindo a estética dark/CRT-amber/monoespaçada atual pelo design system
Lovable (cream editorial), sem alterar comportamento, rotas ou dados.

## Decisões de design (fechadas com o usuário)

1. **Tipografia editorial.** Sans-serif em toda a interface, sem monoespaçada
   para dados. Camera Plain Variable não está instalada localmente → usar o
   fallback oficial do DESIGN.md: `ui-sans-serif, system-ui, sans-serif`.
   Apenas pesos 400 (corpo/UI) e 600 (títulos). Letter-spacing negativo
   escalando com o tamanho (-1.5px @60px, -1.2px @48px, -0.9px @36px,
   normal @16px). Alinhamento numérico via `font-variant-numeric: tabular-nums`,
   não via fonte mono.

2. **Cor funcional contida.** Paleta cream/charcoal derivada de `#1c1c1c` por
   opacidade. Cor saturada volta **somente onde carrega função**:
   - Backend status: `--ok #2f7d3a` / `--down #b23b3b`
   - Protocolo: `--tcp #1d6fb8`, `--udp #7a5bb5`, `--icmp #b06a1f`
     (cor no texto + borda translúcida; sem fundo saturado)
   - Badges de Tipo NAT (CGNAT / BPA / Estático): **neutros**,
     diferenciados por texto, não por cor.

3. **Densidade por contexto.** Linhas compactas (modificador `.compact`)
   somente nas telas de varredura: **Logs** e **Judicial**. Todas as demais
   telas seguem o ritmo confortável/editorial do DESIGN.md.

## Estratégia central

O frontend já consome design tokens via `var(--bg-0)`, `var(--ink-0)`,
`var(--signal)`, etc. Reescrever os tokens em `src/index.css` mantendo os
**aliases legados apontando para os novos valores cream** faz ~70% da mudança
cascatear automaticamente, sem reescrever as 9 páginas do zero. O restante é
limpeza dirigida componente a componente.

## Fonte de verdade do design

`DESIGN.md` (porte do `teste-lovable` + adendo LogProcyon) — veja seção
"Entregável: DESIGN.md" abaixo. As regras inegociáveis do DESIGN.md valem,
com **duas exceções documentadas** para esta aplicação operacional de NOC:
cores funcionais (decisão 2) e densidade compacta nas telas de log (decisão 3).

## Inventário do frontend

`src/` — `App.tsx` (250), `auth.tsx`, `main.tsx`, `api.ts`, `index.css` (328)
Componentes — `Charts.tsx`, `FilterBar.tsx`, `LogTable.tsx`, `SessionView.tsx`
Páginas — `Dashboard`, `LogSearch`, `JudicialSearch`, `Inputs`, `Users`,
`Settings`, `Storage`, `CgnatPools`, `Login`

## Plano por fases

### Fase 1 — Fundação (cascateia a maior parte)

- **`src/index.css`**: substituir o sistema de tokens dark pelo cream:
  - Surfaces: tudo cream `#f7f4ed` (sem branco puro).
  - Ink: escala derivada de `#1c1c1c` por opacidade (1.0 / .82 / muted
    `#5f5f5d` / .4).
  - Bordas: `#eceae4` (passiva), `rgba(28,28,28,.4)` (interativa).
    Bordas fazem a contenção — sem box-shadow em cards.
  - Status funcional: `--ok`, `--down`, `--tcp`, `--udp`, `--icmp`.
  - **Manter os aliases legados** (`--bg-0..3`, `--ink-0..4`, `--signal*`,
    `--accent-*`, `--border-*`) remapeados para os novos valores, para a
    cascata funcionar sem editar todo componente. `--signal` (antes amber)
    passa a ser charcoal `#1c1c1c`.
  - Reescrever utilitários: `.statusbar` → topbar cream limpa;
    `.title-row` → título editorial com tracking negativo;
    `.readout` → faixa de KPIs cream; `.badge` → pill neutro +
    variantes funcionais; `.topnav-link`; scrollbars; overrides do
    recharts; `input/select/textarea` focus (sombra suave, sem outline
    duro); botão dark com sombra inset assinatura como utilitário.
  - Radius: 6px botões/inputs, 12px cards, 16px containers,
    9999px só em pill de ação/ícone. Estados ativos `opacity: .8`.
- **`index.html`**: remover o `<link>` do Google Fonts (IBM Plex Mono /
  Inter); trocar o favicon dark por versão cream; fundo cream.
- **`src/App.tsx`**: statusbar estilo tmux → topbar cream editorial
  (marca, nav, usuário/perfil, status backend ok/down, sair);
  restilizar `NavDropdown` (menu cream, borda `#eceae4`, sem sombra
  pesada), spinner de loading e tela `RoleGate`.

### Fase 2 — Componentes compartilhados + fatia de prova

- `LogTable.tsx`: header/linhas no padrão; `tabular-nums` nas colunas
  numéricas; `ProtocolBadge` usa `--tcp/--udp/--icmp`; `NatBadge` neutro;
  suportar o modificador de densidade `.compact`; `Placeholder` cream.
- `FilterBar.tsx`, `Charts.tsx`, `SessionView.tsx`: convenções de
  input/botão/card; recharts no tema cream.
- Páginas **Dashboard** e **LogSearch**: validar o sistema ponta a ponta.
  LogSearch ativa densidade `.compact`.

### Fase 3 — Páginas restantes

`Login`, `Inputs`, `JudicialSearch` (compact), `Users`, `Settings`,
`Storage`, `CgnatPools` — aplicando as convenções já definidas. Sem
mudança de lógica/estado/rotas.

### Fase 4 — Acabamento

Confirmar tema recharts no cream; densidade compacta em Logs/Judicial;
varredura de contraste/acessibilidade (texto sobre cream, foco por
sombra suave); passada de polish (espaçamento, hierarquia, hover).

## Convenções de componente

- **Botões**: dark inset (CTA primária, `#1c1c1c`/`#fcfbf8`, sombra inset
  assinatura), ghost outline (`1px solid rgba(28,28,28,.4)`), cream surface
  (terciário), pill-ícone (`9999px`). `opacity: .8` no estado ativo.
- **Cards/containers**: fundo cream, borda `#eceae4`, radius 12px, sem
  box-shadow.
- **Inputs/forms**: fundo cream, borda `#eceae4`, radius 6px, foco com
  sombra suave (sem outline duro), placeholder `#5f5f5d`.
- **Badges**: pill neutro por padrão; variantes funcionais (protocolo,
  status) só com cor de texto + borda translúcida.
- **Tabela**: header discreto; linhas confortáveis por padrão; modificador
  `.compact` para telas de log; `tabular-nums` em colunas numéricas;
  hover com tint sutil.
- **Status dot**: cor funcional ok/down.

## Entregável: DESIGN.md no projeto

Criar `/CerebroNovo/log/DESIGN.md` = porte do DESIGN.md do `teste-lovable`
+ adendo "LogProcyon" documentando as duas exceções operacionais (cores
funcionais permitidas e suas hex; densidade compacta por contexto) e o
fallback de fonte adotado. Atualizar conforme o projeto evoluir.

## Fora de escopo

- Mudanças de lógica, estado, rotas, chamadas de API ou contrato de dados.
- Novas features ou telas.
- Refatoração estrutural não relacionada à UI.
- Instalar/empacotar a fonte Camera Plain Variable (usar fallback).

## Critérios de aceite

- Nenhum branco puro `#ffffff` nem fundo dark remanescente.
- Sem Google Fonts; tipografia via fallback system-ui; pesos só 400/600.
- Cinzas derivados de `#1c1c1c` por opacidade; sem hex de cinza arbitrário.
- Cor saturada só nos pontos funcionais listados.
- Logs e Judicial em densidade compacta; demais telas confortáveis.
- Comportamento, rotas e dados inalterados.
- `DESIGN.md` presente no projeto e coerente com o resultado.
