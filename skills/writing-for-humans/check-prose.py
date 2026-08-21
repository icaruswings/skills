#!/usr/bin/env python3
"""Check human-facing prose for AI tells and ASD-STE100 violations.

Usage: check-prose.py FILE [FILE...]      (or pipe text on stdin)
Exit 1 if any violation is found.
Every match still needs a human read: quoted counter-examples and
adjectival participles trip the passive check.
"""
import re, sys

MAX_WORDS = 25
MAX_SENTENCES = 6

AI_WORDS = r"""additionally crucial crucially delve delved delving enduring enhance enhanced enhances
enhancing foster fostering garner garnered interplay intricate landscape leverage leveraged leverages
leveraging pivotal robust seamless seamlessly showcase showcases showcasing tapestry testament
underscore underscores underscoring utilise utilize utilized utilizing vibrant myriad plethora
holistic nuanced comprehensive meticulous meticulously realm navigate navigating unlock unlocking
elevate elevating streamline streamlined streamlining empower empowering cutting-edge groundbreaking
paramount vital ensure ensuring facilitate facilitates facilitating numerous""".split()

METAPHOR_NOUNS = r"""substrate wedge vector locus vantage nexus primitive harness bedrock scaffolding
modality paradigm flywheel endgame gold-plating ratchet surface""".split()

FILLER = [
    (r"\bin order to\b", "to"),
    (r"\bdue to the fact that\b", "because"),
    (r"\bit is important to note that\b", "(delete)"),
    (r"\bit is worth noting that\b", "(delete)"),
    (r"\bin the event that\b", "if"),
    (r"\bat this point in time\b", "now"),
    (r"\bthe fact that\b", "that"),
    (r"\bserves as\b", "is"),
    (r"\bstands as\b", "is"),
    (r"\bboasts\b", "has"),
]

PARTICIPLES = r"""\w+ed|written|done|made|given|taken|seen|known|shown|held|built|sent|kept|left|
found|set|put|read|run|lost|meant|thrown|drawn|brought|caught|chosen|driven|hidden|paid|sold|told""".replace("\n", "")
PASSIVE = re.compile(rf"\b(is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?({PARTICIPLES})\b", re.I)

ADJECTIVAL = {"untouched", "unchanged", "required", "based", "related", "involved", "limited",
              "interested", "concerned", "complicated", "sophisticated", "dedicated", "detailed",
              "advanced", "mixed", "tired", "pleased", "aware", "unaffected", "undefined", "deleted"}

FINITE = r"is|are|was|were|will|would|can|could|should|must|does|do|has|have|never|always|[a-z]+(?:s|ed)"

NOT_GERUND = {"nothing", "something", "everything", "anything", "during", "bring", "king", "thing",
              "sing", "ring", "spring", "string", "morning", "evening", "ceiling", "building", "existing", "outstanding", "remaining"}

EMOJI = re.compile("[\U0001F000-\U0001FAFF←-⇿☀-➿️✅❌⭐]")


def strip_code(text):
    """Blank out fenced blocks and inline code, preserving line numbers."""
    lines = text.split("\n")
    out, in_fence = [], False
    for ln in lines:
        if re.match(r"\s*(```|~~~)", ln):
            in_fence = not in_fence
            out.append("")
            continue
        if in_fence or re.match(r"( {4,}|\t)\S", ln):
            out.append("")
        else:
            clean = re.sub(r"`[^`]*`", "CODE", ln)
            clean = re.sub(r"\"[^\"]{0,120}\"", "QUOTED", clean)
            out.append(clean)
    return out


