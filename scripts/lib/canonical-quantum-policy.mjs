// These checks exercise the bounded analytic fallback, not a general QPU simulator.
export async function verifyLocalQuantum(runtime) {
  const sampler = await runtime.submitSampler({ shots: 1024 });
  const estimator = await runtime.submitEstimator({ observable: 'ZZ' });
  const valid = (result) =>
    result.provider === 'local-simulator' &&
    result.status === 'COMPLETED' &&
    result.hardwareExecuted === false &&
    result.hardwareSubmitted !== true &&
    /^[a-f0-9]{64}$/.test(String(result.receipt || ''));
  const verified =
    valid(sampler) &&
    valid(estimator) &&
    sampler.distribution?.['00'] === 512 &&
    sampler.distribution?.['11'] === 512 &&
    Object.keys(sampler.distribution).length === 2 &&
    estimator.expectationValue === 1;
  return {
    verified,
    provider: 'local-simulator',
    acceptanceState: verified ? 'local-analytic-simulation-verified' : null,
    samplerReceipt: sampler.receipt,
    estimatorReceipt: estimator.receipt,
    limitation:
      'Bounded analytic Bell sampler/ZZ estimator; not general circuit simulation or hardware execution.',
    hardwareSubmitted: false,
    hardwareExecuted: false,
  };
}

export function evaluateProviderAcceptance(providers, profile = 'ibm-required') {
  if (!['local-simulator', 'ibm-required'].includes(profile))
    throw new Error('Unknown quantum acceptance profile');
  const required = [
    'groq-VÆLON',
    'groq-AUREN',
    'groq-SOLVÆR',
    'groq-TEAM',
    'tomorrow-current',
    'tomorrow-forecast',
    'eia-NYIS',
    'noaa-BATN6',
    'transitland',
    'nyc-ferry-GTFS',
    'local-quantum',
  ];
  if (profile === 'ibm-required') required.push('ibm');
  const failed = required.filter((name) => providers[name]?.verified !== true);
  return {
    profile,
    required,
    failed,
    passed: failed.length === 0,
    ibmVerified: providers.ibm?.verified === true,
    hardwareSubmitted: false,
    hardwareExecuted: false,
  };
}
