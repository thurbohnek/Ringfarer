# Endringslogg for Ringfarer

Her står det som er endret i spillet, med det nyeste øverst. Hver oppføring
forteller hva som ble bedt om, hva som ble gjort, og hva som er testet. Den
tekniske oversikten over hvordan spillet henger sammen står i `README.md`.

## Åpne punkter

- **Er ikke prøvd på en ekte telefon.** All testing er gjort i en nettleser
  uten skjerm, i PC- og mobilstørrelse.
- **Alt er åpent med vilje, for testing.** Ingenting skal låses før brukeren
  sier fra. Moduler og skip har et `unlock`-nivå i `js/modules.js` som kan
  brukes når progresjonen skal bygges senere.
- **Skygger fra asteroider følger ytterkanten.** Lyset fra skipet kaster
  skygge etter det ytre omrisset av steinen, ikke etter hulene inni. Når man
  er inne i en hule, kastes ingen skygge fra den steinen.
- **Kjempeasteroider tar tid å bore i.** En tunnel stor nok til skipet krever
  mange biter. Raketter går mye raskere. Farten kan justeres etter testing.
- **Gamle lagringer fra v0.3 kan ikke lastes** fordi skipet er bygget helt om.
  Start en ny karriere eller testmodus.

## 2026-09-28: v0.6.0 · Asteroider av småbiter, huler, brems, sikting og testskip

Ønsker fra brukeren:
- kom seg ikke ut av kontrollmenyen
- noe rart med siktet for laser og anker, og kunne ikke skyte på en stein som
  lå der man styrer skipet på mobilen
- skipet skal ha alt utstyret om bord for testing
- asteroidene skal gå i stykker mer som i første versjon, ikke plutselig i
  tusen biter, og bitene som løsner skal passe med det som er igjen
- mulig å lage hull i store asteroider og fly inn i hulen
- mer realistisk form og farge, kratre og flere sammensetninger
- brems skal stoppe skipet i fartsretningen, ikke bare rygge

Hva som ble gjort:
- **Nye asteroider og kometer** (`js/voxel.js`, ny fil): hver stein er et
  rutenett av små biter, hver med sitt eget mineral. Laseren slår løs én bit om
  gangen, og biten har nøyaktig formen til hullet den etterlater. Steinen deler
  seg bare når en del faktisk mister kontakten med resten, eller når en sprekk
  går tvers gjennom. Da blir den to deler som passer sammen. Store steiner får
  bare en revne. Mineraler som er for harde for laseren blir stående igjen som
  årer.
- **Huler:** man kan bore tunneler og fly inn i store asteroider. Hvert
  asteroidefelt har 2–3 kjempeasteroider (50–70 m), og noen av dem har
  allerede en hule. Raketter og kanon slår ut kratre som blir til noen få biter
  (`js/weapons.js`).
- **Sammensetning og utseende:** steinene har klumper og årer av andre
  mineraler (for eksempel kobberårer i nikkel-jern og is i karbonstein), og
  islagte steiner har en kjerne av et annet mineral. Mineralene glir over i
  hverandre, overflaten er ru, kantene er mørkere, og steinen har fasetter i
  sollyset og kratre både i kanten og på flaten. Formen er ujevn, med utspring
  og innhakk (`js/world.js`, `js/render.js`).
- **Fysikken** takler nå legemer satt sammen av mange biter (kollisjon,
  stråler, støt telles som ett) (`js/physics.js`).
- **Brems** (BREMS-knappen eller S) stopper skipet i den retningen det faktisk
  beveger seg, med all kraft, og stopper også snurring (`js/ship.js`,
  `js/input.js`). W er hovedmotor.
- **Sikting:** trykker man på en stein, låses siktet til det punktet på
  steinen og følger den (klammer rundt trådkorset). På mobil står siktet der
  man sist trykket. Også korte trykk virker nå (`js/game.js`, `js/hud.js`).
  Varselet om for hard stein kommer bare når ingen laser biter (`js/ship.js`).
- **Styrespaken** er en fast sirkel nede til venstre. Resten av skjermen
  brukes til å sikte, så man kan skyte på steiner som ligger der
  (`index.html`, `js/input.js`).
- **Kontrollmenyen** kan rulles, og har en «✕ Lukk»-knapp øverst (`js/ui.js`,
  `index.html`).
- **Testskip:** «Test alt» starter med Fjellbryter bygget med alle modultyper
  (alle fire lasere, kanon, raketter, begge ankere, lys, skjold, prosessorer og
  to dronehangarer) og en gruvedrone og en reparasjonsdrone (`js/modules.js`,
  `js/game.js`).

Testet (nettleser uten skjerm, PC og Pixel 7):
- testskipet har alle 24 modultypene, ingen er blokkert, 4 lasere og 2 droner
- laser i 8 sekunder mot en kjempeasteroide: 12–19 løse biter, hullet vokser
- tre raketter mot samme stein: kratre og flere biter, ingen feil
- brems fra 15 m/s sidelengs: stopper helt på 3 sekunder uten å snu skipet
- kontrollmenyen lukkes både fra tittelskjermen og fra pausemenyen
- mobil: trykk på en stein nede til venstre låser siktet, styrespaken styrer
- ingen feil i nettleserkonsollen

