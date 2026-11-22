# A Combinatie of Contactdozen counts as one towards the 8 per Eindstroombaan

AREI Boek 1 (versie 07, 15.09.2026) 5.3.5.2.b limits each Eindstroombaan to eight "enkelvoudige of meervoudige contactdozen". The text never defines a meervoudige contactdoos; the only hint is symbol table 2.23, which draws one "Meervoudige contactdoos (voor drie contactdozen)" as a single item. See `docs/research/combinatie-contactdozen-count.md`.

The check therefore counts per Eindstroombaan:

- each Combinatie that holds at least one Contactdoos as **1**, however many Contactdozen it holds;
- each fixed Toestel on the same Eindstroombaan as 1, and a group of fixed Toestellen driven by one common bedieningstoestel as 1 in total, as the last sentence of 5.3.5.2.b requires.

More than eight is an Overtreding citing 5.3.5.2.b. When the count is eight or less but would exceed eight if every Contactdoos counted on its own, the check adds an Advies saying the reading of a Combinatie as one meervoudige contactdoos is an interpretation to confirm with the keuringsorganisme.

Rejected: counting every Contactdoos separately as an Overtreding (the AREI counts meervoudige contactdozen as one, so this reports violations the text does not support), and reporting only an Advies until an inspection body confirms (the multi-socket case is clear in the text, and the check would then never cite the article).
