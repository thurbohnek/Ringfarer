# Ringfarer

Et 2D romskipspill (sett ovenfra) med ekte fysikk, inspirert av Stargate. Du
bygger ditt eget gruveskip modul for modul, borer og sprenger deg gjennom
asteroider og kometer, tar frakt- og leveringsoppdrag, og reiser mellom tre
stjernesystemer gjennom en eldgammel ringport.

Spillet er ren HTML5 + JavaScript uten byggesteg og uten avhengigheter. Det
kjører i nettleseren på PC og mobil.

Se `ENDRINGER.md` for hva som er endret og hva som gjenstår.

## Starte spillet

- **Lokalt:** åpne `index.html` i en nettleser. Ingen server trengs.
- **På nett:** repoet har en GitHub Actions-jobb som publiserer spillet til
  GitHub Pages ved hver push til `main`. Første gang: gå til
  **Settings → Pages** og velg **GitHub Actions** som kilde.
- **Testmodus** på startskjermen gir 1 000 000 kr, så alle skip, moduler og
  droner kan prøves med en gang.

## Kontroller

| Tast | Handling |
| --- | --- |
| W (pil opp) | Hovedmotor |
| S (pil ned) | Brems: stopper skipet i fartsretningen |
| A / D | Drei skipet |
| Q / E | Sidestyring |
| Mus | Sikt; venstreklikk bruker valgt verktøy |
| 1 / 2 / 3 / 4 | Velg laser, kanon, rakett eller anker |
| Mellomrom | Bruk valgt verktøy mot siktepunktet |
| X | Skyt ut / løsne ankerkroken |
| C / V | Vinsj inn / gi ut wire |
| F | Traktorstråle av/på |
| K | Send ut / kall inn droner |
| L | Arbeidslys av/på |
| Z | Flygeassistent: av, demper rotasjon, full |
| T / G | Dokk ved stasjonen / ring porten |
| + / − eller musehjul | Zoom |
| Esc / P | Pause (viser også aktive oppdrag) |
| H | Hjelp |

**Mobil:** dra hvor som helst på venstre side for å styre (skipet snur seg dit
du drar, langt drag gir gass). Trykk og hold ellers på skjermen for å sikte og
skyte dit. Knip med to fingre for å zoome. Den store runde
knappen bruker valgt verktøy, de små over den bytter verktøy. BREMS, TRAKTOR og
⋯ (lys, flygeassistent, droner, pause) ligger nederst. Trykk på radaren for å
gjøre den stor.

## Skipet er bygget av moduler

Hvert skip er et rutenett av moduler. Massen, tyngdepunktet, treghetsmomentet og
kollisjonsformen regnes ut fra modulene, så plassering betyr noe: en motor som
sitter skjevt gir dreiemoment, og tung last langt fra tyngdepunktet gjør skipet
tregere å snu.

| Kategori | Moduler |
| --- | --- |
| Struktur | Cockpit, skrogramme |
| Beskyttelse | Panserplate, tungpanser, skjoldgenerator |
| Motor | Hovedmotor, tung motor, styredyser, drivstofftank |
| Last | Lastecontainer, stor lastebinge |
| Gruvedrift | Borelaser (nivå 1–4), traktorstråle med inntak, prosessor |
| Våpen | Massedriver (kanon), rakettkaster |
| Verktøy | Ankerkaster, tungt anker, arbeidslys, flomlys, dronehangar |

Verktøy (laser, kanon, rakett, anker, lys, traktor) festes i festepunkter på
skrogets kant og peker ut der det er ledig plass. Våpen og lasere sitter i tårn
som dreier mot siktepunktet. Motorer trenger en åpen rute rett bak seg. I flukt
tegnes skipet som ett glatt skrog; klossene synes bare i skipsbyggeren.

**Skip å kjøpe:** Hoppeskip MK-I (6×5 ruter), Graver G-2 (8×7) og Fjellbryter
T-3 (9×11). Det gamle skipet tas i innbytte.

**Skade:** et støt skader modulene nærmest treffpunktet. En modul med 0 hp
faller av som vrakdel, og deler som ikke lenger henger sammen med cockpiten
driver bort. Mister du cockpiten, er skipet tapt. Vrakdeler kan samles inn med
traktoren og selges som skrap. På verkstedet kan skadde moduler repareres og
tapte moduler bygges opp igjen etter tegningen.

## Asteroider og mineraler

| Bergart | Mineral | Hardhet |
| --- | --- | --- |
| Kondritt | Jern | 1 |
| Silikat | Silisium | 1 |
| Karbonkondritt | Grafitt | 1 |
| Is | Vannis | 1 |
| Nikkel-jern | Nikkel-jern (årer av kobber) | 2 |
| Kobbermalm | Kobber | 2 |
| Titanmalm | Titan | 3 |
| Gullførende kvarts | Gull | 3 |
| Naquadah-malm | Naquadah | 4 |
| Triniumkrystall | Trinium | 4 |

Laseren må ha minst samme nivå som hardheten. Kanonkuler og raketter slår løs
biter av alt. Noen asteroider og kometer har et islag utenpå og et verdifullt
mineral inni.

## Anker og slep

Ankerkasteren skyter ut en krok på en wire. Den fester seg i det den treffer:
asteroider, kometer, vrak eller stasjonen. Wiren er et fysisk ledd som bare
trekker når den er stram. Vinsj inn for å lande på steinen, eller gi gass og
slep den etter deg.

## Droner

Med en dronehangar kan du kjøpe droner:

- **Gruvedrone** borer i myk stein nær skipet og leverer malmen til deg.
- **Reparasjonsdrone** flyr rundt skipet og reparerer skadde moduler.

Dronene kan også sendes på tokt fra stasjonen (3 minutter). De kommer tilbake
med malm eller betaling, men omtrent én av ti går tapt.

## Kodestruktur

| Fil | Innhold |
| --- | --- |
| `index.html` | Side, stil og berøringskontroller |
| `js/geom.js` | Polygonmatematikk: areal, tyngdepunkt, treghet, klipping, oppdeling |
| `js/physics.js` | Fysikkmotoren: legemer, kollisjon, impulsløser, wire, stråle-test |
| `js/world.js` | Mineraler, bergarter, varer, systemer, stasjoner, port, asteroidefelt |
| `js/voxel.js` | Asteroider og kometer av småbiter: boring, huler, sprekker, kratre og nye steiner |
| `js/modules.js` | Moduler, skip å kjøpe, geometri og egenskaper fra et oppsett |
| `js/ship.js` | Spillerens skip: flyging, laser, traktor, prosessering, skade per modul |
| `js/weapons.js` | Kanonkuler, raketter med sprengning, ankerkrok |
| `js/npc.js` | Datastyrte skip og spillerens droner (autopilot med samme fysikk) |
| `js/missions.js` | Oppdragsgenerator |
| `js/game.js` | Spill-løkke, kamera, gruvedrift, tap av moduler, port, dokking, lagring |
| `js/render.js` | Bakgrunn, asteroider, stasjon, port, partikler og lys |
| `js/shipdraw.js` | Tegning av moduler og modulære skip |
| `js/hud.js` | Instrumentpanel, radar og skadediagram |
| `js/ui.js` | Menyer: tittel, stasjon med skipsbygger, verft, droner, oppdrag |
| `js/input.js` | Tastatur, styrespak og knip-zoom |
| `js/audio.js` | Syntetisert lyd (Web Audio, ingen lydfiler) |

Fremgangen lagres i nettleseren (`localStorage`).
