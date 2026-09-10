import asyncio
from functools import wraps
from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from teacher_service import main
from teacher_service.schemas import Mistake, DetailRequest, FreeQuestionRequest
from teacher_service.prompts import explanation_messages
from teacher_service.retrieval import bm25_rank, reciprocal_rank_fusion, verified_quote
from teacher_service.rag import RagDocument, format_rag_context
from index_pdf import split_text


def async_test(fn):
    @wraps(fn)
    def run(*args, **kwargs):
        return asyncio.run(fn(*args, **kwargs))
    return run


def item(**kwargs):
    return dict(id=1, question='Select two', options=['alpha','beta','gamma'], correct=0, **kwargs)


def test_multi_answer_prompt():
    value = Mistake(**item(correct_answers=[0,2], selected_answers=[1,2]))
    prompt = explanation_messages(value, [])[-1]['content']
    assert 'alpha; gamma' in prompt and 'beta; gamma' in prompt

@pytest.mark.parametrize('indices', [[-1],[3],[1,1],[]])
def test_invalid_correct_indices(indices):
    with pytest.raises(ValidationError):
        Mistake(**item(correct_answers=indices))


def test_context_budget():
    with pytest.raises(ValidationError):
        FreeQuestionRequest(question='q', context=[dict(role='user',content='x'*4000)]*2)


def test_lexical_identifier_and_russian():
    assert bm25_rank('IEC-104', ['SMTP mail', 'IEC-104 protocol'])[0] == 1
    assert bm25_rank('маршрут', ['маршрут пакета', 'почтовый ящик']) == [0]
    assert bm25_rank('missing', ['a','b']) == []


def test_fusion_deduplicates():
    assert reciprocal_rank_fusion(['a','a','b'],['b','c'])[0] == 'b'


def test_quote_verification():
    assert verified_quote('TCP\nconnection', 'A TCP connection exists')
    assert not verified_quote('UDP connection', 'A TCP connection exists')
    assert not verified_quote('', 'A')


def test_page_provenance():
    out = format_rag_context([RagDocument('text', 7, 'book.pdf', 'TCP', 'iv')])
    assert 'PDF-страница: 7' in out and 'метка страницы: iv' in out


def test_chunking_terminates_and_bounds():
    for size, overlap in [(10,0),(10,9),(1200,180)]:
        pieces = split_text('abcdefghij'*500, size, overlap)
        assert pieces and all(0 < len(p) <= size for p in pieces)
    with pytest.raises(ValueError): split_text('text',10,10)


def request():
    return SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(
        generation_slots=asyncio.Semaphore(1), waiting_requests=0, admitted_requests=0)))

@async_test
async def test_burst_capacity_and_cancel(monkeypatch):
    monkeypatch.setattr(main.settings,'teacher_max_concurrent_generations',1)
    monkeypatch.setattr(main.settings,'teacher_max_waiting_requests',1)
    req = request()
    await main.acquire_slot(req)
    waiter = asyncio.create_task(main.acquire_slot(req))
    await asyncio.sleep(.01)
    with pytest.raises(HTTPException) as exc: await main.acquire_slot(req)
    assert exc.value.status_code == 429
    waiter.cancel()
    with pytest.raises(asyncio.CancelledError): await waiter
    assert req.app.state.waiting_requests == 0 and req.app.state.admitted_requests == 1

@async_test
async def test_stream_failure_releases_capacity():
    req = request()
    await main.acquire_slot(req)
    async def broken():
        raise ValueError('private-internal-detail')
        yield b''
    stream = main.stream_response(req,broken)
    chunks = b''.join([chunk async for chunk in stream.body_iterator])
    assert b'error' in chunks and b'private-internal-detail' not in chunks
    assert req.app.state.admitted_requests == 0
    assert not req.app.state.generation_slots.locked()

