#!/usr/bin/env python3
"""
Import ponctuel : notices Word (converties en Markdown par pandoc --wrap=none)
-> un fichier YAML par œuvre dans data/works/.

Usage :
  pandoc CAT_LIVRE1.docx -t markdown --wrap=none -o tools/L1.nw.md
  python3 tools/import_docx.py tools/L1.nw.md:1 tools/L2.nw.md:2

Le script est un outil de migration : une fois les données importées,
on édite directement les fichiers YAML (ou on régénère depuis Word tant
que la rédaction se poursuit dans Word).
"""
import re, sys, os, unicodedata, yaml
from collections import OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "works")

MONTHS = {
    "janvier": 1, "janv": 1, "février": 2, "fevrier": 2, "mars": 3, "avril": 4, "avr": 4,
    "mai": 5, "juin": 6, "juillet": 7, "août": 8, "aout": 8, "septembre": 9, "sept": 9,
    "octobre": 10, "oct": 10, "novembre": 11, "nov": 11, "décembre": 12, "déc": 12, "dec": 12,
}
MONTH_RE = r"(?:janvier|février|mars|avril|avr\.|mai|juin|juillet|août|septembre|octobre|novembre|décembre|déc\.|janv\.|sept\.|oct\.|nov\.)"

# ---------------------------------------------------------------- texte
def clean(s):
    """Markdown pandoc -> markdown léger (*ital*, **gras**, ^exp^)."""
    s = s.replace("\\[", "[").replace("\\]", "]").replace("\\|", "|").replace("\\*", "*")
    s = s.replace("\\'", "'").replace("\\...", "…").replace("\\.", ".").replace("\\-", "-")
    s = s.replace("\\\"", '"').replace("\\~", "~")
    s = re.sub(r"\\$", "", s)
    s = s.replace(" -- ", " – ").replace("--", "–")
    s = s.replace(" ", " ")
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()

def plain(s):
    s = re.sub(r"\^([^^]*)\^", r"\1", s)
    return s.replace("*", "").strip()

def slugify(s):
    s = plain(s)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s

# ---------------------------------------------------------------- dates
def parse_point(txt):
    """'12 mai' -> (None, 5, 12); '1974' -> (1974, None, None)."""
    t = re.sub(r"([a-zéû])(\d)", r"\1 \2", plain(txt).lower())
    t = re.sub(r"\b(\d{1,2})\s*(?:er)\b", r"\1", t)
    y = m = d = None
    my = re.search(r"\b(1[89]\d\d|20\d\d)\b", t)
    if my: y = int(my.group(1))
    mm = re.search(r"\b(" + "|".join(sorted(MONTHS, key=len, reverse=True)) + r")\.?\b", t)
    if mm: m = MONTHS[mm.group(1)]
    md = re.search(r"\b(\d{1,2})\s+(?=" + "|".join(MONTHS) + ")", t)
    if md: d = int(md.group(1))
    return (y, m, d)

def iso(p):
    y, m, d = p
    if not y: return None
    s = f"{y:04d}"
    if m: s += f"-{m:02d}"
    if m and d: s += f"-{d:02d}"
    return s

def parse_range(txt):
    """Renvoie (début, fin) ISO partiels ou (None, None)."""
    t = plain(txt)
    parts = re.split(r"\s+[–-]\s+|\s*–\s*", t)
    if len(parts) == 1:
        p = parse_point(t)
        return iso(p), None
    a, b = parse_point(parts[0]), parse_point(parts[-1])
    if re.fullmatch(r"\d{1,2}", parts[0].strip()): a = (None, None, int(parts[0]))
    ay, am, ad = a; by, bm, bd = b
    if ay is None: ay = by
    if am is None and ad is not None: am = bm
    return iso((ay, am, ad)), iso((by, bm, bd))

def find_date(txt):
    """Cherche la première date dans un texte libre ; renvoie (iso, span) ou (None, None)."""
    t = txt
    r = re.search(r"(\d{1,2}(?:\^?er\^?)?\s+)?" + MONTH_RE + r"\s+(\d{4})", t)
    if r:
        return iso(parse_point(r.group(0))), r.span()
    r = re.search(r"\b(19\d\d|20\d\d)\b", t)
    if r:
        return r.group(1), r.span()
    return None, None

