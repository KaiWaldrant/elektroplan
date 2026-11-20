# One app-wide Catalogus, with a snapshot in each project

The Catalogus (Artikels with manufacturer references, and Samenstellingen) is kept once per installation in IndexedDB and can be exported and imported as JSON, so the user fills in article numbers only once. Each project file stores a copy of the Catalogus version it used, so an old project keeps showing the same Materiaallijst after the Catalogus changes. The repo ships only an empty template: article numbers are entered by the user from the manufacturer's catalog and never guessed or generated.

## Considered Options

- Catalogus per project: every new project would need the article numbers again.
- A public, pre-filled Niko catalog in the repo: unverified references would end up on real orders. Possible later, once every number is checked against the manufacturer's site.
