import { createOpenQuantumRuntime } from '../apps/aethergrid-console/openquantum-runtime.mjs';

const result = await createOpenQuantumRuntime().listBackends();
const publicReport = {
  provider: result.provider,
  status: result.status,
  live: result.live === true,
  backendCount: result.backends.length,
  backends: result.backends.map(({ name, shortCode, type, status, acceptingJobs }) => ({
    name, shortCode, type, status, acceptingJobs,
  })),
  hardwareSubmitted: false,
  hardwareExecuted: false,
};
process.stdout.write(JSON.stringify(publicReport, null, 2) + '\n');
if (result.status !== 'ready') process.exitCode = 1;