@async_test
async def test_timeout_releases_waiter(monkeypatch):
    req=request()
    await main.acquire_slot(req)
    monkeypatch.setattr(main.settings,'teacher_queue_timeout_seconds',.01)
    with pytest.raises(HTTPException): await main.acquire_slot(req)
    assert req.app.state.admitted_requests == 1 and req.app.state.waiting_requests == 0

@async_test
async def test_authenticated_http_concurrent_requests_keep_their_own_payload(monkeypatch):
    import httpx
    monkeypatch.setattr(main.settings, 'teacher_service_token', 't'*32)
    monkeypatch.setattr(main.settings, 'teacher_max_waiting_requests', 16)
    state = request().app.state
    class Rag:
        async def search(self, query): return []
    class Model:
        active = 0
        peak = 0
        async def chat_stream(self, messages, **kwargs):
            self.active += 1
            self.peak = max(self.peak, self.active)
            try:
                await asyncio.sleep(.005)
                yield messages[-1]['content']
            finally:
                self.active -= 1
    model=Model()
    state.rag=Rag(); state.ollama=model
    monkeypatch.setattr(main.app, 'state', state)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url='http://test') as client:
        bad = await client.post('/v1/chat/free',json={'question':'x'})
        assert bad.status_code == 401
        async def ask(i):
            return await client.post('/v1/chat/free', headers={'X-Teacher-Token':'t'*32}, json={'question':f'only-user-{i}'})
        replies = await asyncio.gather(*(ask(i) for i in range(8)))
        for i,response in enumerate(replies):
            assert response.status_code == 200
            assert f'only-user-{i}' in response.text and '"done":true' in response.text
            assert all(f'only-user-{j}' not in response.text for j in range(8) if j!=i)
        invalid = await client.post('/v1/chat/detail',headers={'X-Teacher-Token':'t'*32}, json=dict(item(correct_answers=[99]),previous_explanation='x'))
        assert invalid.status_code == 422
    assert model.peak == 1 and model.active == 0 and state.admitted_requests == 0

@async_test
async def test_stream_disconnect_releases_slot():
    req=request()
    await main.acquire_slot(req)
    async def slow():
        yield b'data: {}\n\n'
        await asyncio.sleep(100)
    response=main.stream_response(req,slow)
    await anext(response.body_iterator)
    await response.body_iterator.aclose()
    assert req.app.state.admitted_requests == 0
    assert not req.app.state.generation_slots.locked()

@async_test
async def test_ollama_incomplete_stream_is_not_success(monkeypatch):
    import httpx
    from teacher_service import ollama_client
    real_client=httpx.AsyncClient
    def handler(request):
        return httpx.Response(200,content=b'{"message":{"content":"partial"}}\n')
    monkeypatch.setattr(ollama_client.httpx,'AsyncClient',lambda **kwargs: real_client(transport=httpx.MockTransport(handler),**kwargs))
    client=ollama_client.OllamaClient(main.settings)
    with pytest.raises(ollama_client.OllamaError,match='до завершения'):
        _=[part async for part in client.chat_stream([{'role':'user','content':'x'}],max_tokens=10,temperature=0)]


def test_api_and_teacher_validation_contracts_match():
    import importlib.util
    from pathlib import Path
    path=Path(__file__).resolve().parents[2]/'backend/src/schemas/teacher.py'
    spec=importlib.util.spec_from_file_location('api_teacher_schema',path)
    module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    import teacher_service.schemas as internal
    for name in ['Mistake','DetailRequest','MistakesRequest','FreeQuestionRequest']:
        assert getattr(module,name).model_json_schema()==getattr(internal,name).model_json_schema()

@async_test
async def test_generation_deadline_releases_capacity(monkeypatch):
    req=request();await main.acquire_slot(req)
    monkeypatch.setattr(main.settings,'teacher_request_timeout_seconds',.01)
    async def slow():
        await asyncio.sleep(1)
        yield b'data: {}\n\n'
    response=main.stream_response(req,slow)
    body=b''.join([part async for part in response.body_iterator])
    assert b'error' in body and req.app.state.admitted_requests == 0

