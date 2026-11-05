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

  const vertex = shader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = shader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error('Native WebGL program allocation failed');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'Native WebGL link failed');
  }
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  const positionLocation = gl.getAttribLocation(program, 'a_position');
  const colorLocation = gl.getAttribLocation(program, 'a_color');
  const pointSizeLocation = gl.getAttribLocation(program, 'a_pointSize');
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  return { program, positionLocation, colorLocation, pointSizeLocation };
}
function shader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Native WebGL shader allocation failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || 'Native WebGL shader compile failed');
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
