// Enforce wire-byte bounds rather than JavaScript string-length limits.
// Never trust Content-Length: streaming requests must be bounded as they arrive.
const MAX_REQUEST_BYTES = 250_000;

function requestError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function readRequestJson(request, { maxBytes = MAX_REQUEST_BYTES } = {}) {
  const parts = [];
  let receivedBytes = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    receivedBytes += bytes.byteLength;
    if (receivedBytes > maxBytes) {
      throw requestError('payload too large', 413);
    }
    parts.push(bytes);
  }
  if (receivedBytes === 0) return {};
  const body = Buffer.concat(parts, receivedBytes).toString('utf8');
  try {
    return JSON.parse(body);
  } catch {
    throw requestError('invalid JSON request body', 400);
  }
}
