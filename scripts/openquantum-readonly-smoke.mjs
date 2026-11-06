import { createOpenQuantumRuntime } from '../apps/aethergrid-console/openquantum-runtime.mjs';

const result = await createOpenQuantumRuntime().listBackends();
const publicReport = {
  provider: result.provider,
  status: result.status,
  sdkInstalled: result.sdkInstalled === true,
  sdkVersion: result.sdkVersion ?? null,
  httpStatus: result.httpStatus ?? null,
  live: result.live === true,
  backendCount: result.backends.length,
  backends: result.backends.map(
    ({ name, shortCode, providerId, type, status, acceptingJobs, queueDepth }) => ({
      name,
      providerId,
      shortCode,
      type,
      status,
      acceptingJobs,
      queueDepth,
    }),
  ),
  hardwareSubmitted: false,
  hardwareExecuted: false,
};
process.stdout.write(JSON.stringify(publicReport, null, 2) + '\n');
if (result.status !== 'ready') process.exitCode = 1;
