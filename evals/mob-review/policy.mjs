const providers = {
  claude: { economy: { model: 'haiku' }, balanced: { model: 'sonnet' }, strong: { model: 'opus' } },
  codex: {
    economy: { model: 'gpt-6-luna', effort: 'medium' },
    balanced: { model: 'gpt-6-sol', effort: 'medium' },
    strong: { model: 'gpt-6-astra', effort: 'high' },
  },
};

export function chooseModel(provider, scheme, tier) {
  if (!Object.hasOwn(providers, provider)) throw new Error(`Unknown provider: ${provider}`);
  if (!['tiered', 'strong'].includes(scheme)) throw new Error(`Unknown scheme: ${scheme}`);
  if (!Object.hasOwn(providers[provider], tier)) throw new Error(`Unknown tier: ${tier}`);
  return { ...providers[provider][scheme === 'strong' ? 'strong' : tier] };
}

export function budgetAllowance({ cap, spent, reserve }) {
  if (!Number.isFinite(spent)) throw new Error('Unknown spending; reconcile usage before continuing');
  if (!(cap > 0 && reserve > 0 && spent >= 0)) throw new Error('Invalid budget');
  if (cap - spent + Number.EPSILON < reserve) throw new Error('Claude budget cannot cover the next reserved call');
  return reserve;
}

export const modelConfiguration = structuredClone(providers);

export function validateCodexCatalog(catalog) {
  return Object.values(providers.codex).map(config => {
    const model = catalog.models?.find(model => model.slug === config.model);
    if (!model) throw new Error(`Configured model ${config.model} is absent from this CLI catalog`);
    if (!model.supported_reasoning_levels?.some(level => level.effort === config.effort)) throw new Error(`Unsupported catalog effort for ${config.model}`);
    return { slug: model.slug, description: model.description ?? '',
      default_reasoning_level: model.default_reasoning_level ?? null,
      supported_reasoning_levels: model.supported_reasoning_levels.map(({ effort }) => ({ effort })) };
  });
}
