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
- **Hva som skal låses senere:** navigasjonsdatamaskinen (og annet med
  `unlock` over 0) skal bli en oppgradering senere i spillet. Nå er alt åpent
  til brukeren sier fra.
- **Ytelse:** testnettleseren (uten grafikkort) går på rundt 20–25 bilder i
  sekundet, og ned mot 12–15 midt i tung gruvedrift med mange malmbiter. På
  en PC med grafikkort bør det gå mye bedre. Si fra hvis det fortsatt hakker.
- **Løs gråstein smuldrer bort:** når det blir mer enn 28 biter, forsvinner de
  som er lengst unna. Grensen kan justeres.
- **Kjempeasteroider tar tid å bore i.** En tunnel stor nok til skipet krever
  mange biter. Raketter går mye raskere. Farten kan justeres etter testing.
- **Borehodene maler fortsatt løs biter** (som før). Bare laseren er en
  skjærestråle. Si fra om borene også skal endres.
- **Pirater:** styrken (skudd, skrog, dusør) og hvor ofte de kommer kan
  justeres etter testing. De følger ikke etter gjennom porten.
- **Skjærefarten** kan justeres etter testing. Startlaseren bruker omtrent
  25 sekunder gjennom en gråstein på 50 m.
- **Laseren gir ikke lenger malm av gråstein** (kondritt, silikat, karbon).
  Jern, silisium og grafitt kommer nå bare fra biter som løsner når steinen
  sprekker, eller fra kanon og raketter. Si fra om det gjør det for vanskelig
  å tjene penger i starten.
- **Kjempeskip og flåte:** skip på flere kilometer som fungerer som en
  flyvende by (dokker, marked, verft, oppdrag, tunge våpen) og hovedsenter
  for en nasjon. Målet er at spilleren styrer en flåte med et slikt skip.
  Nasjoner finnes ikke i spillet ennå.
- **Vrakdeler fra store skip** tegnes i småskip-størrelse.
- **Planeter:** personelltransport til og fra planeter kommer senere.
- **Droner på vei når spillet lagres** kommer hjem ved neste innlasting, men
  passasjerer de hadde med seg akkurat da, blir borte.
- **Gamle lagringer fra v0.3 kan ikke lastes** fordi skipet er bygget helt om.
  Start en ny karriere eller testmodus.

## 2026-09-30: v0.17.4 · Tydeligere knapper i verkstedet

**Ønske:** «Må vell stå fyll opp tanken ikke fix fuel, eller noe som er
bedre passende»

**Hva som er gjort:**

- `js/ui.js`: hver rad i verkstedet (Repairs) har sitt eget ord i stedet
  for «Fix»:

  | Rad | Knapp | Når det ikke er noe å gjøre |
  | --- | --- | --- |
  | Damaged modules | Repair · pris | No damage |
  | Lost modules | Rebuild · pris | None lost |
  | Fuel | Refuel · pris | Tank full |
  | Rockets | Restock · pris | Full, eller No launcher uten rakettkaster |

  Knappen nederst heter «Service all» (før «Fix everything»).
- `js/news.js`, `index.html`: nyhet og versjon v0.17.4.

**Testet** (Playwright):

- Startskipet med 40 % drivstoff viser «Refuel · 1,620 cr», «No damage»,
  «None lost», «No launcher» og «Service all (1,620 cr)».
- Refuel fyller så mye pengene rekker.
- Ingen feil i konsollen.

## 2026-09-30: v0.17.3 · Ingen flimring når en asteroide deles

**Ønske:** «Fortsatt noen flinring når man deler en asteroide i to deler»

**Hva som var galt:** jeg målte hvor mye skjermbildet endret seg fra bilde
til bilde rundt delingen. Vanlige bilder endret seg rundt 2–4, men bildet
rett etter hver deling hoppet til 8–12, også med lysene av. Endringen lå i
et bånd langs laserstrålen, fra steinen og helt ut til kanten av skjermen.
Når kuttet gikk gjennom, skjøt strålen ut i sprekken og tilbake igjen fra
bilde til bilde, mens bitene gled fra hverandre. Strålen blinket mellom kort
og lang.

**Hva som er gjort:**

- `js/ship.js`:
  - Laserstrålen vokser jevnt ut når den plutselig når lenger, omtrent fire
    ganger sin egen lengde per sekund. Kortere blir den med en gang.
  - Treffpunktet vises ikke før strålen har nådd fram.
  - Når laseren slås på, starter strålen i full lengde som før.
- `js/news.js`, `index.html`: nyhet og versjon v0.17.3.

**Testet** (Playwright, samme måling): etter delingen er endringen 2,5–5,8,
som vanlige bilder. Ingen topper i fire kjøringer, med og uten lys. Ingen
feil i konsollen.

## 2026-09-30: v0.17.2 · Steinene flimrer ikke, og innsamleren tar inn malmen

**Ønsker:**

- «Når man miner og deler astroidene flikker de og bitene rører rart på
  seg.»
- «Klarer ikke å samle resurser. Går ihvertfall tregt. Samler seg sammen
  foran innsamleren som på bildet.»

**Hva som var galt:**

- **Flimring:**
  - Når steinen bygges på nytt mens man skjærer, flyttes midtpunktet
    (tyngdepunktet). Det ferdigtegnede bildet av steinen fulgte ikke med.
    I opptil 0,2 sekunder ble det tegnet på feil sted, opptil 11 m unna i
    testen. Det skjedde i 32 av 439 bilder mens man skar.
  - Når steinen delte seg, ble det gamle bildet med biten fortsatt
    tegnet en liten stund. Biten synes da to steder.
- **Rare bevegelser:** biten og steinen deler kantnodene der kuttet gikk.
  De overlappet litt, og fysikken dyttet dem fra hverandre i rykk.
- **Innsamlingen:**
  - Innsamleren stoppet når 25 t malm ventet på prosessering.
  - Prosesseringen gikk bare 800–1 000 kg/s, og en malmbit fra
    skjærestrålen veier 7–14 t. Etter to–tre biter var køen full, og resten
    ble hengende i traktorstrålen foran innsamleren.
  - Var lasterommet fullt, holdt strålen bitene fast der.

**Hva som er gjort:**

- `js/voxel.js`:
  - Når origo flyttes, flyttes også bildet av steinen (`V.cx0`, `V.cy0`)
    og fasettene til lyset.
  - Når steinen deler seg, tegnes den på nytt med en gang (`V.force`).
  - Nye biter husker hvilken stein de kom fra (`sib`).
- `js/render.js`: tegner steinen på nytt med en gang når `V.force` er satt.
- `js/game.js`:
  - Nye biter kolliderer ikke med steinen de kom fra, eller med hverandre,
    de første 2,5 sekundene. De glir rolig fra hverandre.
  - Malm tas inn så lenge det den blir til, får plass i lasterommet. Grensen
    på 25 t er fjernet.
- `js/ship.js`:
  - Ny `procProduct` (tonn produkt i køen).
  - Er lasterommet fullt, slipper traktorstrålen bitene og sier fra: «Cargo
    hold is full. Sell at a station or buy more cargo space».
- `js/modules.js`: prosesseringen er raskere. Grunnfarten er 2 500 kg/s
  (før 800), og Ore processor gir +3 000 kg/s (før 1 500).
- `js/news.js`, `index.html`: nyhet og versjon v0.17.2.

**Testet** (Playwright):

- **Bildet av steinen:** før var det feil i 32 av 439 bilder, med opptil
  11 m. Nå er det 0 av 505. I en annen kjøring var det små avvik under
  1,1 m mens kuttet endret seg.
- **Innsamling med startskipet**, 10 kobberbiter på 8 t: før 4 biter på
  15 sekunder, nå 7 på 5 sekunder. Da var lasterommet på 16 t fullt, og
  strålen slapp resten med melding.
- **Testskipet:** alle 10 på 10 sekunder (før 15).
- **Resten virker som før:** droner, hold posisjon, pirater og skjæring.
  Ingen feil i konsollen.

## 2026-09-30: v0.17.1 · Zoom og panorering på stjernekartet

**Ønske:** «Star map må kunne zoomes inn og ut på»

**Hva som er gjort:**

