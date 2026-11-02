#!/usr/bin/env python3
"""
Enrichissement éditorial appliqué après l'import Word -> YAML.

Tout ce qui relève d'un jugement (titres alternatifs, personnes dédicataires,
catégories d'effectif, relations entre œuvres) est saisi ici, une fois, de façon
explicite. Tant que la rédaction se poursuit dans Word, on relance :
    python3 tools/import_docx.py ... && python3 tools/enrich.py
Quand les YAML deviennent la source de référence, ce fichier n'est plus utile.
"""
import os, glob, yaml, re
from collections import OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys_path = os.path.join(ROOT, "tools"); import sys; sys.path.insert(0, sys_path)
from import_docx import dump  # même mise en forme YAML

# --- titres alternatifs : (titre, où il apparaît)
ALT_TITLES = {
    "danses-villageoises": [("Scènes villageoises", "Enregistrement")],
    "petite-suite": [("Suite", "Carnet de bord")],
    "cinq-chansons-enfantines": [("Cinq Mélodies", "CaG")],
    "saltimbanques": [("Les Saltimbanques", "CaG")],
    "sonate-piano-01": [("Sonatine", "Ms."), ("1re Sonate pour piano", "CaG")],
    "sonate-piano-02": [("Suite pour piano", "Ms."), ("Prélude, Aria et Finale", "Carnet de bord")],
    "variations-continues": [("Cadence", "Ms., CaG")],
    "vingt-trois-etudes": [("Vingt études", "Ms.")],
    "sonate-piano-03": [("Quatre soli", "Ms."), ("Sonate pour piano nº1", "CaG, biffé")],
    "sonate-piano-04": [("Trois pièces", "Ms., CaG")],
    "sonate-piano-05": [("Trois pièces", "Ms., CaG")],
    "sonate-piano-06": [("Sonate pour piano nº2", "CaG, biffé")],
    "sonate-piano-07": [("Cinq pièces pour piano", "Ms.")],
    "sonate-piano-08": [("Nocturne", "Ms."), ("Sonate pour piano nº3", "CaG, biffé")],
    "sonate-piano-09": [("Paradisiac Memories", "Ms."), ("Heavenly Memories", "catalogue tapuscrit")],
    "sonate-piano-10": [("Troisième sonate pour le piano", "Ms."), ("Sonate pour piano nº4", "CaG, biffé")],
    "sonate-piano-11": [("Adagio", "Ms., CaG")],
    "sonate-piano-12": [("Sonatine", "Ms., CaG")],
    "sonate-piano-13": [("Sonate nº2", "Ms."), ("Sonate nº5", "Ms."), ("Sonate en quatre mouvements", "Carnet de bord")],
    "sonate-piano-14": [("Sonate dans le goût ancien", "Ms.")],
    "sonate-piano-15": [("Sonate de guerre", "Carnet de bord")],
    "la-glorieuse": [("Les Glorieuses", "Ms.")],
    "sonate-deux-pianos-01": [("Concerto pour deux pianos", "Ms.")],
    "hommage-a-raymond-roussel": [("Second hommage à Raymond Roussel", "Ms., CaG")],
    "die-ilse": [("Paradisiac Memories nº2", "Ms."), ("The Ballad of Gulliver in his Mother's Cunt", "Ms.")],
    "le-triomphe-de-la-tonalite": [("7.000 pounds", "Ms., CaG")],
    "three-songs": [("Seven Songs", "Carnet de bord")],
    "wiener-konzert": [("Concert viennois", "Carnet de bord, refusé par l'auteur")],
    "and-death-shall-have-no-dominion": [("Cantate sur un poème de Dylan Thomas", "Ms.")],
    "eloise": [("Oratorio", "Carnet de bord")],
}

