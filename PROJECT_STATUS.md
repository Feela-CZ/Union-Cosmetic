# Projektový přehled / Project status

Poslední aktualizace: 2026-11-25
Zdroj výchozího přehledu: soubory a dokumentace ve větvi `main`.  
Tento soubor je společný předávací bod pro Codex, ChatGPT a lidi pracující na repozitáři. Není náhradou za zdrojový kód, testy ani historii Git.

## Mapa aplikací

| Projekt | Umístění | Stav podle dostupné dokumentace |
| --- | --- | --- |
| Jason 2.0 | [Jason2/](Jason2/) | Ostrá aplikace pro správu produktů a logistiky; produktové informace, etikety, PPWR, fotografie, kontroly, zálohy a XLSX export. |
| Jason 2.0 – pískoviště | [Jason2/test/](Jason2/test/) | Izolovaná testovací verze, lokální IndexedDB, bez přístupu k produkčnímu API. |
| Původní Jason / JSON editor | [JSON edit GUI/](JSON%20edit%20GUI/) | Původní rozhraní ponechané na existující adrese; součást sdíleného datového modelu. |
| Order Sheet | [OrderSheet/](OrderSheet/) | Samostatná aplikace pro objednávkové formuláře, sdílený produktový katalog. |
| Katalog 2026 | [Katalog/](Katalog/) | Statický listovací katalog; desktopové dvojstrany, mobilní jednotlivé strany a produktové odkazy. |
| Rozcestník | [index.html](index.html) | Vstupní stránka aplikací. |
| Sdílené funkce a automatizace | [shared/](shared/), [functions/](functions/), [.github/](.github/) | Společné pomocné moduly, API funkce a repozitářové automatizace. |

Podrobná dokumentace: [Jason 2.0](Jason2/README.md), [Katalog](Katalog/README.txt).

## Dlouhodobá technická pravidla

- Zachovat jeden zdroj produkčních dat: `OrderSheet/products.json` a `JSON edit GUI/logistics.json`; fotografie a přílohy jsou v `OrderSheet/img/`.
- Pískoviště Jason2 musí zůstat oddělené od produkčního API a produkčního úložiště.
- Při změnách společného modelu ověřit dopady na všechny dotčené aplikace, zachování neznámých polí a kompatibilitu importů, exportů i záloh.
- Produkční data, přílohy, zálohy a infrastrukturu neměnit pouze kvůli aktualizaci dokumentace.
- Výchozí kontrola Jason2: Node.js 24+, `npm install` a `npm test` v `Jason2/`. Výsledky uvádět jen tehdy, pokud byly skutečně získány.

## Rozpracované úkoly

Další rozpracované úkoly zatím nejsou zmapované. Výchozí přehled byl založen z repozitáře; necommitované změny, běžící úlohy a obsah konverzací v Codexu nebyly dostupné. Nevydávat absenci záznamu za důkaz, že žádná práce neprobíhá.

| Projekt | Úkol / další krok | Stav | Větev, PR nebo commit | Aktualizace |
| --- | --- | --- | --- | --- |
| — | Doplnit skutečný stav při prvním předání z Codexu | K ověření | — | 2026-11-24 |
| Jason 2.0 – pískoviště | Privátní projekty, šablony obalů a přílohy | Druhá verze k vyzkoušení | [Pískoviště](https://feela-cz.github.io/Union-Cosmetic/Jason2/test/#projects) | 2026-11-25 |

## Otevřené problémy a rozhodnutí

Zaznamenávat pouze doložené technické problémy a rozhodnutí s dopadem na další práci. Výchozí seznam nebyl ověřen jako úplný.

## Poslední předání

- **2026-11-25 – Codex:** Privátní projekty mají místo fáze procento vyplnění podle povinných údajů. Detail obsahuje zákazníka, výrobek a místní přílohy. Vlastní kategorie jsou dostupné v dalších projektech stejného prohlížeče. Ověřeno v automatických testech i v Chromium včetně starších záznamů a stažení původních souborů.
- **2026-11-25 – Codex:** Privátní projekty mají vlastní seznam, detail v češtině a angličtině, tisk a stažitelný HTML přehled. Projekty zůstávají v místní IndexedDB pískoviště. Automatické testy ověřují uložení, přepínání šablon a izolaci od katalogu a API.
- **2026-11-24 – ChatGPT:** Založen společný projektový přehled podle aktuálně dostupné dokumentace v `main`. Žádná změna aplikací ani produkčních dat. Prvotní stav rozpracovaných úloh musí doplnit Codex nebo osoba, která k nim má přístup.

## Jak udržovat přehled

Po významné změně aktualizovat příslušný řádek, rozpracované úkoly, relevantní rozhodnutí a krátké poslední předání. Uvádět datum, autora (Codex/ChatGPT/člověk), projekt, co se změnilo, stav ověření a odkaz na větev/PR/commit, pokud existuje. Rozlišovat rozpracováno, commitnuto, sloučeno, nasazeno a ověřeno; jedno automaticky neznamená druhé. Odstranit vyřešené úkoly z aktivního seznamu, historii ponechat v Gitu. Neopisovat podrobnou dokumentaci do tohoto souboru.

Repozitář je veřejný: nezapisovat citlivé interní plány, údaje o zákaznících, obchodní podmínky, osobní údaje, přihlašovací údaje ani neveřejnou komunikaci.
