"""
Сервер учителя для теста по Таненбауму.
Загружает LLM и ChromaDB, предоставляет эндпоинт для объяснения ошибок.
"""
import os
import json
import traceback
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import chromadb
from llama_cpp import Llama

# ==================== КОНФИГУРАЦИЯ ====================
MODEL_PATH = "models/saiga_mistral_7b.Q4_K_M.gguf"
CHROMA_DIR = "chroma_db"
COLLECTION_NAME = "tanenbaum_networks"
LLAMA_CONTEXT_SIZE = 2048
LLAMA_GPU_LAYERS = -1   # 0 - CPU

# ==================== ИНИЦИАЛИЗАЦИЯ FLASK ====================
app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# ==================== ГЛОБАЛЬНЫЕ КОМПОНЕНТЫ ====================
model_ready = False
llm = None
collection = None

# ==================== ЗАГРУЗКА МОДЕЛИ И БД ====================
print("⏳ Загрузка LLM...")
try:
    llm = Llama(
        model_path=MODEL_PATH,
        n_ctx=LLAMA_CONTEXT_SIZE,
        n_gpu_layers=LLAMA_GPU_LAYERS,
        verbose=False,   # убираем лишний шум
        seed=42
    )
    print("✅ LLM готова.")
except Exception as e:
    print(f"❌ Ошибка загрузки LLM: {e}")
    llm = None

print("⏳ Подключение к ChromaDB...")
try:
    chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
    collection = chroma_client.get_collection(name=COLLECTION_NAME)
    doc_count = collection.count()
    print(f"✅ Коллекция '{COLLECTION_NAME}', документов: {doc_count}")
except Exception as e:
    print(f"❌ Ошибка ChromaDB: {e}")
    collection = None

model_ready = llm is not None and collection is not None

# ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
def retrieve_context(query, k=3):
    """Ищет в ChromaDB чанки, релевантные запросу."""
    if collection is None:
        return ""
    try:
        results = collection.query(query_texts=[query], n_results=k)
        docs = results['documents'][0] if results['documents'] else []
        return "\n\n".join(docs)
    except Exception as e:
        print(f"Ошибка поиска в ChromaDB: {e}")
        return ""

explanation_cache = {}

def generate_explanation(mistake):
    q_id = mistake.get('id')
    if q_id in explanation_cache:
        print(f"✅ Объяснение для ID={q_id} взято из кеша.")
        return explanation_cache[q_id]
    query = f"{mistake.get('question', '')} {mistake.get('src', '')}"
    context = retrieve_context(query, k=2)
    if not context:
        context = retrieve_context("компьютерные сети", k=2)

    # Вычисляем правильный ответ (текст)
    correct_text = mistake['options'][mistake['correct']]

    prompt = f"""Ты — преподаватель по компьютерным сетям. Твоя задача — объяснить, почему правильный ответ на вопрос является верным. Не анализируй ошибку ученика, не говори "вы ошиблись". Просто дай чёткое, учебное объяснение, основанное ТОЛЬКО на приведённом контексте из учебника Таненбаума. Не домысливай.

Вопрос: {mistake['question']}
Правильный ответ: {correct_text}

Контекст из учебника:
{context}

Требования к ответу:
- Дай объяснение из 3-5 полных, законченных предложений.
- Не обрывай ответ на середине слова или предложения.
- Если контекста недостаточно, так и скажи, но всё равно объясни общими словами.

Объяснение:"""

    print(f"🤖 Генерация объяснения для вопроса ID={mistake.get('id')}...")
    response = llm(prompt, max_tokens=300, temperature=0.3)  # низкая температура для фактов
    explanation = response['choices'][0]['text'].strip()
    print(f"✅ Объяснение для ID={mistake.get('id')} готово.")
    explanation_cache[q_id] = explanation
    return explanation

@app.route('/api/chat/detail', methods=['POST'])
def chat_detail():
    if not model_ready:
        return jsonify({"error": "Модель ещё не загружена"}), 503

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Неверный формат запроса"}), 400

    required = ['id', 'question', 'options', 'correct', 'previous_explanation']
    if not all(k in data for k in required):
        return jsonify({"error": "Отсутствуют обязательные поля"}), 400

    q_id = data['id']
    question = data['question']
    options = data['options']
    correct_idx = data['correct']
    prev_expl = data['previous_explanation']

    correct_text = options[correct_idx]

    # Ищем контекст ещё раз (можно взять тот же)
    context = retrieve_context(question + " " + data.get('src', ''), k=3)
    if not context:
        context = retrieve_context("компьютерные сети", k=3)

    prompt = f"""Ты — преподаватель по компьютерным сетям. Ранее ты дал такое объяснение:
{prev_expl}

Теперь расскажи об этом же вопросе подробнее. Добавь больше деталей, примеров, ссылок на контекст из учебника.
Вопрос: {question}
Правильный ответ: {correct_text}
Контекст из учебника:
{context}

Подробное объяснение (5-7 предложений, без обрыва мыслей):"""

    print(f"🔍 Генерация детального объяснения для вопроса ID={q_id}...")
    response = llm(prompt, max_tokens=400, temperature=0.5)
    detail = response['choices'][0]['text'].strip()
    print(f"✅ Детальное объяснение готово.")
    return jsonify({"id": q_id, "detail": detail})

