from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4_000)


class Mistake(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: int = Field(ge=1, le=1_000_000)
    question: str = Field(min_length=1, max_length=2_000)
    options: list[str] = Field(min_length=2, max_length=20)
    correct: int = Field(ge=0)
    user_answer: int | None = Field(default=None, alias="userAnswer", ge=0)
    src: str = Field(default="", max_length=500)

    @field_validator("correct")
    @classmethod
    def correct_must_exist(cls, value: int, info):
        if (options := info.data.get("options")) is not None and value >= len(options):
            raise ValueError("Correct answer index is outside options")
        return value


class MistakesRequest(BaseModel):
    mistakes: list[Mistake] = Field(min_length=1, max_length=100)


class DetailRequest(BaseModel):
    id: int = Field(ge=1)
    question: str = Field(min_length=1, max_length=2_000)
    options: list[str] = Field(min_length=2, max_length=20)
    correct: int = Field(ge=0)
    previous_explanation: str = Field(min_length=1, max_length=8_000)
    src: str = Field(default="", max_length=500)

    @field_validator("correct")
    @classmethod
    def correct_must_exist(cls, value: int, info):
        if (options := info.data.get("options")) is not None and value >= len(options):
            raise ValueError("Correct answer index is outside options")
        return value


class FreeQuestionRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2_000)
    context: list[ChatTurn] = Field(default_factory=list, max_length=12)


class StatusResponse(BaseModel):
    ready: bool
    rag_ready: bool = False
    model: str | None = None
    embedding_model: str | None = None
    documents: int = 0
    detail: str | None = None
