/**
 * Universal Data Fabric Bus
 * Normalizes and dispatches telemetry and observation envelopes across backend subsystems.
 */

import { createObservationEnvelope, validateObservationEnvelope } from '../contracts/observation-envelope.mjs';

export class UniversalDataFabricBus {
  constructor(options = {}) {
    this.subscribers = new Set();
    this.history = [];
    this.maxHistory = options.maxHistory || 1000;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('Subscriber must be a function');
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  publish(rawObservation) {
    const envelope = validateObservationEnvelope(rawObservation)
      ? rawObservation
      : createObservationEnvelope(rawObservation);

    this.history.push(envelope);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    for (const subscriber of this.subscribers) {
      try {
        subscriber(envelope);
      } catch (err) {
        console.error('Data fabric subscriber error:', err.message);
      }
    }

    return envelope;
  }

  query({ domain, metric, providerId, limit = 50 } = {}) {
    let results = this.history;
    if (domain) results = results.filter(e => e.domain === domain);
    if (metric) results = results.filter(e => e.metric === metric);
    if (providerId) results = results.filter(e => e.providerId === providerId);
    return results.slice(-limit);
  }
}

export const defaultFabricBus = new UniversalDataFabricBus();
