import type { EngineInterface, Register } from 'claude-code'

const TITLE_SYSTEM =
  'You name coding sessions. Reply with only a title: 3-6 words, no quotes, no trailing punctuation, specific to what the work is about.'

type Dollar = EngineInterface
type TitleState = { count: number; at: number }

async function currentTitle($: Dollar): Promise<string | undefined> {
  const got = await $.mcp.call('ccd_session_mgmt', 'get_session', { session_id: 'self' }).catch(() => undefined)
  const block = got?.content?.[0]
  if (!block || block.type !== 'text') return undefined
  try {
    return JSON.parse(block.text).title
  } catch {
    return undefined
  }
}

async function rename($: Dollar, title: string): Promise<boolean> {
  const done = await $.mcp
    .call('ccd_session_mgmt', 'set_session_title', { session_id: 'self', title })
    .catch(() => undefined)
  const isRenamed = done !== undefined && !done.isError
  $.ui.log(`auto-title: ${isRenamed ? 'renamed' : 'could not rename'} "${title}"`)
  return isRenamed
}

async function generateTitle($: Dollar, model: string): Promise<string | undefined> {
  const transcript = (await $.session.messages())
    .map(m => `${m.role}: ${m.text.slice(0, 400)}`)
    .join('\n')
    .slice(-6000)
  const reply = await $.model.complete({ model, system: TITLE_SYSTEM, prompt: transcript })
  if (!reply.isAnswered) {
    $.ui.log(`auto-title: model reply ${JSON.stringify(reply)}`)
    return undefined
  }
  return reply.text.trim().split('\n')[0].replace(/^["']|["']$/g, '').slice(0, 60) || undefined
}

async function stateKey($: Dollar): Promise<string> {
  return `titles:${await $.session.id()}`
}

async function loadState($: Dollar): Promise<TitleState> {
  const saved = (await $.store.get(await stateKey($))) as Partial<TitleState> | undefined
  return { count: saved?.count ?? 0, at: saved?.at ?? 0 }
}

async function saveState($: Dollar, state: TitleState): Promise<void> {
  await $.store.set(await stateKey($), state)
}

export const register: Register = (on, options) => {
  // 0 turns a number off. Defaults live in plugin.json.
  const count = (value: unknown) => Math.max(0, Math.floor(Number(value)) || 0)
  const FIRST_AT = count(options.firstTitleAtPrompt)
  const REFRESH_EVERY = count(options.refreshEveryPrompts)
  const MAX_AUTO = count(options.maxAutoTitles) // 0: no limit
  const MODEL = String(options.model || 'claude-haiku-5-5')
  const CHECK = String(options.checkmark || '✅')
  const TAKEN_OVER = Number.MAX_SAFE_INTEGER // a manual rename ends automatic ones for the session

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'done', description: `Mark this session finished: put ${CHECK} in front of its title` })
    await $.command.register({ name: 'undone', description: `Take the ${CHECK} off this session's title` })
    await $.command.register({
      name: 'rename-session',
      description: 'Rename this session: name it from the conversation, or pass the title you want',
      argumentHint: '[new title]',
    })
    await $.command.register({ name: 'keep-title', description: "Keep this session's title: stop automatic renaming for this session" })
    await $.command.register({ name: 'auto-title', description: 'Let this session be titled automatically again' })
    return next(e)
  })

  on('command.run', { command: 'keep-title' }, async $ => {
    await saveState($, { count: TAKEN_OVER, at: await $.session.turns() })
    const title = await currentTitle($)
    return { text: title ? `Keeping: ${title}` : 'Keeping the current title.' }
  })

  on('command.run', { command: 'auto-title' }, async $ => {
    await saveState($, { count: 0, at: await $.session.turns() })
    return {
      text: FIRST_AT === 0 ? 'Unlocked, but automatic titles are off in the plugin settings.' : 'Automatic titling is back on for this session.',
    }
  })

  on('command.run', { command: 'done' }, async $ => {
    const title = await currentTitle($)
    if (!title) return { text: "Couldn't read this session's title." }
    if (title.startsWith(CHECK)) return { text: `Already marked: ${title}` }
    await rename($, `${CHECK} ${title}`)
    return { text: `Marked done: ${CHECK} ${title}` }
  })

  on('command.run', { command: 'undone' }, async $ => {
    const title = await currentTitle($)
    if (!title) return { text: "Couldn't read this session's title." }
    if (!title.startsWith(CHECK)) return { text: `Not marked: ${title}` }
    const plain = title.slice(CHECK.length).trim()
    await rename($, plain)
    return { text: `Unmarked: ${plain}` }
  })

  on('command.run', { command: 'rename-session' }, async ($, e) => {
    const wanted = e.args.trim().slice(0, 100)
    const title = wanted || (await generateTitle($, MODEL))
    if (!title) return { text: "Couldn't come up with a title." }

    const hadCheck = (await currentTitle($))?.startsWith(CHECK) ?? false
    const full = hadCheck ? `${CHECK} ${title}` : title
    if (!(await rename($, full))) return { text: "Couldn't rename the session." }

    await saveState($, { count: TAKEN_OVER, at: await $.session.turns() })
    return { text: `Renamed: ${full}` }
  })

  // A fitting title after a few prompts, a limited number of times.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined || FIRST_AT === 0) return result

    const state = await loadState($)
    if (MAX_AUTO > 0 && state.count >= MAX_AUTO) return result

    const turns = await $.session.turns()
    const isDue =
      state.count === 0 ? turns >= FIRST_AT : REFRESH_EVERY > 0 && turns - state.at >= REFRESH_EVERY
    if (!isDue) return result

    const title = await generateTitle($, MODEL)
    if (title) {
      const hadCheck = (await currentTitle($))?.startsWith(CHECK) ?? false
      await rename($, hadCheck ? `${CHECK} ${title}` : title)
      await saveState($, { count: state.count + 1, at: turns })
    }
    return result
  })
}
