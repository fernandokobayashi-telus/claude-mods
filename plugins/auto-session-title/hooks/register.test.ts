import { test, expect } from 'claude-code/testing'

const renames: string[] = []

function world(on: any, title: string, turns = 1) {
  renames.length = 0
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
  on('model.complete', async () => ({
    value: {
      isAnswered: true,
      text: '"Gate 2 resolve bug fix"\n',
      usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    },
  }))
}

const run = ($: any, command: string) => $.command.run({ command })

test('titles the session once three turns are done', async ($, on) => {
  world(on, 'Claude code mod', 3)
  await $.turn.complete({ reason: 'answer', answer: 'done' } as any)
  expect(renames).toEqual(['Gate 2 resolve bug fix'])
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