def sentences(block):
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9(\[\"'`])", block.strip())
    return [p for p in (s.strip() for s in parts) if p]



def check(name, raw):
    lines = strip_code(raw)
    hits = []

    def hit(lineno, rule, detail):
        hits.append((lineno, rule, detail))

    for i, ln in enumerate(lines, 1):
        low = ln.lower()
        if "—" in ln or "–" in ln:
            hit(i, "em-dash", ln.strip()[:70])
        for ch, nm in [("“", "curly-quote"), ("”", "curly-quote"), ("‘", "curly-quote"),
                       ("’", "curly-apostrophe"), ("…", "ellipsis-char")]:
            if ch in ln:
                hit(i, nm, ln.strip()[:70]); break
        for w in AI_WORDS:
            if re.search(rf"\b{re.escape(w)}\b", low):
                hit(i, "ai-vocabulary", w)
        for w in METAPHOR_NOUNS:
            if re.search(rf"\b{re.escape(w)}\b", low):
                hit(i, "metaphor-noun", w)
        for pat, fix in FILLER:
            if re.search(pat, low):
                hit(i, "filler", f"{pat.strip(chr(92)+'b')} -> {fix}")
        if re.search(r"\bnot (just|only|merely)\b.{0,60}\bbut\b", low):
            hit(i, "not-just-but", ln.strip()[:70])
        if EMOJI.search(ln) and re.match(r"\s*(#{1,6}\s|[-*+]\s|\d+\.\s)", ln):
            hit(i, "decorative-emoji", ln.strip()[:70])
        m = re.match(r"\s*(#{1,6})\s+(.*)", ln)
        if m:
            words = re.findall(r"[A-Za-z][\w'-]*", m.group(2))
            if len(words) >= 3:
                # a product name is not title case: CamelCase, ALLCAPS or a digit means proper noun
                caps = [w for w in words[1:]
                        if w[:1].isupper() and not w.isupper()
                        and not re.search(r"[A-Z]", w[1:]) and not re.search(r"\d", w)]
                if len(caps) >= 2:
                    hit(i, "title-case-heading", m.group(2)[:60])
        m = re.match(r"\s*(?:[-*+]\s+)?\*\*([^*]{2,40})\*\*\s*:", ln)
        if m:
            label = m.group(1).lower()
            rest = ln.split(":", 1)[1].lower()
            if label.rstrip("s") in rest:
                hit(i, "inline-header-restates", m.group(1))
        is_heading = bool(re.match(r"\s*#{1,6}\s", ln))
        for s in sentences(ln):
            body = re.sub(r"^\s*(#{1,6}|[-*+]|\d+\.)\s*", "", s)
            n = len(re.findall(r"[\w'`/.-]+", body))
            if n > MAX_WORDS:
                hit(i, f"long-sentence({n}w)", body[:70])
            pm = PASSIVE.search(body)
            if pm and pm.group(2).lower() not in ADJECTIVAL and not is_heading:
                hit(i, "passive-voice", pm.group(0))
            is_label = re.match(r"\s*[-*+]\s", s) and len(re.findall(r"\w+", body)) <= 5
            g = re.match(rf"([A-Z][a-z]+ing)\b[^.!?]{{0,90}}?\s(?:{FINITE})\b", body)
            if g and g.group(1).lower() not in NOT_GERUND and not is_label and not is_heading:
                hit(i, "gerund-subject", g.group(1))

    # paragraph length, on prose only
    para, start = [], 0
    def flush(para, start):
        if not para:
            return
        text = " ".join(para)
        if re.match(r"\s*(#{1,6}\s|[-*+]\s|\d+\.\s|\|)", para[0]):
            return
        n = len(sentences(text))
        if n > MAX_SENTENCES:
            hit(start, f"long-paragraph({n} sentences)", text[:60])
    for i, ln in enumerate(lines, 1):
        if ln.strip():
            if not para:
                start = i
            para.append(ln)
        else:
            flush(para, start); para = []
    flush(para, start)

    hits.sort()
    print(f"\n=== {name} ===")
    if not hits:
        print("  clean")
    for lineno, rule, detail in hits:
        print(f"  {lineno:>4}  {rule:<28} {detail}")
    print(f"  TOTAL: {len(hits)}")
    return len(hits)


if __name__ == "__main__":
    files = sys.argv[1:]
    total = 0
    if not files:
        total += check("stdin", sys.stdin.read())
    for f in files:
        with open(f) as fh:
            total += check(f, fh.read())
    print(f"\nGRAND TOTAL: {total}")
    sys.exit(1 if total else 0)
