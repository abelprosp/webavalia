import { useEffect, useRef } from 'react'

const VERT_SRC = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`

const FRAG_SRC = `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.y = 1.0 - uv.y;
  float t = u_time * 0.00015;

  vec2 p0 = vec2(0.30 + sin(t * 0.70) * 0.25, 0.25 + cos(t * 0.60) * 0.20);
  vec2 p1 = vec2(0.75 + cos(t * 0.50) * 0.20, 0.70 + sin(t * 0.80) * 0.20);
  vec2 p2 = vec2(0.50 + sin(t * 0.40 + 1.0) * 0.30, 0.50 + cos(t * 0.70) * 0.25);
  vec2 p3 = vec2(0.20 + cos(t * 0.55) * 0.20, 0.85 + sin(t * 0.45) * 0.15);

  float r = 0.55;
  float d0 = pow(1.0 - smoothstep(0.0, r, distance(uv, p0)), 1.4);
  float d1 = pow(1.0 - smoothstep(0.0, r, distance(uv, p1)), 1.4);
  float d2 = pow(1.0 - smoothstep(0.0, r, distance(uv, p2)), 1.4);
  float d3 = pow(1.0 - smoothstep(0.0, r, distance(uv, p3)), 1.4);

  float total = d0 + d1 + d2 + d3 + 0.0001;
  vec3 col = (u_c0 * d0 + u_c1 * d1 + u_c2 * d2 + u_c3 * d3) / total;

  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * 0.025;

  gl_FragColor = vec4(col, 1.0);
}`

export type Palette = {
  name: string
  colors: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ]
}

type MeshShaderProps = {
  palette: Palette
}

export function MeshShader({ palette }: MeshShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const targetRef = useRef(palette.colors)
  const currentRef = useRef(
    palette.colors.map((c) => [...c]) as Palette['colors']
  )

  useEffect(() => {
    targetRef.current = palette.colors
  }, [palette])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false })
    if (!gl) return

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)
      if (!sh) return null
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh)
        return null
      }
      return sh
    }

    const vs = compile(gl.VERTEX_SHADER, VERT_SRC)
    const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC)
    if (!vs || !fs) return

    const prog = gl.createProgram()
    if (!prog) return
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    )
    const posLoc = gl.getAttribLocation(prog, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(prog, 'u_resolution')
    const uTime = gl.getUniformLocation(prog, 'u_time')
    const uC0 = gl.getUniformLocation(prog, 'u_c0')
    const uC1 = gl.getUniformLocation(prog, 'u_c1')
    const uC2 = gl.getUniformLocation(prog, 'u_c2')
    const uC3 = gl.getUniformLocation(prog, 'u_c3')

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = now - start
      const k = 0.06
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 3; j++) {
          currentRef.current[i][j] +=
            (targetRef.current[i][j] - currentRef.current[i][j]) * k
        }
      }
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, t)
      const c = currentRef.current
      gl.uniform3f(uC0, c[0][0], c[0][1], c[0][2])
      gl.uniform3f(uC1, c[1][0], c[1][1], c[1][2])
      gl.uniform3f(uC2, c[2][0], c[2][1], c[2][2])
      gl.uniform3f(uC3, c[3][0], c[3][1], c[3][2])
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      gl.deleteProgram(prog)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteBuffer(buf)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className='absolute inset-0 block h-full w-full'
    />
  )
}
