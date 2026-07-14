from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # для разработки
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Временная база пользователей
users_db = {
    "admin": {"password": "admin", "role": "admin"},
    "engineer": {"password": "eng", "role": "engineer"},
    "accountant": {"password": "acc", "role": "accountant"},
    "employee": {"password": "emp", "role": "employee"},
}


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    role: str


@app.post("/api/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    user = users_db.get(request.username)
    if not user or user["password"] != request.password:
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    # Простой токен (позже заменим на JWT)
    token = f"fake-token-{request.username}"
    return LoginResponse(token=token, role=user["role"])


# (Позже добавим другие эндпоинты: /api/warehouse, /api/docs, /api/finance)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=9000)