- `js/ui.js`:
  - **Zoom:** musehjulet zoomer mot punktet under pekeren, og to fingre
    zoomer på mobil. Zoomen går fra ×0,6 til ×60.
  - **Panorering:** dra med musen eller én finger for å flytte kartet.
  - **Knapper** under kartet: +, −, «Center on ship» (sentrerer på skipet og
    zoomer inn til minst ×4) og «Show all» (hele systemet).
  - **Rutenett og målestokk:** rutenettet blir finere når man zoomer inn
    (1 km, 500 m, 100 m, 20 m). Målestokken tilpasser seg zoomen, og zoomen
    vises nede til høyre.
  - **Virkelig størrelse:** zoomet inn tegnes stasjonen, portene, andre skip
    og ditt eget skip i virkelig størrelse og form.
  - **Merkelapper:** fra ×3 får skannede steiner med mineraler en merkelapp
    med mineral og verdi.
- `index.html`: stil for kartet og knappene. Versjon v0.17.1.
- `js/news.js`: nyhet.

**Testet** (Playwright): musehjulet zoomer mot pekeren, dra flytter kartet,
og alle fire knappene virker. Stasjonen og skipet tegnes i riktig form når
man har zoomet inn. Ingen feil i konsollen.

## 2026-09-30: v0.17.0 · Pirater, stjernekart, steiner i bevegelse og skjærelyd

**Ønske:** «8,9, 17 og 22» (punktene i `PLAN.md`: lyd for skjæring, pirater
og fiendtlige droner, kart over systemene, og asteroider i bevegelse som man
må matche farten med).

**Hva som er gjort:**

- **8. Lyd for skjæring** (`js/audio.js`, `js/voxel.js`, `js/game.js`):
  - Jevnt sus med knitring mens strålen skjærer. Tonen går opp i hardere
    mineraler, og det knitrer mer i mineral enn i gråstein.
  - Når en bit løsner: skarpt knepp, et knirk som går nedover og en dump
    rumling. Større bit gir dypere lyd (`Audio.crack`).
  - Alarm med to toner når pirater kommer (`Audio.alarm`).
- **9. Pirater** (ny fil `js/pirates.js`, `js/npc.js`, `js/weapons.js`,
  `js/ship.js`, `js/modules.js`):
  - To nye fiender: Raider (lite kampskip, 110 i skrog, dusør 650 cr) og
    Stinger (rask drone, 40 i skrog, dusør 180 cr). Begge i rødbrune
    piratfarger.
  - De kan dukke opp når lasten er verdt over 2 000 cr og man er mer enn
    600 m fra stasjonen. Sjansen øker med verdien og med hvor farlig
    systemet er: Midgard lav, Vanaheim middels, Muspelheim høy. Det sjekkes
    hvert 15. sekund, med minst 150 sekunder mellom hvert angrep.
  - De kommer fra motsatt side av stasjonen, sirkler rundt skipet, sikter dit
    skipet vil være og skyter røde kuler med lengre spor.
  - De stikker av når skroget deres er under 30 %, når man er innen 420 m av
    stasjonen, når man dokker, etter 160 sekunder, eller når man går gjennom
    porten.
  - Laser, kanon og raketter skader dem. Nedskutte pirater gir dusør og vrak.
  - Vaktdronene (Picket) går etter pirater innen 260 m og brenner dem med
    laseren.
  - Radaren viser dem som røde prikker. Pilen i skjermkanten viser hvor de
    er, og de har en rød skrogmåler over seg.
  - Pausemenyen har «Call raiders (test)» for å teste.
- **17. Stjernekart** (`js/ui.js`, `index.html`, `js/input.js`,
  `js/game.js`):
  - Tasten Tab, «Star map» i pausemenyen eller STAR MAP i ⋯-menyen på
    mobil. Spillet står stille mens kartet er åpent.
  - Kartet over systemet viser:
    - Feltene med de vanligste steintypene.
    - Alle steinene. De skannede steinene med mineraler vises i farge.
    - Stasjonen med den trygge sonen, begge portene, skipet, dronene og
      piratene.
    - Målestokk på 1 km.
  - Liste over alle systemene med beskrivelse, stasjon og hvor farlig det er
    med pirater. Den viser også hva stasjonen betaler godt for (i cr/t) og
    hva den betaler lite for.
- **22. Steiner i bevegelse** (`js/world.js`, `js/game.js`,
  `js/scan.js`):
  - Omtrent hver femte mindre stein i den indre delen av et felt farter
    (3–8 m/s) og snurrer (opptil rundt 25°/s). En svak kraft mot midten av
    feltet holder dem i bane, så de svinger fram og tilbake gjennom feltet.
    Biter som skjæres løs, følger samme bane.
  - Merkelappen ved musen viser farten i forhold til skipet og hvor fort
    steinen snurrer, med «B to match». En pil viser hvor steinen er på vei.
  - Hold posisjon (B) matcher farten. Snurrer steinen, holder skipet avstand
    og retning i rommet mens steinen snurrer foran det (som en dreiebenk).
- `js/ui.js`: nye tips i hjelpen om skjæring, skanner, steiner i bevegelse
  og pirater. Tab står i tastelisten.
- `PLAN.md`: punkt 8, 9, 17 og 22 er strøket over.

**Testet** (Playwright):

- 15 av 70 steiner i Midgard beveger seg. Etter 20 sekunder var de
  fortsatt 100–250 m fra midten av feltet.
- Hold ved en stein som farter 5 m/s og snurrer 21°/s: skipet holdt seg
  innenfor 0,3–2,6 m.
- Pirater mot startskipet: de kom inn fra 800 m og skjøt. Skroget gikk ned.
- Nedskyting ga dusør (1 010 cr for tre pirater).
- Kartet åpnes og lukkes med Tab.
- Lyden startet uten feil.
- Skanner, drone og skjæring virker som før. Ingen feil i konsollen.

## 2026-09-30: v0.16.0 · Skanner, verdi på biter og hold posisjon

**Ønske:** «Bra. Ta for deg 1-3. Så kan du lage listen i en meny som jeg kan
ekspandere inn og ut og etter hver punkt kan du markere hva som er gjort med
en strek over teksten.»

Punkt 1–3 i planen: skanner for mineraler, verdi på løse biter og malm, og
hold posisjon ved en stein.

**Hva som er gjort:**

- Ny fil `js/scan.js` (`RF.Scan`):
  - `composition`: hva en stein eller bit består av (masse per materiale) og
    hva mineralene er verdt, med salgsprisen i systemet og skipets utbytte.
    Gråstein har ingen verdi.
  - Skannerpuls (tasten N, knappen SCAN på mobil): en ring brer seg ut
    (700 m, 2 km med dypskanner). Steiner den når, blir skannet og viser i
    45 sekunder en farget, stiplet ring og en merkelapp med det mest
    verdifulle mineralet og samlet verdi. Maks 8 merkelapper på skjermen,
    de mest verdifulle først. Melding til slutt, for eksempel «Scan: 34
    rocks with minerals, about 3.5M cr». 3 sekunder mellom hver puls.
  - Merkelapp når musen er over en stein eller bit, eller når siktet er låst
    på den (mobil): masse, mineraler med prosent og verdi, og samlet verdi.
    Uskannede asteroider sier «Scan (N) to see minerals». Løse biter og malm
    vises alltid.
  - Merkelappene sier fra når mineralet trenger en sterkere laser, for
    eksempel «needs laser T2».
- `js/modules.js`, `js/shipdraw.js`: ny modul Deep scanner (2 km
  rekkevidde, 2 800 cr), med egen tegning. `scanRange` i skipsdataene.
- `js/game.js`:
  - Hold posisjon (tasten B, knappen HOLD POSITION i menyen på mobil). Skipet
    legger seg der det er og følger steinen man peker på, ellers den
    nærmeste. Den følger også når steinen driver og snur seg, og holder
    samme vinkel til steinen.
  - Under hold snur A/D (eller styrespaken) skipet uten å slippe. W, S, Q, E
    eller B igjen slipper («Hold released»).
  - `game.pickBody` kan brukes av andre filer.
- `js/voxel.js`: når en stein bygges på nytt og tyngdepunktet flyttes,
  flyttes også punktet autopiloten holder og et låst sikte. Før kunne de
  hoppe når man skar i steinen.
