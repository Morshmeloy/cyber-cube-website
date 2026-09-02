import json
from collections.abc import AsyncIterator, Sequence
import httpx
from teacher_service.config import TeacherSettings


class OllamaError(RuntimeError):
    pass


class OllamaClient:
    def __init__(self, config: TeacherSettings):
        self.config = config
        self.base_url = config.ollama_base_url.rstrip("/")

    def _timeout(self) -> httpx.Timeout:
        return httpx.Timeout(
            connect=5, read=self.config.ollama_timeout_seconds, write=30, pool=5
        )

    async def model_names(self) -> set[str]:
        try:
            async with httpx.AsyncClient(
                timeout=self._timeout(), trust_env=False
            ) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
                return {
                    str(m.get("name") or m.get("model"))
                    for m in response.json().get("models", [])
                }
        except (httpx.HTTPError, ValueError) as error:
            raise OllamaError("Ollama недоступна") from error

    async def chat_stream(
        self, messages: Sequence[dict[str, str]], *, max_tokens: int, temperature: float
    ) -> AsyncIterator[str]:
        payload = {
            "model": self.config.ollama_chat_model,
            "messages": list(messages),
            "stream": True,
            "keep_alive": self.config.ollama_keep_alive,
            "options": {
                "num_predict": max_tokens,
                "temperature": temperature,
                "num_ctx": self.config.ollama_num_ctx,
            },
        }
        try:
            async with httpx.AsyncClient(
                timeout=self._timeout(), trust_env=False
            ) as client:
                async with client.stream(
                    "POST", f"{self.base_url}/api/chat", json=payload
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        event = json.loads(line)
                        if event.get("error"):
                            raise OllamaError(str(event["error"]))
                        if token := event.get("message", {}).get("content", ""):
                            yield token
        except OllamaError:
            raise
        except (httpx.HTTPError, json.JSONDecodeError) as error:
            raise OllamaError("Ошибка потокового ответа Ollama") from error

    async def embed(self, inputs: str | Sequence[str]) -> list[list[float]]:
        try:
            async with httpx.AsyncClient(
                timeout=self._timeout(), trust_env=False
            ) as client:
                response = await client.post(
                    f"{self.base_url}/api/embed",
                    json={
                        "model": self.config.ollama_embed_model,
                        "input": inputs,
                        "keep_alive": self.config.ollama_keep_alive,
                    },
                )
                response.raise_for_status()
                embeddings = response.json().get("embeddings")
        except (httpx.HTTPError, ValueError) as error:
            raise OllamaError("Не удалось получить эмбеддинги") from error
        if not isinstance(embeddings, list) or not embeddings:
            raise OllamaError("Ollama вернула пустые эмбеддинги")
        return embeddings
