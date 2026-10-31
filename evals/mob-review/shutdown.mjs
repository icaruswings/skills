export function stopController(events = process) {
  let requested = false;
  const request = () => { requested = true; };
  const signals = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) events.on(signal, request);
  return {
    get requested() { return requested; },
    request,
    dispose() { for (const signal of signals) events.off(signal, request); },
  };
}