- `js/hud.js`: «HOLD» i panelet øverst til venstre, og merkelappene fra
  skanneren.
- `js/render.js`: pulsringen og ringene rundt skannede steiner.
- `js/ui.js`: N og B i hjelpen. `index.html`: `scan.js`, knappene SCAN og
  HOLD POSITION, og versjon v0.16.0. `js/news.js`: nyhet.
- `PLAN.md`: den prioriterte listen, med punkt 1–3 strøket over.
  `CLAUDE.md`: planen vises som en meny som kan foldes ut i hvert svar.

**Testet** (Playwright, startskipet):

- Skann: 34–43 steiner med mineraler innen 700 m, med ringer og merkelapper.
- Musen over en stein: «Asteroid · 910 t, Ice 11 % · 3,075 cr».
- Hold ved en stein som ble dyttet (3,6 m/s) og snurret, mens laseren skar i
  den i 12 sekunder: skipet holdt seg innenfor 0,1–1,8 m av punktet og
  samme vinkel til steinen. W slapp.
- Dronene og gruvetesten virker som før. Ingen feil i konsollen.

## 2026-09-30: v0.15.0 · Laseren er en skjærestråle, og mineralene synes

**Ønske:** «Ønsker egentlig at laseren fungerer mere som en slags kutte stråle.
At d ikke løsner så mange biter. Heller det at noen biter kan knekke av men at
det er realistisk at hvor biten rammer løs synes på astroiden at biten passet
inn der. Om mineralene vises litt bedre på astroiden så kan man på en måte
kutte fra flere sider for å få løs bitene med mineraler så bruke laser for å
få ut mineralet.»

**Hva som er gjort:**

- `js/voxel.js`, ny `Vox.cut` (skjærestrålen):
  - Laseren fordamper en smal renne der den treffer, omtrent én node bred.
    Holdes den på samme linje, går rennen dypere til den er gjennom steinen.
  - Ingen biter slås løs. En bit løsner først når kuttene går helt rundt den.
    Den beholder formen sin og passer i hullet den kom fra.
  - Mens det skjæres, beholder løse biter formen sin ned til 10 m². Mindre
    biter av gråstein blir støv, mindre biter av mineral blir malm.
  - Gråstein som skjæres bort, blir røyk. Mineral som skjæres bort, samles
    opp og kommer ut som malmbiter (omtrent 3 m² om gangen).
  - Mineraler som er for harde for laseren, stopper strålen som før, med
    melding.
  - Laseren gir ikke lenger sprekker. Kanon og raketter gjør det fortsatt.
  - Melding når en bit er skåret løs: «A piece has been cut loose».
  - Løse biter med rutenett knuses bare hvis de er helt gråstein (98,5 %),
    så biter med mineral kan skjæres videre.
- `js/ship.js`: laserne skjærer. Borehodene maler fortsatt løs biter som
  før (`Vox.beam` med `drill`).
- `js/npc.js`: gruvedronene skjærer også, via `Vox.beam`.
- `js/render.js`, `js/world.js`: mineralene synes tydelig i steinen.
  - Hvert mineral har en egen markørfarge (`mark` for nikkel-jern, is og
    titan, ellers årefargen).
  - Mineralene tegnes som myke, fargede flekker med glitter oppå steinen.
  - Mineraler blandes ikke lenger bort mot fargen på resten av steinen.
- `js/news.js`, `index.html`: nyhet og versjon v0.15.0.

**Testet** (Playwright, testnettleser):

- Startskipet (laser T1) på en gråstein: steinen ble skåret i to på omtrent
  22–25 sekunder. Ingen småbiter, og kantene passer sammen.
- Testskipet: steinen skåret i to på 12 sekunder, uten overflødige biter.
- En stein av kondritt med årer av nikkel-jern: årene synes som blålig-sølv
  glitter.
- Stein av nikkel-jern med startlaseren: for hard, som før.
- Dronene går fortsatt inn og ut av luken. Ingen feil i konsollen.

## 2026-09-30: v0.14.2 · Mindre løs stein, raskere gruvedrift og riktig skygge

**Ønske:** «Steinen som blir av mining som ikke er mineraler gjør spillet
tregt. Bli veldig mange og når de ikke kan skytes bort me laser så blir d for
mange. Vet ikke om du har nå smart løsning på det. Der bitene løsner fra
kometen/astroiden blir d en skygge hvor de opprinnelig var.»

**Hva som var galt:**

- Biter som løsnet fra asteroider ble liggende for alltid. Driver de ut av
  systemet, kommer de inn igjen på motsatt side.
- Laseren skar løse steinbiter bit for bit, som store asteroider. Det tok lang
  tid og ga enda flere biter.
- Hver liten stein og malmbit ble tegnet som 10–15 trekanter, med fyll og kant
  på hver. Med mange løse biter ble det tungt.
- Skyggen fra sola ble klippet til det konvekse omrisset av steinen, ikke den
  virkelige formen. Der biter hadde løsnet, ble det liggende skygge i «lufta».

**Hva som er gjort:**

- `js/voxel.js`:
  - Biter som løsner, merkes som løse (`debris`), og hver stein vet hvor stor
    del som er gråstein (`stoneFrac`).
  - Ny `Vox.isJunk`: løse klumper av gråstein, og løse biter med rutenett
    under 600 m² som er minst 85 % gråstein.
  - Ny `Vox.beam`: laseren knuser slike biter tre ganger så fort i stedet for
    å skjære dem. Klumper under 120 m² fordamper, større deler seg i to.
  - Gråsteinsklumper under 60 m² som løsner i laseren, fordamper med én gang.
- `js/ship.js`, `js/npc.js`: laser og bor på skipet og på dronene bruker
  `Vox.beam`.
- `js/game.js` (`cleanupWorld`):
  - Løs gråstein mer enn 1,4 km unna og utenfor skjermen smuldrer bort.
  - Er det mer enn 28 løse gråsteinsbiter, smuldrer de overskytende bort.
    Først de som ikke synes og er lengst unna. De som synes, smuldrer opp i
    støv, noen få om gangen.
  - Løs malm holdes under 150 biter (før 260). De lengst unna går først.
- `js/render.js`:
  - Steiner og malmbiter som er små på skjermen, tegnes som én flate.
  - Steinen man borer i, tegnes i oppløsning etter zoomen og sjeldnere mens
    man borer.
  - Partikler maks 1000 (før 1600).
  - Solskyggen klippes til den virkelige formen på steinen (med groper og
    hull).
- `js/physics.js`: rutenett over delene av store steiner, så kollisjoner
  bare sjekker delene i nærheten.
- `js/news.js`, `index.html`: nyhet og versjon v0.14.2.

**Testet** (Playwright, testnettleser uten grafikkort):

- 80 løse gråsteinsklumper rundt skipet: 44 igjen etter 8 sekunder, og
  antallet går videre ned mot 28.
- Laser på en løs bit med rutenett (278–385 m², gråstein): knust på 2,4–2,7
  sekunder.
- Tung situasjon med 150 malmbiter og fullt med partikler: 40–42 ms per bilde,
  mot 55–75 ms før.
- 40 sekunder gruvedrift med testskipet: ingen feil i konsollen.
- En asteroide med et stort hakk: ingen mørk skygge i hakket. Planeten og
  verdensrommet synes rett gjennom.
- Dronene går fortsatt inn og ut av luken.

## 2026-09-30: v0.14.1 · Dronene flyr inn i luken

**Ønske:** «Dronene flyr ikke inn i luken men bak skipet. Kan du ordne det?»

**Hva som var galt:**

- Egne droner ble tegnet før spillerens skip. Når de fløy inn over skroget
  mot luken, forsvant de under skipet og så ut til å fly bak det.
- Dronene fløy til et punkt ved siden av skipet og derfra inn fra siden,
  gjennom skroget.
- Gruve- og innsamlingsdroner leverte malm til et punkt bak skipet i stedet
  for i luken.

**Hva som er gjort:**

- `js/render.js`: dine egne droner tegnes nå oppå skipet. Andre skip tegnes
  fortsatt under.
