# Elektroplan

Local-first web app for drawing Belgian electrical plans: a *situatieschema* on top of your own floor plan,
and (coming) the *ééndraadschema*, AREI checks, a parts list and a Home Assistant export.

**Everything stays on your machine.** Plans and projects are stored in your browser (IndexedDB) and in files you
save yourself. The production build ships a Content-Security-Policy with `connect-src 'none'`, so the app cannot
make network requests. No CDN, no fonts, no telemetry.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
npm run check    # type check
npm run build && npm run preview   # production build with the strict CSP
```

## Status

- [x] M1: floors, import a PDF/image plan (scale 1:x or two-point calibration), draw walls, measure, undo/redo, autosave, save/open project files
- [ ] M2: AREI symbols (Boek 1, table 2.23) on the plan
- [ ] M3: panel, circuits and automatic ééndraadschema
- [ ] M4: AREI checks with article references, quantities, Niko parts list
- [ ] M5: cable lengths, Home Assistant export, A3 print

## Keys

`V` select · `W` wall · `M` measure · `C` calibrate · `F` fit · `Del` delete · `Ctrl+Z` / `Ctrl+Shift+Z` undo/redo ·
while drawing a wall: type a length in cm + `Enter`, `Alt` disables snapping, `Esc`/double-click/right-click ends the wall.

Not an official schema: have your installer draw/check the schemas for the AREI inspection.
