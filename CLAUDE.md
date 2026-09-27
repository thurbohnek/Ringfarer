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
