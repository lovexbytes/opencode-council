import React from "react"
import { Box, Text } from "ink"

interface Props {
  question: string
  status: string
  completed: number
  total: number
}

export function Header({ question, status, completed, total }: Props) {
  const statusColor =
    status === "complete" ? "green" :
    status === "error" ? "red" :
    "yellow"

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color="cyan">⚖️  OpenCode Council</Text>
        <Text> </Text>
        <Text color={statusColor}>[{status}]</Text>
        <Text dimColor> {completed}/{total} models</Text>
      </Box>
      <Box>
        <Text dimColor>Q: </Text>
        <Text>{question.length > 80 ? question.slice(0, 77) + "..." : question}</Text>
      </Box>
      <Text dimColor>{"─".repeat(60)}</Text>
    </Box>
  )
}
