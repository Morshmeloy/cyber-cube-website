import uuid
from pathlib import Path
from fastapi import UploadFile
from src.core.config import settings

_STORAGE_DIR = Path(settings.DOCUMENTS_STORAGE_DIR)


async def save_uploaded_file(upload: UploadFile) -> tuple[str, int]:
    """Сохраняет файл на диск потоково (чанками, не грузя целиком в память), возвращает
    (техническое имя на диске, размер в байтах)."""
    _STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    extension = Path(upload.filename or "").suffix
    stored_filename = f"{uuid.uuid4().hex}{extension}"
    destination = _STORAGE_DIR / stored_filename
    size = 0
    with destination.open("wb") as out_file:
        while chunk := await upload.read(1024 * 1024):
            size += len(chunk)
            out_file.write(chunk)
    return stored_filename, size


def get_file_path(stored_filename: str) -> Path:
    return _STORAGE_DIR / stored_filename