# ---------------------------------------------------------------- personnes
AUTHOR = "Olivier Greif"
def split_performers(s, prev):
    """'par X (violon) et l'auteur (piano)' -> liste [{name, role}]."""
    s = s.strip().rstrip(".").strip()
    s = re.sub(r"^(?:,\s*)?par\s+", "", s)
    if re.match(r"^(?:les mêmes|le même|la même) interprète", s):
        return [dict(p) for p in prev], True
    if re.match(r"^l'auteur au piano$", s):
        return [{"name": AUTHOR, "role": "piano"}], False
    ensemble = None
    if " : " in s:
        ensemble, s = s.split(" : ", 1)
        ensemble = re.sub(r"^l'(?=[A-ZÉ])", "", re.sub(r"^par\s+", "", ensemble)).strip()
    # découpe hors parenthèses
    toks, depth, cur = [], 0, ""
    i = 0
    while i < len(s):
        c = s[i]
        if c == "(": depth += 1
        if c == ")": depth -= 1
        if depth == 0 and c == ",":
            toks.append(cur); cur = ""; i += 1; continue
        if depth == 0 and s[i:i+4] == " et ":
            toks.append(cur); cur = ""; i += 4; continue
        cur += c; i += 1
    toks.append(cur)
    out = []
    for t in [x.strip() for x in toks if x.strip()]:
        m = re.match(r"^(.*?)\s*\(([^)]*)\)\s*$", t)
        if m:
            name, role = m.group(1).strip(), m.group(2).strip()
        else:
            name, role = t, None
        name = re.sub(r"^l'auteur$", AUTHOR, name)
        if name and name == name.lower() and out:
            if out[-1]["role"] is None:            # « D. Frost, percussion »
                out[-1]["role"] = name; continue
            out.append({"name": "[?]", "role": name.rstrip(" ?") + " ?" if "?" in name else name}); continue
        name = re.sub(r"^l'(?=[A-ZÉ])", "", name)
        alias = None
        ma = re.match(r"^(.*?)\s*«\s*(.*?)\s*»$", name)
        if ma: name, alias = ma.group(1), ma.group(2)
        p = {"name": name, "role": role}
        if alias: p["alias"] = alias
        out.append(p)
    # rôle partagé : « Jacques Dumont, Louis Perlemuter (violons) »
    for i in range(len(out) - 1, -1, -1):
        if out[i]["role"] is None and i + 1 < len(out):
            out[i]["role"] = out[i + 1]["role"]
    if ensemble:
        out.insert(0, {"name": ensemble, "role": "ensemble"})
    for p in out:
        if p.get("role") is None: p.pop("role")
    return out, False

COUNTRIES = {"Italie", "Suisse", "Japon", "Belgique", "Allemagne", "Gabon", "République Tchèque",
             "États-Unis", "Ukraine", "Biélorussie"}

def parse_performance(txt, prev):
    raw = clean(txt)
    t = raw
    note = None
    mnote = re.search(r"\s*\(([^()]*\?)\)\s*$", t)
    if mnote:
        note = mnote.group(1); t = t[:mnote.start()]
    perf = OrderedDict()
    date, span = find_date(t)
    if span:
        place = t[:span[0]].strip().rstrip(",").strip()
        rest = t[span[1]:].strip()
    else:
        place, rest = t, ""
    place = place.replace("(date ?)", "").strip().rstrip(",").strip()
    place = place.strip("[]")
    if date: perf["date"] = date
    if place:
        perf["place"] = place
        segs = [x.strip() for x in place.split(",")]
        if segs[0] in COUNTRIES and len(segs) > 1:
            perf["country"], perf["city"] = segs[0], segs[1]
        else:
            perf["city"] = segs[0]
    performers, same = ([], False)
    if rest:
        r = rest.lstrip(",").strip()
        r = r.lstrip("]").strip().lstrip(",").strip()
        performers, same = split_performers(r, prev)
    elif "l'auteur au piano" in raw:
        performers = [{"name": AUTHOR, "role": "piano"}]
    if performers: perf["performers"] = performers
    perf["text"] = raw
    return perf, note