- `js/npc.js`:
  - Hjemkomst til dronerom og hangar: dronen flyr rett inn over luken
    (lukene sitter i dekket, sett ovenfra). Luken åpnes når dronen er
    nær, og dronen svever over den med nesen samme vei som skipet. Så synker
    den ned i rommet (ny verdi `sink` fra 0 til 1) og er hjemme.
  - Utskyting: dronen stiger opp av luken (`sink` fra 1 til 0) før den
    flyr ut.
  - Ny hjelper `pinTo` holder dronen over luken mens skipet beveger og dreier
    seg.
  - Gruve- og innsamlingsdroner med full last flyr inn i luken sin, lesser
    av og stiger opp igjen. Droner på klemmer leverer ved klemmen.
  - Dokkingklemmene virker som før.
- `js/shipdraw.js`: mens dronen synker, blir den mindre og mørkere, og
  skyggen og dyseflammene forsvinner. Det ser ut som den går ned under
  dekket.
- `js/news.js`, `index.html`: nyhet og versjon v0.14.1.

**Testet** (Playwright, testnettleser):

- Testskipet med dronerom:
  - Dronen stiger opp av luken og flyr ut.
  - Kalt hjem: den flyr inn over luken, luken åpnes, og den synker ned og er
    hjemme på omtrent 8 sekunder.
- Broodhall D-4 med hangar og dronerom:
  - Begge droner flyr inn over hver sin luke og synker ned.
  - Med full malmlast flyr begge inn i luken, lesser av (melding
    «delivered 9.0 t of ore») og kommer ut igjen på jobb.
- Ingen feil i konsollen.
- Skjermbilde: dronen stiger synlig opp av den åpne hangaren.

## 2026-09-30: v0.14.0 · Porten bygget av ekte deler, kraftig åpning, tettere zoom og friere panorering

Ønske fra brukeren: «Må kunne zoome helt inn på små skip. Så skipet dekker
hele skjermen. Må også kunne panorer mer. Usikker på hvor langt skipet kan
være utenfor bildet. Gaten må se mer realistisk ut. Ser bare ut som en
regning no. Må se ut som noe som er bygget med de forskjellige komponenten
som må til. Når gaten åpnes må det virkelig vises me rå effect.»

Hva som er gjort:
- `js/render.js` (porten): tegnet på nytt som en maskin, sett skrått
  ovenfra. Ringen har tykkelse bakover og 36 panelplater med sømmer, lysest
  på siden som vender mot oss. Et symbolspor inni roterer mens porten ringer
  opp. Ni chevron-enheter har hus, en V-klemme som går inn når chevronen
  låser, og en lampe som lyser. Fire stabiliseringsdyser sitter utenpå, og
  en kontrollplattform bak porten er koblet til ringen med fagverk og
  strømkabler. Lampene på plattformen viser hvor mange chevroner som er låst.
- `js/render.js`, `js/game.js` (åpningen): elektriske buer langs ringen de
  siste chevronene, gnister når en chevron låser, og en kraftig vortex med
  turbulente kanter, stråler og et blendende lys. Tre sjokkbølger går
  utover, en sky av blå gnister skytes ut forover, skjermen blinker og
  rister etter hvor nær man er. Horisonten har bevegelige krusninger fra tre
  sentre, lysflekker som glir over flaten og en lys kant, og den trekker seg
  sammen når porten lukkes.
- `js/game.js`: man kan zoome inn til skipet fyller hele skjermen (også på
  de minste skipene), og panorere opptil halvannen skjerm bort fra skipet.
- `js/hud.js`: når man har panorert bort, viser en pil i kanten hvor skipet
  er («Your ship»).
- `js/shipdraw.js`, `js/ship.js`: ditt eget skip tegnes med høyere
  oppløsning, så det er skarpt også helt inne.
- `js/news.js`, `index.html`: nyheter og versjon v0.14.0.

Testet: porten i ro, under oppringing, åpning og åpen (skjermbilder), zoom helt inn på Skiff (84 ganger, skipet fyller skjermen) og panorering bort fra skipet med pil i kanten. Ingen feil i konsollen.

## 2026-09-30: v0.13.0 · Nytt lys med sol, kapitalport, rolige droner og støv som viser fart

Ønske fra brukeren: dronene var for store for lukene og vimset mye, og bare
én av to droner hadde lys. Lyskjeglen var for markant, og to lys oppå
hverandre så rart ut. Mer realistisk lys, der det som blir belyst lyser opp,
og gjerne en sol som lyskilde. Større skip trenger en større port, og
passeringen gjennom porten så rar ut. Noe som viser at man er i bevegelse,
for eksempel små partikler som ligger mer eller mindre i ro.

Hva som er gjort:
- `js/render.js` (lys): lyset er bygget om. Et eget lyslag starter med
  sollyset i systemet (fargen fra stjerna). Steiner, skip og stasjonen kaster
  skygge bort fra sola, men bare på andre gjenstander, ikke på planeten og
  stjernene bak. Lamper, motorer, stråler og porten legger lys til, så to lys
  oppå hverandre blir lysere sammen. Til slutt ganges bildet med lyslaget, så
  det som blir belyst lyser opp. Lyskjeglene har myke kanter (flere svake
  lag), og hver lampe regnes bare i området den lyser på.
- `js/shipdraw.js`: lysdisen i kjeglen er mye svakere og uten skarpe kanter.
- `js/npc.js`, `js/modules.js`: hver drone får en størrelse som passer i
  luken, hangaren eller klemmen den bor i på akkurat det skipet
  (`RF.droneFit`). Alle droner har en liten lykt foran (før hadde bare
  reparasjonsdronen det, fordi den har en lampe-modul). Styringen regner med
  at bremsen er svakere enn hovedmotoren, små justeringer tas med dysene uten
  å snu, og dronene snur rolig. Dronene som venter, ligger stille ved siden av
  skipet med nesen samme vei.
- `js/world.js`, `js/game.js`, `js/render.js`, `js/hud.js`: hvert system har
  fått en kapitalport (840 m i diameter) et godt stykke fra stasjonen, i
  tillegg til den vanlige. Den vises på radaren og som markør i kanten av
  skjermen. Skip som er for brede for porten, får beskjed. Man kommer ut av
  samme type port i neste system.
- `js/render.js` (port): delen av skipet som har gått gjennom horisonten,
  synes ikke, og resten tegnes oppå horisonten, så det ser ut som skipet
  glir inn i den.
- `js/render.js` (bevegelse): støvkorn som ligger i ro i rommet. Når skipet
  flyr fort, trekkes de ut til korte striper.
- Nytt ønske underveis (med skjermbilde): «Disse firkantede steinene er ikke
  realistisk. Annen utforming må de ha. De må også kunne bli ødelagt av en
  laser. Kommer selfølgelig ant på hva slags material de er av.»
  `js/voxel.js`, `js/world.js`: løse steiner under 140 m² var grove biter av
  asteroidens rutenett, og ble derfor firkantede. Nå blir de ujevne, runde
  klumper av samme materiale og størrelse (`RF.RUBBLE_AREA`).
  `js/ship.js`, `js/npc.js`, `js/weapons.js`: laser, bor og droner varmer
  opp klumpene til de knuses, hvis laseren er sterk nok for materialet.
  Kanon og raketter knuser alt. Klumpen deler seg i mindre biter: mineraler
  blir malm, og gråstein fra laseren fordamper.
- `js/render.js` (ytelse): hver lampe regnes bare i området den lyser på,
  lyslaget har litt lavere oppløsning, støvet tegnes samlet, og skyggeformene
  fra sola lagres til steinen har snudd seg.
- `js/news.js`, `index.html`: nyheter og versjon v0.13.0.

Testet:
- Dronene: snittlig dreiefart gikk fra 1,1 til 0,2–0,4 rad/s. Tre små droner
  fra Warren fløy ut og kom hjem igjen på 12 sekunder.
- Porten: Warren fløy gjennom den vanlige porten til Vanaheim, og
  Thunderhold gjennom kapitalporten tilbake til Midgard.
- Skyggene fra sola ligger på steiner og skip, ikke over planeten.
- Ingen feil i konsollen.

## 2026-09-30: v0.12.0 · Skipene i virkelig størrelse, store våpen og utstyr

Ønske fra brukeren: den største klassen skal være gigantisk og lite
manøvrerbar. Svar på oppfølgingsspørsmålene: alle skip skaleres opp til
virkelige størrelser. Kjempeskipene på flere kilometer venter vi med (målet
er å styre en flåte med et slikt hovedskip). Våpen og utstyr skal kunne
oppgraderes, og større skip kan ha større kanoner, lasere og raketter som
tar flere ruter.