## 2026-09-28: v0.5.2 · Alle får nyeste versjon på github.io

Problem: på https://thurbohnek.github.io/Ringfarer/ så brukeren selv den
nyeste versjonen, mens andre fikk en eldre. GitHub-jobben hadde publisert
riktig versjon. Nettleserne til de andre brukte gamle kopier av skriptfilene
fra mellomlageret (GitHub Pages ber nettlesere huske filene i 10 minutter, og
filene hadde samme navn i alle versjoner).

- Skriptfilene lastes nå med versjonen i adressen (`js/game.js?v=v0.5.2`),
  så en ny versjon alltid gir nye filer (`index.html`).
- Siden ber nettleseren sjekke om den selv er endret (`Cache-Control: no-cache`).
- Versjonsnummeret står nå bare ett sted: `window.RF_VERSION` i `index.html`.

Etter at en ny versjon er publisert, kan det fortsatt ta opptil 10 minutter før
selve siden er oppdatert hos alle. Da hjelper det å laste den inn på nytt.

## 2026-09-28: v0.5.1 · Alt åpent, ubegrenset penger til testing

Ønske: for å teste må alt være ulåst, så man kan handle og prøve alt. Ingenting
skal låses, og det skal gis penger om nødvendig.

- Ingenting var låst fra før, men penger kunne stoppe kjøp. «Test alt» er nå
  hovedknappen på startskjermen: kontoen fylles automatisk opp med 1 000 000 kr
  når den kommer under 500 000 kr, så pengene tar aldri slutt (`js/game.js`).
- Knappen «+1 000 000 kr» på stasjonen og «Gi meg 1 000 000 kr» i pausemenyen
  gir penger når som helst, også i en vanlig karriere (`js/ui.js`).

Testet: kjøpte Fjellbryter, Graver og Fjellbryter igjen på rad, og kontoen ble
fylt opp igjen. Pengeknappen virket. Ingen feilmeldinger.

## 2026-09-28: v0.5 · Sikting, festepunkter, glatt skrog, skygger og kometer

Ønske: laseren skal skyte dit man trykker på skjermen, og skyve bort eller
ødelegge løse biter så de ikke blokkerer. Klossene skal ikke synes når man
spiller, bare når man bygger. Skipet skal ha festepunkter der verktøy kan
klikkes inn, for eksempel en laser på siden. Lyset skal være mer realistisk,
med skygger bak ting og en mindre markert lyskjegle. Kometene skal se ut som
bilde 2 (grå, gropete stein med rusk rundt).

- **Sikting:** musen på PC, eller trykk og hold hvor som helst utenfor
  styrespaken på mobil. Trådkorset er grønt når et tårn når målet
  (`js/input.js`, `js/game.js`, `js/hud.js`).
- **Festepunkter og tårn:** verktøy (laser, kanon, rakett, anker, lys, traktor)
  festes i skrogets kant og peker ut der det er ledig plass. Våpen og lasere
  sitter i tårn som dreier mot siktepunktet, litt over 90° hver vei
  (`js/modules.js`, `js/ship.js`, `js/weapons.js`). Skipsbyggeren viser
  retningen med en pil.
- **Laseren holder banen fri:** løse biter som står i strålen dyttes ut til
  siden, og de minste fordamper. Nye biter spruter ut til siden i stedet for
  rett mot skipet.
- **Glatt skrog i flukt** (`js/shipdraw.js`): rutene slås sammen til én
  skrogform med avfasede hjørner, store stålplater, glassfront, motorklokker og
  tårn med festebraketter. Klossene vises bare i skipsbyggeren.
- **Lys med skygger** (`js/render.js`): lyskasterne kaster skygger bak steiner,
  skip og stasjonen. Kjeglen har myke kanter, og lysdisen er svakere.
- **Kometer:** større, grå og gropete med mange kratre og et klumpete omriss,
  en svak støvsky, og grus og småstein som følger med. Alle asteroider har fått
  en ru overflate.

Testet i en nettleser uten skjerm (PC og mobilstørrelse): sikting med mus mot
en stein (laseren traff og steinen sprakk), kanon, rakett, anker, drone, krasj
med tap av modul, og knip-zoom. Ingen feilmeldinger.

## 2026-09-28: v0.4.1 · Lesbare menyer

Ønske: bakgrunnen i menyene gjorde den grå teksten nesten umulig å lese, og
den måtte passe bedre med resten av spillet.

- Panelene er nå mørkt, børstet stål med svak tekstur i stedet for det grove
  støymønsteret (`index.html`, `js/ui.js`). Teksten er lysere og står på en
  mørkere flate. Den oransje knappen er glatt i stedet for kornete.
