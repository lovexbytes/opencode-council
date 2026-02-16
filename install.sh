#!/bin/bash
set -euo pipefail

COUNCIL_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${HOME}/.config/opencode"
PLUGIN_DIR="${CONFIG_DIR}/plugin"

echo "🔧 Installing OpenCode Council..."

# Check prerequisites
command -v bun >/dev/null 2>&1 || { echo "❌ bun is required. Install: curl -fsSL https://bun.sh/install | bash"; exit 1; }
command -v tmux >/dev/null 2>&1 || { echo "❌ tmux is required. Install via your package manager."; exit 1; }

# Create directories
mkdir -p "$PLUGIN_DIR"
mkdir -p "${CONFIG_DIR}"

# Install dependencies
echo "📦 Installing dependencies..."
cd "$COUNCIL_DIR"
bun install

# Build plugin
echo "🔨 Building plugin..."
cd "$COUNCIL_DIR/packages/plugin"
bun build ./src/index.ts --outdir dist --target bun

# Build TUI
echo "🔨 Building TUI..."
cd "$COUNCIL_DIR/packages/tui"
bun build ./src/index.tsx --outdir dist --target bun --external react --external ink

# Copy plugin to global plugin directory (singular)
echo "📋 Installing plugin..."
cp "$COUNCIL_DIR/packages/plugin/dist/index.js" "$PLUGIN_DIR/council.js"

# Install TUI binary
echo "📋 Installing TUI..."
COUNCIL_TUI="${CONFIG_DIR}/council-tui"
cat > "$COUNCIL_TUI" << 'WRAPPER'
#!/bin/bash
exec bun COUNCIL_TUI_DIR/dist/index.js "$@"
WRAPPER
sed -i "s|COUNCIL_TUI_DIR|${COUNCIL_DIR}/packages/tui|g" "$COUNCIL_TUI"
chmod +x "$COUNCIL_TUI"

# Create default config if not exists
if [ ! -f "${CONFIG_DIR}/council.json" ]; then
  echo "📝 Creating default config..."
  cat > "${CONFIG_DIR}/council.json" << 'CONFIG'
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
CONFIG
fi

echo ""
echo "✅ OpenCode Council installed!"
echo ""
echo "Files:"
echo "  Plugin:  $PLUGIN_DIR/council.js"
echo "  TUI:     $COUNCIL_TUI"
echo "  Config:  ${CONFIG_DIR}/council.json"
echo ""
echo "Usage:"
echo "  1. Run opencode inside tmux"
echo "  2. Ask: 'council: should I use Redis or Memcached?'"
echo "  3. The LLM will call council_spawn automatically"
echo ""
echo "Edit ~/.config/opencode/council.json to configure models."
