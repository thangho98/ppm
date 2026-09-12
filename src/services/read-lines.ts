/**
 * Streaming line reader for the JSONL transcripts.
 *
 * Its own module because two readers need it — the full message parser and the
 * compaction scan — and having the second import it from the first would make the
 * two files a cycle.
 */

/**
 * Yield a file's lines without holding the file in memory.
 *
 * `Bun.file().text()` plus `split("\n")` costs the whole transcript twice over —
 * 277MB resident for a 77MB file, which is what forced a cap low enough to
 * reject real sessions. Peak here is one chunk plus one line.
 */
export async function* readLines(filePath: string): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  // Explicit reader rather than `for await` over the stream: the DOM lib's
  // ReadableStream is not typed as async-iterable, and the `finally` is what
  // releases it when a caller breaks early on `beforeUuid`.
  const reader = Bun.file(filePath).stream().getReader();
  let buffered = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const line of lines) yield line;
    }
  } finally {
    reader.releaseLock();
  }
  buffered += decoder.decode();
  if (buffered) yield buffered;
}
