from dataclasses import dataclass
import chromadb
from teacher_service.config import TeacherSettings
from teacher_service.ollama_client import OllamaClient


@dataclass(frozen=True)
class RagDocument:
    text: str
    page: int | None


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
        collection = self._collection()
        if collection is None or not self.is_ready():
            return []
        embedding = (await self.ollama.embed(query))[0]
        result = collection.query(
            query_embeddings=[embedding],
            n_results=self.config.rag_top_k,
            include=["documents", "metadatas"],
        )
        documents = (result.get("documents") or [[]])[0]
        metadatas = (result.get("metadatas") or [[]])[0]
        return [
            RagDocument(str(doc), (meta or {}).get("page"))
            for doc, meta in zip(documents, metadatas, strict=False)
            if doc
        ]


def format_rag_context(documents: list[RagDocument]) -> str:
    if not documents:
        return "База знаний не содержит подходящего фрагмента."
    return "\n\n".join(
        f"[Фрагмент {i}{f', страница {d.page}' if d.page else ''}]\n{d.text}"
        for i, d in enumerate(documents, 1)
    )
