// Simple council implementation using single-model coordination
// The heavy lifting is done in the prompt rewriting via command hook

export async function runCouncil(
  _input: unknown,
  _context: unknown,
  query: string,
): Promise<string> {
  // This is now handled by prompt rewriting in the command hook
  // Return simple acknowledgment
  return `Council analysis initiated for: ${query}\n\nThe multi-perspective analysis is running in the main response above.`;
}
