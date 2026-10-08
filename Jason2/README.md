# Jason 2.0 — testovací verze

Třetí volba na úvodní stránce Union Cosmetic. Původní Jason a OrderSheet zůstávají na původních adresách.

## Sdílená data

- Stejné API jako původní Jason: `https://union-cosmetic.filipluchesi.workers.dev/api/products`, `/api/logistics`, `/api/upload-image`.
- Jediné produktové a logistické soubory zůstávají `OrderSheet/products.json` a `JSON edit GUI/logistics.json`. Jason2 nevytváří další databázi.
- Fotografie používají existující `OrderSheet/img/{EAN}.jpg`.
- Při otevření se načtou aktuální společná data. Návrat do okna je obnoví, pokud není otevřený formulář nebo neodeslané změny. K dispozici je i tlačítko Načíst aktuální data.
- IndexedDB obsahuje pracovní kopii a bod obnovy, aby síťová chyba neztratila práci. Uložené změny, import i obnova zálohy v této testovací verzi upravují skutečná společná data.
- Před každým zápisem se porovná aktuální vzdálený obsah s načtenou verzí. Zjištěný souběžný zásah zastaví odeslání; uživatel může stáhnout zálohu a načíst aktuální data. API nemá atomické podmíněné zápisy, proto nelze zaručit ochranu při přesně současném zápisu dvou editorů.

## Funkce

Hledání bez diakritiky, filtry, řazení, stránkování, detail produktu, kopírování, logistické klíče se sdílenými počty balení, původní příznaky i vlastní příznaky, hromadné změny, kontroly dat, fotografie, JSON zálohy, XLSX export, čeština/angličtina a vrácení změn. Neznámá pole JSON a původní typy nezměněných hodnot se zachovávají. Kontroly existující nesoulady automaticky neopravují. Duplicitní EAN se hlásí pouze mezi aktivními produkty (`discontinued !== true`); ukončená varianta může mít stejný EAN jako její náhrada. Odlišná cena není výjimkou z kontroly.

Statická aplikace bez sestavení a bez nových služeb. Rozhraní používá modré barvy a originální logo Union Cosmetic. Excel export používá lokálně uložený ExcelJS 4.3.0 (stejná verze jako původní Jason) s barevnými záhlavími, rámečky, zamknutými řádky a nastavením tisku. Logistika zachovává původní matici a bloky ITEM / CARTON / LAYER / PALLET, včetně jednotek cm a kg; produktový export zachovává filtry, textové identifikátory a číselné ceny. Licence závislosti je v `vendor/exceljs-LICENSE`. Firemní logo pochází z https://www.unioncosmetic.cz/data/filecache/96/logo.png.

## Ověření

Node 24+: `npm install`, `npm test`. Testy prověřují model, uživatelské postupy v simulovaném DOM a API adaptér s testovacími odpověďmi; nemění produkční data. Živý web je zvlášť zkontrolován v prohlížeči bez ukládání změn do katalogu.