# ---------------------------------------------------------------- en-tête
HEAD_RE = re.compile(r"^\*\*Th\s*(\d+[a-z]?)\s*--\s*(.*)\*\*\s*$")
def parse_head(line):
    m = HEAD_RE.match(line)
    if not m: return None
    th, rest = m.group(1), m.group(2)
    rest = rest.replace("*", "")
    opus = None
    mo = re.search(r",?\s*(op\.\s*(\d+)|sans opus)\s*$", rest)
    if mo:
        opus = mo.group(2)
        rest = rest[:mo.start()]
    rest = rest.strip().rstrip(",").strip()
    sub = None
    ms = re.search(r"«\s*(.*?)\s*»", rest)
    if ms:
        sub = ms.group(1)
        rest = (rest[:ms.start()] + rest[ms.end():]).strip().rstrip(",").strip()
    title = clean(rest)
    title = re.sub(r"\^(\w+)\^", r"^\1^", title)
    return {"th": th, "title": title, "subtitle": clean(sub) if sub else None,
            "opus": opus}

# ---------------------------------------------------------------- champs
LABELS = {
    "date de composition": "composition", "composition": "composition",
    "source manuscrite": "sources", "sources manuscrites": "sources",
    "source sonore": "audio_source",
    "bibliographie": "bibliography", "bibliographi": "bibliography",
    "remarque": "remarks", "remarques": "remarks",
    "carnet de bord": "journal", "inédit": "unpublished", "inédit ?": "unpublished?",
    "création": "premiere", "création radiophonique": "premiere_radio",
    "création discographique": "premiere_recording",
    "durée": "duration", "durées": "duration",
    "poème": "text", "poèmes": "text", "poème :": "text",
    "exécution": "performances", "exécutions": "performances",
    "édition": "edition", "dédicace": "dedication", "dédicaces": "dedication",
    "documents": "documents", "document": "documents",
    "vidéographie": "videography", "discographie": "discography", "discographi": "discography",
    "ajouts intertextuels": "intertextual",
}
FIELD_RE = re.compile(r"^\*\*([^*]+?)\s*\*\*\s*(e?)\s*:?\s*(.*)$")

def field_of(par):
    m = FIELD_RE.match(par)
    if not m: return None
    lab = m.group(1).strip().rstrip(":").strip().lower()
    if lab in LABELS:
        return LABELS[lab], m.group(3).strip()
    return None

# notes de travail détectées dans le texte -> notes de rédaction
TODO_PATTERNS = [
    r"\(Reproduction de l'intégralité des poèmes \?\)",
    r"Décrire la suite du ms\.", r"Décrire le manuscrit", r"À revoir avec le manuscrit !",
    r"Autre à dire \?", r"À continuer\.\.\.", r"À continuer…", r"Ajouter \?",
    r"\(Obtention du scan[^)]*\)", r"\(retrouver le manuscrit[^)]*\)",
    r"\(Indiqué en 1966[^)]*\)", r"\(Fichier audio[^)]*\)",
]
def extract_todos(text, todos):
    for p in TODO_PATTERNS:
        for m in re.finditer(p, text):
            todos.append(m.group(0).strip("() "))
        text = re.sub(r"\s*" + p, "", text)
    return text.strip()

# ---------------------------------------------------------------- mouvements
def parse_movements(pars):
    toks = []
    for p in pars:
        c = clean(p)
        if re.match(r"^\[(\d+ )?INCIPIT(\(S\))?( \?)?\]( \?)?$", c):
            toks.append(("inc", c))
        elif re.match(r"^\[?(\d+|\?|…|\.\.\.)\s*mes\.\]?$", c.replace(" ", " ")) or re.match(r"^(\.\.\.|…)\s*mes\.$", c):
            n = re.match(r"^\[?(\d+)", c)
            toks.append(("bars", int(n.group(1)) if n else None))
        elif re.match(r"^\*[^*].*\*$", c) and not c.startswith("**"):
            toks.append(("ital", c.strip("*").strip()))
        else:
            toks.append(("title", c))
    movs, pending_title, effectif_note = [], None, None
    n_inc = sum(1 for t in toks if t[0] == "inc")
    # bloc final d'incipits littéraires (cas Wiener Konzert)
    trailing = []
    while toks and toks[-1][0] == "ital":
        trailing.insert(0, toks.pop()[1])
    for kind, val in toks:
        if kind == "title":
            pending_title = val
        elif kind == "inc":
            m = OrderedDict()
            if pending_title: m["title"] = pending_title
            if "23 INCIPIT" in val: m["incipit_count"] = 23
            movs.append(m); pending_title = None
        elif kind == "bars":
            if not movs: movs.append(OrderedDict())
            if val is not None: movs[-1]["bars"] = val
        elif kind == "ital":
            if not movs: movs.append(OrderedDict())
            movs[-1]["text_incipit"] = val
    if pending_title and not movs:
        effectif_note = pending_title
    if len(movs) == 1 and "title" in movs[0] and n_inc == 1:
        effectif_note = movs[0].pop("title")
    if trailing:
        if len(trailing) == len(movs) and len(movs) > 1:
            for m, t in zip(movs, trailing): m["text_incipit"] = t
        elif movs:
            movs[-1]["text_incipit"] = trailing[0]
    for m in movs:
        if "title" in m:
            m["title"] = m["title"]
    return movs, effectif_note

