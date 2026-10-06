/**
 * Governed Action Gateway
 * Action plan construction, policy evaluation, risk tiering, and execution receipts.
 */

export const ACTION_POLICY_TIERS = Object.freeze({
  OBSERVE: 'OBSERVE',               // Read-only
  SIMULATE: 'SIMULATE',             // Simulated run
  LOW_RISK: 'LOW_RISK',             // Reversible configuration
  HIGH_RISK: 'HIGH_RISK',           // System configuration / trading
  CRITICAL_CONTROL: 'CRITICAL_CONTROL' // Grid actuation / physical changes
});

export class ActionPlan {
  constructor(options = {}) {
    this.id = options.id || `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.title = options.title || 'Untitled Action Plan';
    this.domain = options.domain || 'system';
    this.tier = options.tier || ACTION_POLICY_TIERS.OBSERVE;
    this.actions = Array.isArray(options.actions) ? options.actions : [];
    this.approvalRequired = this.tier === ACTION_POLICY_TIERS.HIGH_RISK || this.tier === ACTION_POLICY_TIERS.CRITICAL_CONTROL;
    this.approved = false;
    this.approvedBy = null;
    this.status = 'DRAFT';
    this.createdAt = new Date().toISOString();
  }

  approve(operatorId) {
    if (!operatorId) throw new Error('Operator ID required for approval');
    this.approved = true;
    this.approvedBy = operatorId;
    this.status = 'APPROVED';
  }

  getExecutionReceipt(executionResult = {}) {
    return {
      actionPlanId: this.id,
      title: this.title,
      domain: this.domain,
      tier: this.tier,
      approved: this.approved,
      approvedBy: this.approvedBy,
      executedAt: new Date().toISOString(),
      status: executionResult.success ? 'EXECUTED' : 'FAILED',
      result: executionResult
    };
  }
}

export class GovernedActionGateway {
  constructor(options = {}) {
    this.plans = new Map();
  }

  createActionPlan(config) {
    const plan = new ActionPlan(config);
    this.plans.set(plan.id, plan);
    return plan;
  }

  approveActionPlan(planId, operatorId) {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Action plan ${planId} not found`);
    plan.approve(operatorId);
    return plan;
  }

  async executeActionPlan(planId, executorFn, context = {}) {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Action plan ${planId} not found`);

    if (plan.approvalRequired && !plan.approved) {
      throw new Error(`Action plan ${planId} requires operator approval before execution`);
    }

    plan.status = 'EXECUTING';
    try {
      const res = await executorFn(plan.actions, context);
      const receipt = plan.getExecutionReceipt({ success: true, data: res });
      plan.status = 'COMPLETED';
      return receipt;
    } catch (err) {
      const receipt = plan.getExecutionReceipt({ success: false, error: err.message });
      plan.status = 'FAILED';
      return receipt;
    }
  }
}

export const defaultGovernedGateway = new GovernedActionGateway();
