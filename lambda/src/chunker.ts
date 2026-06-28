const CHUNK_TOKENS = 500
const OVERLAP_TOKENS = 50
const CHARS_PER_TOKEN = 4 // rough estimate

export function chunkText(text: string): string[] {
  const chunkSize = CHUNK_TOKENS * CHARS_PER_TOKEN
  const overlapSize = OVERLAP_TOKENS * CHARS_PER_TOKEN
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    chunks.push(text.slice(start, end))
    if (end === text.length) break
    start = end - overlapSize
  }
  return chunks
}
