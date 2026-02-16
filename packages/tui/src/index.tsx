#!/usr/bin/env bun
import { render } from "ink"
import React from "react"
import { App } from "./App.js"
import fs from "fs"

// Simple argument parser (Bun doesn't have parseArgs from node:util)
function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith("--")) {
      const key = arg.slice(2)
      const nextArg = args[i + 1]
      if (nextArg && !nextArg.startsWith("--")) {
        result[key] = nextArg
        i++ // Skip next arg since we used it
      } else {
        result[key] = "true"
      }
    }
  }
  return result
}

// Debug logging
const logFile = `/tmp/council-tui-${Date.now()}.log`
try {
  fs.appendFileSync(logFile, `TUI starting with args: ${Bun.argv.join(" ")}\n`)
} catch (e) {
  // Ignore log errors
}

try {
  const args = parseArgs(Bun.argv.slice(2))
  
  try {
    fs.appendFileSync(logFile, `Parsed args: ${JSON.stringify(args)}\n`)
  } catch {}

  let models: Array<{ provider: string; model: string; label?: string }> = []
  try {
    models = JSON.parse(args.models || "[]")
    try {
      fs.appendFileSync(logFile, `Parsed models: ${JSON.stringify(models)}\n`)
    } catch {}
  } catch (e) {
    try {
      fs.appendFileSync(logFile, `ERROR parsing models: ${e}\n`)
    } catch {}
  }

  const question = args.question || "No question provided"
  const socketPath = args.socket || `/tmp/opencode-council-default.sock`
  const timeout = parseInt(args.timeout || "120", 10)
  const synthesize = args.synthesize === "true"

  try {
    fs.appendFileSync(logFile, `Rendering App with question: ${question}, models: ${models.length}\n`)
  } catch {}

  render(
    <App
      question={question}
      models={models}
      socketPath={socketPath}
      timeout={timeout}
      synthesize={synthesize}
    />
  )
} catch (error) {
  try {
    fs.appendFileSync(logFile, `FATAL ERROR: ${error}\n`)
  } catch {}
  console.error("Council TUI crashed:", error)
  process.exit(1)
}
