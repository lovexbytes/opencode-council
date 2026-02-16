# opencode-council

Multi‑model council deliberation for OpenCode with a Speaker‑led discussion, voting, and final synthesis.

## Features

- `/council <message>` command (via config) that runs a multi‑model council
- Initial parallel responses from N models
- Speaker‑led discussion with clarifying questions
- Voting phase + final Speaker synthesis
- Collapsible "Live council discussion" transcript
- Configurable members (3–10) and Speaker model

## Build from Source

Clone the repo and build:

```bash
git clone https://github.com/lovexbytes/opencode-council.git
cd opencode-council
npm install
npm run build
```

This creates `dist/plugin.js` (and `dist/opencode-council.js`) which OpenCode can load.

## Installation in OpenCode (Local/Bun)

OpenCode auto‑loads local plugins from **any** of these directories:
- `~/.config/opencode/plugin/` or `~/.config/opencode/plugins/`
- `~/.opencode/plugin/` or `~/.opencode/plugins/`
- `${PROJECT}/.opencode/plugin/` or `${PROJECT}/.opencode/plugins/`

**Global install (recommended):**
```bash
# Copy built plugin to OpenCode's global plugin directory
mkdir -p ~/.config/opencode/plugin
cp dist/plugin.js ~/.config/opencode/plugin/opencode-council.js
```

✅ **No config entry needed.** OpenCode will auto‑load any `*.js`/`*.ts` file in those folders.

**Or use an absolute file URL directly (explicit config):**
```json
{
  "plugin": [
    "file:///ABSOLUTE/PATH/opencode-council/dist/plugin.js"
  ]
}
```

**Important:** A bare name like `"opencode-council"` tells OpenCode to install from npm via Bun. For local builds, use a `file://` URL or the plugin folders above.

## Configure Council Models

Create a council config file in one of these locations:

1. `${PROJECT}/.opencode/council.json`
2. `~/.opencode/council.json`
3. Or set env var: `export OPENCODE_COUNCIL_CONFIG=/path/to/council.json`

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

**Requirements:**
- 3–10 members (excluding Speaker)
- Speaker model must be specified
- All models must be available in your OpenCode provider config

## Add the `/council` Command

Add this to your OpenCode config:

```json
{
  "command": {
    "council": {
      "description": "Run a multi-model council deliberation",
      "template": "Call the council tool with message: {message}"
    }
  }
}
```

## Usage

In OpenCode, type:

```
/council How should we refactor our caching layer for reliability?
```

Or with more context:

```
/council We're choosing between Redis, Memcached, and an in-memory solution. What's best for our scale?
```

## What You'll See

1. **Stage indicator:**
   - "Council — initial discussions..."
   - "Council — refining the solutions..."
   - "Council — voting..."

2. **Final output:**
   - Winning solution (most votes)
   - Vote breakdown
   - Collapsible "Live council discussion" transcript

## Development

To modify and rebuild:

```bash
# Edit source files in src/
npm run build
# Restart OpenCode to load new build
```

## Troubleshooting

**Plugin not loading:**
- Check the path in config is correct absolute path
- Verify `dist/plugin.js` exists after build

**Models not responding:**
- Verify models in council.json are configured in OpenCode providers
- Check that API keys for those providers are set

**Discussion stuck:**
- Speaker may be waiting for clarification
- Check if any model returned an error

## How It Works

1. **Initial phase:** Your message is sent to all council members simultaneously
2. **Discussion phase:** Speaker coordinates debate, asks clarifying questions
3. **Voting phase:** Each model votes for best solution (can't vote for own)
4. **Synthesis:** Speaker presents winning solution with reasoning

The council runs in isolated sessions to avoid polluting your main chat history.

## License

MIT
