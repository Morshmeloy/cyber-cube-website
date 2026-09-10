import {test} from 'node:test'
import assert from 'node:assert/strict'
import {historyKey, parseHistory, freeQuestionContext} from '../src/lib/teacher-session.ts'
const message = (text, kind='free') => ({sender:'user',text,kind,mistakeId:null,contextLabel:null})
test('attempt and user identities isolate history even for identical questions', () => {
  assert.notEqual(historyKey('alice','1'),historyKey('alice','2'))
  assert.notEqual(historyKey('alice','1'),historyKey('bob','1'))
  assert.notEqual(historyKey('a:b','c'),historyKey('a','b:c'))
})
test('malformed persisted state is discarded', () => {
  for (const raw of ['null','{}','[null,{}]','broken']) assert.deepEqual(parseHistory(raw),[])
})
test('history retention is bounded', () => {
  const rows = Array.from({length:100},(_,i)=>message(String(i)))
  const saved = parseHistory(JSON.stringify(rows))
  assert.equal(saved.length,40); assert.equal(saved[0].text,'60')
})
test('free context excludes explanations and errors and limits turns and characters', () => {
  const rows=Array.from({length:12},(_,i)=>message(String(i)+'x'.repeat(1600)))
  rows.push(message('do not send','error'),message('do not send','explanation'))
  const context = freeQuestionContext(rows)
  assert.equal(context.length,6)
  assert.equal(context.reduce((n,m)=>n+m.content.length,0),6000)
  assert.ok(context.every(m=>!m.content.includes('do not send')))
})
test('new question is separate and not duplicated in prior context', () => {
  const rows=[message('earlier')]
  const before=freeQuestionContext(rows)
  rows.push(message('new question'))
  assert.deepEqual(before,[{role:'user',content:'earlier'}])
})
test('long dialogue does not evict completed explanations and trigger regeneration', () => {
  const explanations=Array.from({length:100},(_,i)=>({...message(`answer${i}`,'explanation'),sender:'bot',mistakeId:i+1}))
  const rows=[...explanations,...Array.from({length:70},(_,i)=>message(`chat${i}`))]
  const saved=parseHistory(JSON.stringify(rows))
  assert.equal(saved.filter(m=>m.kind==='explanation').length,100)
  assert.equal(saved.length,140)
})
