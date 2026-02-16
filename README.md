# opencode-council

Multi‑model council deliberation for OpenCode with a Speaker‑led discussion, voting, and final synthesis.

## Features

- `/council <message>` command (via config) that runs a multi‑model council
- Initial parallel responses from N models
- Speaker‑led discussion with clarifying questions
- Voting phase + final Speaker synthesis
- Collapsible “Live council discussion” transcript
- Configurable members (3–10) and Speaker model

## Installation

```bash
npm install opencode-council
# or
bun add opencode-council
```

Then add the plugin to your OpenCode config (`~/.config/opencode/opencode.json` or project `.opencode/opencode.json`):

```json
{
  "plugin": ["opencode-council"]
}
```

## Configure Council Models

Create a council config file in one of these locations (first match wins):

1. `${PROJECT}/.opencode/council.json`
2. `~/.config/opencode/council.json`
3. Set `OPENCODE_COUNCIL_CONFIG=/path/to/council.json`

Example config:

```json
{
  "members": [
    "anthropic/claude-3-5-sonnet",
    "openai/gpt-4.1",
    "google/gemini-1.5-pro"
  ],
  "speaker": "anthropic/claude-3-5-sonnet",
  "discussion": {
    "maxTurns": 6
  }
}
```

> Requirements: 3–10 members, speaker model required.

## Add the `/council` Command

OpenCode commands are configured via `command` in your config. Add this entry:

```json
{
  "command": {
    "council": {
      "description": "Run a multi-model council deliberation",
      "template": "You must call the council tool with {message: $ARGUMENTS} and return its output verbatim."
    }
  }
}
```

Now you can run:

```
/council How should we refactor our caching layer for reliability?
```

## What You’ll See

- A stage header:
  - “Council — initial discussions...”
  - “Council — refining the solutions...”
  - “Council — voting...”
- A final “Winning solution” block
- A collapsible “Live council discussion” transcript

## Testing Locally

```bash
npm run build
```

Then point OpenCode to the local plugin:

```json
{
  "plugin": ["file:///ABSOLUTE/PATH/opencode-council/dist/plugin.js"]
}
```

## Notes

- The council runs in a temporary session to avoid polluting your main chat.
- If the Speaker asks for more input, the response will tell you what’s missing—reply and re‑run `/council`.

## License

MIT