Hva som er gjort:
- `js/physics.js`: et legeme kan ha en målestokk. Skipet regnes og tegnes i
  sine egne ruter, men er s ganger større i verden.
- `js/classes.js`: hvert skip har en virkelig lengde, og målestokken regnes
  ut fra den. Jagere 10–32 m, korvett 55 m, fregatt 110 m, destroyer 300 m og
  slagkrysser 800 m. De andre linjene går opp til 450–500 m. Destroyeren og
  slagkrysseren har fått lanse i baugen, tunge massedrivere og
  rakettbatterier.
- `js/ship.js`: masse og drivstofftanker følger volumet (s³) og
  treghetsmomentet s⁵, mens motorkraften vokser med s^2,5. Store skip blir
  derfor trege: Skiff snur 180° på 3 s, destroyeren på 30 s og slagkrysseren
  på 65 s. Skjold, lasterom, laser og kanonkraft vokser med størrelsen, og
  modulene tåler mer.
- `js/modules.js`, `js/shipdraw.js`, `js/ui.js`, `js/game.js`: store moduler
  som tar 2×2 eller 3×3 ruter: kapitalmotor, skottpanser, skjoldarray, stort
  lasterom, tung traktorstråle, tungt skjærearray, tung massedriver,
  beleiringskanon, rakettbatteri og lanse. De tegnes forstørret, sikter,
  skyter og tar skade som én modul, og kan kjøpes og selges som vanlig.
- `js/weapons.js`: prosjektiler og raketter fra store kanoner og store skip
  slår hardere og lager større kratre.
- `js/game.js`: skip over 60 m legger seg ved stasjonen i stedet for i
  dokkingarmen («Hold position»). Kameraet kan zoome langt nok ut til de
  største skipene. Drivstoff koster mindre per kilo for store skip.
- `js/npc.js`: dronene dokker riktig mot store skip.
- `CLAUDE.md`: regel om at hvert svar har en markert kopi av brukerens siste
  melding rett over lenkene.
- `js/news.js`, `index.html`: nyheter og versjon v0.12.0.

Testet:
- Alle 28 skipene: ingen sperrede verktøy eller motorer, ingen overlappende
  ruter, og alt henger sammen med cockpiten.
- Gadfly, Excavator, Rockbreaker, Vigil, Tidewater, Grimtide, Thunderhold og
  Stonewain fløy med autopilot fra stasjonen og kom fram (slagkrysseren på
  51 s). Kanonene skyter, og store skip får «Hold position» ved stasjonen.
- Ingen feil i konsollen.

## 2026-09-29: v0.11.0 · Oppdateringsnyheter, droner i tre størrelser, passasjerer og mannskapsbytte

Ønsker fra brukeren: et kort sammendrag for spillerne av hva som er endret
når spillet starter etter en oppdatering, og et varsel i spillet (et sted
det ikke er i veien) når en ny versjon er lagt ut. Droner i ulike størrelser
som passer til skipet, kobler seg fra og dokker til skipet igjen. Noen skip
har en luke som åpnes og lukkes der dronene flyr ut og inn. Droner som
beskytter skipet, henter ressurser, hjelper til med gruvedrift, frakter
varer, frakter personell fra skip til skip og til og fra stasjoner.
Planeter kommer senere.

Hva som er gjort:
- `js/news.js` (ny): korte nyheter på engelsk for hver versjon. Tittelskjermen
  viser det som er nytt siden sist spilleren startet spillet, og «All
  updates» viser hele listen. Spillet sjekker hvert tredje minutt (og når
  fanen blir synlig igjen) om `index.html` på nettet har et nyere
  versjonsnummer. Da kommer et lite varsel under radaren med knappen
  «Reload» (spillet lagres først) og et kryss for å skjule det.
- `js/modules.js`: dronene har størrelse og rolle. Små (Mite gruvedrone,
  Mender reparasjonsdrone, Gleaner innsamler) bor i dronerom. Mellomstore
  (Burrower tung gruvedrone, Picket vaktdrone, Tern mannskapsskyttel) bor i
  hangardekk eller på en klemme. Store (Porter lastedrone, Ferryman
  passasjerlander) sitter på en ny modul, dokkingklemme, utenpå skroget.
  `RF.fitDrones` fordeler dronene og sjekker at de får plass.
- `js/npc.js`: dronene er mindre utgaver av skip (størrelse, treghet og
  tegning skaleres). De venter til luken er åpen, flyr ut gjennom åpningen
  og tilbake til den, og legger seg inntil klemmen når de dokker. Nye jobber:
  vakt (brenner småstein og vrakbiter på kollisjonskurs), innsamling,
  lastetur til stasjonen (selger varene og flyr tilbake), passasjertur til og
  fra stasjonen, og mannskapsbytte ut til et frakteskip. Droner deler ikke
  på samme oppgave. Rutingen rundt stasjonen er rettet, så droner og skip
  ikke flyr inn i den når de starter nær stasjonen.
- `js/shipdraw.js`, `js/render.js`: luker som glir til sidene over dronerom
  og hangardekk, med varsellys mens de går. Tegning av dokkingklemmen, og av
  dronene som sitter på den.
- `js/game.js`: K sender ut alle droner, og kaller dem hjem hvis noen er ute.
  Egne droner kolliderer ikke med sitt eget skip eller andre droner.
  Passasjerer går av og på når man dokker. Ved skipsbytte beholdes dronene
  som får plass, resten selges.
- `js/missions.js`, `js/ui.js`: nye oppdrag: passasjerer til en annen
  stasjon, passasjerer som hentes på en annen stasjon, og mannskapsbytte til
  et frakteskip i systemet (krever skyttel-drone). Dronemenyen viser
  størrelse, rolle og hvor dronen bor, og om det er plass til en ny.
  Oppdragsmenyen viser ledige passasjerplasser.
- `js/classes.js`: klemmer på Coachliner, Tidewater, Longhaul og Stonewain.
  Drone-linjens bonus er nå at hvert dronerom rommer to små droner.
- `CLAUDE.md`: regel om at hver oppdatering får en kort nyhet i `js/news.js`.
- `index.html`: versjon v0.11.0, stil for nyheter og varsel.

Testet:
- Testskipet sender ut fem droner. Lukene åpnes, dronene flyr ut, og alle
  kommer tilbake og dokker når de kalles hjem.
- Lastedronen fløy rundt stasjonen, inn i lasteporten, solgte 25 t og kom
  tilbake.
- Passasjerlanderen leverte 6 passasjerer og hentet 4. Skyttelen fløy 3
  mannskap ut til et frakteskip. Oppdragene ble betalt.
- Nyheter på tittelskjermen og varselet om ny versjon ser riktige ut på PC
  og mobil. Ingen feil i konsollen.

## 2026-09-29: v0.10.0 · Skipsklasser: 28 skip i seks linjer, klassebonuser og fordeler fra formen

Ønske fra brukeren: klasser for personelltransport (fra 2 til rundt 1000
personer), frakt, gruvedrift, droner, jagere, større jagere, destroyere og
slagkrysser. Egne navn, ikke kopier av kjente skip. Skipene skal formes etter
hva de skal brukes til. Svar på spørsmålene fra forslaget: «Bonuser for
forskjellige klasser. Utforming gir også fordel på de forskjellige klasser»
og «Må ha penger for å kjøpe men kan hoppe over skip. Må ikke gå gradvis.»

Hva som er gjort:
- `js/classes.js` (ny): seks linjer i fem nivåer, 28 skip i alt (25 nye og
  de tre gamle som gruveskip). Hver linje gir en bonus:
  - Personell: +30 % skjold, 20 % mindre drivstoff.
  - Frakt: +25 % lasterom, +10 % skyvekraft.
  - Gruvedrift: +25 % laser og bor, prosessering og traktorstråle.
  - Droner: +50 % droneplass, dronene jobber 25 % raskere.
  - Jagere: +50 % dreiekraft, 40 % raskere snuing, kanonene skyter 25 % fortere.
  - Krigsskip: +40 % skjold, 20 % mindre skade, kanonene skyter 10 % fortere.