# ---------------------------------------------------------------- source
def parse_sources(first, more):
    src = OrderedDict()
    t = clean(first)
    if re.match(r"^non localisée", t, re.I): src["status"] = "not_located"; t = t[len("non localisée"):].strip(" .")
    elif re.match(r"^perdue", t, re.I): src["status"] = "lost"; t = t[len("perdue"):].strip(" .")
    else: src["status"] = "located"
    m = re.match(r"^(F[- ]P\w+)\.?\s*", t)
    if m:
        src["siglum"] = m.group(1).replace(" ", "-")
        t = t[m.end():]
    if t: src["intro"] = t
    items = []
    for p in more:
        c = clean(p)
        lab = None
        mm = re.match(r"^\*\*([^*]+)\*\*\s*(.*)$", c)
        if mm:
            lab, c = mm.group(1).strip(), mm.group(2)
        else:
            mm = re.match(r"^(\d+\))\s*(.*)$", c)
            if mm: lab, c = mm.group(1), mm.group(2)
        it = OrderedDict()
        if lab: it["label"] = lab.rstrip(".")
        it["text"] = c
        items.append(it)
    # si la description tient en un seul paragraphe, c'est l'unique item
    if not items and src.get("intro", "").startswith(("Ms", "Brouillon", "Ébauche")):
        items.append(OrderedDict(text=src.pop("intro")))
    if items: src["items"] = items
    # extraction : papiers, état
    blob = " ".join([src.get("intro", "")] + [i["text"] for i in items])
    papers = []
    for pm in re.finditer(r"papier ([^,;]+?)\s*(?:[,;]|$)", blob):
        p = pm.group(1).strip().rstrip("?").strip()
        p = re.sub(r",.*", "", p)
        if p not in papers: papers.append(p)
    if papers: src["papers"] = papers
    kinds = []
    for k, pat in [("draft", r"\bBrouillon\b"), ("sketch", r"\bÉbauche|ébauché"), ("fair_copy", r"mis[e]? au net"),
                   ("autograph", r"\bautographe\b"), ("unfinished", r"\binachevée?\b"), ("incomplete", r"\bincomplet\b")]:
        if re.search(pat, blob): kinds.append(k)
    if kinds: src["features"] = kinds
    return src

