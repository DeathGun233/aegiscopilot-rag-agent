from __future__ import annotations

import re


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def tokenize(text: str) -> list[str]:
    tokens: list[str] = []
    for token in re.findall(r"[\w\u4e00-\u9fff]+", text):
        normalized = token.lower()
        if re.fullmatch(r"[\u4e00-\u9fff]+", normalized):
            tokens.extend(list(normalized))
            if len(normalized) > 1:
                tokens.extend(normalized[index : index + 2] for index in range(len(normalized) - 1))
        else:
            tokens.append(normalized)
    return tokens


def split_into_chunks(text: str, chunk_size: int = 900, overlap: int = 120) -> list[str]:
    normalized = normalize_text(text)
    if len(normalized) <= chunk_size:
        return [normalized]
    chunks: list[str] = []
    start = 0
    while start < len(normalized):
        hard_end = min(len(normalized), start + chunk_size)
        end = _find_chunk_boundary(normalized, start, hard_end, chunk_size)
        chunks.append(normalized[start:end].strip())
        if end >= len(normalized):
            break
        start = max(end - overlap, start + 1)
    return [chunk for chunk in chunks if chunk]


def _find_chunk_boundary(text: str, start: int, hard_end: int, chunk_size: int) -> int:
    if hard_end >= len(text):
        return hard_end

    min_end = min(hard_end, start + max(int(chunk_size * 0.65), 1))
    boundary_candidates = [
        text.rfind("\n\n", min_end, hard_end),
        text.rfind("\n", min_end, hard_end),
        text.rfind("。", min_end, hard_end),
        text.rfind("；", min_end, hard_end),
    ]
    boundary = max(boundary_candidates)
    if boundary >= min_end:
        return boundary + 1
    return hard_end
