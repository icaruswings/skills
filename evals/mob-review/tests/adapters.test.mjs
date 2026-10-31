import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseClaude, parseCodex, parseReview, cliArguments } from '../adapters.mjs';

const answer = { findings: [], gaps: [] };
test('Claude reports actual model and usage rather than trusting the requested alias', () => {
  const response = { structured_output: answer, is_error: false, total_cost_usd: .03,
    modelUsage: { 'claude-opus-5-5': { inputTokens: 100, outputTokens: 20 } } };
  const result = parseClaude(JSON.stringify(response));
  assert.equal(result.effectiveModel, 'claude-opus-5-5');
  assert.equal(result.costUsd, .03);
  assert.deepEqual(result.review, answer);
  assert.throws(() => parseClaude(JSON.stringify({ ...response, is_error: true })), /Claude/i);
});

test('invalid reviews and failed Codex calls never become empty successful reviews', () => {
  assert.throws(() => parseReview('not JSON'));
  assert.throws(() => parseReview('{"findings":[]}'));
  assert.throws(() => parseReview('{"findings":[{"severity":"minor"}],"gaps":[]}'));
  assert.throws(() => parseCodex('{"type":"turn.failed","error":{"message":"oops"}}'));
  const events = [{ type: 'thread.started', thread_id: 't1' }, { type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(answer) } }, { type: 'turn.completed', usage: { input_tokens: 4, output_tokens: 2 } }];
  assert.equal(parseCodex(events.map(JSON.stringify).join('\n')).threadId, 't1');
  assert.equal(parseCodex(events.map(JSON.stringify).join('\n')).tokens.input, 4);
});

test('tool calls contaminate a review and providers receive isolated read-only arguments', () => {
  assert.throws(() => parseCodex(JSON.stringify({ type: 'item.completed', item: { type: 'command_execution', command: 'cat answers' } })), /tool/i);
  const args = cliArguments('claude', { model: 'haiku' }, { schema: '/tmp/schema', allowance: .2 });
  assert.ok(args.includes('--tools') && args[args.indexOf('--tools') + 1] === '');
  const codex = cliArguments('codex', { model: 'gpt-6-luna', effort: 'medium' }, { schema: '/tmp/schema' });
  assert.ok(codex.includes('read-only'));
  assert.ok(codex.includes('agents.enabled=false'));
  assert.ok(!codex.includes('--dangerously-bypass-approvals-and-sandbox'));
});

test('missing Claude token measurements stay unknown instead of becoming zero', () => {
  const partial = parseClaude(JSON.stringify({ structured_output: answer, total_cost_usd: .01,
    modelUsage: { 'claude-opus-test': { inputTokens: 12 } } }));
  assert.deepEqual(partial.tokens, { input: null, cached: null, output: null });
  const complete = parseClaude(JSON.stringify({ structured_output: answer, total_cost_usd: .01,
    modelUsage: { 'claude-opus-test': { inputTokens: 12, cacheCreationInputTokens: 3, cacheReadInputTokens: 5, outputTokens: 4 } } }));
  assert.deepEqual(complete.tokens, { input: 20, cached: 5, output: 4 });
});
