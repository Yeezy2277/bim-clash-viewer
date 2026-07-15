# Girder — BIM clash viewer

[![CI](https://github.com/Yeezy2277/bim-clash-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/Yeezy2277/bim-clash-viewer/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Yeezy2277/bim-clash-viewer/actions/workflows/codeql.yml/badge.svg)](https://github.com/Yeezy2277/bim-clash-viewer/actions/workflows/codeql.yml)

A browser BIM coordination viewer: a procedurally generated four-storey building
(structural frame, architecture envelope, MEP services) rendered with
**three.js**, and a **pure, unit-tested clash-detection engine** that finds every
place the services run into the structure — the classic clash review, entirely
client-side.

> **Live demo:** <https://girder.vitaliipopov.dev> · no backend, no login

## What it shows

- **Clash detection as pure logic** — [`src/model/clash.ts`](src/model/clash.ts)
  intersects AABBs across discipline pairs (structure/architecture vs MEP) with
  a touch tolerance, returns overlap volume + centroid, severity-sorted. No
  three.js imports; pinned by [unit tests](src/model/clash.test.ts).
- **Deterministic model as code** — [`src/model/building.ts`](src/model/building.ts)
  generates the building from grid constants and deliberately mis-routes three
  MEP runs (duct at beam elevation, pipe through a column line, pipe clipping a
  soffit). Tests assert every planted error is found *and* every cleanly routed
  run stays clash-free — the test suite caught a real routing mistake during
  development.
- **Viewer UX from real BIM tools** — click a clash: the camera flies to it,
  the pair lights up red/amber, and the rest of the model turns to glass
  (isolate-with-ghosted-context, NavisWorks-style). Plus a section plane
  slider, per-discipline visibility, and a model browser with element counts.
- **Imperative 3D behind a small API** — [`src/viewer/scene.ts`](src/viewer/scene.ts)
  owns the render loop; React never re-renders on camera moves. The same
  host/extension split used when building tooling on top of embedded 3D
  viewers.

## Run it

```bash
npm install
npm run dev        # vite dev server
npm test           # clash engine + model generator (node --test)
npm run build      # tsc + vite
```

## Background

Generalised from production work extending a web-based BIM viewer
(three.js-hosted) with coordination tooling — clash/collision checks, work-set
grouping and review UI. This is a clean-room, self-contained reproduction of
those patterns: same discipline, none of the original code or data.