- Fordeler fra formen, regnet ut fra hvor modulene sitter (gjelder også når
  man bygger om skipet): pansret baug (30 % mindre skade forfra), styredyser
  ytterst (+20 % dreiekraft), smalt skrog (+20 % snuing og sidestyring),
  beskyttet bro (cockpiten tar halv skade), skjermede dekk (passasjermoduler
  tar 40 % mindre skade når tanker og reaktor sitter mellom dem og motorene)
  og lasteracker på sidene (10 % bedre priser i markedet).
- Alle skip kan kjøpes når man har råd. Man må ikke eie skipet før i linjen.
- `js/modules.js`: nye moduler: passasjerkabin (2), boligmodul (10),
  kryokøyer (30, trenger ikke livsopprettholdelse), livsopprettholdelse
  (120 personer), luftsluse, reaktor (+40 skjold, raskere opplading, 8 %
  sterkere laser) og hangardekk (2 droner). Maks 30 droner per skip.
- `js/shipdraw.js`: tegninger av de nye modulene, også som ikoner i butikken.
  Skrogfargen følger klassen: passasjerskip lyse, droneskip grønngrå og
  militære skip blågrå.
- `js/ship.js`, `js/weapons.js`, `js/game.js`, `js/npc.js`: bonusene virker i
  fysikken, skaden, skuddtakten, markedsprisene og dronene. Lange skip legges
  lenger ut når de dokker, så baugen ikke stikker inn i dokkingarmen.
- `js/ui.js`, `index.html`: verftet har nå en fane per linje med bonusen
  øverst. Hvert skip vises med bilde, nivå, størrelse, masse, akselerasjon,
  tid for å snu 180°, skjold, lasterom, passasjerer, droner, våpen og
  fordelene fra formen. Utstyrsoversikten viser passasjerer og klasse. Raden
  med kategorier klemmes ikke lenger sammen på mobil.
- `README.md`: `js/classes.js` er lagt inn i oversikten.
- `index.html`: versjon v0.10.0.

Testet:
- Alle 28 skipene: ingen verktøy eller motorer er sperret, og alle moduler
  henger sammen med cockpiten.
- Hvert skip ble kjøpt i testmodus, dokket av og fløy med autopilot til et
  punkt 150 m ut. Alle kom fram. Ingen feil i konsollen.
- Thunderhold (det største krigsskipet) ligger riktig ved dokkingarmen.
- Kjøp av boligmodul, lagring og innlasting virker.
- Laser, malmstøt, skjoldet og autopiloten gir samme resultater som før.

## 2026-09-29: v0.9.6 · Laseren fordamper gråstein, malm dytter ikke skipet, skjold mot småstein

Ønske fra brukeren: «Når man skyter laser på en asteroide så kommer de små
bitene ut mot skipet i full fart. Laseren bør ødelegge disse bitene så lenge
det ikke er mineraler. Mineralene bør ikke ha innvirkning på skipet når de
treffer det. Altså fysikken. Kan kollidere men må ikke flytte på skipet.
Autopiloten må heller ikke ta hensyn til de minste steinene. Kanskje et skjold
rundt skipet kan dytte bort små objekter som de minste steinene.»

Hva som er gjort:
- `js/world.js`: vanlig gråstein (kondritt, silikat og karbonholdig kondritt)
  er merket som `stone`. Is og mineralene (nikkel-jern og hardere) regnes som
  mineraler. Nye hjelpere: `RF.isStone` og `RF.isSmallRock` (stein med radius
  under 3,5 m).
- `js/voxel.js`: bitene laseren slår løs av gråstein fordamper med en liten
  røyksky i stedet for å fly ut. Mineralbiter løsner som malm, som før.
- `js/ship.js`: laser- og borestrålen går fortsatt rett gjennom løse
  mineralbiter, men treffer løse gråsteinsbiter og fordamper dem (for
  eksempel biter fra sprekker eller kanonskudd).
- `js/physics.js`: ny `oneWay`-regel i kollisjonene. Den ene parten kan
  kollidere uten å bli skjøvet.
- `js/game.js`: malmbiter kolliderer med skip (spillerens og andres), men
  flytter dem ikke og gjør ingen skade.
- `js/ship.js` (`updateDeflector`): skjoldet dytter småstein og løse malmbiter
  unna skroget. Feltet rekker lenger ut jo fortere biten kommer, og virker
  ikke tilbake på skipet. Skjoldet blinker der det dytter. Når traktorstrålen
  er på, slipper malmen gjennom så den kan trekkes inn. Uten skjold (tomt)
  virker ikke feltet.
- `js/game.js`: autopiloten ser bort fra småstein (under 3,5 m radius) når
  den legger kurs, og bremser ikke for dem.
- `index.html`: versjon v0.9.6.

Testet:
- Laser i 12 sekunder mot en kondrittstein: ingen gråsteinsbiter fra laseren.
  Fire biter kom fra sprekker. Mot nikkel-jern og kobber løsnet 20 og 36
  malmbiter, og ingen kom mot skipet i mer enn 3 m/s.
- Malmbit kastet mot skipet i 12 m/s, med og uten skjold: skipet flyttet seg
  ikke (0,00 m/s) og fikk ingen skade.
- Småstein (radius 3 m) mot skipet i 4 m/s: med skjold ble den dyttet tilbake
  før den traff (skipet 0,00 m/s). Uten skjold dyttet den skipet 0,74 m/s.
- Autopilot: alle tre skipene kom fram rundt en asteroide uten støt. To
  runder med åtte turer i asteroidefeltet ga ett lett støt (2,7 m/s mot en
  stor stein i lav fart, tatt av skjoldet). Ingen småstein traff skipet.
  Lange turer (over 1 km) rakk ikke fram innen testens grense på ett minutt,
  og én tur på 660 m heller ikke. Ingen feil i konsollen.

## 2026-09-29: v0.9.5 · Autopiloten styrer unna på alle skip i testmodus

Ønske fra brukeren: «Autopiloten må virke på alle skip i testfunksjonen.»

Hva som er gjort:
- `js/game.js` (`navInput`): i testmodus styrer autopiloten nå unna
  asteroider og stasjoner på alle skip, også på skip som ikke har
  navigasjonsdatamaskin. Før gjaldt dette bare testskipet, som har den
  montert. Ellers i spillet kreves fortsatt navigasjonsdatamaskinen.
- `index.html`: versjon v0.9.5.

Testet: i testmodus ble hvert av de tre skipene (Hopper, Graver, Fjell)
kjøpt, og hvert fløy to turer med en asteroide midt i veien. Alle seks turene
la kurs rundt steinen og kom fram. Hopperen fikk ett lett støt på den ene
turen. Ingen feil i konsollen.

## 2026-09-29: v0.9.4 · Autopiloten flyr med nesen først

Ønske fra brukeren: «Når autopiloten navigerer må romskipet forsøke å fly med
nesen i fartsretningen.»

Hva som er gjort:
- `js/game.js` (`navInput`): på vei mot målet peker nå nesen dit skipet
  faktisk beveger seg. Fra stillstand peker den dit skipet skal akselerere.
  Når farten øker, tar fartsretningen over, også når skipet svinger rundt en
  hindring. Før pekte nesen rett mot målet eller omveispunktet, og skipet
  kunne da drive sidelengs.
- De siste 30 meterne snur skipet seg til retningen spilleren valgte, som
  før. Nær steiner snur det fortsatt bare sakte.
- `index.html`: versjon v0.9.4.

Testet: åtte turer med autopilot gjennom asteroidefeltet. Det var ingen
kollisjoner, og alle kortere turer kom fram. Nesen pekte i snitt 5–30 grader
fra fartsretningen i fart over 6 m/s. Det største avviket var i svingene rundt
steiner. Ingen feil i konsollen.

## 2026-09-28: v0.9.3 · Tryggere autopilot, zoom på skipet i utstyrsmenyen, markering som varer

Ønsker fra brukeren (med skjermbilder):
- autopiloten krasjet flere ganger (i en kjempeasteroide med innhakk)
- markeringen av endringen på skipet virket, men forsvant for fort
- å kunne zoome inn og ut på skipet i utstyrsmenyen

