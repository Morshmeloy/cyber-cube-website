"""
Индексация PDF книги Таненбаума.
Создаёт ChromaDB коллекцию с чанками текста без привязки к главам.
Запускается один раз: python index_pdf.py
"""

import fitz  # PyMuPDF
import os
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
import chromadb
from chromadb.config import Settings

# --- Настройки ---
PDF_PATH = "data/Tanenbaum_E__Fimster_N__Uezeroll_D_-_Kompyuternye_seti_6-e_izd__Klassika_computer_science_-_2023.pdf"
CHROMA_DIR = "chroma_db"
COLLECTION_NAME = "tanenbaum_networks"
EMBED_MODEL = "BAAI/bge-m3"  # или "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

# --- Проверка файла ---
if not os.path.exists(PDF_PATH):
    raise FileNotFoundError(f"PDF не найден: {PDF_PATH}")

# --- 1. Извлечение текста ---
print("⏳ Извлечение текста из PDF...")
doc = fitz.open(PDF_PATH)
total_pages = len(doc)
full_text = ""
for page in doc:
    full_text += page.get_text() + "\n"
doc.close()
print(f"✅ Извлечено страниц: {total_pages}, символов: {len(full_text)}")

# --- 2. Разбивка на чанки ---
print("⏳ Разбивка текста на чанки...")
splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    separators=["\n\n", "\n", " ", ""]
)
chunks = splitter.split_text(full_text)
print(f"✅ Чанков создано: {len(chunks)}")

# --- 3. Векторизация и сохранение в ChromaDB ---
print(f"⏳ Загрузка модели эмбеддингов {EMBED_MODEL}...")
embeddings = HuggingFaceEmbeddings(model_name=EMBED_MODEL)
print("✅ Модель загружена.")

client = chromadb.PersistentClient(path=CHROMA_DIR)
# Удаляем старую коллекцию, если есть
try:
    client.delete_collection(name=COLLECTION_NAME)
    print(f"Старая коллекция '{COLLECTION_NAME}' удалена.")
except:
    pass
collection = client.create_collection(name=COLLECTION_NAME)

BATCH_SIZE = 100
for i in range(0, len(chunks), BATCH_SIZE):
    batch = chunks[i:i+BATCH_SIZE]
    ids = [str(j) for j in range(i, i+len(batch))]
    # Используем метаданные с пометкой "fallback"
    collection.add(
        documents=batch,
        ids=ids,
        metadatas=[{"source": "fallback"} for _ in batch]
    )
    print(f"Прогресс: {i+len(batch)}/{len(chunks)}")

print(f"✅ Индексация завершена. Документов в коллекции: {collection.count()}")