- Markedstabellen ble for bred på mobil, så kjøpskolonnen og knappene havnet
  utenfor skjermen. På smale skjermer blir hver rad nå et lite kort med
  merkede tall og knappene under. Det samme gjelder tabellen på verkstedet.

Testet i mobilstørrelse (Pixel 7) på Marked og Verksted. Ingen feilmeldinger.

## 2026-09-28: v0.4 · Modulære skip, våpen, anker, droner og ryddigere skjerm

Ønske: skipet skal være mer metallisk og firkantet, som et gruveskip.
Utstyr som kan kjøpes og festes på skipet (mer last, flere lasere, kanoner,
verktøy for gruvedrift og bevegelse). Kantete asteroider med flere farger,
flere mineraltyper og forskjellige typer asteroider og kometer, is på noen, og
mineraler som krever sterkere laser eller rakett. Et anker som skytes ut og
fester seg, så man kan slepe en komet etter en wire. Alt skal være tilgjengelig
nå for testing, og låses etter progresjon senere. Større skip å kjøpe. Droner
som kan sendes på oppdrag og hjelpe til med gruvedrift eller reparasjon.
Skipet skal kunne miste deler, ikke bare eksplodere. Mindre rot på skjermen
og zoom med knip. Bilder av Space Engineers-aktige gruveskip og Pixel
Starships ble lagt ved som retning for designet.

- **Modulære skip** (ny fil `js/modules.js`, ny `js/ship.js`, `js/physics.js`):
  skipet er et rutenett av 22 modultyper. Masse, tyngdepunkt, treghetsmoment
  og kollisjonsform regnes ut fra modulene. Hver motor skyver der den sitter.
- **Tre skip å kjøpe:** Hoppeskip MK-I, Graver G-2 og Fjellbryter T-3, med
  innbytte av det gamle skipet.
- **Skipsbygger på stasjonen** (`js/ui.js`): trykk på en rute for å sette inn
  eller fjerne moduler. Viser vekt, skyvekraft, akselerasjon, last og
  advarsler hvis noe er sperret.
- **Nytt utseende på skipene** (ny fil `js/shipdraw.js`): kantete metallblokker
  i lys og mørk grå med gule varselfelt, glassfront, dyser, containere og
  synlig skade per modul. Også de datastyrte skipene er bygget av moduler.
- **Skade per modul:** støt skader modulene nærmest treffpunktet. Moduler med
  0 hp faller av som vrakdeler, og deler som mister kontakten med cockpiten
  driver bort. Vrak kan samles inn og selges som skrap. Verkstedet reparerer
  og bygger opp tapte moduler etter tegningen. Bare tap av cockpiten er
  dødelig.
- **Våpen og verktøy** (ny fil `js/weapons.js`): laser (fire nivåer), massedriver
  med rekyl, sprengraketter med trykkbølge, og ankerkrok som skytes ut på wire
  og fester seg i det den treffer. Vinsj inn og gi ut wire.
- **Nye mineraler og bergarter** (`js/world.js`): ti mineraler med hardhet fra
  1 til 4, islag med verdifull kjerne, årer av et annet mineral, og kometer med
  kjerne. Asteroidene er kantete og tegnes med fasetter som får lys fra sola.
- **Egne droner** (`js/npc.js`): gruvedrone som borer og leverer malm til
  skipet, reparasjonsdrone som reparerer moduler, og tokt fra stasjonen.
- **Ryddigere skjerm** (ny `js/hud.js`): små felt i hjørnene, et skadediagram
  av skipet i stedet for mange stolper, radar som blir stor når man trykker på
  den, og korte meldinger.
- **Mobil:** knip med to fingre for å zoome. Færre og mindre knapper: én
  avtrekker, små verktøyknapper og en ⋯-meny for resten.
- **Testmodus** på startskjermen med 1 000 000 kr.

Testet i en nettleser uten skjerm (PC og mobilstørrelse):
- Testmodus, alle fanene på stasjonen, kjøp av Graver G-2, og å sette inn en modul i skipsbyggeren.
- Kjøp og utsending av drone.
- Laser på kobber (hardhet 2) med tung laser, kanon, rakett og ankerkrok.
- Gruvedronen samlet malm.
- Et krasj i 16 m/s mot en stor stein kostet én modul (traktoren), som ble til en vrakdel.
- Knip-zoom på mobil.
- Arbeidsskipene fløy i fire simulerte minutter uten å krasje i stasjonen.

Ingen feilmeldinger.

## 2026-09-28: Versjonsnummer på startskjermen

Brukeren så en eldre versjon av spillet via lenken, selv om siden var
oppdatert. Mest sannsynlig var det en lagret kopi i nettleseren.

- Startskjermen viser nå versjonsnummeret (`RF.VERSION` i `js/game.js`), så
  det er lett å se om man har den nyeste. Nummeret økes ved hver endring.
- Nåværende versjon: **v0.3 · 2026-09-28**.

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
