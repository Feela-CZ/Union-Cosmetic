import json
import pandas as pd
import time
import requests
from bs4 import BeautifulSoup
import re
from googlesearch import search

INPUT_JSON = "products.json"
OUTPUT_XLSX = "products_translated.xlsx"
SLEEP_TIME = 8  # delší pauza, aby se Google hned nezlobil

def clean_name(name: str) -> str:
    """Odstraní hodnoty + jednotky (350 ml, 100 g, 5 ks...) na konci názvu."""
    if not name:
        return name
    return re.sub(r"\s*\d+\s?(ml|g|kg|l|L|ks|pc)$", "", name.strip())

# Načti všechny produkty
with open(INPUT_JSON, "r", encoding="utf-8") as f:
    products = json.load(f)

# Zjisti, jestli už existuje výstupní Excel → a načti hotové řádky
done_eans = set()
rows = []
try:
    existing = pd.read_excel(OUTPUT_XLSX)
    done_eans = set(existing["EAN"].astype(str))
    rows = existing.to_dict("records")
    print(f"Načteno {len(done_eans)} již hotových řádků, budu pokračovat dál...")
except FileNotFoundError:
    print("Excel zatím neexistuje, začínám od nuly.")

for i, p in enumerate(products, 1):
    ean = str(p.get("id"))
    en_name = p.get("name")

    # pokud už máme hotovo → přeskoč
    if ean in done_eans:
        continue

    cz_name = ""
    try:
        query = f"site:union-cosmetic.cz {ean}"
        results = list(search(query, num_results=1))
        if results:
            url = results[0]
            r = requests.get(url, timeout=10)
            soup = BeautifulSoup(r.text, "html.parser")
            h1 = soup.find("h1", {"class": "product__title"})
            if h1:
                cz_name = clean_name(h1.get_text(strip=True))
            else:
                print(f"!!! Nenalezen název pro {ean} ({url})")
        else:
            print(f"!!! Google nenašel žádný výsledek pro {ean}")

    except Exception as e:
        print(f"Chyba u {ean}: {e}")

    rows.append({"EAN": ean, "EN_name": en_name, "CZ_name": cz_name})
    print(f"[{i}/{len(products)}] {ean} -> {cz_name}")

    # ulož průběžně po každém (abys nikdy nic neztratil)
    pd.DataFrame(rows).to_excel(OUTPUT_XLSX, index=False)

    time.sleep(SLEEP_TIME)

print(f"\nHotovo! Soubor uložen jako {OUTPUT_XLSX}")
