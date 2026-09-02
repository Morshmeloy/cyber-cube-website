import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from src.core.dependencies import get_current_user
from src.models.user import User
from src.schemas.teacher import (
    DetailRequest,
    FreeQuestionRequest,
    MistakesRequest,
    StatusResponse,
)
from src.services.teacher_gateway import TeacherGatewayError, teacher_gateway

router = APIRouter(prefix="/teacher", tags=["teacher"])


async def proxy(path: str, payload: dict):
    try:
        await teacher_gateway.acquire()
    except TeacherGatewayError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    async def generate():
        try:
            async for chunk in teacher_gateway.stream(path, payload):
                yield chunk
        except asyncio.CancelledError:
            raise
        except TeacherGatewayError as error:
            data = json.dumps({"error": str(error)}, ensure_ascii=False)
            yield f"data: {data}\n\n".encode()
        finally:
            teacher_gateway.release()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/status", response_model=StatusResponse)
async def status(_: User = Depends(get_current_user)):
    try:
        return await teacher_gateway.status()
    except TeacherGatewayError as error:
        return StatusResponse(ready=False, detail=str(error))


@router.post("/chat/stream")
async def mistakes(payload: MistakesRequest, _: User = Depends(get_current_user)):
    return await proxy("/v1/chat/mistakes", payload.model_dump(by_alias=True))


@router.post("/chat/detail/stream")
async def detail(payload: DetailRequest, _: User = Depends(get_current_user)):
    return await proxy("/v1/chat/detail", payload.model_dump())


@router.post("/chat/free/stream")
async def free(payload: FreeQuestionRequest, _: User = Depends(get_current_user)):
    return await proxy("/v1/chat/free", payload.model_dump())
