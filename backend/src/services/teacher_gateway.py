import asyncio
import json
from collections.abc import AsyncIterator
import httpx
from src.core.config import settings


class TeacherGatewayError(RuntimeError):
    pass


class TeacherGateway:
    def __init__(self):
        self._slots = asyncio.Semaphore(settings.TEACHER_MAX_CONCURRENT_STREAMS)

    def _check(self):
        if len(settings.TEACHER_SERVICE_TOKEN) < 32:
            raise TeacherGatewayError("ИИ-помощник ещё не настроен")

    def _timeout(self):
        return httpx.Timeout(
            connect=settings.TEACHER_CONNECT_TIMEOUT_SECONDS,
            read=settings.TEACHER_READ_TIMEOUT_SECONDS,
            write=30,
            pool=5,
        )

    def _headers(self):
        return {
            "X-Teacher-Token": settings.TEACHER_SERVICE_TOKEN,
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
        }

    async def status(self) -> dict:
        self._check()
        try:
            async with httpx.AsyncClient(
                timeout=self._timeout(), trust_env=False
            ) as client:
                response = await client.get(
                    f"{settings.TEACHER_BASE_URL.rstrip('/')}/v1/status",
                    headers=self._headers(),
                )
                response.raise_for_status()
                return response.json()
        except (httpx.HTTPError, ValueError) as error:
            raise TeacherGatewayError("ИИ-сервис недоступен") from error

    async def acquire(self):
        self._check()
        try:
            await asyncio.wait_for(
                self._slots.acquire(), timeout=settings.TEACHER_QUEUE_TIMEOUT_SECONDS
            )
        except TimeoutError as error:
            raise TeacherGatewayError("ИИ занят другим запросом") from error

    def release(self):
        self._slots.release()

    async def stream(self, path: str, payload: dict) -> AsyncIterator[bytes]:
        try:
            async with httpx.AsyncClient(
                timeout=self._timeout(), trust_env=False
            ) as client:
                async with client.stream(
                    "POST",
                    f"{settings.TEACHER_BASE_URL.rstrip('/')}{path}",
                    headers=self._headers(),
                    content=json.dumps(payload, ensure_ascii=False).encode(),
                ) as response:
                    response.raise_for_status()
                    async for chunk in response.aiter_bytes():
                        if chunk:
                            yield chunk
        except httpx.HTTPError as error:
            raise TeacherGatewayError("Связь с ИИ-сервисом прервана") from error


teacher_gateway = TeacherGateway()