# --- dédicataires (nom normalisé) ; « mvt » = dédicace d'un mouvement
DEDICATEES = {
    "cinq-chansons-enfantines": ["Annette (belle-sœur du compositeur)", "Emmanuel (neveu du compositeur)"],
    "sonate-piano-02": ["Paul E. Langer"],
    "la-chanson-de-gaspard-hauser": ["Diane von Fürstenberg"],
    "sonate-violon-piano-02": ["Devy Erlih"],
    "sonate-piano-14": ["Arthur Rubinstein"],
    "vingt-trois-etudes": ["Katia Labèque"],
    "alabama-song": ["Kurt Weill"],
    "sonate-piano-07": ["Glenn Gould"],
    "l-ile-du-docteur-moreau": ["Robert Flinn"],
    "in-memoriam": ["Gustav Mahler"],
    "morbid-fixations": ["Katia Labèque", "Marielle Labèque"],
    "sonate-piano-09": ["Marilyn Monroe", "Busby Berkeley"],
    "42nd-street": ["Devadip", "Urmila"],
    "sonate-piano-10": ["Geoffroy Paulmier"],
    "la-glorieuse": ["Patricia Aubertin"],
    "sonate-piano-11": ["Wilhelm Furtwängler", "E-D F."],
    "die-ilse": ["Isabelle Collin-Dufresne"],
    "wiener-konzert": ["Jean-Jacques Greif", "Alis Levi", "Mrs Alexander Liberman", "Marc Cholodenko",
                       "Isabelle Collin-Dufresne", "Richard Strauss"],
    "and-death-shall-have-no-dominion": ["Mère du compositeur"],
    "ancient-music": ["Michel Béroff"],
    "la-perigourdine": ["Igor Stravinsky"],
    "light-music": ["Guy de Chambure", "Gala Barbisan", "Claus Schenk Graf von Stauffenberg", "Stephan Genz"],
    "three-songs": ["Inès de la Fressange"],
    "the-spirit-s-song": ["Esther Galil"],
    "time-is-on-my-side": ["Litta de la Fressange"],
    "sonate-piano-15": ["Louise Clavius Marius"],
    "sonate-deux-pianos-02": ["Antoine Herbart"],
}

# --- variantes orthographiques fusionnées (forme trouvée -> forme d'index)
NAME_VARIANTS = {
    "Isabelle Collin Dufresne": "Isabelle Collin-Dufresne",
    "Isabelle Colin-Dufresne": "Isabelle Collin-Dufresne",
    "Isabelle Colin Dufresne": "Isabelle Collin-Dufresne",
    "Kurt Weil": "Kurt Weill",
    "Alis Lévi": "Alis Levi",
    "Katya Labèque": "Katia Labèque",
    "Rihaku": "Li Bai",
}

# --- catégories d'effectif (clé -> règle sur l'effectif, sinon surcharge par id)
CATEGORY_OVERRIDES = {
    "concerto-pour-violon-et-orchestre": ["orchestra"],
    "and-death-shall-have-no-dominion": ["orchestra", "vocal-ensemble"],
    "die-ilse": ["vocal-ensemble"],
    "in-paradisum": ["vocal-ensemble"],
    "bomben-auf-engelland-1976": ["vocal-ensemble"],
    "petite-cantate-de-chambre": ["vocal-ensemble"],
    "eloise": ["choral"],
    "the-bells": ["undetermined"],
}
def categorize(w):
    if w["id"] in CATEGORY_OVERRIDES: return CATEGORY_OVERRIDES[w["id"]]
    s = re.sub(r"\*", "", w.get("scoring", "")).lower()
    if s in ("piano", "fugue pour piano"): return ["piano"]
    if "deux pianos" in s or "quatre mains" in s: return ["two-pianos"]
    if "chœur" in s: return ["choral"]
    if re.search(r"voix|soprano|mezzo", s) and s.endswith("et piano"): return ["voice-piano"]
    if re.search(r"violon|flûte|saxophone|quatuor", s): return ["chamber"]
    return ["undetermined"]