# ---------------------------------------------------------------- carnet
DATE_LINE = re.compile(r"^(?:\d{1,2}(?:\^?er\^?)?\s+(?:et\s+\d{1,2}\s+\w+\s+)?" + MONTH_RE + r"(?:\s*\d{4})?|\d{1,2}\s+déc\.\s+\d{4}|19\d\d\b|20\d\d\b|Date \?)")
def parse_journal(pars):
    entries, cur, year = [], None, None
    intro = None
    for p in pars:
        c = clean(p)
        if not c: continue
        if DATE_LINE.match(c) and not c.startswith("«"):
            cur = OrderedDict()
            c = re.sub(r"([a-zéû])(\d)", r"\1 \2", c)
            md = re.match(r"^(.*?)(?:,\s*(.*))?$", c)
            datepart, ctx = md.group(1), md.group(2)
            # « 1966 (date exacte ? ...) »
            mpar = re.match(r"^(.*?)\s*\((.*)\)\s*$", datepart)
            if mpar: datepart, ctx = mpar.group(1), (mpar.group(2) + (", " + ctx if ctx else ""))
            if datepart.startswith("Date ?"):
                ctx = datepart[len("Date ?"):].strip() or ctx
                datepart = "Date ?"
            y, mth, d = parse_point(datepart)
            if y: year = y
            elif mth and year: y = year
            iso_d = iso((y, mth, d))
            cur["date_text"] = datepart.strip()
            if iso_d: cur["date"] = iso_d
            if ctx: cur["context"] = ctx.strip()
            if intro: cur["note"] = intro; intro = None
            cur["quotes"] = []
            entries.append(cur)
        elif c.startswith("«") or cur is None or not cur["quotes"]:
            if cur is None or (not c.startswith("«") and not c.startswith("*cf*") and c.endswith(":")):
                intro = c; continue
            cur["quotes"].append(c)
        else:
            cur["quotes"][-1] += "\n\n" + c
    if intro and entries: entries[-1].setdefault("note_after", intro)
    return entries

