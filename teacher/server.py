#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Сервер учителя для теста по Таненбауму.

Полная версия с:
- RAG через ChromaDB
- локальная LLM llama.cpp
- SSE потоковая генерация
- история диалогов
- тестовые объяснения
"""

import json
import sys
import signal
import traceback
import threading

from collections import defaultdict, deque

from flask import (
    Flask,
    request,
    jsonify,
    Response,
    stream_with_context,
)

from flask_cors import CORS

import chromadb

from llama_cpp import Llama


# ==========================================================
# CONFIGURATION
# ==========================================================


MODEL_PATH = (
    "models/saiga_mistral_7b.Q4_K_M.gguf"
)


CHROMA_DIR = (
    "chroma_db"
)


COLLECTION_NAME = (
    "tanenbaum_networks"
)


# Размер контекста модели
LLAMA_CONTEXT_SIZE = 4096


# GPU layers
# -1 = все доступные слои
LLAMA_GPU_LAYERS = -1


# Размер batch
LLAMA_BATCH = 256

# Параметры генерации
LLAMA_TOP_P = 0.8
LLAMA_TOP_K = 30
LLAMA_REPEAT_PENALTY = 1.1
LLAMA_TEMPERATURE_EXPLANATION = 0.25
LLAMA_TEMPERATURE_DETAIL = 0.35
LLAMA_TEMPERATURE_FREE = 0.35

MAX_TOKENS_EXPLANATION = 280
MAX_TOKENS_DETAIL = 360
MAX_TOKENS_FREE = 420

RAG_K_EXPLANATION = 2
RAG_K_DETAIL = 2
RAG_K_FREE = 3

STOP_SEQUENCES = [
    "\nВопрос:",
    "\nПравильный ответ:",
    "\nКонтекст:",
    "\nПодробное объяснение:",
    "\nОтвет:",
]

# Максимальная история чата
HISTORY_MAXLEN = 12


# ==========================================================
# FLASK INIT
# ==========================================================


app = Flask(
    __name__,
    static_folder="static",
    template_folder="templates"
)


CORS(app)



# ==========================================================
# GLOBAL STATE
# ==========================================================


llm = None


collection = None


model_ready = False



# llama.cpp не является полностью потокобезопасным.
# Один генератор одновременно.

llm_lock = threading.Lock()



# История свободного чата

conversation_store = defaultdict(
    lambda: deque(
        maxlen=HISTORY_MAXLEN
    )
)


conversation_store_lock = threading.Lock()



# Кеш объяснений

explanation_cache = {}



# ==========================================================
# LOAD COMPONENTS
# ==========================================================


def load_components():

    """
    Загрузка:
    1. LLM
    2. ChromaDB
    """

    global llm
    global collection
    global model_ready


    print(
        "⏳ Загрузка LLM...",
        flush=True
    )


    try:

        llm = Llama(

            model_path=MODEL_PATH,

            n_ctx=LLAMA_CONTEXT_SIZE,

            n_gpu_layers=LLAMA_GPU_LAYERS,

            n_batch=LLAMA_BATCH,

            verbose=False,

            seed=42
        )


        print(
            "✅ LLM загружена",
            flush=True
        )


    except Exception as e:


        print(
            f"❌ Ошибка LLM: {e}",
            flush=True
        )


        llm = None



    print(
        "⏳ Подключение ChromaDB...",
        flush=True
    )


    try:


        chroma_client = (
            chromadb.PersistentClient(
                path=CHROMA_DIR
            )
        )


        collection = (
            chroma_client.get_collection(
                name=COLLECTION_NAME
            )
        )


        print(
            f"✅ ChromaDB подключена. "
            f"Документов: {collection.count()}",
            flush=True
        )


    except Exception as e:


        print(
            f"❌ Ошибка ChromaDB: {e}",
            flush=True
        )


        collection = None



    model_ready = (
        llm is not None
        and collection is not None
    )



load_components()



# ==========================================================
# SIGNALS
# ==========================================================


def signal_handler(sig, frame):

    print(
        "\n⏳ Завершение сервера...",
        flush=True
    )

    sys.exit(0)



signal.signal(
    signal.SIGINT,
    signal_handler
)


signal.signal(
    signal.SIGTERM,
    signal_handler
)



# ==========================================================
# RAG
# ==========================================================


def retrieve_context(
        query,
        k=3
):

    """
    Поиск релевантных документов
    """

    if collection is None:

        return ""


    try:


        result = collection.query(

            query_texts=[
                query
            ],

            n_results=k

        )


        docs = result.get(
            "documents",
            [[]]
        )[0]


        return "\n\n".join(
            docs
        )


    except Exception as e:


        print(
            f"Ошибка ChromaDB: {e}"
        )


        return ""

def build_explanation_prompt(mistake):
    query = "{} {}".format(
        mistake.get("question", ""),
        mistake.get("src", ""),
    ).strip()

    context = retrieve_context(query, k=RAG_K_EXPLANATION)
    correct_text = mistake["options"][mistake["correct"]]

    prompt = (
        "Ты преподаватель по компьютерным сетям. "
        "Сформулируй объяснение только текстом, без служебных меток и без повторения структуры prompt. "
        "Используй только контекст и правильный ответ. "
        "Начинай сразу с объяснения.\n"
        f"Вопрос: {mistake['question']}\n"
        f"Правильный ответ: {correct_text}\n"
        f"Контекст: {context}\n"
        "Объяснение:"
    )

    return prompt

# ==========================================================
# HISTORY
# ==========================================================


def get_user_id(data):

    if not data:

        return "anonymous"


    user_id = (
        data.get(
            "user_id",
            "anonymous"
        )
    )


    return (
        str(user_id).strip()
        or
        "anonymous"
    )



def build_history_messages(
        user_id
):

    with conversation_store_lock:

        return list(
            conversation_store[user_id]
        )



def push_history(
        user_id,
        role,
        content
):

    with conversation_store_lock:

        conversation_store[user_id].append(

            {
                "role": role,

                "content": content
            }

        )



def format_history_text(history):

    if not history:

        return ""


    lines = [
        "Предыдущие сообщения:"
    ]


    for msg in history:

        role = (
            "Пользователь"
            if msg["role"]=="user"
            else
            "Учитель"
        )


        lines.append(
            f"{role}: {msg['content']}"
        )


    return (
        "\n".join(lines)
        +
        "\n\n"
    )



# ==========================================================
# LLM STREAM CORE
# ==========================================================


def llm_complete(
    prompt,
    max_tokens,
    temperature,
    stop=None,
    stream=False,
):
    """Create a completion with standard model settings."""
    return llm.create_completion(
        prompt,
        max_tokens=max_tokens,
        temperature=temperature,
        top_p=LLAMA_TOP_P,
        top_k=LLAMA_TOP_K,
        repeat_penalty=LLAMA_REPEAT_PENALTY,
        stream=stream,
        stop=stop,
    )


def stream_llm(prompt, max_tokens=500, temperature=0.4, stop=None):
    """Универсальный генератор токенов."""
    stream = llm_complete(
        prompt,
        max_tokens=max_tokens,
        temperature=temperature,
        stop=stop,
        stream=True,
    )

    for chunk in stream:
        text = chunk["choices"][0]["text"]
        if text:
            yield text


# ==========================================================
# SSE RESPONSE HELPERS
# ==========================================================


def sse_event(data):

    """
    Формирование SSE сообщения.

    Формат:

    data: {...}

    пустая строка обязательна
    """

    return (
        "data: "
        +
        json.dumps(
            data,
            ensure_ascii=False
        )
        +
        "\n\n"
    )



def create_stream_response(generator):

    """
    Единый Response для всех SSE endpoint.
    """

    return Response(

        stream_with_context(
            generator()
        ),

        mimetype="text/event-stream",

        headers={

            # запрещаем кеширование
            "Cache-Control":
                "no-cache, no-transform",


            # постоянное соединение
            "Connection":
                "keep-alive",


            # nginx не должен буферизовать поток
            "X-Accel-Buffering":
                "no"
        }
    )



# ==========================================================
# SERVICE ENDPOINTS
# ==========================================================


@app.route(
    "/api/model_status"
)
def model_status():


    return jsonify(

        {

            "ready":
                model_ready,


            "llm_loaded":
                llm is not None,


            "db_loaded":
                collection is not None,


            "doc_count":
                (
                    collection.count()
                    if collection
                    else
                    0
                )
        }
    )




@app.route(
    "/api/reset",
    methods=["POST"]
)
def reset_state():


    explanation_cache.clear()


    return jsonify(

        {

            "status":
                "ok",

            "message":
                "Кеш очищен"

        }

    )



# ==========================================================
# STREAM FOR QUIZ ERRORS
# ==========================================================


@app.route(
    "/api/chat/stream",
    methods=["POST"]
)
def chat_stream():


    if not model_ready:


        return jsonify(

            {
                "error":
                    "Модель не загружена"
            }

        ),503



    data = request.get_json(
        silent=True
    )


    if not data or "mistakes" not in data:


        return jsonify(

            {
                "error":
                    "Неверный запрос"
            }

        ),400



    mistakes = data["mistakes"]



    if not isinstance(
            mistakes,
            list
        ):


        return jsonify(

            {
                "error":
                    "Неверный формат"
            }

        ),400




    def generate():


        # сразу уведомляем браузер

        yield ":\n\n"



        for mistake in mistakes:


            q_id = mistake.get(
                "id"
            )



            yield sse_event(

                {
                    "id":
                        q_id,

                    "start":
                        True
                }

            )



            try:


                prompt = (
                    build_explanation_prompt(
                        mistake
                    )
                )



                with llm_lock:


                    for token in stream_llm(
                        prompt,
                        max_tokens=MAX_TOKENS_EXPLANATION,
                        temperature=LLAMA_TEMPERATURE_EXPLANATION,
                        stop=STOP_SEQUENCES,
                    ):


                        yield sse_event(

                            {

                                "id":
                                    q_id,


                                "token":
                                    token

                            }

                        )



                yield sse_event(

                    {

                        "id":
                            q_id,

                        "done":
                            True

                    }

                )



            except Exception as e:


                yield sse_event(

                    {

                        "id":
                            q_id,

                        "error":
                            str(e)

                    }

                )



        yield sse_event(

            {
                "all_done":
                    True
            }

        )



    return create_stream_response(
        generate
    )



# ==========================================================
# STREAM DETAIL EXPLANATION
# ==========================================================


@app.route(
    "/api/chat/detail/stream",
    methods=["POST"]
)
def chat_detail_stream():


    if not model_ready:


        return jsonify(

            {
                "error":
                    "Модель не загружена"
            }

        ),503




    data = request.get_json(
        silent=True
    )



    required = [

        "id",

        "question",

        "options",

        "correct",

        "previous_explanation"

    ]



    if not all(
            key in data
            for key in required
        ):


        return jsonify(

            {
                "error":
                    "Недостаточно полей"
            }

        ),400




    q_id = data["id"]


    question = data["question"]


    correct_text = (
        data["options"]
        [
            data["correct"]
        ]
    )


    previous = (
        data["previous_explanation"]
    )



    context = retrieve_context(

        question,

        k=3

    )



    prompt = (
        "Ты преподаватель по компьютерным сетям. "
        "Добавь подробностей только к уже данному объяснению. "
        "Не повторяй вопрос, не выводи служебные метки и не возвращай структуру prompt. "
        "Начинай сразу с дополнительной информации.\n"
        f"Ранее объяснение: {previous}\n"
        f"Вопрос: {question}\n"
        f"Правильный ответ: {correct_text}\n"
        f"Контекст: {context}\n"
        "Подробное объяснение:"
    )




    def generate():


        yield ":\n\n"



        yield sse_event(

            {

                "id":
                    q_id,

                "start":
                    True

            }

        )



        try:


            with llm_lock:


                for token in stream_llm(

                    prompt,

                    max_tokens=MAX_TOKENS_DETAIL,

                    temperature=LLAMA_TEMPERATURE_DETAIL,

                    stop=STOP_SEQUENCES

                ):


                    yield sse_event(

                        {

                            "id":
                                q_id,

                            "token":
                                token

                        }

                    )




            yield sse_event(

                {

                    "id":
                        q_id,

                    "done":
                        True

                }

            )



        except Exception as e:


            yield sse_event(

                {

                    "id":
                        q_id,

                    "error":
                        str(e)

                }

            )



    return create_stream_response(
        generate
    )


# ==========================================================
# FREE CHAT STREAM
# ==========================================================


@app.route(
    "/api/chat/free/stream",
    methods=["POST"]
)
def chat_free_stream():


    if not model_ready:


        return jsonify(

            {
                "error":
                    "Модель не загружена"
            }

        ),503




    data = request.get_json(
        silent=True
    )



    if not data or "question" not in data:


        return jsonify(

            {
                "error":
                    "Нет вопроса"
            }

        ),400




    question = (
        data["question"]
        .strip()
    )



    if not question:


        return jsonify(

            {
                "error":
                    "Пустой вопрос"
            }

        ),400




    user_id = get_user_id(
        data
    )



    history = build_history_messages(
        user_id
    )



    history_text = format_history_text(
        history
    )



    context = retrieve_context(

        question,

        k=4

    )



    if not context:


        context = retrieve_context(

            "компьютерные сети",

            k=2

        )




    prompt = (
        "Ты преподаватель по компьютерным сетям. "
        "Отвечай только на основе контекста и истории диалога. "
        "Если ответ неизвестен, скажи прямо. "
        "Не повторяй вопрос, не выводи дополнительные метки и не возвращай структуру prompt.\n"
        f"{history_text}"
        f"Контекст: {context}\n"
        f"Вопрос: {question}\n"
        "Ответ:"
    )




    def generate():


        yield ":\n\n"


        answer=[]



        try:


            yield sse_event(

                {
                    "status":
                        "generating"
                }

            )



            with llm_lock:


                for token in stream_llm(

                    prompt,

                    max_tokens=500,

                    temperature=0.4

                ):


                    answer.append(
                        token
                    )



                    yield sse_event(

                        {

                            "token":
                                token

                        }

                    )




            final_answer = (
                "".join(answer)
                .strip()
            )



            push_history(

                user_id,

                "user",

                question

            )



            push_history(

                user_id,

                "assistant",

                final_answer

            )



            yield sse_event(

                {

                    "done":
                        True,

                    "answer":
                        final_answer

                }

            )



        except Exception as e:


            traceback.print_exc()



            yield sse_event(

                {

                    "error":
                        str(e)

                }

            )



    return create_stream_response(
        generate
    )



# ==========================================================
# SYNCHRONOUS COMPATIBILITY API
# ==========================================================


@app.route(
    "/api/chat/free",
    methods=["POST"]
)
def chat_free():

    if not model_ready:

        return jsonify(
            {
                "error":
                    "Модель не загружена"
            }
        ),503



    data=request.get_json()


    question=data["question"]



    context=retrieve_context(
        question,
        k=4
    )



    prompt = (
        "Ты преподаватель по компьютерным сетям. "
        "Отвечай кратко и по существу, используя только контекст. "
        "Не повторяй вопрос и не выводи служебные метки.\n"
        f"Контекст: {context}\n"
        f"Вопрос: {question}\n"
        "Ответ:"
    )

    with llm_lock:
        result = llm_complete(
            prompt,
            max_tokens=MAX_TOKENS_FREE,
            temperature=LLAMA_TEMPERATURE_FREE,
            stop=STOP_SEQUENCES,
            stream=False,
        )

    answer = (
        result["choices"][0]["text"]
        .strip()
    )



    return jsonify(

        {
            "answer":
                answer
        }

    )




@app.route(
    "/api/chat/detail",
    methods=["POST"]
)
def chat_detail():


    data=request.get_json()



    question=data["question"]



    context=retrieve_context(
        question,
        k=3
    )



    prompt = (
        "Ты преподаватель по компьютерным сетям. "
        "Отвечай развёрнуто и поясни ключевые детали. "
        "Используй только контекст и не добавляй лишних меток.\n"
        f"Контекст: {context}\n"
        f"Вопрос: {question}\n"
        "Подробный ответ:"
    )

    with llm_lock:
        result = llm_complete(
            prompt,
            max_tokens=MAX_TOKENS_DETAIL,
            temperature=LLAMA_TEMPERATURE_DETAIL,
            stop=STOP_SEQUENCES,
            stream=False,
        )



    answer = (
        result["choices"][0]["text"]
        .strip()
    )



    return jsonify(

        {
            "detail":
                answer
        }

    )



# ==========================================================
# HISTORY API
# ==========================================================
# ==========================================================
# QUIZ CHAT COMPATIBILITY API
# ==========================================================


@app.route(
    "/api/chat",
    methods=["POST"]
)
def chat():

    if not model_ready:

        return jsonify(
            {
                "error":
                "Модель не загружена"
            }
        ),503



    data = request.get_json(
        silent=True
    )


    if not data or "mistakes" not in data:

        return jsonify(
            {
                "error":
                "Неверный запрос"
            }
        ),400



    mistakes = data["mistakes"]


    explanations=[]



    for mistake in mistakes:


        q_id = mistake.get(
            "id"
        )


        try:


            prompt = build_explanation_prompt(
                mistake
            )


            with llm_lock:
                result = llm_complete(
                    prompt,
                    max_tokens=MAX_TOKENS_EXPLANATION,
                    temperature=LLAMA_TEMPERATURE_EXPLANATION,
                    stop=STOP_SEQUENCES,
                    stream=False
                )



            text = (

                result["choices"][0]["text"]

                .strip()

            )


            explanations.append(

                {

                    "id":
                        q_id,


                    "explanation":
                        text

                }

            )


        except Exception as e:


            explanations.append(

                {

                    "id":
                        q_id,


                    "explanation":
                        f"Ошибка: {e}"

                }

            )



    return jsonify(

        {
            "explanations":
                explanations
        }

    )

@app.route(
    "/api/chat/history",
    methods=["GET"]
)
def chat_history():


    user_id = request.args.get(

        "user_id",

        "anonymous"

    )



    return jsonify(

        {

            "user_id":
                user_id,


            "history":
                build_history_messages(
                    user_id
                )

        }

    )




@app.route(
    "/api/chat/history",
    methods=["DELETE"]
)
def clear_chat_history():


    user_id=request.args.get(

        "user_id",

        "anonymous"

    )



    with conversation_store_lock:


        conversation_store.pop(

            user_id,

            None

        )



    return jsonify(

        {
            "ok":
                True
        }

    )



# ==========================================================
# STATIC
# ==========================================================


@app.route(
    "/questions.js"
)
def serve_questions_js():


    return app.send_static_file(

        "questions.js"

    )



@app.route(
    "/quiz.js"
)
def serve_quiz_js():


    return app.send_static_file(

        "quiz.js"

    )



@app.route(
    "/styles/<path:filename>"
)
def serve_styles(filename):


    return app.send_static_file(

        filename

    )



# ==========================================================
# RUN
# ==========================================================


if __name__ == "__main__":


    app.run(

        host="0.0.0.0",

        port=5000,

        debug=False,

        threaded=True

    )