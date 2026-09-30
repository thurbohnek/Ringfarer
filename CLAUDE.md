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

## Nyheter for spillerne

- Hver oppdatering får en kort oppføring øverst i `RF.NEWS` i `js/news.js`,
  på engelsk og skrevet for den som spiller (3–5 korte punkter). `v` skal
  være lik første del av `RF_VERSION` i `index.html`.
- Spillet viser nyhetene på tittelskjermen første gang det startes etter en
  oppdatering, og et lite varsel i hjørnet når en ny versjon er lagt ut.

## Svarformat

- Rett over lenkene til spillet (som står helt sist) skal hvert svar ha en
  markert kopi av brukerens siste melding (sitatblokk med overskriften
  «Siste melding fra deg»), så brukeren ser hva forrige forespørsel var.
- Planen i `PLAN.md` vises i hvert svar som en meny som kan foldes ut og inn
  (`<details>` med `<summary>`), rett over statuslinjen. Nummerert etter
  prioritet. Ferdige punkter strykes over (`~~tekst~~`) både i menyen og i
  `PLAN.md`, med versjonen de kom i. Nye forslag legges til nederst.
- Nederst i hvert svar (rett over sitatet og lenkene) skal det stå en tydelig
  statuslinje for versjonene: 🟢 for versjonen som er pushet og publisert,
  og 🔴 for en versjon som ligger i koden, men ikke er pushet ennå (med
  grunnen). Er alt pushet, står bare den grønne linjen.

## Arbeidsflyt

- Når en endring er ferdig og testet, skal den pushes (arbeidsgrenen og
  `main`) og publiseres uten at brukeren må be om det eller skrive
  «fortsett». Blir arbeidet avbrutt, fortsett og push så snart det går.
