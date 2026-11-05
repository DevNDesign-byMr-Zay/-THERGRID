import { nativeBackground } from './native-environment';
import { collectNativeGeometry } from './native-geometry';
import type { NativeFrame, ProjectedFeature } from './native-frame';

// Own the canvas listeners and all context-bound resources together. CPU scene
// state remains with the renderer and is redrawn only after fresh bindings exist.
export class NativeWebglDriver {
  #bindings: NativeWebglBindings | null;
  #destroyed = false;
  reason: string | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGLRenderingContext,
    private readonly redraw: () => void,
  ) {
    this.#bindings = initializeNativeWebgl(gl);
    canvas.addEventListener('webglcontextlost', this.#onLost);
    canvas.addEventListener('webglcontextrestored', this.#onRestored);
  }

  get suspended(): boolean {
    return !this.#bindings || this.gl.isContextLost();
  }

  #onLost = (event: Event): void => {
    event.preventDefault();
    // Lost-context programs are invalid already; never delete or reuse them.
    this.#bindings = null;
    this.reason = 'WebGL context lost; rendering suspended until restoration';
  };

  #onRestored = (): void => {
    if (this.#destroyed || this.gl.isContextLost()) return;
    // Ignore duplicate restoration notifications once this context is usable.
    if (this.#bindings) return;
    try {
      this.#bindings = initializeNativeWebgl(this.gl);
      this.reason = null;
    } catch (error) {
      this.reason = `WebGL restoration failed: ${error instanceof Error ? error.message : String(error)}`;
      return;
    }
    this.redraw();
  };

  draw(frame: NativeFrame): ProjectedFeature[] {
    const bindings = this.#bindings;
    if (this.#destroyed || this.suspended || !bindings) return [];
    const gl = this.gl,
      background = nativeBackground(frame);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(background.r, background.g, background.b, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(bindings.program);
    const geometry = collectNativeGeometry(frame);
    drawNativeWebgl(
      gl,
      bindings,
      gl.LINES,
      geometry.linePositions,
      geometry.lineColors,
      new Array(geometry.linePositions.length / 2).fill(1),
    );
    drawNativeWebgl(
      gl,
      bindings,
      gl.POINTS,
      geometry.pointPositions,
      geometry.pointColors,
      geometry.pointSizes,
    );
    return geometry.features;
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.canvas.removeEventListener('webglcontextlost', this.#onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.#onRestored);
    if (this.#bindings && !this.gl.isContextLost()) {
      // Deleting a current program is deferred by WebGL until it is unbound.
      this.gl.useProgram(null);
      this.gl.deleteProgram(this.#bindings.program);
    }
    this.#bindings = null;
  }
}

export interface NativeWebglBindings {
  program: WebGLProgram;
  positionLocation: number;
  colorLocation: number;
  pointSizeLocation: number;
}
export function initializeNativeWebgl(gl: WebGLRenderingContext): NativeWebglBindings {
  const vertexSource = `
      attribute vec2 a_position;
      attribute vec4 a_color;
      attribute float a_pointSize;
      varying vec4 v_color;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        gl_PointSize = a_pointSize;
        v_color = a_color;
      }
    `;
  const fragmentSource = `
      precision mediump float;
      varying vec4 v_color;
      void main() {
        gl_FragColor = v_color;
      }
    `;

  let vertex: WebGLShader | null = null,
    fragment: WebGLShader | null = null;
  let program: WebGLProgram | null = null;
  try {
    vertex = shader(gl, gl.VERTEX_SHADER, vertexSource);
    fragment = shader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    program = gl.createProgram();
    if (!program) throw new Error('Native WebGL program allocation failed');
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Native WebGL link failed');
    }
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const colorLocation = gl.getAttribLocation(program, 'a_color');
    const pointSizeLocation = gl.getAttribLocation(program, 'a_pointSize');
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    return { program, positionLocation, colorLocation, pointSizeLocation };
  } catch (error) {
    if (program && !gl.isContextLost()) gl.deleteProgram(program);
    throw error;
  } finally {
    if (!gl.isContextLost()) {
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
    }
  }
}

function shader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Native WebGL shader allocation failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Native WebGL shader compile failed';
    if (!gl.isContextLost()) gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}
export function drawNativeWebgl(
  gl: WebGLRenderingContext,
  bindings: NativeWebglBindings,
  mode: number,
  positions: readonly number[],
  colors: readonly number[],
  sizes: readonly number[],
): void {
  if (!positions.length) return;
  const count = positions.length / 2;

  const positionBuffer = gl.createBuffer();
  const colorBuffer = gl.createBuffer();
  const sizeBuffer = gl.createBuffer();
  if (!positionBuffer || !colorBuffer || !sizeBuffer) return;

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(bindings.positionLocation);
  gl.vertexAttribPointer(bindings.positionLocation, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(bindings.colorLocation);
  gl.vertexAttribPointer(bindings.colorLocation, 4, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sizes), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(bindings.pointSizeLocation);
  gl.vertexAttribPointer(bindings.pointSizeLocation, 1, gl.FLOAT, false, 0, 0);

  gl.drawArrays(mode, 0, count);
  gl.deleteBuffer(positionBuffer);
  gl.deleteBuffer(colorBuffer);
  gl.deleteBuffer(sizeBuffer);
}