# --- relations entre œuvres
RELATIONS = [
    ("bomben-auf-engelland", "bomben-auf-engelland-1976", "revision"),
    ("sonate-piano-09", "42nd-street", "extract"),
    ("le-triomphe-de-la-tonalite", "7000-pounds", "revision"),
    ("o-joy-o-joy", "joy-o-joy", "version"),
    ("in-memoriam", "in-paradisum", "companion"),
    ("light-music", "the-spirit-s-song", "cycle"),
    ("light-music", "time-is-on-my-side", "cycle"),
    ("light-music", "wiener-konzert", "shared-material"),
    ("la-perigourdine", "sonate-deux-pianos-02", "sketch"),
]

# --- lieux : normalisation de la ville d'index (préfixe du lieu -> ville, pays)
PLACE_FIX = [
    ("Suisse, église de Champéry", "Champéry", "Suisse"),
    ("États-Unis, Floride, Palm Beach", "Palm Beach (Floride)", "États-Unis"),
    ("Auditorium du siège de la Cie Total", None, None),
    ("France Culture", "Radio (France Culture)", None),
    ("Joigny (Yonne)", "Joigny", None),
    ("Landerrouat (Gironde)", "Landerrouat", None),
    ("Tarn, Festival de Cordes-sur-Ciel", "Cordes-sur-Ciel", None),
    ("Tournée écossaise", "Écosse (tournée)", "Royaume-Uni"),
    ("Université Paris III", "Paris", None),
    ("Vienne, Château de Chiré-en-Montreuil", "Chiré-en-Montreuil (Vienne)", None),
    ("Vienne, Mairie de Frozes", "Frozes (Vienne)", None),
]
def fix_place(perf):
    pl = perf.get("place", "")
    if pl.startswith("Tournée écossaise"):
        perf["place"] = re.sub(r",\s*du 15 au\s*$", "", pl)
        perf["date"] = "1979-02-15"; perf["date_end"] = "1979-02-18"
    for pre, city, country in PLACE_FIX:
        if pl.startswith(pre):
            if city: perf["city"] = city
            else: perf.pop("city", None)
            if country: perf["country"] = country
            break

def main():
    files = sorted(glob.glob(os.path.join(ROOT, "data", "works", "*.yaml")))
    works = {}
    for f in files:
        w = yaml.safe_load(open(f, encoding="utf-8"))
        works[w["id"]] = (f, w)
    for wid, (f, w) in works.items():
        w = OrderedDict(w)
        if wid in ALT_TITLES:
            w["alt_titles"] = [OrderedDict(title=t, source=s) for t, s in ALT_TITLES[wid]]
        if wid in DEDICATEES:
            w.setdefault("dedication", OrderedDict())
            w["dedication"] = OrderedDict(w["dedication"])
            w["dedication"]["persons"] = DEDICATEES[wid]
        w["categories"] = categorize(w)
        rel = []
        for a, b, kind in RELATIONS:
            if a == wid: rel.append(OrderedDict(id=b, relation=kind))
            if b == wid: rel.append(OrderedDict(id=a, relation=kind + ":inverse"))
        if rel: w["related"] = rel
        # personnes : variantes
        def norm(o):
            if isinstance(o, dict):
                for k, v in list(o.items()):
                    if k == "name" and isinstance(v, str) and v in NAME_VARIANTS:
                        o.setdefault("as_written", v); o[k] = NAME_VARIANTS[v]
                    else: norm(v)
            elif isinstance(o, list):
                for x in o: norm(x)
        norm(w)
        for perf in (w.get("premiere") or []) + (w.get("performances") or []):
            fix_place(perf)
        # ordre des clés
        order = ["id", "th", "book", "title", "subtitle", "alt_titles", "opus", "scoring", "scoring_note",
                 "categories", "movements", "text", "composition", "dedication", "sources", "audio_source",
                 "remarks", "intertextual", "unpublished", "editions", "premiere", "premiere_recording",
                 "performances", "duration", "journal", "documents", "bibliography", "discography",
                 "videography", "related", "editorial_notes"]
        w2 = OrderedDict((k, w[k]) for k in order if k in w)
        for k in w:
            if k not in w2: w2[k] = w[k]
        open(f, "w", encoding="utf-8").write(dump(w2))
    print(f"{len(works)} notices enrichies")

if __name__ == "__main__":
    main()