# ---------------------------------------------------------------- entrée
def parse_entry(head, pars, livre):
    w = OrderedDict()
    h = parse_head(head)
    w["id"] = None
    w["th"] = h["th"]
    w["book"] = livre
    w["title"] = h["title"]
    if h["subtitle"]: w["subtitle"] = h["subtitle"]
    w["opus"] = h["opus"]
    todos = []
    # effectif = premier paragraphe
    i = 0
    w["scoring"] = clean(pars[0]) if pars else ""
    i = 1
    mov_pars = []
    while i < len(pars) and not field_of(pars[i]):
        mov_pars.append(pars[i]); i += 1
    movs, eff_note = parse_movements(mov_pars)
    if eff_note: w["scoring_note"] = eff_note
    if movs: w["movements"] = movs
    # champs
    fields = []
    while i < len(pars):
        f = field_of(pars[i])
        if f:
            fields.append([f[0], f[1], []])
        elif fields:
            fields[-1][2].append(pars[i])
        i += 1
    for key, val, more in fields:
        val = clean(val)
        if key == "composition":
            w["composition"] = OrderedDict(text=val)
            a, b = parse_range(val)
            if a: w["composition"]["from"] = a
            if b: w["composition"]["to"] = b
        elif key == "text":
            authors = []
            v = val
            mt = re.match(r"^«\s*(.*?)\s*»\s*de\s+(.*)$", v)
            poem_title = None
            if mt: poem_title, v = mt.group(1), mt.group(2)
            mtr = re.match(r"^(.*?)\s+traduit par\s+(.*)$", v)
            if mtr:
                authors = [{"name": re.sub(r"\s*\(.*\)$", "", mtr.group(1)).strip(), "role": "author"},
                           {"name": mtr.group(2).strip(), "role": "translator"}]
            else:
                authors = [{"name": re.sub(r"\s*\(.*\)$", "", v).strip(), "role": "author"}]
            w["text"] = OrderedDict(credit=val)
            if poem_title: w["text"]["poem_title"] = poem_title
            w["text"]["authors"] = authors
            for p in more:
                extract_todos(clean(p), todos)
        elif key == "dedication":
            if more:
                val = "\n".join([val] + [clean(p) for p in more])
            w["dedication"] = OrderedDict(text=val)
        elif key == "sources":
            w["sources"] = parse_sources(val, more)
        elif key == "audio_source":
            w["audio_source"] = val
        elif key == "remarks":
            paras = [val] + [clean(p) for p in more] if val else [clean(p) for p in more]
            w.setdefault("remarks", []).extend(extract_todos(p, todos) for p in paras if p)
            w["remarks"] = [r[0].upper() + r[1:] for r in w["remarks"] if r]
        elif key in ("unpublished", "unpublished?"):
            w["unpublished"] = True if key == "unpublished" else "uncertain"
            rest = clean(val)
            if rest: todos.append(rest.strip("() "))
        elif key in ("premiere", "premiere_radio", "premiere_recording"):
            paras = [val] + [clean(p) for p in more]
            prev = []
            for p in paras:
                if not p: continue
                if key == "premiere_radio" or p.startswith("?"):
                    todos.append(f"Création : {p}"); continue
                if key == "premiere_recording":
                    w.setdefault("premiere_recording", []).append(p); continue
                perf, note = parse_performance(p, prev)
                if note: todos.append(f"Création : {note}")
                w.setdefault("premiere", []).append(perf)
                prev = perf.get("performers", [])
        elif key == "performances":
            prev = (w.get("premiere") or [{}])[-1].get("performers", [])
            paras = ([val] if val else []) + [clean(re.sub(r"^-\s+", "", p)) for p in more]
            for p in paras:
                if not p: continue
                p = re.sub(r"^-\s+", "", p)
                perf, note = parse_performance(p, prev)
                if note: todos.append(f"Exécution : {note}")
                w.setdefault("performances", []).append(perf)
                prev = perf.get("performers", prev)
        elif key == "duration":
            w["duration"] = val
        elif key == "edition":
            ed = OrderedDict(text=val)
            for pub in ["Donemus", "Alphonse Leduc", "Symétrie", "Max Eschig", "Artchipel"]:
                if pub in val: ed["publisher"] = pub
            my = re.search(r"\b(19|20)\d\d\b", val)
            if my: ed["year"] = int(my.group(0))
            if "à paraître" in val: ed["status"] = "forthcoming"
            if val.endswith("?"): ed["status"] = "uncertain"
            w.setdefault("editions", []).append(ed)
        elif key == "documents":
            paras = ([val] if val else []) + [clean(p) for p in more]
            w.setdefault("documents", []).extend(p for p in paras if p)
        elif key == "journal":
            w["journal"] = parse_journal(more if not val else [val] + more)
        elif key == "bibliography":
            refs = []
            for p in ([val] if val else []) + [clean(re.sub(r"^-\s+", "", p)) for p in more]:
                m = re.match(r"^(.*?\(\d{4}\))\s*[,:]?\s*(?:p\.\s*)?(.*)$", p)
                if m: refs.append(OrderedDict(ref=m.group(1), pages=m.group(2).strip().rstrip(".")))
                else: refs.append(OrderedDict(ref=p))
            w["bibliography"] = refs
        elif key in ("discography", "videography"):
            items = ([val] if val else []) + [clean(re.sub(r"^-\s+", "", p)) for p in more]
            out = []
            for p in items:
                if not p: continue
                d = OrderedDict(text=p)
                mt = re.match(r"^\*?(.*?)\*?\s*,?\s*\((\d{4})\)\s*(.*)$", p)
                if mt:
                    d["title"] = mt.group(1).strip().strip("*").strip(",").strip()
                    d["year"] = int(mt.group(2))
                    if mt.group(3): d["details"] = mt.group(3).strip()
                out.append(d)
            w[key] = out
        elif key == "intertextual":
            w["intertextual"] = [clean(p) for p in more if clean(p)]
    # notes de travail dispersées dans les champs -> editorial_notes
    def walk(o, key=None):
        if isinstance(o, dict):
            for k, v in o.items():
                if k not in ("quotes", "editorial_notes"): o[k] = walk(v, k)
            return o
        if isinstance(o, list): return [walk(x, key) for x in o]
        if isinstance(o, str): return extract_todos(o, todos)
        return o
    walk(w)
    # placeholders à compléter
    blob = dump(w)
    if re.search(r"\bX f\.|X pages|X mes\.", blob): todos.append("Compléter les valeurs « X » (feuillets, pages, mesures)")
    todos = list(dict.fromkeys(todos))
    todos = [x for x in todos if not (x.split(" : ", 1)[-1] in todos and " : " in x and x.split(" : ", 1)[0] in ("Création", "Exécution"))]
    if todos: w["editorial_notes"] = todos
    return w

def split_entries(path):
    lines = open(path, encoding="utf-8").read().split("\n")
    pars, buf = [], []
    for ln in lines:
        if ln.strip() == "":
            if buf: pars.append(" ".join(buf)); buf = []
        else:
            buf.append(ln.strip())
    if buf: pars.append(" ".join(buf))
    entries, cur = [], None
    for p in pars:
        if HEAD_RE.match(p):
            cur = [p, []]; entries.append(cur)
        elif p.startswith("**(LIVRE"):
            continue
        elif cur:
            cur[1].append(p)
    return entries

