# Endringslogg for Ringfarer

Her står det som er endret i spillet, med det nyeste øverst. Hver oppføring
forteller hva som ble bedt om, hva som ble gjort, og hva som er testet. Den
tekniske oversikten over hvordan spillet henger sammen står i `README.md`.

## Åpne punkter

- **Nettversjonen på GitHub Pages er ikke slått på.** Gå til
  Settings → Pages og velg «GitHub Actions» som kilde. Et privat repo på en
  gratis GitHub-konto kan ikke bruke Pages. Da må repoet gjøres offentlig først.
- **Endringene er ikke på `main` ennå.** De ligger på grenen
  `claude/stargate-spaceship-game-dv8wq3`. Nettversjonen oppdateres først når
  de er slått sammen til `main`.
- **Er ikke prøvd på en ekte telefon.** All testing er gjort i en nettleser
  uten skjerm, i PC- og mobilstørrelse.

## 2026-09-27: Regel om hemmeligheter

Ønske: «Aldri publiser secrets eller API-er på GitHub. Da kan vi bruke GitHub
secrets.»

- Sjekket hele repoet og historikken for nøkler, tokens og passord. Ingen
  funnet.
- La til `CLAUDE.md` med regelen: nøkler legges i GitHub secrets
  (Settings → Secrets and variables → Actions) eller i en lokal `.env`-fil.
- `.gitignore` ignorerer nå `.env`-filer og nøkkelfiler.
- Verdt å vite: spillet kjører i nettleseren, så alt i `js/` kan leses av alle
  som spiller. En nøkkel spillet selv må bruke, trenger en egen server.

## 2026-09-27: Mobilstyring, mørke og lys, anker, arbeidsskip, rustent utseende

Ønske: touch-styring på telefon, klumpete malmbiter i stedet for flak, mørkere
rom med mer svevende partikler, lys på skipet, oppgraderbart utstyr (lys,
laser, anker), mer støv ved boring, datastyrte skip som utfører oppgaver, og et
mer rustent og metallisk utseende på menyer, instrumentpanel og skip.

- **Styring på telefon:** styrespak på venstre side. Skipet snur seg dit du
  drar, og et langt drag gir gass. Knapper for laser, brems, traktor, lys,
  anker og vinsj. Slås på automatisk første gang skjermen berøres, og kan
  slås av og på i pausemenyen. (`js/input.js`, `index.html`, `js/ship.js`)
- **Klumpete malm:** små biter lages som runde klumper med nøyaktig samme
  areal, og dermed samme masse, som biten de erstatter. (`js/geom.js`,
  `js/game.js`)
- **Mer støv:** kontinuerlig steinstøv og gnister der laseren brenner, og
  store skyer og grus når en stein sprekker. (`js/game.js`)
- **Mørkere rom:** mørkere himmel, svakere tåke og planet, og svevende støv i
  flere dybder. (`js/render.js`, `js/world.js`)
- **Lyssystem:** mørke legges over verden, og lyskildene lyser det opp:
  arbeidslyset (en kjegle fra nesen), motorer, laser, stasjonen og porten.
  Røyk og støv blir synlige i lyskjeglen. (`js/render.js`)
- **Nye oppgraderinger:** arbeidslys (70 → 120 → 180 m) og ankerkabel med
  vinsj (60 eller 120 m). (`js/ship.js`)
- **Anker:** X fester kabelen i steinen foran nesen, og C (eller VINSJ) trekker
  skipet inn. Kabelen er et fysisk ledd i impulsløseren som bare trekker når
  den er stram. (`js/physics.js`, `js/ship.js`)
- **Datastyrte skip** (ny fil `js/npc.js`):
  - Gruvedroner borer i asteroider, samler malmbitene og leverer dem gjennom
    en lasteport bak på stasjonen.
  - Frakteskip ringer opp porten, reiser til andre systemer og kommer tilbake
    gjennom porten senere, med virvel foran porten når de kommer.
  - Alle bruker samme fysikk som spilleren. De ruter rundt stasjonen og styrer
    unna steiner, og kan bli ødelagt hvis de treffes hardt.
- **Rustent og metallisk utseende:**
  - Skipene har slitt stål, nagler, rustrenner, sot og falmede varselstriper.
  - Stasjonen har fått skitt og døde solceller.
  - Instrumentpanelet er stålplater med nagler, varsellamper og en messingramme
    rundt en grønn radarskjerm.
  - Menyene har varselstriper, stensilskrift og knapper som ser ut som
    metallplater.

Testet: styrespaken, anker og vinsj, boring og innsamling, porten,
kollisjonsskade, og fire simulerte minutter med arbeidsskipene. I første
versjon krasjet arbeidsskipene inn i stasjonen. Det ble rettet med ruting
rundt stasjonen og bedre unnamanøvre. De kan fortsatt dunke borti steiner og
hverandre i lav fart, men tar ikke skade av det.

## 2026-09-27: Eget repo

Ønske: spillet skal ikke ha noe med Roller å gjøre, og skal ligge i et eget
repo.

- Spillet ble flyttet fra Roller-repoet til dette repoet (`Ringfarer`), med egen
  README og en egen jobb som publiserer til GitHub Pages.
- Roller-repoet fikk en commit som fjerner alt som hadde med spillet å gjøre.

## 2026-09-27: Første versjon

Ønske: et 2D-spill (sett ovenfra) med et lite enmannsskip i Stargate-stil.
Oppdrag med handel og frakt, utvinning i asteroider og kometer der man borer,
knuser og fanger biter som prosesseres, nøyaktig fysikk med skade på skipet,
og fremtidsrettede skip som tåler en støyt.

- Fysikkmotor skrevet fra bunnen: stive legemer (konvekse polygoner),
  kollisjoner med sprett og friksjon, og masse og treghetsmoment regnet ut fra
  formen.
- Skade regnes fra fartsendringen i støtet. Skjoldet tar støtet først, og
  stedet som blir truffet avgjør hvilket system som skades.
- Borelaser som skjærer av biter og får steiner til å sprekke. Traktorstråle
  som trekker bitene inn i nesen, der de prosesseres til jern, nikkel-jern,
  vannis eller naquadah.
- Tre systemer (Midgard, Vanaheim, Muspelheim) med stasjoner, forskjellige
  priser, kometer og en ringport med chevroner, virvel og horisont.
- Stasjonsmenyer for marked, verksted, oppdrag og oppgraderinger. Fremgangen
  lagres i nettleseren.
