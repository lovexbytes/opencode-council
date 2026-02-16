import React from "react"
import { Box, Text } from "ink"

interface Props {
  model: {
    label: string
    status: string
    response: string
    streaming: string
  }
}

export function ModelPanel({ model }: Props) {
  const statusIcon =
    model.status === "done" ? "✅" :
    model.status === "running" ? "⏳" :
    model.status === "error" ? "❌" :
    "⏸️"

  // Truncate response for display (scrollable in full impl)
  const display = model.response || model.streaming || ""
  const lines = display.split("\n").slice(0, 12)
  const truncated = display.split("\n").length > 12

  return (
    <Box
      flexDirection="column"
      width="50%"
      padding={1}
      borderStyle="single"
      borderColor={model.status === "done" ? "green" : "gray"}
    >
      <Text bold>
        {statusIcon} {model.label}
      </Text>
      {lines.map((line, i) => (
        <Text key={i} wrap="wrap">{line}</Text>
      ))}
      {truncated && <Text dimColor>... (truncated)</Text>}
    </Box>
  )
}
