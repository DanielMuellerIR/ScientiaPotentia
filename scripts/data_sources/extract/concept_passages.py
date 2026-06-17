#!/usr/bin/env python3
"""Phase-1-Treffer-Finder (deterministisch, 0 LLM).

Findet Namen BESTEHENDER Konzepte einer Domain im Volltext der lokalen Sachbücher
und schreibt Passagen + Seitenzahl je Konzept -> ~/.cache/scientia_extract/passages_<domain>.json.
Diese Passagen sind das Futter für die Sonnet-Enrichment-Agenten (belegter funFact je Konzept).

Aufruf:  concept_passages.py <domain> [maxHitsProKonzept]
"""
import sys, os, re, json, glob, bisect

HOME = os.path.expanduser("~")
CACHE = os.path.join(HOME, ".cache", "scientia_extract")
REPO = os.path.join(HOME, "git", "ScientiaPotentia")

domain = sys.argv[1]
MAXHITS = int(sys.argv[2]) if len(sys.argv) > 2 else 3

concepts_path = os.path.join(REPO, "public", "data", f"concepts_{domain}.json")
data = json.load(open(concepts_path, encoding="utf-8"))
items = list(data.values()) if isinstance(data, dict) else data
concepts = [(c.get("name", ""), c.get("category", "")) for c in items if c.get("name")]

# Buchtexte laden + Seiten-Offsets indizieren
books = {}
for txt in glob.glob(os.path.join(CACHE, "*.txt")):
    t = open(txt, encoding="utf-8", errors="ignore").read()
    offs, pages = [], []
    for m in re.finditer(r"===== Seite (\d+) =====", t):
        offs.append(m.start()); pages.append(int(m.group(1)))
    books[os.path.basename(txt)] = (t, offs, pages)

def page_of(offs, pages, pos):
    i = bisect.bisect_right(offs, pos) - 1
    return pages[i] if i >= 0 else None

out, found = [], 0
for name, cat in concepts:
    if len(name) < 4:
        continue
    pat = re.compile(r"\b" + r"\s+".join(re.escape(w) for w in name.split()) + r"\b", re.IGNORECASE)
    hits = []
    for bname, (t, offs, pages) in books.items():
        for m in pat.finditer(t):
            a, b = max(0, m.start() - 320), m.end() + 320
            passage = re.sub(r"\s+", " ", t[a:b]).strip()
            hits.append({"book": bname, "page": page_of(offs, pages, m.start()), "passage": passage})
            if len(hits) >= MAXHITS:
                break
        if len(hits) >= MAXHITS:
            break
    if hits:
        out.append({"concept": name, "category": cat, "hits": hits})
        found += 1

outpath = os.path.join(CACHE, f"passages_{domain}.json")
json.dump(out, open(outpath, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"{domain}: {found}/{len(concepts)} bestehende Konzepte in den Büchern gefunden -> {outpath}")
# kleine Vorschau
for o in out[:8]:
    print(f"  • {o['concept']} ({o['category']}) — {o['hits'][0]['book'][:30]} S.{o['hits'][0]['page']}")
