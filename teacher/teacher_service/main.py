import asyncio
import json
import secrets
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from teacher_service.config import settings
from teacher_service.ollama_client import OllamaClient, OllamaError
from teacher_service.prompts import (
    detail_messages,
    explanation_messages,
    free_question_messages,
)
from teacher_service.rag import RagStore
from teacher_service.schemas import DetailRequest, FreeQuestionRequest, MistakesRequest


def sse_event(data: dict) -> bytes:
    return f"data: {json.dumps(data, ensure_ascii=False, separators=(',', ':'))}\n\n".encode()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.require_service_token()
    ollama = OllamaClient(settings)
    app.state.ollama = ollama
    app.state.rag = RagStore(settings, ollama)
    app.state.generation_slots = asyncio.Semaphore(
        settings.teacher_max_concurrent_generations
    )
    yield


app = FastAPI(
    title="D4 Internal Teacher",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)


def require_service_token(
    x_teacher_token: str = Header(default="", alias="X-Teacher-Token")
) -> None:
    if not settings.teacher_service_token or not secrets.compare_digest(
        x_teacher_token, settings.teacher_service_token
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid service token"
        )


async def acquire_slot(request: Request) -> None:
    try:
        await asyncio.wait_for(
            request.app.state.generation_slots.acquire(),
            timeout=settings.teacher_queue_timeout_seconds,
        )
    except TimeoutError as error:
        raise HTTPException(
            status_code=429, detail="ИИ занят другим запросом"
        ) from error


def stream_response(
    request: Request, producer: Callable[[], AsyncIterator[bytes]]
) -> StreamingResponse:
    async def guarded():
        try:
            yield b": connected\n\n"
            async for chunk in producer():
                yield chunk
        except asyncio.CancelledError:
            raise
        except (OllamaError, RuntimeError) as error:
            yield sse_event({"error": str(error)})
        finally:
            request.app.state.generation_slots.release()

    return StreamingResponse(
        guarded(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/v1/status", dependencies=[Depends(require_service_token)])
async def teacher_status(request: Request):
    try:
        models = await request.app.state.ollama.model_names()
    except OllamaError as error:
        return {
            "ready": False,
            "rag_ready": False,
            "model": settings.ollama_chat_model,
            "detail": str(error),
        }
    chat_ready = settings.ollama_chat_model in models
    embed_ready = settings.ollama_embed_model in models
    return {
        "ready": chat_ready and embed_ready,
        "rag_ready": embed_ready and request.app.state.rag.is_ready(),
        "model": settings.ollama_chat_model,
        "embedding_model": settings.ollama_embed_model,
        "documents": request.app.state.rag.document_count(),
        "detail": None,
    }


@app.post("/v1/chat/mistakes", dependencies=[Depends(require_service_token)])
async def mistakes(payload: MistakesRequest, request: Request):
    await acquire_slot(request)

    async def produce():
        for item in payload.mistakes:
            yield sse_event({"id": item.id, "start": True})
            docs = await request.app.state.rag.search(f"{item.question} {item.src}")
            async for token in request.app.state.ollama.chat_stream(
                explanation_messages(item, docs),
                max_tokens=settings.teacher_max_explanation_tokens,
                temperature=0.2,
            ):
                yield sse_event({"id": item.id, "token": token})
            yield sse_event({"id": item.id, "done": True})
        yield sse_event({"all_done": True})

    return stream_response(request, produce)


@app.post("/v1/chat/detail", dependencies=[Depends(require_service_token)])
async def detail(payload: DetailRequest, request: Request):
    await acquire_slot(request)

    async def produce():
        docs = await request.app.state.rag.search(f"{payload.question} {payload.src}")
        async for token in request.app.state.ollama.chat_stream(
            detail_messages(payload, docs),
            max_tokens=settings.teacher_max_detail_tokens,
            temperature=0.25,
        ):
            yield sse_event({"token": token})
        yield sse_event({"done": True})

    return stream_response(request, produce)


@app.post("/v1/chat/free", dependencies=[Depends(require_service_token)])
async def free(payload: FreeQuestionRequest, request: Request):
    await acquire_slot(request)

    async def produce():
        docs = await request.app.state.rag.search(payload.question)
        async for token in request.app.state.ollama.chat_stream(
            free_question_messages(payload, docs),
            max_tokens=settings.teacher_max_chat_tokens,
            temperature=0.3,
        ):
            yield sse_event({"token": token})
        yield sse_event({"done": True})

    return stream_response(request, produce)