Hva som ble gjort:
- **Autopiloten** (`js/game.js`, `js/ship.js`). Målinger viste flere årsaker:
  - Skipet fløy fort mot steiner, og farten bar det sidelengs inn når ruten
    svingte. Nå begrenses farten ut fra hvor langt det er til nærmeste
    hindring i den retningen skipet faktisk driver, så det alltid kan stoppe.
  - Store skip som snudde seg nær steiner, feide tuppen av skroget inn i dem
    i 20–30 m/s. Nærmere enn 20 m fra en hindring snur autopiloten ikke
    skipet lenger. Den flytter det sidelengs med dysene, og tuppen beveger
    seg maks 2,5 m/s.
  - Planleggeren kunne velge ny side rundt steinen flere ganger i sekundet.
    Nå velger den den korteste frie ruten rundt hindringen og holder seg til
    samme side.
  - Ruten sjekkes med fem stråler med margin, pluss en egen sjekk for små
    steiner som kunne gli mellom strålene. Ruten sjekkes sju ganger i
    sekundet.
- **Markering ved kjøp og salg** (`js/ui.js`, `js/shipdraw.js`): pulserer
  nå i 7 sekunder og blir deretter stående rolig på skipet til neste kjøp
  eller salg. Vinduet nederst vises også i 7 sekunder.
- **Zoom på skipet i utstyrsmenyen** (`js/ui.js`, `js/shipdraw.js`,
  `index.html`):
  - Knappene +, − og Fit, musehjul, eller knip med to fingre.
  - Dra for å flytte bildet når det er forstørret.
  - Opptil 800 %. Er bildet forstørret når du kjøper noe, flyttes det til den
    nye delen.

Testet (nettleser uten skjerm):
- turer tvers gjennom asteroidefeltet i Midgard: før krasjet 3 av 6 turer.
  Nå hadde 9 av 10 turer ingen støt, og den siste bare et lett dult på
  3,7 m/s som skjoldet tok
- turer rundt kjempeasteroider (70–105 m): alle kom frem uten krasj
- zoom med knapper (235 %), musehjul og dra. Markeringen står fortsatt
  etter 8 sekunder. «Fit» går tilbake til 100 %
- snu på stedet, retning ved målet, kjøp og salg virker fortsatt
- ingen feil i nettleserkonsollen

## 2026-09-28: v0.9.2 · Motorflammen bare når motoren brukes

Ønske: hovedmotorene så ut som de var på hele tiden, også når skipet sto i
ro. Det skal synes at det er en motor, men uten flamme bak når den ikke
brukes. (Brukeren bekreftet også at autopiloten nå fungerer bra.)

Hva som ble gjort (`js/shipdraw.js`):
- Flammen tegnes bare når motoren faktisk skyver, og lengden følger hvor
  mye gass den får.
- I ro har dysene bare en svak, varm glød innerst, så man ser at det er en
  motor. Med gass lyser de blått.

Testet (nettleser uten skjerm): skipet i ro viser dysene med svak glød og
ingen flamme. Med W kommer blå flammer bak begge motorene. Ingen feil i
konsollen.

## 2026-09-28: v0.9.1 · Autopilot som styrer unna, og rotasjon uten å svinge forbi

Ønsker fra brukeren:
- autopiloten må styre unna asteroider på veien. Det skal være en
  oppgradering man får senere, men den må være tilgjengelig for testing nå
- når man drar fra skipet for å snu det, roterer skipet for fort, forbi
  pilen, og svinger fram og tilbake før det stopper

Hva som ble gjort:
- **Ny oppgradering: Navigation computer** (Equipment → Tools, 3 500 cr)
  (`js/modules.js`):
  - Med den sjekker autopiloten fire ganger i sekundet om noe ligger i veien.
    Den bruker tre stråler: midt i skipet og ved hver side.
  - Ligger en stein, stasjonen, porten eller et annet skip i veien, velger
    den et punkt ved siden av hindringen og flyr via det.
  - Ruten vises som en stiplet linje med et punkt der den svinger.
  - Løse malmbiter og egne droner teller ikke som hindringer.
  - (`js/game.js`, `js/render.js`)
- Uten navigasjonsdatamaskin flyr autopiloten rett som før, men gir beskjed
  når noe ligger i veien.
- Den har nivå 2 i `unlock`, så den kan låses til senere i spillet. Den er
  åpen nå, og testskipet har den montert.
- Ny detalj på skipet: en sensorskål der maskinen sitter (`js/shipdraw.js`).
- **Rotasjon:** skipet regner nå ut når det må begynne å bremse
  rotasjonen, ut fra hvor kraftige styredysene er og hvor tungt skipet er.
  Det stopper på pilen uten å svinge forbi (`js/ship.js`). Det gjelder både
  når man drar fra skipet, retningen ved målet og styrespaken på mobil.

Testet (nettleser uten skjerm):
- snu 2,5 radianer: før svingte det store testskipet 1,6 radianer forbi
  (det lille 0,6 og fram og tilbake fire ganger). Nå 0 forbi og ingen
  svinging, for begge skipene
- en stein på 35–40 m lagt midt i ruten: med navigasjonsdatamaskin fløy
  skipet rundt og kom frem uten skade. Uten den krasjet skipet i steinen
- ingen feil i nettleserkonsollen

## 2026-09-28: v0.9.0 · Malmbiter hindrer ikke laseren, kjøpsbeskjed, ryddig HUD, snu skipet, bedre menyer

Ønsker fra brukeren:
- de minste bitene som løsner er veldig firkantete og blokkerer laser og våpen
- når man kjøper og monterer noe, er eneste tilbakemelding at pengene
  forsvinner
- HUD-en er rotete
- vanskelig å snu skipet uten å dra av gårde: hold fingeren nede og dra dit
  skipet skal peke når det er fremme, og trykk og hold på skipet og dra for å
  snu det
- menyene bør ha en oversiktlig layout

Hva som ble gjort:
- **Malmbiter:** små biter er nå ujevne, avrundede klumper i stedet for
  firkanter (`js/voxel.js`). Laser, borehode, kuler og raketter går rett
  gjennom løse biter, så de ikke står i veien (`js/ship.js`,
  `js/weapons.js`, `js/npc.js`). Ankerkroken kan fortsatt feste seg i dem.
- **Kjøp og salg av utstyr** (`js/ui.js`, `js/shipdraw.js`, `index.html`):
  - Et vindu glir inn nederst med et lite bilde av skipet, navnet på delen og
    prisen.
  - Delen som ble montert pulserer grønt på skipet. En solgt del markeres
    med rødt kryss.
  - Raden du kjøpte fra, blinker kort.
- **HUD** (`js/hud.js`, `js/game.js`):
  - Ett lite panel øverst til venstre med system, kreditter, fire tynne
    målere (skrog, skjold, drivstoff, last), fart og antall oppdrag.
  - Skadekartet vises bare når skipet er skadet.
  - Maks to meldinger om gangen, og samme melding gjentas ikke.
- **Styring:**
  - **Trykk og hold på tomt rom:** målringen dukker opp. Dra videre for å
    velge hvilken vei nesen skal peke når skipet er fremme. En grønn pil
    viser retningen.
  - **Trykk på skipet og dra:** skipet snur seg mot fingeren uten å flytte
    seg.
  - Kort trykk flytter som før, og dra på tomt rom flytter kameraet. Å holde
    fingeren på tomt rom skyter ikke lenger. Skyt med avtrekkeren, eller hold
    på en stein.
  - (`js/game.js`, `js/render.js`, `js/ui.js`)
- **Menyer:**
  - Utstyrsfanen har kategoriknapper øverst (Structure, Protection, Engines,
    Cargo, Mining, Weapons, Tools) og viser én kategori om gangen som kort
    med ikon, pris, beskrivelse, «Fitted» og knapper.
  - På mobil er toppen av stasjonen mer kompakt: målerne på én rad og
    fanene som én rad med ikoner, så det blir mer plass til innholdet.

Testet (nettleser uten skjerm, Pixel 7 og PC):
- kjøp av tung laser: vinduet «✓ Heavy mining laser fitted» vises med
  markering på skipet
- trykk på skipet og dra nedover: skipet snudde fra 3,14 til 1,62 rad
  (ønsket 1,57) uten å flytte seg
