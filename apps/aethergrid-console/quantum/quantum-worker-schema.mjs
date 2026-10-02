import { z } from 'zod';

export const workloadSpecSchema = z.object({
  type: z.enum(['openqasm3', 'sampler-circuit', 'estimator-circuit']),
  circuit: z.string().min(1).max(256 * 1024),
  observables: z.array(z.string()).optional(),
});

export const prepareRequestSchema = z.object({
  provider: z.string().default('ibm-quantum'),
  backend: z.string().min(1),
  primitive: z.enum(['sampler', 'estimator']).default('sampler'),
  workload: workloadSpecSchema,
  optimizationLevel: z.number().int().min(0).max(3).default(2),
  shots: z.number().int().min(1).max(100000).default(4096),
  apiKey: z.string().optional(),
  serviceCrn: z.string().optional(),
});

export const dryRunRequestSchema = prepareRequestSchema;
