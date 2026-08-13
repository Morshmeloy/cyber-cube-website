from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from src.core.config import settings
from src.core.database import AsyncSessionLocal
from src.routes import auth
from src.routes import warehouse
from src.routes import admin
from src.routes import documents
from src.services.warehouse_service import WarehouseService

scheduler = AsyncIOScheduler()


async def _scheduled_sync() -> None:
    async with AsyncSessionLocal() as db:
        service = WarehouseService(db)
        await service._perform_sync()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(_scheduled_sync, "interval", minutes=60, id="onec_sync")
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    lifespan=lifespan,
)
app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(warehouse.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/ping")
async def ping():
    return {"message": "pong"}
