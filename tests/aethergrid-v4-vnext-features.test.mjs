import test from 'node.test';
import assert from 'node.assert/strict';

import { createObservationEnvelope, validateObservationEnvelope } from '../apps/aethergrid-console/contracts/observation-envelope.mjs';
import { UniversalDataFabricBus } from '../apps/aethergrid-console/data-fabric/fabric-bus.mjs';
import { calculateReturns, calculateVolatility, calculateSharpeRatio, calculateValueAtRisk } from '../apps/aethergrid-console/kpi/kpi-engine.mjs';
import { DomainPack, DomainPackRegistry } from '../apps/aethergrid-console/domains/domain-pack-sdk.mjs';
import { resolveAgentConfig } from '../apps/aethergrid-console/agent-config.mjs';
import { AgentToolRegistry } from '../apps/aethergrid-console/agents/tool-registry.mjs';
import { PluginRegistry } from '../apps/aethergrid-console/plugins/plugin-registry.mjs';
import { AethergridMcpServer } from '../apps/aethergrid-console/mcp/mcp-server.mjs';
import { createGroqVoiceAdapter } from '../apps/aethergrid-console/voice/groq-voice-adapter.mjs';
import { AviationTelemetryProvider } from '../apps/aethergrid-console/domains/aviation/aviation-provider.mjs';
import { createAlpacaProvider } from '../apps/aethergrid-console/providers/alpaca-provider.mjs';
import { createFredProvider } from '../apps/aethergrid-console/providers/fred-provider.mjs';
import { GovernedActionGateway, ACTION_POLICY_TIERS } from '../apps/aethergrid-console/control/action-plan.mjs';

test('Data Fabric & Observation Envelope', () => {
  const env = createObservationEnvelope({
    domain: 'energy',
    providerId: 'eia',
    metric: 'net_generation',
    value: 500
  });
  assert.equal(validateObservationEnvelope(env), true);
  assert.equal(env.domain, 'energy');

  const bus = new UniversalDataFabricBus();
  bus.publish(env);
  const results = bus.query({ domain: 'energy' });
  assert.equal(results.length, 1);
  assert.equal(results[0].value, 500);
});

test('KPI Engine & Domain Pack SDK', () => {
  const prices = [10, 11, 10.5, 12];
  const returns = calculateReturns(prices);
  assert.equal(returns.length, 3);
  assert(calculateVolatility(returns) > 0);
  assert(calculateSharpeRatio(returns) !== 0);
  assert(calculateValueAtRisk(returns) >= 0);

  const reg = new DomainPackRegistry();
  const pack = reg.register(new DomainPack({
    id: 'test-domain',
    name: 'Test Domain',
    capabilities: ['cap1']
  }));
  assert.equal(reg.get('test-domain').name, 'Test Domain');
});

test('Agent Config Groq Models & Tool/Plugin Registries', async () => {
  const cfg = resolveAgentConfig({ AETHERGRID_AI_PROVIDER: 'groq' });
  assert.equal(cfg['AUREN'].model, 'qwen/qwen3.8-27b');
  assert.equal(cfg['VÆLON'].model, 'openai/gpt-oss-120b');

  const toolReg = new AgentToolRegistry();
  toolReg.registerTool({
    name: 'ping',
    description: 'Ping test',
    handler: async () => 'pong'
  });
  const res = await toolReg.executeTool('ping', {});
  assert.equal(res, 'pong');

  const plugReg = new PluginRegistry();
  plugReg.registerPlugin({ id: 'plug1', name: 'Plugin One' });
  assert.equal(plugReg.listPlugins().length, 1);
});

test('MCP Server & Groq Voice Adapter', async () => {
  const toolReg = new AgentToolRegistry();
  toolReg.registerTool({
    name: 'echo',
    description: 'Echo msg',
    handler: async (args) => args.msg
  });

  const mcp = new AethergridMcpServer({ toolRegistry: toolReg });
  const list = await mcp.handleRequest({ method: 'tools/list' });
  assert.equal(list.tools.length, 1);
  assert.equal(list.tools[0].name, 'aethergrid:echo');

  const call = await mcp.handleRequest({
    method: 'tools/call',
    params: { name: 'aethergrid:echo', arguments: { msg: 'hello' } }
  });
  assert.equal(JSON.parse(call.content[0].text), 'hello');

  const voice = createGroqVoiceAdapter({ apiKey: '' });
  const voiceRes = await voice.transcribeAudioBuffer(Buffer.from('test'));
  assert.equal(voiceRes.status, 'unconfigured');
});

test('Aviation Telemetry Provider', () => {
  const av = new AviationTelemetryProvider();
  const health = av.getHealth();
  assert.equal(health.status, 'configured');
  assert.equal(health.providerId, 'aviation-adsb');
});

test('Alpaca & FRED Market Providers', () => {
  const alpaca = createAlpacaProvider();
  const aHealth = alpaca.getHealth();
  assert.equal(aHealth.providerId, 'alpaca');
  assert.equal(aHealth.status, 'unconfigured');

  const fred = createFredProvider();
  const fHealth = fred.getHealth();
  assert.equal(fHealth.providerId, 'fred');
  assert.equal(fHealth.status, 'unconfigured');
});

test('Governed Action Gateway & Approval Lifecycle', async () => {
  const gw = new GovernedActionGateway();
  const plan = gw.createActionPlan({
    title: 'High Risk Action',
    tier: ACTION_POLICY_TIERS.HIGH_RISK,
    actions: [{ type: 'trade' }]
  });

  await assert.rejects(async () => {
    await gw.executeActionPlan(plan.id, async () => ({ status: 'ok' }));
  }, /requires operator approval/);

  gw.approveActionPlan(plan.id, 'op-123');
  const receipt = await gw.executeActionPlan(plan.id, async () => ({ status: 'ok' }));
  assert.equal(receipt.status, 'EXECUTED');
  assert.equal(receipt.approvedBy, 'op-123');
});