# ==================== API ====================
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/model_status')
def model_status():
    return jsonify({
        "ready": model_ready,
        "llm_loaded": llm is not None,
        "db_loaded": collection is not None,
        "doc_count": collection.count() if collection else 0
    })

@app.route('/api/chat', methods=['POST'])
def chat():
    if not model_ready:
        return jsonify({"error": "Модель ещё не загружена"}), 503

    data = request.get_json(silent=True)
    if not data or 'mistakes' not in data:
        return jsonify({"error": "Неверный формат запроса. Ожидается JSON с ключом 'mistakes'."}), 400

    mistakes = data['mistakes']
    if not isinstance(mistakes, list) or len(mistakes) == 0:
        return jsonify({"error": "Список ошибок пуст."}), 400

    explanations = []
    for idx, m in enumerate(mistakes, 1):
        try:
            print(f"📚 Объясняю вопрос {idx} из {len(mistakes)} (ID={m.get('id')})")
            expl = generate_explanation(m)
            explanations.append({
                "id": m.get('id'),
                "explanation": expl
            })
        except Exception as e:
            print(f"❌ Ошибка при объяснении вопроса ID={m.get('id')}: {e}")
            traceback.print_exc()
            explanations.append({
                "id": m.get('id'),
                "explanation": f"Не удалось сгенерировать объяснение: {str(e)}"
            })

    return jsonify({"explanations": explanations})
import flask

@app.route('/questions.js')
def serve_questions_js():
    return flask.send_from_directory('.', 'questions.js')

@app.route('/quiz.js')
def serve_quiz_js():
    return flask.send_from_directory('.', 'quiz.js')

@app.route('/styles/<path:filename>')
def serve_styles(filename):
    return flask.send_from_directory('styles', filename)

@app.route('/api/chat/free', methods=['POST'])
def chat_free():
    """Свободный диалог с ИИ-агентом с учётом истории сообщений."""
    if not model_ready:
        return jsonify({"error": "Модель ещё не загружена"}), 503

    data = request.get_json(silent=True)
    if not data or 'question' not in data:
        return jsonify({"error": "Неверный запрос. Ожидается поле 'question'."}), 400

    question = data['question'].strip()
    if not question:
        return jsonify({"error": "Вопрос не может быть пустым."}), 400

    # Получаем историю диалога (если передана)
    context_messages = data.get('context', [])
    # Формируем историю в виде текста для промпта
    history_text = ""
    if context_messages:
        # Берём последние 5-6 сообщений для контекста
        recent = context_messages[-6:]
        history_text = "Предыдущие сообщения:\n"
        for msg in recent:
            role = "Пользователь" if msg['role'] == 'user' else "Учитель"
            history_text += f"{role}: {msg['content']}\n"
        history_text += "\n"

    # Ищем релевантные фрагменты из книги
    context = retrieve_context(question, k=4)
    if not context:
        context = retrieve_context("компьютерные сети", k=2)

    # Формируем промпт с учётом истории
    prompt = f"""Ты — преподаватель по компьютерным сетям, эксперт по книге Таненбаума «Компьютерные сети» (6-е издание).
Твоя задача — отвечать на вопросы пользователя, используя ТОЛЬКО информацию из приведённого ниже контекста.
Если ответа нет в контексте, так и скажи, не домысливай.
При ответе учитывай историю диалога, чтобы давать последовательные и релевантные ответы.

{history_text}

Контекст из учебника:
{context}

Вопрос пользователя: {question}

Ответ (чётко, аргументированно, на русском языке, 3-5 предложений. Если нужно, приведи примеры или аналогии, но только из контекста):"""

    print(f"💬 Свободный вопрос: {question[:50]}...")
    response = llm(prompt, max_tokens=500, temperature=0.4)
    answer = response['choices'][0]['text'].strip()

    return jsonify({"answer": answer, "context_used": context[:200] + "..."})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)