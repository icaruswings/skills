import { lensNames } from './prompts.mjs';
const severities = ['blocker', 'should-fix', 'optional'];

export function parseReview(text) {
  const value = typeof text === 'string' ? JSON.parse(text) : text;
  if (!value || !Array.isArray(value.findings) || !Array.isArray(value.gaps)) throw new Error('Invalid review shape');
  for (const finding of value.findings) {
    if (!severities.includes(finding.severity)) throw new Error('Invalid severity');
    if (!lensNames.includes(finding.lens)) throw new Error('Invalid canonical lens');
    for (const field of ['lens', 'title', 'evidence', 'location']) {
      if (typeof finding[field] !== 'string' || !finding[field].trim()) throw new Error(`Invalid finding ${field}`);
    }
  }
  if (!value.gaps.every(gap => typeof gap === 'string')) throw new Error('Invalid verification gaps');
  return value;
}

export function parseClaude(stdout, parser = parseReview) {
  const value = JSON.parse(stdout);
  if (value.is_error) throw new Error(`Claude failed: ${value.result ?? value.subtype}`);
  const models = Object.keys(value.modelUsage ?? {});
  const tokens = Object.values(value.modelUsage ?? {}).reduce((sum, usage) => ({
    input: sum.input + (usage.inputTokens ?? 0) + (usage.cacheCreationInputTokens ?? 0) + (usage.cacheReadInputTokens ?? 0),
    cached: sum.cached + (usage.cacheReadInputTokens ?? 0),
    output: sum.output + (usage.outputTokens ?? 0),
  }), { input: 0, cached: 0, output: 0 });
  return { review: parser(value.structured_output ?? value.result), effectiveModel: models.length === 1 ? models[0] : null,
    observedModels: models, costUsd: value.total_cost_usd ?? null, tokens };
}

export function parseCodex(stdout, parser = parseReview) {
  const events = stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const failure = events.find(event => ['error', 'turn.failed'].includes(event.type));
  if (failure) throw new Error(`Codex failed: ${JSON.stringify(failure)}`);
  const items = events.filter(event => event.type === 'item.completed').map(event => event.item);
  if (items.some(item => !['agent_message', 'reasoning'].includes(item.type))) throw new Error('Review contaminated by tool use');
  const final = items.filter(item => item.type === 'agent_message').at(-1);
  const completed = events.find(event => event.type === 'turn.completed');
  if (!final || !completed) throw new Error('Incomplete Codex review');
  return { review: parser(final.text), threadId: events.find(event => event.type === 'thread.started')?.thread_id,
    costUsd: null, tokens: { input: completed.usage?.input_tokens ?? null, cached: completed.usage?.cached_input_tokens ?? null,
      output: completed.usage?.output_tokens ?? null } };
}

const noTools = ['shell_tool', 'apps', 'plugins', 'memories', 'hooks', 'browser_use', 'computer_use', 'image_generation', 'view_image'];
export function cliArguments(provider, config, { schema, allowance }) {
  if (provider === 'claude') return ['-p', '--model', config.model, '--tools', '', '--permission-mode', 'dontAsk',
    '--strict-mcp-config', '--setting-sources', '', '--no-session-persistence', '--output-format', 'json',
    '--max-budget-usd', String(allowance), '--json-schema', schema,
    '--system-prompt', 'Perform only the supplied read-only review. No tools. Return the requested JSON.'];
  if (provider !== 'codex') throw new Error(`Unsupported provider: ${provider}`);
  return ['--no-daemon', '-a', 'never', 'exec', '--ignore-user-config', '--json', '--skip-git-repo-check',
    '--sandbox', 'read-only', ...noTools.flatMap(feature => ['--disable', feature]),
    '-c', 'agents.enabled=false', '-c', 'web_search="disabled"', '-c', 'skills.include_instructions=false',
    '-c', 'skills.bundled.enabled=false', '-c', `model_reasoning_effort="${config.effort}"`,
    '--model', config.model, '--output-schema', schema, '-'];
}

export function modelMatches(provider, requested, observed) {
  if (!observed) return false;
  return provider === 'claude' ? observed.startsWith(`claude-${requested}-`) : observed === requested;
}
