/* ── MOBILE NAV TOGGLE ── */
(function () {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => links.classList.toggle('open'));
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
  document.addEventListener('click', (e) => {
    if (links.classList.contains('open') && !links.contains(e.target) && e.target !== toggle) {
      links.classList.remove('open');
    }
  });
})();

/* ── HERO SHADER (WebGL aurora — orange palette) ── */
(function () {
  const canvas = document.getElementById('hero-shader');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false })
           || canvas.getContext('experimental-webgl', { alpha: false });
  if (!gl) return;

  const VS = `
    attribute vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;

  const FS = `
    precision mediump float;
    uniform float iTime;
    uniform vec2  iResolution;

    #define NUM_OCTAVES 3

    float rand(vec2 n) {
      return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 ip = floor(p);
      vec2 u  = fract(p);
      u = u * u * (3.0 - 2.0 * u);
      return mix(
        mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
        mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x), u.y
      );
    }
    float fbm(vec2 x) {
      float v = 0.0; float a = 0.3;
      vec2 shift = vec2(100.0);
      mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
      for (int i = 0; i < NUM_OCTAVES; i++) {
        v += a * noise(x); x = rot * x * 2.0 + shift; a *= 0.4;
      }
      return v;
    }
    /* tanh polyfill — safe for WebGL 1.0 */
    vec4 tanh4(vec4 x) {
      x = clamp(x, -8.0, 8.0);
      vec4 e2 = exp(2.0 * x);
      return (e2 - 1.0) / (e2 + 1.0);
    }

    void main() {
      vec2 shake = vec2(sin(iTime * 1.2) * 0.005, cos(iTime * 2.1) * 0.005);
      vec2 p = ((gl_FragCoord.xy + shake * iResolution) - iResolution * 0.5)
               / iResolution.y * mat2(6.0, -4.0, 4.0, 6.0);
      vec4 o = vec4(0.0);
      float f = 2.0 + fbm(p + vec2(iTime * 5.0, 0.0)) * 0.5;

      for (int idx = 0; idx < 35; idx++) {
        float i = float(idx);
        vec2 v = p
          + cos(i * i + (iTime + p.x * 0.08) * 0.025 + i * vec2(13.0, 11.0)) * 3.5
          + vec2(sin(iTime * 3.0 + i) * 0.003, cos(iTime * 3.5 - i) * 0.003);

        float tailNoise = fbm(v + vec2(iTime * 0.5, i)) * 0.3 * (1.0 - i / 35.0);

        /* ── Orange / amber palette to match brand #ff5e00 ── */
        vec4 col = vec4(
          0.88 + 0.12 * sin(i * 0.2  + iTime * 0.40),               /* red:   0.88–1.00 */
          0.20 + 0.30 * (0.5 + 0.5 * cos(i * 0.3  + iTime * 0.50)), /* green: 0.20–0.50 */
          0.01 + 0.07 * (0.5 + 0.5 * sin(i * 0.4  + iTime * 0.30)), /* blue:  0.01–0.08 */
          1.0
        );

        float thinness = smoothstep(0.0, 1.0, i / 35.0) * 0.6;
        vec2  vSafe = max(abs(v), vec2(0.0001));
        vec2  vClamped = vec2(v.x * f * 0.015, v.y * 1.5);
        float len = length(max(abs(v), abs(vClamped)));

        o += col * exp(sin(i * i + iTime * 0.8)) / max(len, 0.0001)
             * (1.0 + tailNoise * 0.8) * thinness;
      }

      o = tanh4(pow(abs(o / 55.0), vec4(1.4)));
      gl_FragColor = o * 2.2;
    }
  `;

  function mkShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[hero-shader]', gl.getShaderInfoLog(s)); gl.deleteShader(s); return null;
    }
    return s;
  }
  const vs = mkShader(gl.VERTEX_SHADER, VS);
  const fs = mkShader(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[hero-shader]', gl.getProgramInfoLog(prog)); return;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(prog, 'iTime');
  const uRes  = gl.getUniformLocation(prog, 'iResolution');

  let startTs = null, rafId;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr  = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width  = Math.round(rect.width  * dpr);
    canvas.height = Math.round(rect.height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  }

  function tick(ts) {
    if (!startTs) startTs = ts;
    gl.uniform1f(uTime, (ts - startTs) * 0.001);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    rafId = requestAnimationFrame(tick);
  }

  /* pause when tab is hidden or hero is off-screen */
  const visObs = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { startTs = null; rafId = requestAnimationFrame(tick); }
    else cancelAnimationFrame(rafId);
  }, { threshold: 0.01 });
  visObs.observe(canvas);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(rafId);
    else { startTs = null; rafId = requestAnimationFrame(tick); }
  });

  window.addEventListener('resize', resize, { passive: true });
  resize();
})();

/* ── PARTICLE SYSTEM ── */
(function () {
  const c = document.getElementById('fx');
  const ctx = c.getContext('2d');
  let W, H, pts = [];
  const mouse = { x: -9999, y: -9999 };

  function resize() { W = c.width = window.innerWidth; H = c.height = window.innerHeight; }

  const COLORS = [
    'rgba(255,94,0,', 'rgba(255,130,60,', 'rgba(255,200,140,', 'rgba(200,200,200,',
  ];

  function init() {
    pts = [];
    for (let i = 0; i < 55; i++) {
      pts.push({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.6 + 0.4,
        a: Math.random() * 0.5 + 0.1,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    pts.forEach(p => {
      const dx = mouse.x - p.x, dy = mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) { p.x -= dx * 0.012; p.y -= dy * 0.012; }
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color + p.a + ')';
      ctx.fill();
    });
    pts.forEach((a, i) => {
      pts.slice(i + 1).forEach(b => {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 110) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = 'rgba(255,94,0,' + (0.07 * (1 - d / 110)) + ')';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      });
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => { resize(); init(); });
  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  resize(); init(); draw();
})();

/* ── NAV SCROLL STATE ── */
window.addEventListener('scroll', () => {
  document.getElementById('nav').classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

/* ── SCROLL REVEAL ── */
const reveals = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in-view'); observer.unobserve(e.target); } });
}, { threshold: 0.1 });
reveals.forEach(r => observer.observe(r));

/* ── STAT COUNTER ANIMATION ── */
function animateCount(el) {
  const target = parseInt(el.getAttribute('data-count'), 10);
  if (isNaN(target)) return;
  let start = 0;
  const duration = 1800;
  const step = timestamp => {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 4);
    el.textContent = Math.round(ease * target);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const counterObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const nums = e.target.querySelectorAll('[data-count]');
      nums.forEach(animateCount);
      counterObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.3 });
document.querySelectorAll('.stats-row').forEach(el => counterObserver.observe(el));

/* ── FORM SUBMIT ── */
async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('.form-submit');
  btn.textContent = 'Sending...';
  btn.disabled = true;
  try {
    const res = await fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      btn.textContent = '✓ Sent! We\'ll be in touch soon.';
      btn.style.background = '#22c55e';
      form.reset();
    } else {
      btn.textContent = 'Something went wrong — please call us.';
      btn.style.background = '#ef4444';
      btn.disabled = false;
    }
  } catch {
    btn.textContent = 'Something went wrong — please call us.';
    btn.style.background = '#ef4444';
    btn.disabled = false;
  }
}
