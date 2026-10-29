// Public HTTP errors never expose unexpected exception messages, runtime
// configuration, credentials or stack traces. Pure and safe for direct tests.
export function publicHttpError(error) {
  const candidate = Number(error?.status);
  const status =
    Number.isInteger(candidate) && candidate >= 400 && candidate <= 599
      ? candidate
      : 500;
  const clientError = status < 500;
  const suppliedMessage = typeof error?.message === 'string' ? error.message : '';
  const message = clientError
    ? suppliedMessage.slice(0, 256) || 'Invalid request'
    : 'Internal server error';
  return {
    status,
    payload: {
      error: status === 400 ? 'invalid_request' : 'server_error',
      message,
    },
  };
}
