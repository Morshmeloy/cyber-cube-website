import test from 'node:test'
import assert from 'node:assert/strict'
import { readTeacherStream } from '../src/lib/teacher-stream.ts'
function response(text, stride = 1) {
  const bytes = new TextEncoder().encode(text)
  return new Response(new ReadableStream({ start(c) {
    for (let i = 0; i < bytes.length; i += stride) c.enqueue(bytes.slice(i, i + stride))
    c.close()
  } }))
}
const collect = async r => { const events = []; for await (const e of readTeacherStream(r)) events.push(e); return events }
test('UTF-8 split bytewise, CRLF, comments and compact data', async () => {
  const events = await collect(response(': connected\r\n\r\ndata:{"token":"Привет"}\r\n\r\ndata: {"done":true}\r\n\r\n'))
  assert.equal(events[0].token, 'Привет'); assert.equal(events.length, 2)
})
test('EOF without completion rejects', async () => assert.rejects(collect(response('data: {"token":"partial"}\n\n')), /прерван/))
test('per-item done cannot complete a batch', async () => assert.rejects(collect(response('data: {"id":1,"done":true}\n\n')), /прерван/))
test('batch terminal event succeeds', async () => assert.equal((await collect(response('data: {"all_done":true}\n\n'))).length, 1))
test('malformed JSON rejects', async () => assert.rejects(collect(response('data: nope\n\n')), /Некорректный/))
test('server error propagates', async () => assert.rejects(collect(response('data: {"error":"busy"}\n\n')), /busy/))
