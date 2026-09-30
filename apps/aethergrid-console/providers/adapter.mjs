export function createProviderAdapter(options = {}) {
  const id = options.id;
  if (!id) throw new Error('Provider adapter requires an id');

  const name = options.name || id;
  const capabilities = Object.freeze([...(options.capabilities || [])]);

  function configured() {
    return typeof options.configured === 'function' ? options.configured() : true;
  }

  function health() {
    return typeof options.health === 'function'
      ? options.health()
      : { status: 'ready', capabilities };
  }

  async function request(params = {}, context = {}) {
    if (typeof options.request !== 'function') {
      throw new Error(`Provider adapter '${id}' does not implement request()`);
    }
    return options.request(params, context);
  }

  return Object.freeze({
    id,
    name,
    capabilities,
    configured,
    health,
    request,
  });
}
