import { expect, test } from '@playwright/test';
import { NativeWebglSpatialRenderer } from '../src/renderer/native/native-webgl-renderer';

// The DOM/GL boundary is doubled here so allocation failures and synchronous races
// are deterministic; native-context-browser.spec.ts exercises real browser loss.
function fixture() {
  const previous = ['document', 'window', 'requestAnimationFrame', 'cancelAnimationFrame'].map(
    (name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
  );
  let lost = false,
    failLink = false,
    failShader = false,
    loseOnInitialLink = false,
    draws = 0,
    removed = false,
    reducedMotion = true;
  let active: object | null = null,
    pendingDelete: object | null = null;
  const programs = new Set<object>(),
    deleted: object[] = [],
    shaders = new Set<object>(),
    allocations: object[] = [];
  let initialLossEvent: Event | null = null;
  const uploads: number[][] = [],
    commands: { colors: number[]; sizes: number[] }[] = [];
  const frames = new Map<number, FrameRequestCallback>();
  const gl: any = new Proxy(
    {
      VERTEX_SHADER: 1,
      FRAGMENT_SHADER: 2,
      COMPILE_STATUS: 3,
      LINK_STATUS: 4,
      LINES: 5,
      POINTS: 6,
      isContextLost: () => lost,
      createShader: () => {
        const shader = {};
        shaders.add(shader);
        return shader;
      },
      deleteShader: (shader: object) => shaders.delete(shader),
      createProgram: () => {
        const program = {};
        programs.add(program);
        allocations.push(program);
        return program;
      },
      // WebGL defers deletion of the current program until it is unbound.
      deleteProgram: (program: object) => {
        expect(lost).toBe(false);
        expect(programs.has(program)).toBe(true);
        if (program === active) pendingDelete = program;
        else programs.delete(program);
        deleted.push(program);
      },
      useProgram: (program: object | null) => {
        if (pendingDelete && program !== pendingDelete) {
          programs.delete(pendingDelete);
          pendingDelete = null;
        }
        active = program;
        if (program) expect(programs.has(program)).toBe(true);
      },
      getShaderParameter: () => !failShader,
      getShaderInfoLog: () => 'Shader failure fixture',
      getProgramParameter: () => {
        if (loseOnInitialLink) {
          loseOnInitialLink = false;
          lost = true;
          programs.clear();
          shaders.clear();
          initialLossEvent = new Event('webglcontextlost', { cancelable: true });
          queueMicrotask(() => canvas.dispatchEvent(initialLossEvent!));
          return false;
        }
        return !failLink;
      },
      getProgramInfoLog: () => 'Link failure fixture',
      getAttribLocation: () => 0,
      createBuffer: () => ({}),
      bufferData: (_: number, data: Float32Array) => uploads.push(Array.from(data)),
      drawArrays: () => {
        expect(lost).toBe(false);
        draws++;
        commands.push({ colors: uploads[1], sizes: uploads[2] });
        uploads.length = 0;
      },
    },
    { get: (target, key) => (key in target ? target[key as keyof typeof target] : () => {}) },
  );
  const canvas: any = Object.assign(new EventTarget(), {
    style: {},
    clientWidth: 800,
    clientHeight: 600,
    width: 800,
    height: 600,
    setAttribute() {},
    remove() {
      removed = true;
    },
    getContext: () => gl,
  });
  Object.assign(globalThis, {
    document: { createElement: () => canvas },
    window: { matchMedia: () => ({ matches: reducedMotion }) },
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      const id = frames.size + 1;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  });
  const renderer = new NativeWebglSpatialRenderer();
  renderer.mount({ clientWidth: 800, clientHeight: 600, replaceChildren() {} } as any);
  return {
    renderer,
    canvas,
    commands,
    programs,
    deleted,
    shaders,
    allocations,
    get initialLossEvent() {
      return initialLossEvent;
    },
    set loseOnInitialLink(value: boolean) {
      loseOnInitialLink = value;
    },
    set failShader(value: boolean) {
      failShader = value;
    },
    get draws() {
      return draws;
    },
    get removed() {
      return removed;
    },
    set failLink(value: boolean) {
      failLink = value;
    },
    set reducedMotion(value: boolean) {
      reducedMotion = value;
    },
    frame(now: number) {
      const [id, callback] = frames.entries().next().value!;
      frames.delete(id);
      callback(now);
    },
    get pendingFrames() {
      return frames.size;
    },
    loss() {
      lost = true;
      active = null;
      pendingDelete = null;
      programs.clear();
      const event = new Event('webglcontextlost', { cancelable: true });
      canvas.dispatchEvent(event);
      return event;
    },
    restore() {
      lost = false;
      canvas.dispatchEvent(new Event('webglcontextrestored'));
    },
    cleanup() {
      renderer.destroy();
      for (const [name, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete (globalThis as any)[name];
      }
    },
  };
}

async function scene(renderer: NativeWebglSpatialRenderer) {
  await renderer.initialize();
  await renderer.flyTo({
    latitude: 40,
    longitude: -74,
    rangeMeters: 5000,
    pitchDegrees: -45,
    headingDegrees: 30,
    journey: 'direct',
  });
  renderer.setTime({ mode: 'historical', iso: '2026-06-21T12:00:00Z' });
  renderer.setVisualMode('solid');
  renderer.setPerformanceTier('quality');
  renderer.setLayers([
    { id: 'grid', visible: false },
    { id: 'energy', visible: true, opacity: 0.25 },
  ]);
  renderer.applyOverlay({
    id: 'source',
    layerId: 'energy',
    eventTime: '2026-06-21T12:00:00Z',
    attribution: 'Lifecycle source',
    live: false,
    stale: true,
    fallback: false,
    nodes: [
      {
        id: 'station',
        kind: 'substation',
        position: { latitude: 40, longitude: -74 },
        properties: { sourceFeatureId: 'mapped-station' },
      },
    ],
    edges: [],
  });
  renderer.selectFeature('station');
}

test('native status reaches canvas observers after loss, failed restore and a fresh draw', async () => {
  const f = fixture();
  try {
    await scene(f.renderer);
    const before = f.draws;
    const states: unknown[] = [];
    f.canvas.addEventListener('aethergrid:native-availability', (event: Event) => {
      const { ready, reason } = f.renderer.status();
      states.push({ bubbles: event.bubbles, ready, reason, drew: f.draws > before });
    });
    f.loss();
    f.failLink = true;
    f.restore();
    f.failLink = false;
    f.restore();
    f.restore();
    expect(states).toEqual([
      { bubbles: true, ready: false, reason: expect.stringMatching(/context lost/i), drew: false },
      { bubbles: true, ready: false, reason: expect.stringMatching(/Link failure fixture/), drew: false },
      { bubbles: true, ready: true, reason: expect.not.stringMatching(/context lost|restoration failed/i), drew: true },
    ]);
    f.loss();
    f.renderer.destroy();
    f.restore();
    f.loss();
    expect(states).toHaveLength(4);
  } finally {
    f.cleanup();
  }
});

for (const kind of ['node', 'edge'] as const) {
  test(`native suspended picking ignores ${kind}s even when overlay, layers and camera change`, async () => {
    const f = fixture(), center = { x: 400, y: 300 };
    const overlay = (id: string, latitude: number, longitude: number) => ({
      id: 'source', layerId: 'energy', eventTime: '2026-06-21T12:00:00Z',
      attribution: 'Latest mapped source', live: false, stale: true, fallback: false,
      nodes: kind === 'node' ? [{ id, kind: 'substation' as const, position: { latitude, longitude }, properties: { sourceFeatureId: 'mapped' } }] : [],
      edges: kind === 'edge' ? [{ id, kind: 'transmission' as const, from: { latitude, longitude: longitude - 0.01 }, to: { latitude, longitude: longitude + 0.01 }, properties: { sourceFeatureId: 'mapped' } }] : [],
    });
    try {
      await scene(f.renderer);
      f.renderer.applyOverlay(overlay('before', 40, -74));
      expect(await f.renderer.pick(center)).toMatchObject({ id: 'before' });
      f.loss();
      expect.soft(await f.renderer.pick(center), 'immediately after loss').toBeNull();
      f.renderer.clearOverlay('energy');
      expect.soft(await f.renderer.pick(center), 'after removal').toBeNull();
      f.renderer.applyOverlay(overlay('latest', 41, -73));
      f.renderer.setLayers([{ id: 'energy', visible: false }]);
      expect.soft(await f.renderer.pick(center), 'with replacement hidden').toBeNull();
      f.renderer.setLayers([{ id: 'energy', visible: true }]);
      await f.renderer.flyTo({ latitude: 41, longitude: -73, rangeMeters: 5000, journey: 'direct' });
      expect.soft(await f.renderer.pick(center), 'at the new camera target').toBeNull();
      expect(await f.renderer.pickSurface(center)).toMatchObject({ latitude: 41, longitude: -73, source: 'native-projection' });
      f.restore();
      expect(await f.renderer.pick(center)).toMatchObject({ id: 'latest', source: 'Latest mapped source', properties: { sourceFeatureId: 'mapped', stale: true, fallback: false } });
    } finally {
      f.cleanup();
    }
  });
}

// Removing preventDefault or the suspended draw guard must fail this contract.
test('native loss permits restoration and suspends GPU work without losing camera or scene state', async () => {
  const f = fixture();
  try {
    await scene(f.renderer);
    const camera = f.renderer.cameraSnapshot(),
      solar = f.renderer.status().solar,
      before = f.draws;
    expect(f.loss().defaultPrevented).toBe(true);
    expect(f.renderer.status()).toMatchObject({ ready: false, degraded: true });
    expect(f.renderer.status().reason).toMatch(/context lost/i);
    f.renderer.resize();
    f.renderer.setVisualMode('solid');
    expect(f.draws).toBe(before);
    expect(f.renderer.cameraSnapshot()).toEqual(camera);
    f.restore();
    expect(f.renderer.status()).toMatchObject({
      ready: true,
      degraded: false,
      visualMode: 'solid',
      performanceTier: 'quality',
      solar,
    });
    expect(f.renderer.cameraSnapshot()).toEqual(camera);
    expect(f.draws).toBeGreaterThan(before);
    expect(f.commands.at(-1)).toEqual({ colors: [1, 1, 1, 0.25], sizes: [13] });
    expect(await f.renderer.pick({ x: 400, y: 300 })).toMatchObject({
      id: 'station',
      source: 'Lifecycle source',
      properties: { sourceFeatureId: 'mapped-station', stale: true, fallback: false },
    });
  } finally {
    f.cleanup();
  }
});

// Reusing invalid bindings, deleting a lost program, or leaving listeners alive fails here.
test('native repeated recovery and idempotent destroy release only valid programs', async () => {
  const f = fixture();
  try {
    await scene(f.renderer);
    for (let cycle = 0; cycle < 3; cycle++) {
      expect(f.loss().defaultPrevented).toBe(true);
      f.restore();
      expect(f.programs.size).toBe(1);
    }
    f.renderer.destroy();
    f.renderer.destroy();
    expect(f.deleted).toHaveLength(1);
    expect(f.programs.size).toBe(0);
    expect(f.shaders.size).toBe(0);
    expect(f.removed).toBe(true);
    expect(f.loss().defaultPrevented).toBe(false);
    const before = f.draws;
    f.restore();
    expect(f.draws).toBe(before);
    expect(f.programs.size).toBe(0);
  } finally {
    f.cleanup();
  }
});

test('native destroy during loss detaches restoration and leaves no live program', async () => {
  const f = fixture();
  try {
    await scene(f.renderer);
    f.loss();
    const before = f.draws;
    f.renderer.destroy();
    f.renderer.destroy();
    f.restore();
    expect(f.draws).toBe(before);
    expect(f.deleted).toHaveLength(0);
    expect(f.programs.size).toBe(0);
    expect(f.renderer.status().ready).toBe(false);
    expect(f.renderer.cameraSnapshot()).toBeNull();
  } finally {
    f.cleanup();
  }
});

// A failed restore must stay suspended and clean partial GPU resources.
test('native restore failure reports unavailable state and a later restore can recover', async () => {
  const f = fixture();
  try {
    await scene(f.renderer);
    f.loss();
    f.failLink = true;
    const before = f.draws;
    f.restore();
    expect(f.renderer.status()).toMatchObject({ ready: false, degraded: true });
    expect(f.renderer.status().reason).toMatch(/Link failure fixture/);
    expect(f.programs.size).toBe(0);
    expect(f.shaders.size).toBe(0);
    f.renderer.resize();
    expect(f.draws).toBe(before);
    f.failLink = false;
    f.restore();
    expect(f.renderer.status()).toMatchObject({ ready: true, degraded: false });
    expect(f.commands.at(-1)?.sizes).toEqual([13]);
  } finally {
    f.cleanup();
  }
});

// A lost context must not freeze journey promises or restore an obsolete CPU frame.
test('native loss retains scene updates and journeys settle while GPU draws are suspended', async () => {
  const f = fixture();
  try {
    await scene(f.renderer);
    f.reducedMotion = false;
    const started = performance.now();
    const journey = f.renderer.flyTo({
      latitude: 10,
      longitude: 20,
      rangeMeters: 5000,
      journey: 'direct',
    });
    f.frame(started + 100);
    const before = f.draws;
    f.loss();
    f.renderer.setTime({ mode: 'historical', iso: '2026-12-21T12:00:00Z' });
    f.renderer.setLayers([
      { id: 'grid', visible: false },
      { id: 'energy', visible: true, opacity: 0.5 },
    ]);
    f.frame(started + 400);
    await journey;
    expect(f.pendingFrames).toBe(0);
    expect(f.renderer.status().busy).toBe(false);
    expect(f.draws).toBe(before);
    const updatedSolar = f.renderer.status().solar;
    expect(f.renderer.cameraSnapshot()).toMatchObject({ latitude: 10, longitude: 20 });
    f.restore();
    expect(f.renderer.status()).toMatchObject({ ready: true, solar: updatedSolar });
    expect(f.renderer.cameraSnapshot()).toMatchObject({ latitude: 10, longitude: 20 });
    expect(f.commands.at(-1)).toEqual({ colors: [1, 1, 1, 0.5], sizes: [13] });
    const recovered = f.draws;
    f.restore();
    expect(f.draws).toBe(recovered);
    expect(f.programs.size).toBe(1);
    const cancelled = f.renderer.flyTo({ latitude: 0, longitude: 0, journey: 'direct' });
    f.loss();
    f.renderer.destroy();
    await cancelled;
    expect(f.pendingFrames).toBe(0);
    f.restore();
    expect(f.programs.size).toBe(0);
  } finally {
    f.cleanup();
  }
});

// A loss during first linking must leave an owner for the queued loss event.
test('native initial linking loss remains suspended and restores the retained public scene', async () => {
  const f = fixture();
  try {
    f.loseOnInitialLink = true;
    await scene(f.renderer);
    expect(f.initialLossEvent?.defaultPrevented).toBe(true);
    expect(f.renderer.status()).toMatchObject({ ready: false, degraded: true });
    expect(f.renderer.status().reason).toMatch(/context lost/i);
    expect(f.draws).toBe(0);
    expect(f.programs.size).toBe(0);
    const camera = f.renderer.cameraSnapshot(),
      solar = f.renderer.status().solar;
    f.restore();
    expect(f.allocations).toHaveLength(2);
    expect(f.allocations[1]).not.toBe(f.allocations[0]);
    expect(f.programs.size).toBe(1);
    expect(f.renderer.status()).toMatchObject({
      ready: true,
      degraded: false,
      visualMode: 'solid',
      performanceTier: 'quality',
      solar,
    });
    expect(f.renderer.cameraSnapshot()).toEqual(camera);
    expect(f.commands.at(-1)).toEqual({ colors: [1, 1, 1, 0.25], sizes: [13] });
    expect(await f.renderer.pick({ x: 400, y: 300 })).toMatchObject({
      id: 'station',
      source: 'Lifecycle source',
      properties: { sourceFeatureId: 'mapped-station', stale: true, fallback: false },
    });
    f.renderer.destroy();
    f.renderer.destroy();
    expect(f.deleted).toHaveLength(1);
    expect(f.programs.size).toBe(0);
    expect(f.loss().defaultPrevented).toBe(false);
    f.restore();
    expect(f.programs.size).toBe(0);
  } finally {
    f.cleanup();
  }
});

for (const failure of ['shader', 'link'] as const) {
  test(`native genuine initial ${failure} failure rejects and relinquishes listener ownership`, async () => {
    const f = fixture();
    try {
      if (failure === 'shader') f.failShader = true;
      else f.failLink = true;
      await expect(f.renderer.initialize()).rejects.toThrow(
        failure === 'shader' ? 'Shader failure fixture' : 'Link failure fixture',
      );
      expect(f.renderer.status().ready).toBe(false);
      expect(f.programs.size).toBe(0);
      expect(f.shaders.size).toBe(0);
      expect(f.loss().defaultPrevented).toBe(false);
      f.restore();
      expect(f.programs.size).toBe(0);
    } finally {
      f.cleanup();
    }
  });
}
