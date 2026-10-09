# claude-mods

Small Claude Code mods, installed as plugins from this repo.

| Mod | What it does |
| --- | --- |
| [`auto-session-title`](#auto-session-title) | Names a session from its conversation, and lets you mark it done with a ✅ |

## auto-session-title

Sessions that start with "can you help me with…" end up with titles that say nothing. This mod names the session after a few prompts, and gives you commands to rename it or mark it finished.

### What it does

- **Titles the session on its own.** After the 3rd prompt it reads the conversation and gives the session a short title (3–6 words). It does this a limited number of times (2 by default: the first title plus one refresh 10 prompts later), then stops looking at the session.
- **`/rename-session`** names the session from the conversation right now. **`/rename-session My own title`** sets exactly that title. Either one counts as you taking over: automatic titling stops for that session.
- **`/done`** puts ✅ in front of the title. **`/undone`** takes it off. Automatic titles and `/rename-session` keep the ✅ if it's there.

### Install

You need Claude Code with hooks modules turned on (the desktop app's Code tab does this). The mod renames sessions through the desktop app's session-management tool, so it has only been tested there.

**1. Add the marketplace** (once per machine). In Claude Code:

```
/plugin marketplace add fernandokobayashi-telus/claude-mods
```

or from a terminal:

```bash
claude plugin marketplace add fernandokobayashi-telus/claude-mods
```

**2. Install the mod:**

```
/plugin install auto-session-title@claude-mods
```

or:

```bash
claude plugin install auto-session-title@claude-mods
```

Pick the **user** scope if it asks, so the mod works in every project. Installing may show a screen for the settings below; the defaults are fine.

**3. Start a new session.** The mod loads in sessions started after the install. Check it worked by typing `/done` and then `/undone`: the title should gain and lose a ✅.

Check what's installed with `claude plugin list`.

### Settings

Each setting appears in the plugin's config menu, and is stored in your settings under `pluginConfigs`. A change reloads the mod.

| Setting | Default | Meaning |
| --- | --- | --- |
| `firstTitleAtPrompt` | `3` | Give the session its first title once this many prompts have been sent. `0` turns automatic titles off. |
| `refreshEveryPrompts` | `10` | Re-title this many prompts after the last automatic title, in case the work has moved on. `0` never refreshes. |
| `maxAutoTitles` | `2` | Stop titling on its own after this many automatic titles. `1` titles once and never looks again. `0` means no limit. |
| `model` | `claude-haiku-5-5` | The model that writes the title. It's one short call, so a small model is plenty. |
| `checkmark` | `✅` | What `/done` puts in front of the title and `/undone` takes off. |

`/rename-session`, `/done` and `/undone` always work, whatever these are set to.

### Cost

An automatic title is one short model call (a few hundred tokens in, a few words out). With the defaults that is at most two calls per session. `/done` and `/undone` make no model call; `/rename-session` makes one when you don't give it a title.

### Good to know

- A session that was started before you installed the mod gets one automatic title the next time it completes a turn, because the mod has no record of it yet.
- If you set a session's title by hand, the app may ask you to approve the mod's rename.
- The mod's per-session counts are kept in the plugin's own store, so reloading or resuming a session doesn't restart them.

### Update and uninstall

Update with `claude plugin marketplace update claude-mods`, then `claude plugin update auto-session-title@claude-mods`. Remove it with `claude plugin uninstall auto-session-title@claude-mods`.

### Try it from a local checkout

```bash
git clone https://github.com/fernandokobayashi-telus/claude-mods
claude plugin marketplace add ./claude-mods
claude plugin install auto-session-title@claude-mods
```

The installed plugin reads from the checkout in place, so don't move or delete the folder.
