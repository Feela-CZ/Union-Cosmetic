#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re
import pandas as pd
import requests
from bs4 import BeautifulSoup

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
HEADERS = {"User-Agent": UA}

SEARCH_URL = "https://www.union-cosmetic.cz/vysledky-vyhledavani?q={ean}"

# regex pro získání URL produktu z datalayeru
PRODUCT_URL_RE = re.compile(r'"productUrl"\s*:\s*"([^"]+)"')


def fetch(url: str) -> str:
    """Stáhne HTML s nastavenými hlavičkami."""
    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        r.raise_for_status()
        if not r.encoding or r.encoding.lower() == "iso-8859-1":
            r.encoding = r.apparent_encoding or "utf-8"
        return r.text
    except Exception as e:
        print(f"[HTTP] error fetching {url}: {e}")
        return ""


def find_product_url(ean: str) -> str:
    """Najde URL detailu produktu z výsledků vyhledávání (z dataLayer JSONu)."""
    search_page = fetch(SEARCH_URL.format(ean=ean))
    if not search_page:
        return ""
    m = PRODUCT_URL_RE.search(search_page)
    if m:
        return m.group(1).replace("\\/", "/")
    return ""


def extract_inci(html: str) -> str:
    """Najde INCI: hledá první element obsahující 'Aqua,'."""
    soup = BeautifulSoup(html, "html.parser")

    for elem in soup.find_all(["p", "div", "span"]):
        txt = elem.get_text(" ", strip=True)
        if "Aqua," in txt:
            return txt.strip()

    return ""


def main():
    inp = "EANs.xlsx"
    outp = "EANs_inci.xlsx"

    df = pd.read_excel(inp)
    if "EAN" not in df.columns:
        raise SystemExit(f"Chybí sloupec 'EAN'. Sloupce: {list(df.columns)}")

    # RESUME
    done = {}
    if os.path.exists(outp):
        try:
            old = pd.read_excel(outp)
            for _, r in old.iterrows():
                e = str(r["EAN"]).strip()
                done[e] = {"EAN": e, "URL": r.get("URL", ""), "INCI": r.get("INCI", "")}
            print(f"[resume] {len(done)} řádků už hotovo – přeskočím je.")
        except Exception:
            pass

    results = list(done.values())
    total = len(df)

    for i, row in df.iterrows():
        ean = str(row["EAN"]).strip()
        if not ean or ean.lower() in {"nan", "none"}:
            continue
        if ean in done:
            continue

        print(f"{i+1}/{total}: {ean}")

        url = find_product_url(ean)
        print(f"   URL: {url}")
        inci = ""
        if url:
            html = fetch(url)
            if html:
                if i == 0:
                    with open("debug_product.html", "w", encoding="utf-8") as f:
                        f.write(html)
                    print("   [debug] uložen první produkt → debug_product.html")

                inci = extract_inci(html).strip()

        if inci:
            print(f"   INCI: { (inci[:100] + '…') if len(inci) > 100 else inci }")
        else:
            print("   INCI: [nenalezeno]")

        results.append({"EAN": ean, "URL": url or "", "INCI": inci})
        pd.DataFrame(results).to_excel(outp, index=False)

    print(f"[OK] Hotovo → {outp}")


if __name__ == "__main__":
    main()
