# Design System Tooling Research — Deferred

Research notes from two focused subagent runs during the UXUI refactor (April 2026). Captures the design-system tooling ecosystem we evaluated, the four baseline finalists we considered, and the strategic decision to NOT adopt any of them — with conditions for revisiting.

**Why this file exists.** During the refactor we explored whether to add baseline design-system presets to the `/design-system` skill (when it still existed). Two research subagents produced detailed analyses of the shadcn ecosystem, DTCG, design-token tooling, and the CLI-vs-MCP split. That research was intentionally NOT acted on — we dropped `/design-system` entirely instead. But the findings have value if cowmoo's direction changes, so this file preserves them.

**Current direction (for context).** UXUI no longer picks design tokens. Concrete visual values now live in:
- Approved Claude Design bundles (Phase B handoff) — visual source of truth when a designer has produced one
- `src/` (after builder implements) — code source of truth
- `cowmoo/agent-files/builder/BUILD-NOTES.md` — builder's accumulated token rules from iteration
- Framework defaults — floor when nothing else applies

The decision was: LLMs are weak at speculative aesthetic decisions without rendered UI to react to. UXUI captures vocabulary (role names) and design intent (prose), not values. See `ideas/uxui/design-system-deferred.md` for the dropped skill itself.

---

## The shadcn ecosystem (the headline finding)

**shadcn CLI v4** (released March 2026) ships exactly the preset model we'd want if we were inventing one. A "preset" is a single short alphanumeric code (e.g. `a1Dg5eFl`) that packs colors, theme, icon library, fonts, and radius. Referenced via `npx shadcn@latest init --preset <CODE>`.

**shadcn/skills** bundle was released alongside CLI v4 specifically for coding agents. The bundle's `shadcn/ui skill` detects `components.json`, runs `shadcn info --json`, and generates matching component code. It's explicitly a **builder-side** skill — designed for coding agents writing TSX. Provides no token-picking value to a markdown-only agent.

**shadcn MCP server** (`ui.shadcn.com/docs/mcp`) exposes browse/search/view registry tools plus natural-language install. The browse/search/view half is **read-only** and would be UXUI-suitable for "show me what's in the Nova preset" style queries. The install half is builder-only.

**tweakcn** (`jnsahaj/tweakcn` on GitHub) is the de-facto community theme generator. **Web-only** — no CLI, no API, no MCP. User edits visually, exports a shadcn-compatible preset code or `registry-item.json`, pastes it back. The only integration pattern for UXUI would be: generate a `tweakcn.com` URL pre-seeded with direction → user tweaks visually → pastes preset code back.

**shadcn/create** (`ui.shadcn.com/create`) — also web-only. Visual preview of colors/fonts/radius on real components, hands back a code.

**Critical gap:** preset codes are **opaque**. There is no documented `shadcn preset describe <code>` subcommand. To inspect a preset without touching code, UXUI would have to go through shadcn/create or tweakcn (web-only flows). No CLI or MCP unpacks a preset code offline.

### Shadcn CLI subcommands — which agent owns which

| Subcommand | Action | Requires code execution? | UXUI? | Builder? |
|---|---|---|---|---|
| `shadcn init --preset <code>` | Scaffolds project, writes CSS vars, installs deps | **Y** — writes disk, runs installs | N | Y |
| `shadcn add <comp>` | Installs a component to `src/` | **Y** | N | Y |
| `shadcn apply --preset` | Switches preset on existing project (writes CSS) | **Y** | N | Y |
| `shadcn view <comp>` | Prints registry item to stdout | **N** — read-only | Y | Y |
| `shadcn search` / `list` | Queries registries | **N** | Y | Y |
| `shadcn docs [--json]` | Fetches component docs | **N** | Y | Y |
| `shadcn info --json` | Describes current project config | partial — reads `components.json` | N (no project) | Y |
| `shadcn diff` / `add --dry-run` | Shows what would change | **N** (dry-run) | Y | Y |
| `shadcn migrate` / `build` | Rewrites files / builds registry | **Y** | N | Y |

**CLI vs MCP redundancy check:** they are NOT redundant. CLI mutates a project (write-path, builder-only); MCP browses registries without touching disk (read-path, UXUI-suitable for read tools only). Keep both available to different agents if either is ever wired.

---

## The four baseline finalists (the menu we considered offering)

If `/design-system` were ever restored as a "pick a baseline" skill, these are the four directions worth offering. The first research subagent ranked them by AI-agent friendliness and ecosystem maturity.

### 1. shadcn preset (CLI v4) — **default choice if restored**