- hold på tomt rom og dra til venstre: målet fikk retning 3,14, og skipet
  kom frem (0,3 m unna) og pekte riktig vei
- utstyrsfanen og stasjonen på mobil og PC ser ryddige ut
- ingen feil i nettleserkonsollen

## 2026-09-28: v0.8.1 · Resten av spillet på engelsk

Ønske: oversette alt i spillet til engelsk.

Hva som ble gjort:
- Gikk gjennom all tekst i alle filene på nytt. Fem knapper på mobil var
  fortsatt på norsk og er nå oversatt (`index.html`): WINCH IN, PAY OUT,
  CANNON, ROCKET og HARPOON.
- Oppdrag i gamle lagringer hadde norske varenavn (for eksempel
  «Reservedeler»). De oversettes nå når en lagring lastes inn (`js/game.js`).

Testet (nettleser uten skjerm, Pixel 7):
- lastet en gammel lagring med et norsk oppdrag: det vises som «Haul 3 t of
  spare parts»
- lest all tekst i alle seks fanene på stasjonen, knappene på mobil,
  meldinger, pause, hjelp og oppringing: ingen norsk tekst igjen
- ingen feil i nettleserkonsollen

## 2026-09-28: v0.8.0 · Organisk skip, bedre menyer, ny himmel, engelsk, større steiner

Ønsker fra brukeren (med et bilde av skip fra Stargate-flåten som mal):
- skipet skal være mer organisk, som på det nye bildet (ikke det forrige)
- menyen må fikses og gjøres bedre
- bakgrunnen med planeter virker ikke realistisk
- spillet skal være på engelsk
- større kometer og asteroider med mer realistiske farger

Hva som ble gjort:
- **Skipet** (`js/shipdraw.js`): modulene tegnes ikke lenger som klosser. De
  blir til ett sammenhengende, avrundet skrog i lag oppå hverandre: et bredt
  underskrog, et smalere dekk og en rygg langs midten, med spiss baug foran
  og motorgondoler bak. Fargen er varm grå/beige som på bildet. Skroget har
  paneler og sømmer, små detaljer (luker, rør, bokser), mørke renner og rader
  med vinduslys. Utstyret synes fortsatt: bro med vinduer, skjoldskål,
  lastedører, tanker, prosessor, dronehangar, pansring, motorer og alle
  verktøyene i sine festeringer.
- **Menyene** (`js/ui.js`, `index.html`):
  - Hovedmenyen har store, tydelige valg med en kort forklaring under hvert.
  - Stasjonen har faner med ikoner, til venstre på PC og som et rutenett på
    3 × 2 på mobil, så ingenting må skyves sidelengs. Last, skrog,
    drivstoff og raketter vises som små målere.
  - Knappen «Undock» ligger fast nederst.
  - På mobil fyller stasjonen hele skjermen.
- **Himmelen** (ny fil `js/sky.js`):
  - Svart himmel med et svakt melkeveibånd med støvstriper, og tusenvis av
    små stjerner i naturlige farger.
  - Sola har en hvit kjerne og mild blending.
  - Planetene er lyssatt fra sola, med dag- og nattside og atmosfære langs
    kanten:
    - Midgard: jordlik planet med hav, land, iskapper og skyer.
    - Vanaheim: gasskjempe med bånd og ringer, der planeten kaster skygge
      på ringene.
    - Muspelheim: lavaplanet med glødende sprekker.
  - Himmel og planet ligger langt unna og flytter seg nesten ikke.
  - Svevende støv er dempet, og mørket over verden er lettere, så steiner og
    planeter synes bedre.
- **Engelsk:** all tekst spilleren ser er oversatt (menyer, meldinger,
  moduler, varer, oppdrag, steder og knapper). Tall vises på engelsk vis, og
  penger heter «cr». Regelen står i `CLAUDE.md`.
- **Asteroider og kometer** (`js/world.js`, `js/voxel.js`, `js/render.js`):
  - Steinene er større (opptil 42 m), kjempeasteroidene er 70–105 m, og
    kometene 34–60 m.
  - Fargene er dempet og realistiske: gråbrun kondritt, trekullsvart
    karbonstein, metallgrå nikkel-jern og skitten, grå is. Sjeldne mineraler
    har bare et svakt glimt av farge.
  - Skyggen på steinene er jevn fra sola i stedet for «kakestykker», og
    kometene har færre og mykere kratre.

Testet (nettleser uten skjerm, PC og Pixel 7):
- hovedmeny, stasjon (marked, utstyr, oppdrag) og kontrollmeny på PC og
  mobil, uten feil
- alle tre systemene: himmel, sol og planet tegnes riktig
- autopilot, panorering, brems og lukking av kontrollmenyen virker fortsatt
- ingen feil i nettleserkonsollen

## 2026-09-28: v0.7.0 · Nytt utseende på skipet, utstyrsbutikk, fly dit du trykker og kamera som kan flyttes

Ønsker fra brukeren (med to bilder som mal for utseendet):
- skipet var for kantete og hadde for lite detaljer på utsiden
- skipsbyggeren kan tas bort, men når man kjøper ting skal det synes på skipet
- man skal kunne zoome ut som nå og i tillegg flytte kameraet, helt til skipet
  står i kanten av skjermen men fortsatt synes
- trykker man på et sted, for eksempel ved siden av en asteroide, skal skipet
  fly dit og stoppe

Hva som ble gjort:
- **Nytt utseende på skipene** (`js/shipdraw.js`), etter det første bildet:
  hver modul er en lys stålblokk formet som en åttekant med avfasede hjørner,
  skråkant og skygge. Mellom modulene synes den mørke rammen, og koblingsstykker
  med bolter holder dem sammen. Modulene har rister, merkelapper, runde
  tanker, cockpitglass, dyseklokker med blått lys og rader med lysende kupler
  langs kantene. Verktøyene er større og lette å kjenne igjen: lasertårn med
  farget linse, doble kanonløp, rakettkasse, ankerkrok, lyskastere, traktor og
  borehoder. Skipet tegnes én gang og gjenbrukes, så det går like raskt som før.
- **Nytt verktøy: borehode.** En piggete bortrommel på en arm (som på bildet).
  Den snurrer og maler seg inn i stein den presses mot (hardhet 2), og brukes
  med laserknappen (`js/modules.js`, `js/ship.js`).
- **Skipsbyggeren er fjernet.** I stedet har stasjonen fanen **Utstyr**
  (`js/ui.js`). Der ser du et bilde av skipet med alt utstyret, og kan kjøpe og
  selge. Det du kjøper monteres automatisk der det er plass, uten å sperre
  andre verktøy eller motorer (`RF.autoPlace` i `js/modules.js`).
- **Fly dit du trykker:** et kort trykk på tomt rom setter et mål. Skipet snur
  seg, flyr dit og stopper der. Ligger målet ved en stein, følger det steinen
  mens den driver. En ring og en stiplet linje viser målet. Styrer du selv,
  slås autopiloten av (`js/game.js`, `js/ship.js`, `js/render.js`).
- **Kameraet kan flyttes:** dra på skjermen (eller bruk høyre musknapp) for å
  se deg rundt. Skipet blir alltid værende på skjermen, et stykke fra kanten.
  Trykk på skipet, ⋯ → Sentrer kamera eller tasten O for å sentrere igjen.
- **Trykk på skjermen betyr nå:** kort trykk på tomt rom = fly dit, trykk og
  hold på en stein = sikt og skyt (siktet følger steinen), hold fingeren stille
  på tomt rom = skyt dit, dra = flytt kameraet (`js/input.js`, `js/game.js`).
- Testskipet har i tillegg to borehoder.

Testet (nettleser uten skjerm, PC og Pixel 7):
- testskipet har alle modultypene og to borehoder, ingen er blokkert
- på Hoppeskipet ble borehode, tung laser, kanon, flomlys og ett borehode til
  kjøpt og montert uten at noe ble sperret. Salg av kanonen virket
- klikk på tomt rom 60 m unna: skipet fløy dit og stoppet 0,4 m fra målet
- å dra på skjermen flyttet kameraet, og skipet ble værende på skjermen
- mobil: kort trykk satte mål, dra flyttet kameraet, å holde på en stein låste
  siktet og laseren skjøt
- ingen feil i nettleserkonsollen

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
