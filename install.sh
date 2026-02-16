#!/bin/bash
set -euo pipefail

# Use standard location in ~/.config
CONFIG_DIR="${HOME}/.config/opencode"
STANDARD_DIR="${CONFIG_DIR}/opencode-council"
PLUGIN_DIR="${CONFIG_DIR}/plugin"

# Get current directory
CURRENT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Determine where to install from
if [[ "$CURRENT_DIR" == "$STANDARD_DIR" ]]; then
  # Already in standard location
  COUNCIL_DIR="$STANDARD_DIR"
  echo "🔧 Installing OpenCode Council from standard location..."
elif [ -d "$CURRENT_DIR/.git" ] && git -C "$CURRENT_DIR" remote -v 2>/dev/null | grep -q "opencode-council"; then
  # Running from the git repo itself - use current location
  COUNCIL_DIR="$CURRENT_DIR"
  echo "🔧 Installing OpenCode Council from current directory..."
  echo "  (Using: $COUNCIL_DIR)"
else
  # Need to clone to standard location
  echo "📥 Installing to standard location: $STANDARD_DIR"
  if [ -d "$STANDARD_DIR/.git" ]; then
    echo "  (Updating existing installation)"
    cd "$STANDARD_DIR" && git pull
    cd "$STANDARD_DIR"  # Ensure we're in the right dir after git pull
  else
    rm -rf "$STANDARD_DIR"  # Remove if exists but not git repo
    echo "  Cloning repository..."
    git clone https://github.com/lovexbytes/opencode-council.git "$STANDARD_DIR" || {
      echo "❌ Failed to clone repository"
      exit 1
    }
  fi
  COUNCIL_DIR="$STANDARD_DIR"
fi

# Verify directory exists
if [ ! -d "$COUNCIL_DIR" ]; then
  echo "❌ Error: Directory $COUNCIL_DIR does not exist after clone"
  exit 1
fi

echo "  Location: $COUNCIL_DIR"

# Check prerequisites
command -v bun >/dev/null 2>&1 || { echo "❌ bun is required. Install: curl -fsSL https://bun.sh/install | bash"; exit 1; }
command -v tmux >/dev/null 2>&1 || { echo "❌ tmux is required. Install via your package manager."; exit 1; }

# Create directories
mkdir -p "$PLUGIN_DIR"
mkdir -p "${CONFIG_DIR}"

# Install dependencies
echo "📦 Installing dependencies..."
cd "$COUNCIL_DIR"
bun install 2>/dev/null || npm install

# Build plugin
echo "🔨 Building plugin..."
cd "$COUNCIL_DIR/packages/plugin"
bun build ./src/index.ts --outdir dist --target bun

# Build TUI
echo "🔨 Building TUI..."
cd "$COUNCIL_DIR/packages/tui"
bun build ./src/index.tsx --outdir dist --target bun --external react --external ink

# Copy plugin to global plugin directory
echo "📋 Installing plugin..."
cp "$COUNCIL_DIR/packages/plugin/dist/index.js" "$PLUGIN_DIR/council.js"

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
echo "  TUI:     $COUNCIL_DIR/packages/tui/dist/index.js"
echo "  Config:  ${CONFIG_DIR}/council.json"
echo ""
echo "Usage:"
echo "  1. Run opencode inside tmux"
echo "  2. Ask: 'council: should I use Redis or Memcached?'"
echo "  3. The LLM will call council_spawn automatically"
echo ""
echo "Edit ~/.config/opencode/council.json to configure models."
