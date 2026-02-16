# OpenCode Council

Multi-model deliberation plugin for OpenCode. When you need diverse perspectives on architecture decisions, technical choices, or complex problems, the Council brings multiple AI models together in a real-time deliberation.

## Features

- **Multi-Model Deliberation** — Consult multiple AI models simultaneously
- **Real-Time TUI** — Watch models debate in a tmux split with live streaming output
- **Automatic Synthesis** — Get a synthesized recommendation combining all perspectives
- **Simple Integration** — Works inside your existing OpenCode + tmux workflow

## Installation

```bash
git clone https://github.com/lovexbytes/opencode-council
cd opencode-council
bash install.sh
```

## Requirements

- [Bun](https://bun.sh) — `curl -fsSL https://bun.sh/install | bash`
- [tmux](https://github.com/tmux/tmux) — Install via your package manager
- OpenCode running inside tmux

## Configuration

Edit `~/.config/opencode/council.json`:

```json
{
  "enabled": true,
  "models": [
    { "provider": "anthropic", "model": "claude-sonnet-4-20250514", "label": "Sonnet" },
    { "provider": "openai", "model": "gpt-4o", "label": "GPT-4o" },
    { "provider": "google", "model": "gemini-2.5-pro", "label": "Gemini" }
  ],
  "tmux": {
    "mode": "split",
    "percent": 40,
    "position": "right"
  },
  "synthesize": true,
  "timeout": 120
}
```

### Configuration Options

- `enabled` — Set to `false` to disable all council tools
- `models` — Array of models to consult. Each needs `provider`, `model`, and optional `label`
- `tmux.mode` — `"split"` (split-window) or `"window"` (new-window)
- `tmux.percent` — Percentage of terminal for the split (default 40)
- `tmux.position` — `"right"` (horizontal split) or `"bottom"` (vertical split)
- `synthesize` — Whether to auto-synthesize all responses
- `timeout` — Seconds before giving up on a model (default 120)

## Usage

Inside OpenCode (running in tmux), simply ask:

```
council: should I use Redis or Memcached for session storage?
```

Or:

```
I'd like to get multiple perspectives on this architecture decision.
```

The LLM will automatically call `council_spawn`, opening a tmux pane showing the deliberation. The council returns a council_id for status checking.

### Available Tools

- `council_spawn` — Spawn a new council deliberation
- `council_status` — Check progress and get results
- `council_close` — Terminate an active council early

## How It Works

1. You ask a question mentioning "council" or multiple perspectives
2. The LLM calls `council_spawn` with your question
3. A tmux split opens with the Council TUI
4. Each model gets a sub-session and deliberates in parallel
5. Results stream live to the TUI panels
6. Once complete, a synthesis is generated
7. The LLM retrieves results via `council_status` and presents them

## Architecture

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  OpenCode   │──────│   Plugin    │──────│   TUI       │
│  (tmux)     │      │  (index.ts) │      │  (ink/react)│
└─────────────┘      └─────────────┘      └─────────────┘
                            │                    │
                            │                    │
                     Unix Socket IPC       OpenCode SDK
                     (/tmp/*.sock)        (localhost:4096)
```

## Development

```bash
# Install dependencies
bun install

# Build both packages
bun run build

# Build individually
cd packages/plugin && bun build ./src/index.ts --outdir dist --target bun
cd packages/tui && bun build ./src/index.tsx --outdir dist --target bun

# Reinstall globally
bash install.sh
```

## License

MIT
