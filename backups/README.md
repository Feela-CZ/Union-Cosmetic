# Denní zálohy Jason

Automatická archivace společných dat probíhá každý den kolem **23:45 v časovém pásmu Europe/Prague**, včetně víkendů. Letní a zimní čas se zohledňuje automaticky. GitHub může plánovaný běh při vytížení odložit.

- **Denní zálohy:** `backups/daily/RRRR/MM/RRRR-MM-DD.json`.
- **Ruční a úvodní zálohy:** `backups/manual/RRRR-MM-DD/HHMMSSZ-ID.json`.
- Zálohu vytvoří GitHub Actions **Daily Jason data backup**. V záložce Actions lze kdykoli použít **Run workflow** na větvi `main`.
- **Uchovávání: 30 kalendářních dní**, včetně data právě vytvořené zálohy. Denní soubor se nepřepisuje; ruční běhy mají vlastní názvy. Starší denní i ruční soubory se automaticky odstraňují až po vytvoření a ověření nové zálohy. Pokud zálohování selže, úklid neproběhne.
- Produkty a logistické klíče pocházejí z **jednoho přesně určeného commitu**, takže souběžná úprava mezi čtením souborů nemůže namíchat dvě verze.
- Archivace a úklid mění pouze rozpoznané soubory záloh v `backups/daily/` a `backups/manual/`. Nikdy nepřepisují živý katalog, logistiku, fotografie ani tento návod. Souběžné změny zachovají a nepoužívají force push.

Odstranění souborů udržuje přehlednou aktuální složku záloh. **Git stále uchovává starší commity a jejich obsah**, takže se tím nezmenšuje historie repozitáře. Fotografie se do denních záloh nekopírují; při současné velikosti dat má jedna záloha přibližně 200 kB a 30 denních záloh přibližně 6 MB (ruční zálohy navíc). Historie se automaticky nepřepisuje.

## Obnova produktů a logistiky

1. Nejdřív v ostrém Jasonu přes **Data a připojení → Stáhnout úplnou zálohu** uschovejte aktuální data.
2. Otevřete požadovaný denní soubor na GitHubu a stáhněte jeho JSON přes **Raw / Download raw file**.
3. V Jasonu vyberte **Data a připojení → Obnovit zálohu Jason**, nahrajte JSON a potvrďte nahrazení. V ostré verzi se obnova po potvrzení odešle do společných dat a projeví se i v původním Jasonu a Order Sheet.
4. Pro bezpečné ověření lze stejný soubor nejprve načíst v testovací verzi; tam se nic do společných dat neodešle.

Záloha obsahuje všechny produktové údaje a logistické klíče v nativním formátu `jason-backup`, bez změny jejich obsahu. Vypočtené údaje z přehledu se znovu odvodí z klíčů. Pískoviště ani neodeslané úpravy v jednotlivých prohlížečích nejsou součástí společné zálohy.

## Fotografie

Fotografie již mají verze v GitHubu. Aby se každý den zbytečně nekopírovaly stovky MB, JSON zaznamená `source.commit` a cestu `OrderSheet/img`; obrázky z daného okamžiku zůstávají dostupné v tomto commitu. Běžná obnova JSON fotografie nemění. Pokud je třeba vrátit také fotografie, obnoví se složka `OrderSheet/img` z uvedeného commitu samostatně.

## Ověření běhů

Úspěšný běh má zelenou značku v **Actions → Daily Jason data backup** a ve shrnutí uvádí cestu zálohy i zdrojový commit. Při chybě se neplatná nebo náhradní stará data nearchivují. Pro kontrolu vytváření existuje také denní úkol v ChatGPT, který ověří dnešní zálohu a při chybějícím souboru vytvoří stejný archiv přes GitHub konektor. Vyžaduje zachované připojení GitHubu k ChatGPT; běžné zálohování GitHub Actions na něm nezávisí.