- **Token shape:** CSS variables in `:root`/`.dark`, OKLCH color values, semantic role names (`--primary`, `--background`, `--foreground`, `--muted`, `--accent`, `--destructive`, `--border`, `--ring`, plus `--radius`, `--font-sans`). Distributed as `registry-item.json` with `cssVars: { theme, light, dark }`.
- **AI-friendliness:** Excellent. Role-named, no ambiguity, Tailwind v4 native, MCP server already exists for both Claude Code and Cursor. v4 CLI was explicitly redesigned for agents.
- **Preset model:** First-class. tweakcn is the de-facto community theme generator (exports JSON preset + CSS vars, has shareable URLs, integrates with the registry schema). Repo: `jnsahaj/tweakcn`.
- **Mapping:** `color-primary → --primary` is one-to-one. Trivial for an agent to consume.
- **Affinity:** Most natural with React/Next + Tailwind. Other stacks can consume the CSS variables, less natural fit.

### 2. Radix UI Colors (`@radix-ui/colors` v3)

- **Token shape:** 30 scales (gray, mauve, slate, sage, olive, sand + accents), each with 12 numbered steps designed for specific use cases (1–2 backgrounds, 3–5 component backgrounds, 6–8 borders, 9–10 solid, 11–12 text). Auto dark mode, APCA-validated contrast.
- **AI-friendliness:** Very high if the agent uses the *aliasing* pattern (`--accent: blue9`, `--danger: red9`). The 12-step semantic ladder is the cleanest "this number means this thing" system in the industry.
- **Preset model:** Single canonical scale set; pick base/accent/gray and alias.
- **Mapping:** Excellent — Radix explicitly documents the alias pattern.
- **Affinity:** Framework-agnostic — pure CSS scales. Often paired with shadcn (which itself uses Radix Colors under the hood), but works standalone.

### 3. Tailwind v4 defaults

- **Token shape:** `@theme` block, OKLCH palette (50–950 per hue), 0.25rem spacing base (dynamic), built-in duration/easing scales, all exposed as CSS vars automatically.
- **AI-friendliness:** High but raw — colors are by hue (`blue-500`), not role. Needs a semantic layer on top, which is exactly what shadcn provides.
- **Preset model:** One canonical default; extension via `@theme`.
- **Affinity:** Tailwind users. Floor option when the user wants nothing exotic.

### 4. Open Props (`argyleink/open-props`, v1.7 stable, v2 beta)

- **Token shape:** CSS custom properties shipped as CSS / PostCSS / JSON / JS. Covers colors, type, spacing, shadows, radii, borders, aspect-ratios, animations, gradients. Numeric scales (`--size-3`, `--font-size-2`, `--radius-3`).
- **AI-friendliness:** Good. Numeric, predictable, framework-agnostic. Less role-semantic than shadcn/Radix — closer to "scale primitives."
- **Preset model:** Single canonical pack; no preset variants.
- **Affinity:** Framework-agnostic. Best for non-Tailwind / non-React projects, or projects that want primitives without an opinionated component library.

### Dropped from consideration

- **Material Design 3** — verbose three-tier indirection (`md.sys.color.primary`), geared toward Android/Compose/Web Components, overkill unless target stack is Material
- **Geist (Vercel)** — documented at `vercel.com/geist` but not published as a standalone consumable token package
- **Carbon (IBM), Polaris (Shopify), Primer (GitHub)** — open and themed but enterprise-flavored, none designed for "swap as a baseline" the way shadcn presets are

---

## Design-token tooling beyond shadcn

The second subagent surveyed broader token tooling that an LLM could consume.

### DTCG (Design Tokens Format Module 2025.10 — first stable)

- **W3C standard.** Pure JSON with `$value` and `$type` fields. Canonical format for design tokens.
- **AI-friendly:** yes — pure JSON, no code execution required to read.
- **Status:** First stable spec released October 2025. Style Dictionary v4 supports it natively.
- **Use case:** if cowmoo ever wants to write a machine-readable token contract, DTCG is the format. Would sit alongside `cowmoo/design/design-system.md` as `cowmoo/design/design-system.tokens.json`.

### Style Dictionary v4 (Amazon)

- **Build tool.** Reads DTCG JSON, transforms to platform-specific outputs (CSS variables, iOS, Android, etc.).
- **AI-friendly:** Partial — it's a build tool, not a runtime consumer. Reads DTCG, writes platform outputs.
- **Use case:** Builder-side. UXUI captures DTCG, builder runs Style Dictionary to generate platform tokens.

### Token Studio (Figma plugin)

