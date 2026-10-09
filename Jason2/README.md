# Jason 2.0 — ostrá a testovací verze

Úvodní stránka má tři stejně velké bloky: původní Jason, Jason 2.0 a Order Sheet. Blok Jason 2.0 nabízí ostrou verzi (`Jason2/`) a samostatnou testovací verzi (`Jason2/test/`). Původní aplikace zůstávají na svých adresách.

## Sdílená data

- Stejné API jako původní Jason: `https://union-cosmetic.filipluchesi.workers.dev/api/products`, `/api/logistics`, `/api/upload-image`.
- Jediné produktové a logistické soubory zůstávají `OrderSheet/products.json` a `JSON edit GUI/logistics.json`. Ostrá verze Jason2 nevytváří další společnou databázi.
- Fotografie používají existující `OrderSheet/img/{EAN}.jpg`.
- Při otevření se načtou aktuální společná data. Návrat do okna je obnoví, pokud není otevřený formulář nebo neodeslané změny. K dispozici je i tlačítko Načíst aktuální data.
- IndexedDB obsahuje pracovní kopii a bod obnovy, aby síťová chyba neztratila práci. Uložené změny, import i obnova zálohy v ostré verzi upravují skutečná společná data.
- Před každým zápisem se porovná aktuální vzdálený obsah s načtenou verzí. Zjištěný souběžný zásah zastaví odeslání; uživatel může stáhnout zálohu a načíst aktuální data. API nemá atomické podmíněné zápisy, proto nelze zaručit ochranu při přesně současném zápisu dvou editorů.

## Bezpečné pískoviště

- `Jason2/test/` používá stejný kód rozhraní a vlastní konfiguraci, bez adresy API a bez automatického připojení.
- Výchozí snapshot `test/seed.js` obsahuje **317 produktů a 78 logistických klíčů** z repozitáře k 9. 10. 2026, commit `92d030ded71979ac28ef51f1ed242c35093b2710`. Snapshot se automaticky neobnovuje.
- Změny jsou pouze v samostatné IndexedDB `union-cosmetic-jason2-sandbox`. Ostrá pracovní kopie zůstává v `union-cosmetic-jason2`. Každý prohlížeč má vlastní pískoviště a testovací úpravy zůstanou i po obnovení stránky.
- Testovací konfigurace je neměnná. API adaptér odmítá všechny požadavky včetně GET a uploadu fotografií. Připojení, synchronizace a obnovení společných dat mají další ochranu přímo v aplikaci; nastavení ze záloh či staré pracovní kopie se nemohou přenést do připojení.
- Stránka má CSP omezující síť na vlastní statické soubory; společný Worker není povolen. Původní fotografie se jen zobrazují ze statických souborů stejného webu, nové fotografie jsou pouze v místní testovací kopii.
- Importy, obnova záloh, fotografie, vrácení změn a Excel export fungují místně. V dialogu **Testovací data** je návrat k výchozímu snapshotu po potvrzení, který vyčistí testovací úpravy, fotografie i historii vrácení.
- Ostrá a testovací verze jsou viditelně označené. Pískoviště má i informační pruh vysvětlující místní ukládání.

## Funkce

Hledání bez diakritiky, filtry, řazení, stránkování, detail produktu, kopírování, logistické klíče se sdílenými počty balení, původní příznaky i vlastní příznaky, hromadné změny, kontroly dat, fotografie, JSON zálohy, XLSX export, čeština/angličtina a vrácení změn. Neznámá pole JSON a původní typy nezměněných hodnot se zachovávají. Kontroly existující nesoulady automaticky neopravují. Duplicitní EAN se hlásí pouze mezi aktivními produkty (`discontinued !== true`); ukončená varianta může mít stejný EAN jako její náhrada. Odlišná cena není výjimkou z kontroly.

Statická aplikace bez sestavení a bez nových služeb. Rozhraní používá modré barvy a originální logo Union Cosmetic. Excel export používá lokálně uložený ExcelJS 4.3.0 (stejná verze jako původní Jason) s barevnými záhlavími, rámečky, zamknutými řádky a nastavením tisku. Logistika zachovává původní matici a bloky ITEM / CARTON / LAYER / PALLET, včetně jednotek cm a kg; produktový export vyváží zaškrtnuté položky (i napříč stránkami), a pokud není žádný výběr, používá aktuální filtry. Zachovává textové identifikátory a číselné ceny. Stav produktu je Aktivní (zelená) nebo Ukončeno (tlumená červená). Novinka je nezávislý modrý příznak navíc; v tabulce nenahrazuje stav. Samostatný filtr Novinka (Všechny / Ano / Ne) lze kombinovat se stavem i ostatními filtry. Původní datová pole `new` a `discontinued` se nemění. Vendorizovaná knihovna má upravené přiřazení `regeneratorRuntime` přes `globalThis`, aby fungovala bez dynamického vyhodnocování kódu i pod CSP pískoviště. Licence závislosti je v `vendor/exceljs-LICENSE`. Firemní logo pochází z https://www.unioncosmetic.cz/data/filecache/96/logo.png.

## Ověření

Node 24+: `npm install`, `npm test`. Testy prověřují model, uživatelské postupy v simulovaném DOM a API adaptér s testovacími odpověďmi; nemění produkční data. Živý web je zvlášť zkontrolován v prohlížeči bez ukládání změn do katalogu.


V detailu produktu na záložce Balení a logistika se zobrazují všechny standardní údaje přiřazeného klíče (ITEM / CARTON / LAYER / PALLET). Samostatný detail klíče se otevře nad formulářem a zachová jeho rozpracované změny. Excel lze stáhnout přímo ze záložky i z tohoto detailu; obsahuje pouze aktuálně přiřazený klíč ve stejné formátované matici jako hlavní logistický export. Zobrazení a export klíče nic neukládají.

Počty balení se v detailu produktu zobrazují pouze v přehledu klíče; nemají samostatné editační vstupy. Změna přiřazení při uložení doplní počty z klíče. Ostatní úpravy produktu zachovávají původní hodnoty `pack`, `boxes_per_layer` a `boxes_per_pallet`, včetně historických nesouladů.

Logistický Excel má jednotnou světle modrou výplň všech bloků. Nadpis LOGISTICS DATA je sloučený pouze v A1:B1, menším písmem 13 pt; název značky je jen na listu. Ukotvení prvních dvou sloupců a řádků tak neprochází textem nadpisu.
