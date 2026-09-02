"""Build ChromaDB index with Ollama bge-m3 embeddings."""

import asyncio
import logging
import os
import time
import uuid
from pathlib import Path
import chromadb
import fitz
from teacher_service.config import settings
from teacher_service.ollama_client import OllamaClient

LOGGER = logging.getLogger("d4teacher.index")

PDF_PATH = Path(
    os.getenv(
        "TEACHER_PDF_PATH",
        "/app/data/Tanenbaum_E__Fimster_N__Uezeroll_D_-_Kompyuternye_seti_6-e_izd__Klassika_computer_science_-_2023.pdf",
    )
)
CHUNK_SIZE, CHUNK_OVERLAP, BATCH = 1200, 180, 16


def split_text(
    text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP
) -> list[str]:
    text = "\n".join(line.strip() for line in text.splitlines() if line.strip())
    chunks, start = [], 0
    while start < len(text):
        hard_end, end = min(start + size, len(text)), min(start + size, len(text))
        if hard_end < len(text):
            boundary = max(
                text.rfind("\n", start + size // 2, hard_end),
                text.rfind(". ", start + size // 2, hard_end),
            )
            if boundary > start:
                end = boundary + 1
        if chunk := text[start:end].strip():
            chunks.append(chunk)
        if end >= len(text):
            break
        start = max(start + 1, end - overlap)
    return chunks


async def build_index() -> None:
    if not PDF_PATH.exists():
        raise FileNotFoundError(f"PDF не найден: {PDF_PATH}")
    documents, metadata = [], []
    with fitz.open(PDF_PATH) as pdf:
        for page_number, page in enumerate(pdf, 1):
            chunks = split_text(page.get_text())
            documents.extend(chunks)
            metadata.extend(
                {"source": PDF_PATH.name, "page": page_number} for _ in chunks
            )
    if not documents:
        raise RuntimeError("Из PDF не извлечён текст")

    client = chromadb.PersistentClient(path=settings.chroma_dir)
    staging = f"teacher_build_{uuid.uuid4().hex[:12]}"
    collection = client.create_collection(
        staging,
        metadata={
            "embedding_model": settings.ollama_embed_model,
            "source": PDF_PATH.name,
            "created_unix": int(time.time()),
        },
    )
    ollama = OllamaClient(settings)
    try:
        for start in range(0, len(documents), BATCH):
            docs = documents[start : start + BATCH]
            collection.add(
                ids=[str(i) for i in range(start, start + len(docs))],
                documents=docs,
                metadatas=metadata[start : start + BATCH],
                embeddings=await ollama.embed(docs),
            )
            LOGGER.info("Проиндексировано: %s/%s", start + len(docs), len(documents))
        try:
            client.delete_collection(settings.chroma_collection)
        except Exception:
            pass
        collection.modify(name=settings.chroma_collection)
    except Exception:
        client.delete_collection(staging)
        raise
    LOGGER.info("Индекс готов: %s фрагментов", collection.count())


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    asyncio.run(build_index())