# ---------------------------------------------------------------- identifiants
def make_id(w, used):
    t = plain(w["title"])
    m = re.match(r"Sonate pour (piano|deux pianos|violon et piano|saxophone et piano) nº\s*(\d+)", t)
    if m:
        inst = {"piano": "piano", "deux pianos": "deux-pianos", "violon et piano": "violon-piano",
                "saxophone et piano": "saxophone-piano"}[m.group(1)]
        base = f"sonate-{inst}-{int(m.group(2)):02d}"
    else:
        base = slugify(t)
    if t.startswith("Cantate") and w.get("subtitle"): base = slugify(w["subtitle"])
    sid = base
    if sid in used:
        y = (w.get("composition", {}).get("from") or "")[:4]
        sid = f"{base}-{y}" if y else f"{base}-2"
    used.add(sid)
    return sid

def main(specs):
    works, used = [], set()
    for spec in specs:
        path, livre = spec.rsplit(":", 1)
        for head, pars in split_entries(path):
            works.append(parse_entry(head, pars, int(livre)))
    # identifiants stables (Bomben auf Engelland : version la plus ancienne d'abord)
    for w in works: w["id"] = make_id(w, used)
    by_th = {w["th"]: w["id"] for w in works}
    by_op = {w["opus"]: w["id"] for w in works if w["opus"]}
    # renvois Th -> [[id]]
    fixes = json_fixes()
    for w in works:
        resolve_refs(w, by_th, by_op, fixes.get(w["th"], {}))
    for f in os.listdir(OUT):
        if f.endswith(".yaml"): os.remove(os.path.join(OUT, f))
    for w in works:
        with open(os.path.join(OUT, f"{w['id']}.yaml"), "w", encoding="utf-8") as fh:
            fh.write(dump(w))
    print(f"{len(works)} œuvres écrites dans {OUT}")

def json_fixes():
    """Renvois erronés repérés à la relecture (décalage de numérotation).
    clé = Th de la notice ; valeur = {renvoi tel qu'écrit: Th correct}."""
    return {
        "37a": {"36b": "37b"}, "37b": {"36a": "37a"},
        "44a": {"43b": "44b"}, "44b": {"43a": "44a"},
        "52": {"44": "45"}, "45": {"51": "52"},
        "50": {"X": "75"},   # « version primitive de l'opus 71 (cf. ThX) »
    }

REF_RE = re.compile(r"Th\s?(\d+[ab]?|X)\b(?:,\s*op\.\s*(\d+))?")
def resolve_refs(w, by_th, by_op, fixes):
    unresolved = []
    def fix_text(s):
        def rep(m):
            num, after = m.group(1), m.group(2) or ""
            if num in fixes: num = fixes[num]
            if num == "X":
                if after and after in by_op:
                    return f"[[{by_op[after]}]]" + m.group(0)[len("ThX"):]
                unresolved.append(m.group(0))
                return "[[?]]" + m.group(0)[len("ThX"):]
            if num in by_th:
                return f"[[{by_th[num]}]]" + m.group(0)[len("Th") + (1 if m.group(0)[2] == " " else 0) + len(m.group(1)):]
            unresolved.append(m.group(0))
            return m.group(0)
        return REF_RE.sub(rep, s)
    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in ("id", "th"): continue
                o[k] = walk(v)
            return o
        if isinstance(o, list): return [walk(x) for x in o]
        if isinstance(o, str): return fix_text(o)
        return o
    walk(w)
    if unresolved:
        w.setdefault("editorial_notes", []).append("Renvoi(s) à résoudre : " + " ; ".join(sorted(set(unresolved))))

# ---------------------------------------------------------------- YAML lisible
class D(yaml.SafeDumper): pass
def _str(d, s):
    if "\n" in s: return d.represent_scalar("tag:yaml.org,2002:str", s, style="|")
    return d.represent_scalar("tag:yaml.org,2002:str", s)
D.add_representer(str, _str)
D.add_representer(OrderedDict, lambda d, o: d.represent_dict(o.items()))
def dump(w):
    w = OrderedDict((k, v) for k, v in w.items() if v not in (None, [], ""))
    return yaml.dump(w, Dumper=D, allow_unicode=True, sort_keys=False, width=100)

if __name__ == "__main__":
    main(sys.argv[1:])
