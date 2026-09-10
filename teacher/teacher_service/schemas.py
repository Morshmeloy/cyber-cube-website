from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _validate_options(options: list[str]) -> list[str]:
    if any(not option.strip() or len(option) > 1_000 for option in options):
        raise ValueError("Every option must contain 1-1000 characters")
    return options


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

    _options = field_validator("options")(_validate_options)

    correct_answers: list[int] | None = Field(default=None, max_length=20)
    selected_answers: list[int] | None = Field(default=None, max_length=20)

    @model_validator(mode="after")
    def validate_answer_sets(self):
        for values in (self.correct_answers, self.selected_answers):
            if values is not None and (len(set(values)) != len(values) or any(i < 0 or i >= len(self.options) for i in values)):
                raise ValueError("Answer indices must be unique and inside options")
        if hasattr(self, "user_answer") and self.user_answer is not None and self.user_answer >= len(self.options):
            raise ValueError("Selected answer index is outside options")
        if self.correct_answers == []:
            raise ValueError("At least one correct answer is required")
        return self

    @field_validator("correct")
    @classmethod
    def correct_must_exist(cls, value: int, info):
        if (options := info.data.get("options")) is not None and value >= len(options):
            raise ValueError("Correct answer index is outside options")
        return value


class MistakesRequest(BaseModel):
    mistakes: list[Mistake] = Field(min_length=1, max_length=100)


class DetailRequest(BaseModel):
    id: int = Field(ge=1, le=1_000_000)
    question: str = Field(min_length=1, max_length=2_000)
    options: list[str] = Field(min_length=2, max_length=20)
    correct: int = Field(ge=0)
    previous_explanation: str = Field(min_length=1, max_length=8_000)
    src: str = Field(default="", max_length=500)

    _options = field_validator("options")(_validate_options)

    correct_answers: list[int] | None = Field(default=None, max_length=20)
    selected_answers: list[int] | None = Field(default=None, max_length=20)

    @model_validator(mode="after")
    def validate_answer_sets(self):
        for values in (self.correct_answers, self.selected_answers):
            if values is not None and (len(set(values)) != len(values) or any(i < 0 or i >= len(self.options) for i in values)):
                raise ValueError("Answer indices must be unique and inside options")
        if hasattr(self, "user_answer") and self.user_answer is not None and self.user_answer >= len(self.options):
            raise ValueError("Selected answer index is outside options")
        if self.correct_answers == []:
            raise ValueError("At least one correct answer is required")
        return self

    @field_validator("correct")
    @classmethod
    def correct_must_exist(cls, value: int, info):
        if (options := info.data.get("options")) is not None and value >= len(options):
            raise ValueError("Correct answer index is outside options")
        return value


class FreeQuestionRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2_000)
    context: list[ChatTurn] = Field(default_factory=list, max_length=6)

    @model_validator(mode="after")
    def bound_context(self):
        if sum(len(turn.content) for turn in self.context) > 6000:
            raise ValueError("Conversation context exceeds 6000 characters")
        return self
