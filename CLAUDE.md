# Ringfarer

## Hemmeligheter og API-nøkler

- Aldri legg hemmeligheter, API-nøkler, tokens eller passord i koden, i
  commits, i README eller i andre filer i repoet. Heller ikke midlertidig.
- Trengs en nøkkel i en GitHub Actions-jobb, legges den inn som GitHub
  secret (Settings → Secrets and variables → Actions) og brukes som
  `${{ secrets.NAVN }}` i workflow-fila.
- Lokale nøkler hører hjemme i en `.env`-fil, som git ignorerer.
- Merk: spillet kjører helt i nettleseren, så alt i `index.html` og `js/`
  er synlig for alle som spiller. En nøkkel som spillet selv trenger å bruke
  kan derfor ikke gjemmes der, heller ikke via GitHub secrets. Den må ligge
  bak en egen server eller tjeneste.

## Endringslogg

- Hver gang spillet endres, skal `ENDRINGER.md` oppdateres i samme commit.
  Ny oppføring øverst (under «Åpne punkter»), med dato, hva som ble bedt om,
  hva som ble gjort (med filnavn) og hva som er testet.
- Hold «Åpne punkter» oppdatert: fjern det som er løst, legg til nye ting
  som venter på brukeren.
- Skriv på vanlig norsk, slik at det er lett å lese uten å kunne kode.

## Lenke til spillet etter hver endring

- Etter hver endring i spillet: publiser spillsiden på nytt og legg ved
  lenken i svaret, så brukeren kan teste med en gang.
- Lenkene til spillet skal alltid stå helt sist i svaret, etter all annen
  tekst, så brukeren ikke trenger å bla opp for å finne dem.
- Øk `window.RF_VERSION` øverst i skriptet nederst i `index.html` ved hver
  endring, og nevn versjonsnummeret i svaret. Det vises på startskjermen og
  brukes i adressen til skriptfilene (`?v=…`), så ingen får gamle filer fra
  nettleserens mellomlager.
- Spillsiden er https://claude.ai/artifact/RbYcgGXBSatEDSGDCXe756 . Oppdater
  den samme siden (samme lenke) i stedet for å lage en ny.
- Når endringene er på `main` og GitHub Pages er slått på, legg også ved
  https://thurbohnek.github.io/Ringfarer/ .

## Testing: alt skal være åpent

- Ingenting i spillet skal låses (skip, moduler, droner, handel) før brukeren
  selv sier fra. «Test alt» på startskjermen gir ubegrenset med penger.

## Språk

- Alle navn og all tekst i spillet skal være på engelsk. Det gjelder alt
  spilleren ser: menyer, knapper, meldinger, hjelpetekst, navn på skip,
  skipsklasser og linjer, moduler, varer, stasjoner, systemer og oppdrag.
  Nye navn lages på engelsk fra starten, og skal ikke kopiere kjente skip
  eller merkenavn fra andre spill og filmer.
- Interne id-er i koden (for eksempel `fjell` eller `jern`) kan være norske,
  men de skal aldri vises for spilleren.
- Kommentarer i koden, `ENDRINGER.md` og svarene til brukeren er på norsk.