@async_test
async def test_real_chroma_hybrid_search_returns_provenance(tmp_path):
    from teacher_service.config import TeacherSettings
    from teacher_service.rag import RagStore
    class Embed:
        async def embed(self,query): return [[1.,0.,0.]]
    config=TeacherSettings(chroma_dir=str(tmp_path),chroma_collection='test-corpus',ollama_embed_model='test-embedding',rag_top_k=2)
    store=RagStore(config,Embed())
    collection=store.client.create_collection('test-corpus',metadata={'embedding_model':'test-embedding'})
    collection.add(ids=['mail','iec'],documents=['Почтовый протокол SMTP','IEC-104 передача телемеханики'],embeddings=[[1.,0.,0.],[0.,1.,0.]],metadatas=[{'page':2,'source':'a.pdf'},{'page':17,'source':'b.pdf','chapter':'Телемеханика','page_label':'12'}])
    docs=await store.search('IEC-104')
    assert {d.chunk_id for d in docs} == {'mail','iec'}
    iec=next(d for d in docs if d.chunk_id=='iec')
    assert (iec.source,iec.page,iec.page_label,iec.chapter)==('b.pdf',17,'12','Телемеханика')

@async_test
async def test_index_promotion_retains_old_collection(tmp_path,monkeypatch):
    import fitz
    import chromadb
    import index_pdf
    pdf=tmp_path/'manual.pdf'
    with fitz.open() as doc:
        page=doc.new_page();page.insert_text((72,72),'A short networking manual with TCP.')
        doc.set_toc([[1,'Transport',1]])
        doc.save(pdf)
    client=chromadb.PersistentClient(path=str(tmp_path/'index'))
    old=client.create_collection('current-corpus',metadata={'embedding_model':'old'})
    old.add(ids=['old'],documents=['previous'],embeddings=[[1.,0.]])
    monkeypatch.setattr(index_pdf,'PDF_PATH',pdf)
    monkeypatch.setattr(index_pdf.settings,'chroma_dir',str(tmp_path/'index'))
    monkeypatch.setattr(index_pdf.settings,'chroma_collection','current-corpus')
    class Embed:
        def __init__(self,config): pass
        async def embed(self,docs): return [[0.,1.] for _ in docs]
    monkeypatch.setattr(index_pdf,'OllamaClient',Embed)
    await index_pdf.build_index()
    current=client.get_collection('current-corpus').get()
    assert current['metadatas'][0]['chapter']=='Transport'
    assert current['metadatas'][0]['page']==1
    backups=[c for c in client.list_collections() if c.name.startswith('teacher_backup_')]
    assert len(backups)==1 and backups[0].get()['ids']==['old']

@async_test
async def test_index_embedding_failure_keeps_old_index(tmp_path,monkeypatch):
    import fitz
    import chromadb
    import index_pdf
    pdf=tmp_path/'manual.pdf'
    with fitz.open() as doc:
        doc.new_page().insert_text((72,72),'Text to index.');doc.save(pdf)
    client=chromadb.PersistentClient(path=str(tmp_path/'index'))
    old=client.create_collection('current-corpus');old.add(ids=['old'],documents=['previous'],embeddings=[[1.,0.]])
    monkeypatch.setattr(index_pdf,'PDF_PATH',pdf)
    monkeypatch.setattr(index_pdf.settings,'chroma_dir',str(tmp_path/'index'))
    monkeypatch.setattr(index_pdf.settings,'chroma_collection','current-corpus')
    class Broken:
        def __init__(self,config): pass
        async def embed(self,docs): raise RuntimeError('model unavailable')
    monkeypatch.setattr(index_pdf,'OllamaClient',Broken)
    with pytest.raises(RuntimeError,match='model unavailable'): await index_pdf.build_index()
    assert client.get_collection('current-corpus').get()['ids']==['old']
    assert not any(c.name.startswith('teacher_build_') for c in client.list_collections())
