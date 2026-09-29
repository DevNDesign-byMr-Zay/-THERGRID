import { startOperatorConsole } from '../src/operator-console-server.mjs';

const { server, port } = await startOperatorConsole();

process.stdout.write(`ÆTHERGRID operator console ready at http://127.0.0.1:${port}\n`);

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
