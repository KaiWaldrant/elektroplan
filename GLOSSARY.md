# Elektroplan

The Belgian domestic electrical installation as drawn for an AREI inspection: what is installed, where it sits, and how it is wired.

Terms use the Dutch AREI word (as in the UI). Each term has one fixed English name for code, shown as **Code**.

## Language

**Situatieschema**:
The floor plan of one floor showing where each Toestel sits, drawn with the AREI symbols.
**Code**: `SiteplanView`
_Avoid_: floor plan (that is only the background), layout plan

**Ééndraadschema**:
The single-line diagram of the installation: the panel, its protections, the circuits and the Toestellen on each circuit.
**Code**: `SingleLineView`
_Avoid_: schema, wiring diagram

**Verdieping**:
One floor of the house, with its own plan and its own Situatieschema.
**Code**: `Floor`
_Avoid_: level, storey, page

**Ruimte**:
A named room on a Verdieping, outlined on its plan. It decides the Home Assistant area of the Toestellen inside it and whether bathroom rules apply.
**Code**: `Room`
_Avoid_: zone (reserved for bathroom zones), area, kamer

**Toestel**:
One piece of installed electrical equipment, such as a light point, socket, push button, teleruptor or data outlet. It is the same Toestel in the Situatieschema and the Ééndraadschema, and it may have no position on a plan yet.
**Code**: `Device`
_Avoid_: element, point, materieel, HA device

**Eindstroombaan**:
One final circuit behind its own protection in the panel, feeding 230 V Toestellen. Every 230 V Toestel belongs to exactly one Eindstroombaan.
**Code**: `FinalCircuit`
_Avoid_: kring, groep, circuit (alone), line

**Bedieningskring**:
The 24 V ZLVS control circuit that feeds the Drukknoppen and the coils of Teleruptors and Relais.
**Code**: `ControlCircuit`
_Avoid_: stuurkring, low-voltage circuit

**Combinatie**:
A set of Toestellen at one spot on the wall under one shared multiple cover plate, horizontal or vertical. A single Toestel on its own plate is a Combinatie of one.
**Code**: `Gang`
_Avoid_: cluster, group, multiple

## Panel

**Verdeelbord**:
The panel that holds the protections; it is fed either from the meter or from an Eindstroombaan of another Verdeelbord (then it is an onderverdeelbord).
**Code**: `Panel`
_Avoid_: kast, zekeringkast, board

**Differentieel**:
A residual current device in a Verdeelbord, with a rated sensitivity (300 mA at the origin, 30 mA after it), protecting everything downstream of it.
**Code**: `Rcd`
_Avoid_: verliesstroomschakelaar, aardlekschakelaar, diff

**Automaat**:
A circuit breaker in a Verdeelbord that protects exactly one Eindstroombaan or the supply of the Bedieningskring.
**Code**: `CircuitBreaker`
_Avoid_: zekering, fuse, breaker

**Contactdoos**:
A Toestel to plug in an appliance, with earth and child protection. Several next to each other form a Combinatie.
**Code**: `Socket`
_Avoid_: stopcontact, outlet, plug

## Switching

**Lichtpunt**:
A Toestel that gives light: a ceiling or wall connection for a luminaire.
**Code**: `LightPoint`
_Avoid_: lamp, fixture

**Drukknop**:
A Toestel that gives a short pulse when pressed; it switches nothing by itself.
**Code**: `PushButton`
_Avoid_: switch, button

**Schakelaar**:
A Toestel that switches a Lichtpunt directly and stays in its position (single-pole, two-way, intermediate, dimmer).
**Code**: `Switch`
_Avoid_: push button, toggle

**Teleruptor**:
A Toestel in the panel that flips its contact on each pulse from a Drukknop and holds it (bistable).
**Code**: `ImpulseRelay`
_Avoid_: impulsschakelaar (only on the AREI symbol label), relay

**Relais**:
A Toestel in the panel whose contact is closed only while its coil is energised (monostable), for example driven by a Home Assistant relay module.
**Code**: `Relay`
_Avoid_: teleruptor, contactor

**Bediening**:
A set of Lichtpunten that go on and off together, plus what switches them: either Drukknoppen and the one Teleruptor or Relais they drive, or one or more Schakelaars. A Lichtpunt belongs to at most one Bediening. All its Lichtpunten sit on the same Eindstroombaan. One Bediening is one light in Home Assistant.
**Code**: `Control`
_Avoid_: group, scene, light group, circuit

## Parts list

**Catalogus**:
The user's own list of Artikels and Samenstellingen, shared by all projects. Article numbers are entered by the user from the manufacturer's catalog, never guessed.
**Code**: `Catalog`
_Avoid_: database, price list

**Artikel**:
One orderable product in the Catalogus, with its manufacturer reference, description and unit.
**Code**: `Article`
_Avoid_: product, part, item

**Samenstelling**:
The Artikels one kind of Toestel needs in a given finish, such as mechanism, finishing set and flush box.
**Code**: `Assembly`
_Avoid_: recipe, kit, bundle

**Afwerking**:
The product range and colour of the visible parts, such as Niko Original black coated. A project has one default Afwerking; a Combinatie may use another.
**Code**: `Finish`
_Avoid_: style, colour, serie

**Materiaallijst**:
The quantities of Artikels a project needs, counted from its Toestellen, Combinaties and Verdeelborden.
**Code**: `BillOfMaterials`
_Avoid_: BOM (in the UI), parts list, bestelling

## Checks

**Bevinding**:
The result of one check on the project, pointing at the Toestellen, Eindstroombanen or Verdeelborden it concerns. It never blocks editing.
**Code**: `Finding`
_Avoid_: error, warning, issue

**Overtreding**:
A Bevinding that breaks a specific AREI article, always shown with that article number.
**Code**: `Violation`
_Avoid_: error, fout

**Advies**:
A Bevinding about good practice that no AREI article requires; it never cites an article.
**Code**: `Advice`
_Avoid_: warning, tip, aanbeveling
