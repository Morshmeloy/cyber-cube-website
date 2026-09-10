"""Public API admission control without a database or model process."""
import asyncio
import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from functools import wraps
import pytest


def async_test(fn):
    @wraps(fn)
    def run(*args, **kwargs): return asyncio.run(fn(*args, **kwargs))
    return run

@pytest.fixture
def gateway(monkeypatch):
    config=ModuleType('src.core.config')
    config.settings=SimpleNamespace(TEACHER_SERVICE_TOKEN='t'*32,TEACHER_MAX_CONCURRENT_STREAMS=1,TEACHER_QUEUE_TIMEOUT_SECONDS=.1)
    monkeypatch.setitem(sys.modules,'src.core.config',config)
    path=Path(__file__).resolve().parents[2]/'backend/src/services/teacher_gateway.py'
    spec=importlib.util.spec_from_file_location('gateway_under_test',path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module.TeacherGateway(), module.TeacherGatewayError

@async_test
async def test_one_pending_request_per_authenticated_user(gateway):
    gate,error=gateway
    await gate.acquire('alice')
    with pytest.raises(error,match='предыдущий'): await gate.acquire('alice')
    gate.release('alice')
    await gate.acquire('alice');gate.release('alice')
    assert gate._active_users == set()

@async_test
async def test_different_user_waits_then_runs(gateway):
    gate,_=gateway
    await gate.acquire('alice')
    pending=asyncio.create_task(gate.acquire('bob'))
    await asyncio.sleep(.01)
    assert not pending.done()
    gate.release('alice');await pending;gate.release('bob')
    assert gate._active_users == set()

@async_test
async def test_cancelled_and_timed_out_user_can_retry(gateway):
    gate,error=gateway
    await gate.acquire('alice')
    pending=asyncio.create_task(gate.acquire('bob'))
    await asyncio.sleep(.01);pending.cancel()
    with pytest.raises(asyncio.CancelledError): await pending
    assert 'bob' not in gate._active_users
    with pytest.raises(error,match='занят'): await gate.acquire('bob')
    assert 'bob' not in gate._active_users
    gate.release('alice');await gate.acquire('bob');gate.release('bob')
