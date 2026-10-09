import { test, expect, mock } from 'claude-code/testing'

const renames: string[] = []
const models: string[] = []

function world(on: any, title: string, turns = 1, store: Record<string, unknown> = {}) {
  renames.length = 0
  models.length = 0
  mock.store(on, store)
  on('turn.complete', async () => ({ text: 'done' }))
  on('session.id', async () => ({ value: 'sess1' }))
  on('session.turns', async () => ({ value: turns }))
  on('session.messages', async () => ({ value: [{ role: 'user', text: 'fix the gate 2 resolve bug', toolUses: [] }] }))
  on('fs.write', async () => ({ value: undefined }))
  on('mcp.call', async (_: any, e: any) => {
    if (e.tool === 'set_session_title') renames.push(e.args.title)
    const text = e.tool === 'get_session' ? JSON.stringify({ title }) : 'ok'
    return { value: { content: [{ type: 'text', text }], isError: false } }
  })
  on('model.complete', async (_: any, e: any) => (models.push(e.model), {
    value: {
      isAnswered: true,
      text: '"Gate 2 resolve bug fix"\n',
      usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    },
  }))
}

const run = ($: any, command: string, args = '') => $.command.run({ command, args })

const answered = { reason: 'answer', answer: 'done' } as any

test('titles the session once three turns are done', async ($, on) => {
  world(on, 'Claude code mod', 3)
  await $.turn.complete(answered)
  expect(renames).toEqual(['Gate 2 resolve bug fix'])
})

test('waits for the configured first prompt', { options: { firstTitleAtPrompt: 5 } }, async ($, on) => {
  world(on, 'Claude code mod', 3)
  await $.turn.complete(answered)
  expect(renames).toEqual([])
})

test('titles at the configured first prompt', { options: { firstTitleAtPrompt: 5 } }, async ($, on) => {
  world(on, 'Claude code mod', 5)
  await $.turn.complete(answered)
  expect(renames).toEqual(['Gate 2 resolve bug fix'])
})

test('never titles on its own when first prompt is 0', { options: { firstTitleAtPrompt: 0 } }, async ($, on) => {
  world(on, 'Claude code mod', 50)
  await $.turn.complete(answered)
  expect(renames).toEqual([])
})

test('uses the configured model', { options: { model: 'claude-sonnet-5-5' } }, async ($, on) => {
  world(on, 'Claude code mod', 3)
  await $.turn.complete(answered)
  expect(models).toEqual(['claude-sonnet-5-5'])
})

test('/done uses the configured checkmark', { options: { checkmark: '[x]' } }, async ($, on) => {
  world(on, 'Gate 2 resolve bug fix')
  await run($, 'done')
  expect(renames).toEqual(['[x] Gate 2 resolve bug fix'])
})

test('/done puts the check in front of the title', async ($, on) => {
  world(on, 'Gate 2 resolve bug fix')
  await run($, 'done')
  expect(renames).toEqual(['✅ Gate 2 resolve bug fix'])
})

test('/done leaves a marked title alone', async ($, on) => {
  world(on, '✅ Gate 2 resolve bug fix')
  await run($, 'done')
  expect(renames).toEqual([])
})

test('/undone takes the check off', async ($, on) => {
  world(on, '✅ Gate 2 resolve bug fix')
  await run($, 'undone')
  expect(renames).toEqual(['Gate 2 resolve bug fix'])
})

test('/undone leaves an unmarked title alone', async ($, on) => {
  world(on, 'Gate 2 resolve bug fix')
  await run($, 'undone')
  expect(renames).toEqual([])
})

test('stops titling on its own after the default two titles', async ($, on) => {
  world(on, 'Some title', 30, { 'titles:sess1': { count: 2, at: 13 } })
  await $.turn.complete(answered)
  expect(renames).toEqual([])
})

test('refreshes once the refresh interval has passed, below the limit', async ($, on) => {
  world(on, 'Some title', 13, { 'titles:sess1': { count: 1, at: 3 } })
  await $.turn.complete(answered)
  expect(renames).toEqual(['Gate 2 resolve bug fix'])
})

test('does not refresh before the interval', async ($, on) => {
  world(on, 'Some title', 8, { 'titles:sess1': { count: 1, at: 3 } })
  await $.turn.complete(answered)
  expect(renames).toEqual([])
})

test('titles once only when the limit is 1', { options: { maxAutoTitles: 1 } }, async ($, on) => {
  world(on, 'Some title', 13, { 'titles:sess1': { count: 1, at: 3 } })
  await $.turn.complete(answered)
  expect(renames).toEqual([])
})

test('no limit when maxAutoTitles is 0', { options: { maxAutoTitles: 0 } }, async ($, on) => {
  world(on, 'Some title', 43, { 'titles:sess1': { count: 9, at: 33 } })
  await $.turn.complete(answered)
  expect(renames).toEqual(['Gate 2 resolve bug fix'])
})

test('/rename-session with a title sets exactly that', async ($, on) => {
  world(on, 'Old title')
  await run($, 'rename-session', 'My own title')
  expect(renames).toEqual(['My own title'])
})

test('/rename-session without a title names it from the conversation', async ($, on) => {
  world(on, 'Old title')
  await run($, 'rename-session')
  expect(renames).toEqual(['Gate 2 resolve bug fix'])
})

test('/rename-session keeps the checkmark', async ($, on) => {
  world(on, '✅ Old title')
  await run($, 'rename-session', 'My own title')
  expect(renames).toEqual(['✅ My own title'])
})

test('after /rename-session the automatic titles stop', async ($, on) => {
  world(on, 'Old title', 3)
  await run($, 'rename-session', 'My own title')
  await $.turn.complete(answered)
  expect(renames).toEqual(['My own title'])
})
