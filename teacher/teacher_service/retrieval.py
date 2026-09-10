"""Deterministic lexical retrieval and rank fusion; no generated evidence."""
import math
import re
from collections import Counter


def tokens(text: str) -> list[str]:
    return re.findall(r"[\w]+(?:[-.][\w]+)*", text.casefold())


def bm25_rank(query: str, documents: list[str], limit: int = 20) -> list[int]:
    corpus = [Counter(tokens(d)) for d in documents]
    if not corpus:
        return []
    lengths = [sum(d.values()) for d in corpus]
    average = sum(lengths) / len(corpus) or 1
    scores = [0.0] * len(corpus)
    for term in set(tokens(query)):
        df = sum(term in d for d in corpus)
        idf = math.log(1 + (len(corpus) - df + .5) / (df + .5))
        for i, doc in enumerate(corpus):
            tf = doc[term]
            scores[i] += idf * tf * 2.2 / (tf + 1.2 * (.25 + .75 * lengths[i] / average))
    return sorted((i for i, score in enumerate(scores) if score > 0), key=lambda i: (-scores[i], i))[:limit]


def reciprocal_rank_fusion(*rankings: list[str], limit: int = 4) -> list[str]:
    scores: dict[str, float] = {}
    for ranking in rankings:
        for rank, key in enumerate(dict.fromkeys(ranking), 1):
            scores[key] = scores.get(key, 0) + 1 / (60 + rank)
    return sorted(scores, key=lambda key: (-scores[key], key))[:limit]


def verified_quote(quote: str, source: str) -> bool:
    """Whitespace-only normalization: paraphrases must never be labelled quotes."""
    return bool(quote.strip()) and ' '.join(quote.split()) in ' '.join(source.split())
