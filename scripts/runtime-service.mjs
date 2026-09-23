import { createRuntimeLogger, parseRuntimeConfig } from '../src/runtime-observability.mjs';
import { startRuntimeService } from '../src/runtime-service.mjs';

const config = parseRuntimeConfig(process.env);
const logger = createRuntimeLogger({
  level: config.logLevel,
  service: 'thergrid',
});
const server = await startRuntimeService({
  port: config.port,
  logger,
});

async function shutdown(signal) {
  logger.info(
    {
      event: 'runtime.stopping',
      signal,
    },
    'runtime service stopping',
  );

  await new Promise((resolve) => {
    server.close(resolve);
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}