- **Figma plugin.** Exports tokens to JSON/Git in DTCG-compatible format.
- **AI-friendly:** Yes if the project already uses Token Studio (the JSON is consumable). Not useful if the team doesn't use it in Figma.

### Other notes

- **Figma Dev Mode MCP** — Figma's official MCP exposes `get_variable_defs` for token extraction, distinct from the Framelink server. (Note: cowmoo's Figma integration was removed in the 2026-04 archive — see `ideas/archive.md`. This is research from when Figma was the design substrate; mentioned here for completeness if a future Figma reintegration happens.)
- **Design-system-specific MCPs** — community servers exist for "extract tokens from URL" but none are standardized.
- **Claude Code skills for design tokens** — none found in community registries beyond `shadcn/skills`.

---

## The CLI-vs-MCP split — who should use what

This is the most actionable finding. If cowmoo ever wires shadcn for any agent:

**UXUI should use, IF restored:**
- **Shadcn MCP** (`ui.shadcn.com/docs/mcp`) — browse/search/view tools only. Read-only, no project mutation. Suitable for UXUI's markdown-only scope.
- **Open Props JSON feed** (via WebFetch of `open-props.tokens.json`) — read-only, structured, no install, gives a complete baseline token vocabulary.
- **Radix Colors scales** (WebFetch the npm package's JSON or docs) — read-only source for 12-step color semantics that map cleanly onto role tokens.
- **shadcn/create + tweakcn URLs** surfaced to the user as "open this link, tweak visually, paste the preset code back" — UXUI records the code as metadata but does **not** run `shadcn apply`.

**Builder should use, IF wired:**
- All `shadcn` CLI write subcommands (`init`, `add`, `apply`, `migrate`, `build`)
- The `shadcn/skills` bundle (it's a builder-side skill assuming `components.json` + `src/`)
- Style Dictionary transforms
- Any MCP tool that installs

**The clean handoff contract:**

```
UXUI captures:
  - Preset code (opaque, e.g. `a1Dg5eFl`) as metadata
  - DTCG-shaped role tokens (machine-readable for builder)
  - Rationale + source link (human-readable)

Builder reads that metadata and runs:
  shadcn init --preset <code>
  
Then verifies the resolved values match the DTCG tokens UXUI wrote.
```

This was the proposed path before we dropped the whole concept. The preset code is the clean contract between the two agents — UXUI's job ends at "write the code into design-system.md", builder's job starts at "read that code and run shadcn init".

---

## Why we ultimately dropped all of this

After the CLI/MCP research, the user pushed back on the entire premise:

> "But the real question is, does it really help in us somehow in a way all those designs system things that we've created here with those four different approaches as SHATCM and the React approach and everything else. What is the real benefit and how it's going to help us?"

The honest answer was no. Reasons:

1. **LLMs are weak at speculative aesthetic decisions** — picking hex values, radius, spacing scales without rendered UI to react to produces noise (the "generic AI aesthetic" problem)
2. **Concrete values should emerge from real builds, not speculation** — Figma when designer present, builder iteration when not
3. **Role vocabulary is enough at the UXUI level** — `primary-action`, `destructive`, `muted-text` is what UXUI needs to describe screens; values resolve downstream
4. **DTCG, JSON tokens, and structured metadata don't help Claude Code** — Claude reads markdown narrative better than JSON, and already knows what shadcn/Radix/Tailwind/Open Props look like from training data
5. **WebFetch of token JSON adds latency with zero new information** — Claude already has this knowledge; fetching is wasteful
6. **Preset-picking is a moment of low information** — if it runs at project start with no rendered UI, the LLM has no grounding; if it runs after the first build, the values are already chosen by builder iteration

We replaced the whole thing with: UXUI captures **design intent prose** (`cowmoo/design/OVERVIEW.md` Design Intent section) and **role vocabulary** (`cowmoo/design/roles.md`). That's it. No tokens, no values, no presets.

---

## When to revisit

This research is worth restoring if:

- **A team has explicit brand requirements from day one** — they need `color-primary = #[brand color]` locked in before any screen is defined. In that case, restore `/design-system` with brand override capability and use one of the 4 baselines as the floor.
- **Cross-builder token consistency becomes a problem** — if multiple builders working on the same project produce drifting token implementations and `BUILD-NOTES.md` discipline isn't enough, a shared baseline preset would force convergence.
- **Component-registry adoption** reaches the point where token alignment matters more than role vocabulary. (A component-registry idea was archived alongside the Figma integration — see `ideas/archive.md`.)
- **A specific preset becomes the de-facto cowmoo default** — if every cowmoo project ends up using shadcn anyway, formalize it: `moo init` could ask "shadcn? y/n" and pre-wire the choice.

If any of these triggers, restore `/design-system` from `ideas/uxui/design-system-deferred.md` AND pull from this file for the baseline-picking logic.

---

## Restore checklist (if reviving)

If a future curator wants to wire the shadcn ecosystem into UXUI:

1. **Decide which of the 4 baselines to offer** (default: shadcn + Radix + Tailwind + Open Props as in the research)
2. **Decide whether to add the shadcn MCP to UXUI's `settings.json`** — `mcp__shadcn__*` for browse/search/view (read-only)
3. **Decide whether to use DTCG format for `cowmoo/design/design-system.tokens.json`** — separate machine-readable file alongside the human-readable `cowmoo/design/design-system.md`
4. **Restore `/design-system` skill** from `ideas/uxui/design-system-deferred.md`, but rewrite it to:
   - NOT auto-prompt at project start (mid-flow only, after product understanding is formed)
   - Use research-informed preset recommendation (call `@research` for product category UX conventions)
   - Use shadcn MCP for browsing, tweakcn URLs for visual editing, WebFetch for Open Props/Radix JSON
   - Write both a human-readable narrative AND a DTCG-shaped token file
5. **Update planner's task PRD template** to reference the design-system file
6. **Update builder's `/build` and `@check-design`** to read the design-system file and run `shadcn init --preset <code>` if the project uses shadcn
7. **Document the trade-off** — explain why the team chose to add this back, what triggered it (real brand requirement? real consistency drift?), and what it replaces (the role-vocabulary-only model)

---

## Sources

From the two research subagent runs (April 2026):

- [shadcn CLI v4 changelog](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4)
- [shadcn/ui Theming docs](https://ui.shadcn.com/docs/theming)
- [shadcn MCP Server docs](https://ui.shadcn.com/docs/mcp)
- [shadcn registry-item.json schema](https://ui.shadcn.com/docs/registry/registry-item-json)
- [shadcn April 2026 changelog (shadcn apply)](https://ui.shadcn.com/docs/changelog/2026-04-shadcn-apply)
- [shadcn CLI docs](https://ui.shadcn.com/docs/cli)
- [shadcn Skills docs](https://ui.shadcn.com/docs/skills)
- [shadcn/create](https://ui.shadcn.com/create)
- [tweakcn Theme Editor](https://tweakcn.com/)
- [tweakcn GitHub (jnsahaj/tweakcn)](https://github.com/jnsahaj/tweakcn)
- [Radix Colors](https://www.radix-ui.com/colors)
- [Radix Colors Aliasing](https://www.radix-ui.com/colors/docs/overview/aliasing)
- [Radix Colors Scales](https://www.radix-ui.com/colors/docs/palette-composition/scales)
- [Radix Colors Install](https://www.radix-ui.com/colors/docs/overview/installation)
- [@radix-ui/colors on npm](https://www.npmjs.com/package/@radix-ui/colors/v/0.1.7)
- [Tailwind CSS v4 release post](https://tailwindcss.com/blog/tailwindcss-v4)
- [Tailwind theme variables](https://tailwindcss.com/docs/theme)
- [Open Props](https://open-props.style/)
- [Open Props GitHub (argyleink/open-props)](https://github.com/argyleink/open-props)
- [open-props on npm](https://www.npmjs.com/package/open-props)
- [Design Tokens Format Module 2025.10](https://www.designtokens.org/tr/drafts/format/)
- [DTCG stable announcement](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/)
- [Style Dictionary DTCG support](https://styledictionary.com/info/dtcg/)
- [Material Design 3 Tokens](https://m3.material.io/foundations/design-tokens)
- [material-foundation/material-tokens](https://github.com/material-foundation/material-tokens)
- [Geist by Vercel](https://vercel.com/geist/introduction)
- [Carbon Design System](https://carbondesignsystem.com/)
- [Shopify polaris-tokens](https://github.com/Shopify/polaris-tokens)
- [Figma Dev Mode MCP server](https://www.figma.com/blog/introducing-figma-mcp-server/)

---

## Related ideas files

- `ideas/uxui/design-system-deferred.md` — the original `/design-system` skill that was removed
- `ideas/uxui/design-system-skill.md` — older iteration notes (pre-deferred)

The earlier `ideas/figma/*` notes (component registry, code connect, official MCP comparison, UXUI Figma plan) were archived together with the Figma integration on 2026-04-19 — see `ideas/archive.md`.
