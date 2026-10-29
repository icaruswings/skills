import { createHash } from 'node:crypto';
import { budgetAllowance } from './policy.mjs';

export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export const opaqueId = key => hash(`blind-v1:${key}`).slice(0, 16);
export const callIdentity = input => hash(input);

export function makeMatrix(cases, repetitions, providers = ['claude', 'codex']) {
  if (!Number.isInteger(repetitions) || repetitions < 1) throw new Error('Invalid repetition count');
  const arms = providers.flatMap(provider => ['tiered', 'strong'].map(scheme => ({ provider, scheme })));
  const matrix = cases.flatMap(fixture => arms.flatMap(arm => Array.from({ length: repetitions }, (_, i) => ({
    caseId: fixture.id, split: fixture.split, ...arm, repetition: i + 1,
    key: `${arm.provider}:${arm.scheme}:${fixture.id}:${i + 1}`,
  }))));
  const phases = { pilot: 0, holdout: 1 };
  return matrix.sort((a, b) => phases[a.split] - phases[b.split] || opaqueId(a.key).localeCompare(opaqueId(b.key)));
}

export function assertResume(record, identity) {
  if (record.identity !== identity) throw new Error('Inputs or configuration changed; use a new run directory');
  if (record.status !== undefined && record.status !== 'complete') throw new Error('Previous call incomplete; reconcile its usage before retrying');
}

export class Budget {
  constructor(cap, reserve, spent = 0) {
    this.cap = cap;
    this.reservation = reserve;
    this.spent = spent;
    this.reserved = 0;
    this.activeReservations = 0;
    this.waiters = [];
  }
  reserve() {
    const allowance = budgetAllowance({ cap: this.cap, spent: this.spent === null ? null : this.spent + this.reserved, reserve: this.reservation });
    this.reserved += allowance;
    this.activeReservations++;
    return allowance;
  }
  async reserveWhenAvailable() {
    while (true) {
      try { return this.reserve(); }
      catch (error) {
        if (this.spent === null || this.activeReservations === 0) throw error;
        await new Promise(resolve => this.waiters.push(resolve));
      }
    }
  }
  settle(allowance, actual) {
    this.reserved -= allowance;
    this.activeReservations--;
    if (this.activeReservations === 0) this.reserved = 0;
    this.spent = this.spent === null || !Number.isFinite(actual) ? null : this.spent + actual;
    for (const resolve of this.waiters.splice(0)) resolve();
  }
}
