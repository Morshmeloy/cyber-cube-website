import asyncio
from dataclasses import dataclass
from teacher_service.retrieval import bm25_rank, reciprocal_rank_fusion
import chromadb
from teacher_service.config import TeacherSettings
from teacher_service.ollama_client import OllamaClient


@dataclass(frozen=True)
class RagDocument:
    text: str
    page: int | None
    source: str = "не указан"
    chapter: str = ""
    page_label: str = ""
    chunk_id: str = ""


class RagStore:
    def __init__(self, config: TeacherSettings, ollama: OllamaClient):
        self.config, self.ollama = config, ollama
        self.client = chromadb.PersistentClient(path=config.chroma_dir)

    def _collection(self):
        try:
            return self.client.get_collection(self.config.chroma_collection)
        except Exception:
            return None

    def is_ready(self) -> bool:
        collection = self._collection()
        return bool(
            collection
            and collection.count()
            and (collection.metadata or {}).get("embedding_model")
            == self.config.ollama_embed_model
        )

    def document_count(self) -> int:
        collection = self._collection()
        return collection.count() if collection else 0

    async def search(self, query: str) -> list[RagDocument]:
        collection = await asyncio.to_thread(self._collection)
        if collection is None or not await asyncio.to_thread(self.is_ready):
            return []
        embedding = (await self.ollama.embed(query))[0]
        def retrieve():
            count = collection.count()
            if not count:
                return []
            dense = collection.query(query_embeddings=[embedding], n_results=min(count, max(12, self.config.rag_top_k)), include=["documents", "metadatas"])
            # Baseline intended for a small single-book corpus; move lexical index
            # to FTS/OpenSearch before scaling. All blocking Chroma work runs off-loop.
            snapshot = collection.get(include=["documents", "metadatas"])
            ids = snapshot["ids"]
            docs = snapshot["documents"]
            metas = snapshot["metadatas"]
            searchable = [f"{(m or {}).get('chapter', '')} {d}" for d, m in zip(docs, metas)]
            lexical = [ids[i] for i in bm25_rank(query, searchable)]
            selected = reciprocal_rank_fusion(dense["ids"][0], lexical, limit=self.config.rag_top_k)
            rows = {key: (doc, meta or {}) for key, doc, meta in zip(ids, docs, metas)}
            return [RagDocument(text=rows[key][0], page=rows[key][1].get("page"),
                    source=rows[key][1].get("source", "не указан"),
                    chapter=rows[key][1].get("chapter", ""),
                    page_label=rows[key][1].get("page_label", ""), chunk_id=key)
                    for key in selected if rows[key][0]]
        return await asyncio.to_thread(retrieve)


def format_rag_context(documents: list[RagDocument]) -> str:
    if not documents:
        return "База знаний не содержит подходящего фрагмента."
    return "\n\n".join(
        f"[Фрагмент {i}; источник: {d.source}; PDF-страница: {d.page or 'неизвестна'}; метка страницы: {d.page_label or 'неизвестна'}; раздел: {d.chapter or 'неизвестен'}]\n{d.text[:900]}"
        for i, d in enumerate(documents, 1)
    )
