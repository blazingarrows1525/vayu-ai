/** Reads a `text/event-stream` body and calls `onEvent` for each complete frame. Malformed JSON
 *  in a frame is skipped rather than ending the stream. Resolves when the stream ends. */
export async function readEventStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: unknown) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, i);
      buffer = buffer.slice(i + 2);
      const lines = frame.split("\n");
      const event = lines.find((l) => l.startsWith("event:"))?.slice(6).trim() ?? "message";
      const data = lines
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("\n");
      if (!data) continue;
      try {
        onEvent(event, JSON.parse(data));
      } catch {
        /* skip a malformed frame */
      }
    }
  }
}
