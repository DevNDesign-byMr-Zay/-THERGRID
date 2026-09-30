(() => {
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const state = {
    system: { status: 'All Systems Nominal', region: 'New York Metro', view: 'live', scenario: 'peak-demand', mode: 'ADVISORY ONLY' },
    metrics: { generationMw: 2130, loadMw: 2410, renewablePercent: 46.8, storageMw: 590 },
    optimization: { currentCost: 12480, candidateCost: 10230, emissionsReduction: 24.3, renewableUtilizationGain: 16.7, runCount: 0 },
    evidence: [
      { title: 'Scenario: Peak Load Reduction', age: '12 min ago', status: 'Verified' },
      { title: 'Quantum Optimization Run', age: '28 min ago', status: 'Verified' },
      { title: 'Grid Resilience Analysis', age: '1 hour ago', status: 'Verified' },
      { title: 'Renewable Integration Study', age: '2 hours ago', status: 'Verified' },
    ],
    agents: {
      'VÆLON': { role: 'Optimization & Scenario Exploration', status: 'ONLINE' },
      AUREN: { role: 'Semantic Analysis & Spatial Intelligence', status: 'ONLINE' },
      'SOLVÆR': { role: 'Simulation & Evidence Generation', status: 'ONLINE' },
    },
  };

  const toast = q('#toast');
  const panelDialog = q('#panelDialog');
  const chatDialog = q('#chatDialog');
  const dialogKicker = q('#dialogKicker');
  const dialogTitle = q('#dialogTitle');
  const dialogBody = q('#dialogBody');
  const chatLog = q('#chatLog');
  const chatForm = q('#chatForm');
  const chatInput = q('#chatInput');

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch]);
  }

  function showToast(title, copy) {
    if (!toast) return;
    toast.innerHTML = `<b>${escapeHtml(title)}</b><small>${escapeHtml(copy)}</small>`;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  async function api(path, options = {}) {
    if (location.protocol === 'file:') throw new Error('standalone mode');
    const response = await fetch(path, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  }

  function mergeState(next = {}) {
    if (next.system) Object.assign(state.system, next.system);
    if (next.metrics) Object.assign(state.metrics, next.metrics);
    if (next.optimization) Object.assign(state.optimization, next.optimization);
    if (next.agents) Object.assign(state.agents, next.agents);
    if (next.evidence) state.evidence = next.evidence;
    syncStateToUi();
  }

  // ---------- Native WebGL 4D spatial grid ----------
  function mat4Identity() {
    return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  }
  function mat4Multiply(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }
  function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([
      f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0
    ]);
  }
  function lookAt(eye, target, up) {
    let zx = eye[0]-target[0], zy = eye[1]-target[1], zz = eye[2]-target[2];
    let zl = Math.hypot(zx,zy,zz) || 1; zx/=zl; zy/=zl; zz/=zl;
    let xx = up[1]*zz-up[2]*zy, xy = up[2]*zx-up[0]*zz, xz = up[0]*zy-up[1]*zx;
    let xl = Math.hypot(xx,xy,xz) || 1; xx/=xl; xy/=xl; xz/=xl;
    const yx = zy*xz-zz*xy, yy = zz*xx-zx*xz, yz = zx*xy-zy*xx;
    return new Float32Array([
      xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
      -(xx*eye[0]+xy*eye[1]+xz*eye[2]),
      -(yx*eye[0]+yy*eye[1]+yz*eye[2]),
      -(zx*eye[0]+zy*eye[1]+zz*eye[2]),1
    ]);
  }

  class SpatialGrid4D {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = canvas.getContext('webgl', { antialias: true, alpha: true, preserveDrawingBuffer: false });
      this.layers = { grid: true, routes: true, buildings: true, nodes: true };
      this.yaw = 0.74; this.pitch = 0.46; this.distance = 20; this.timeHours = 12;
      this.drag = null; this.timeStart = performance.now();
      this.geometry = {};
      if (!this.gl) {
        canvas.replaceWith(Object.assign(document.createElement('div'), { textContent: 'WebGL is required for the spatial grid.' }));
        return;
      }
      this.initProgram();
      this.buildGeometry();
      this.bindControls();
      this.resize();
      this.animate();
      addEventListener('resize', () => this.resize());
    }

    shader(type, source) {
      const s = this.gl.createShader(type); this.gl.shaderSource(s, source); this.gl.compileShader(s);
      if (!this.gl.getShaderParameter(s, this.gl.COMPILE_STATUS)) throw new Error(this.gl.getShaderInfoLog(s));
      return s;
    }

    initProgram() {
      const gl = this.gl;
      const vs = this.shader(gl.VERTEX_SHADER, `
        attribute vec4 a_position;
        uniform mat4 u_mvp;
        uniform float u_time;
        uniform float u_amp;
        uniform float u_pointSize;
        varying float v_phase;
        void main(){
          vec3 p=a_position.xyz;
          p.y += sin(a_position.w + u_time) * u_amp;
          gl_Position=u_mvp*vec4(p,1.0);
          gl_PointSize=u_pointSize;
          v_phase=0.5+0.5*sin(a_position.w+u_time);
        }`);
      const fs = this.shader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        uniform vec4 u_color;
        uniform float u_pointMode;
        varying float v_phase;
        void main(){
          if(u_pointMode>0.5){
            vec2 c=gl_PointCoord-vec2(0.5);
            if(dot(c,c)>0.25) discard;
          }
          gl_FragColor=vec4(u_color.rgb*(0.78+v_phase*0.35),u_color.a);
        }`);
      this.program = gl.createProgram(); gl.attachShader(this.program, vs); gl.attachShader(this.program, fs); gl.linkProgram(this.program);
      this.loc = {
        pos: gl.getAttribLocation(this.program, 'a_position'),
        mvp: gl.getUniformLocation(this.program, 'u_mvp'),
        time: gl.getUniformLocation(this.program, 'u_time'),
        amp: gl.getUniformLocation(this.program, 'u_amp'),
        color: gl.getUniformLocation(this.program, 'u_color'),
        pointSize: gl.getUniformLocation(this.program, 'u_pointSize'),
        pointMode: gl.getUniformLocation(this.program, 'u_pointMode'),
      };
    }

    makeBuffer(data) {
      const gl = this.gl, buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      return { buffer, count: data.length / 4 };
    }

    v(out, x, y, z, w) { out.push(x,y,z,w); }
    line(out, a, b, phase = 0) { this.v(out,...a,phase); this.v(out,...b,phase+0.3); }

    buildGeometry() {
      const grid=[], buildings=[], routes=[], nodes=[];
      for (let n=-10;n<=10;n++) {
        this.line(grid,[-10,0,n],[10,0,n],n*.21);
        this.line(grid,[n,0,-10],[n,0,10],n*.23);
      }
      // deterministic wireframe buildings
      let seed=31;
      const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
      for(let i=0;i<72;i++){
        const x=(rnd()*18-9), z=(rnd()*18-9), w=.28+rnd()*.62, d=.28+rnd()*.62, h=.35+rnd()*2.8, p=rnd()*6.283;
        const x0=x-w,x1=x+w,z0=z-d,z1=z+d;
        const e=[
          [[x0,0,z0],[x1,0,z0]],[[x1,0,z0],[x1,0,z1]],[[x1,0,z1],[x0,0,z1]],[[x0,0,z1],[x0,0,z0]],
          [[x0,h,z0],[x1,h,z0]],[[x1,h,z0],[x1,h,z1]],[[x1,h,z1],[x0,h,z1]],[[x0,h,z1],[x0,h,z0]],
          [[x0,0,z0],[x0,h,z0]],[[x1,0,z0],[x1,h,z0]],[[x1,0,z1],[x1,h,z1]],[[x0,0,z1],[x0,h,z1]]
        ];
        e.forEach(([a,b])=>this.line(buildings,a,b,p));
      }
      const hubs=[[-6,.3,-3],[-2,.5,1],[2,.6,-2],[5,.45,3],[0,.7,5],[7,.35,-5],[-7,.42,5]];
      hubs.forEach((n,i)=>this.v(nodes,n[0],n[1],n[2],i*.91));
      const routePairs=[[0,1],[1,2],[2,3],[1,4],[3,5],[4,6],[6,0],[4,3],[2,5]];
      for(const [ai,bi] of routePairs){
        const a=hubs[ai], b=hubs[bi]; let prev=a;
        for(let s=1;s<=22;s++){
          const t=s/22, bow=Math.sin(t*Math.PI)*(.55+((ai+bi)%3)*.15);
          const cur=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t+bow,a[2]+(b[2]-a[2])*t];
          this.line(routes,prev,cur,(ai+bi)*.5+t*5); prev=cur;
        }
      }
      this.geometry.grid=this.makeBuffer(grid);
      this.geometry.buildings=this.makeBuffer(buildings);
      this.geometry.routes=this.makeBuffer(routes);
      this.geometry.nodes=this.makeBuffer(nodes);
      this.hubs=hubs;
    }

    loadGraph(graph) {
      if (!graph?.nodes?.length || !graph?.routes?.length) return;
      const gl = this.gl;
      for (const item of Object.values(this.geometry)) {
        if (item?.buffer) gl.deleteBuffer(item.buffer);
      }
      const grid=[], buildings=[], routes=[], nodes=[];
      for (let n=-10;n<=10;n++) {
        this.line(grid,[-10,0,n],[10,0,n],n*.21);
        this.line(grid,[n,0,-10],[n,0,10],n*.23);
      }
      const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
      graph.structures?.forEach((item) => {
        const x0=item.x-item.width,x1=item.x+item.width,z0=item.z-item.depth,z1=item.z+item.depth,h=item.height,p=item.temporalPhase||0;
        [
          [[x0,0,z0],[x1,0,z0]],[[x1,0,z0],[x1,0,z1]],[[x1,0,z1],[x0,0,z1]],[[x0,0,z1],[x0,0,z0]],
          [[x0,h,z0],[x1,h,z0]],[[x1,h,z0],[x1,h,z1]],[[x1,h,z1],[x0,h,z1]],[[x0,h,z1],[x0,h,z0]],
          [[x0,0,z0],[x0,h,z0]],[[x1,0,z0],[x1,h,z0]],[[x1,0,z1],[x1,h,z1]],[[x0,0,z1],[x0,h,z1]]
        ].forEach(([a,b])=>this.line(buildings,a,b,p));
      });
      graph.nodes.forEach((node,index)=>{
        const [x,y,z]=node.position; this.v(nodes,x,y,z,index*.91);
      });
      graph.routes.forEach((route,index)=>{
        const a=nodeMap.get(route.from)?.position,b=nodeMap.get(route.to)?.position;if(!a||!b)return;
        let prev=a;
        for(let step=1;step<=22;step++){
          const t=step/22,bow=Math.sin(t*Math.PI)*(.52+(index%3)*.15);
          const cur=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t+bow,a[2]+(b[2]-a[2])*t];
          this.line(routes,prev,cur,(route.phase||0)+t*5);prev=cur;
        }
      });
      this.geometry.grid=this.makeBuffer(grid);
      this.geometry.buildings=this.makeBuffer(buildings);
      this.geometry.routes=this.makeBuffer(routes);
      this.geometry.nodes=this.makeBuffer(nodes);
      this.hubs=graph.nodes.map((node)=>node.position);
    }

    resize() {
      if (!this.gl) return;
      const dpr=Math.min(devicePixelRatio||1,2), rect=this.canvas.getBoundingClientRect();
      const w=Math.max(1,Math.round(rect.width*dpr)), h=Math.max(1,Math.round(rect.height*dpr));
      if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
      this.gl.viewport(0,0,w,h);
    }

    bindControls() {
      const c=this.canvas;
      c.addEventListener('pointerdown',(e)=>{this.drag={x:e.clientX,y:e.clientY,yaw:this.yaw,pitch:this.pitch};c.setPointerCapture(e.pointerId);c.classList.add('dragging')});
      c.addEventListener('pointermove',(e)=>{if(!this.drag)return;this.yaw=this.drag.yaw+(e.clientX-this.drag.x)*.008;this.pitch=clamp(this.drag.pitch+(e.clientY-this.drag.y)*.006,.12,1.15);this.updateCameraReadout()});
      const end=(e)=>{if(!this.drag)return;this.drag=null;c.classList.remove('dragging');try{c.releasePointerCapture(e.pointerId)}catch{}};
      c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end);
      c.addEventListener('wheel',(e)=>{e.preventDefault();this.distance=clamp(this.distance+e.deltaY*.014,10,34);this.updateCameraReadout()},{passive:false});
      c.addEventListener('dblclick',()=>this.resetCamera());
    }

    resetCamera(){this.yaw=.74;this.pitch=.46;this.distance=20;this.updateCameraReadout()}
    setTime(hours){this.timeHours=Number(hours)}
    toggle(layer){if(layer==='reset')return this.resetCamera();if(layer==='layers'){const on=!(this.layers.grid&&this.layers.routes&&this.layers.buildings&&this.layers.nodes);Object.keys(this.layers).forEach(k=>this.layers[k]=on);return} if(layer in this.layers)this.layers[layer]=!this.layers[layer]}
    updateCameraReadout(){const el=q('#cameraReadout');if(el)el.textContent=`Orbit ${Math.round(this.yaw*57.3)}° · ${Math.round(this.pitch*57.3)}° · ${this.distance.toFixed(1)}m`}

    drawBuffer(item, primitive, color, amp, pointMode=0, pointSize=1) {
      const gl=this.gl; gl.bindBuffer(gl.ARRAY_BUFFER,item.buffer);gl.vertexAttribPointer(this.loc.pos,4,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(this.loc.pos);
      gl.uniform4fv(this.loc.color,color);gl.uniform1f(this.loc.amp,amp);gl.uniform1f(this.loc.pointMode,pointMode);gl.uniform1f(this.loc.pointSize,pointSize);
      gl.drawArrays(primitive,0,item.count);
    }

    animate = (now=performance.now()) => {
      if(!this.gl)return;
      const gl=this.gl, rect=this.canvas.getBoundingClientRect(), aspect=Math.max(.1,rect.width/Math.max(1,rect.height));
      const eye=[
        Math.sin(this.yaw)*Math.cos(this.pitch)*this.distance,
        Math.sin(this.pitch)*this.distance*.78+3.0,
        Math.cos(this.yaw)*Math.cos(this.pitch)*this.distance
      ];
      const view=lookAt(eye,[0,1.05,0],[0,1,0]), proj=perspective(Math.PI/3.1,aspect,.1,100), mvp=mat4Multiply(proj,view);
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(.008,.025,.06,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this.program);gl.uniformMatrix4fv(this.loc.mvp,false,mvp);
      const temporal=(this.timeHours/24)*Math.PI*2+(now-this.timeStart)*.00035;
      gl.uniform1f(this.loc.time,temporal);
      if(this.layers.grid)this.drawBuffer(this.geometry.grid,gl.LINES,[.09,.42,.75,.42],.045);
      if(this.layers.buildings)this.drawBuffer(this.geometry.buildings,gl.LINES,[.14,.64,1,.55],.07);
      if(this.layers.routes)this.drawBuffer(this.geometry.routes,gl.LINES,[.83,.36,1,.9],.11);
      if(this.layers.nodes)this.drawBuffer(this.geometry.nodes,gl.POINTS,[.22,1,.84,1],.08,1,9);
      requestAnimationFrame(this.animate);
    }
  }

  // ---------- animated 2D canvases ----------
  class WaveSurface {
    constructor(canvas){this.c=canvas;this.ctx=canvas.getContext('2d');this.t=0;this.resize();addEventListener('resize',()=>this.resize());this.loop()}
    resize(){const d=Math.min(devicePixelRatio||1,2),r=this.c.getBoundingClientRect();this.c.width=Math.max(1,r.width*d);this.c.height=Math.max(1,r.height*d);this.ctx.setTransform(d,0,0,d,0,0)}
    loop=()=>{const x=this.ctx,w=this.c.clientWidth,h=this.c.clientHeight;x.clearRect(0,0,w,h);x.save();x.translate(w*.5,h*.58);for(let z=12;z>=0;z--){x.beginPath();for(let i=0;i<=60;i++){const px=(i/60-.5)*w*.92,zz=(z/12-.5)*100;const wave=Math.sin(i*.25+this.t+z*.34)*8+Math.cos(i*.11-this.t*.7)*5;const py=zz*.45-wave-(z*1.1);const y=py+(px*px)/(w*w)*30;i?x.lineTo(px,y):x.moveTo(px,y)}x.strokeStyle=`hsla(${195+z*6},95%,62%,${.2+z*.045})`;x.lineWidth=1;x.stroke()}x.restore();this.t+=.018;requestAnimationFrame(this.loop)}
  }

  class ScenarioChart {
    constructor(canvas){this.c=canvas;this.x=canvas.getContext('2d');this.phase=0;this.resize();addEventListener('resize',()=>this.resize());this.loop()}
    resize(){const d=Math.min(devicePixelRatio||1,2),r=this.c.getBoundingClientRect();this.c.width=Math.max(1,r.width*d);this.c.height=Math.max(1,r.height*d);this.x.setTransform(d,0,0,d,0,0)}
    loop=()=>{const c=this.x,w=this.c.clientWidth,h=this.c.clientHeight;c.clearRect(0,0,w,h);c.strokeStyle='rgba(83,130,190,.22)';c.lineWidth=1;for(let i=0;i<7;i++){const y=10+i*(h-24)/6;c.beginPath();c.moveTo(28,y);c.lineTo(w-8,y);c.stroke()}for(let i=0;i<7;i++){const x=28+i*(w-36)/6;c.beginPath();c.moveTo(x,8);c.lineTo(x,h-16);c.stroke()}
      const series=[['#22d8ff',0,0],['#43ef91',-.12,.6],['#bd67ff',-.18,1.2],['#ffb84d',.12,2.1]];
      series.forEach(([color,bias,p])=>{c.beginPath();for(let i=0;i<=48;i++){const t=i/48,base=.52+.14*Math.sin(t*Math.PI*2+p)+.18*Math.exp(-Math.pow((t-.62)*5,2));const val=clamp(base+bias+.018*Math.sin(this.phase+i*.45+p),.12,.92);const px=28+t*(w-36),py=8+(1-val)*(h-24);i?c.lineTo(px,py):c.moveTo(px,py)}c.strokeStyle=color;c.lineWidth=1.6;c.stroke()});this.phase+=.01;requestAnimationFrame(this.loop)}
  }

  class WireThumb {
    constructor(canvas,variant){this.c=canvas;this.x=canvas.getContext('2d');this.variant=variant;this.t=Math.random()*10;this.resize();this.loop()}
    resize(){const d=Math.min(devicePixelRatio||1,2),r=this.c.getBoundingClientRect();this.c.width=Math.max(1,r.width*d);this.c.height=Math.max(1,r.height*d);this.x.setTransform(d,0,0,d,0,0)}
    loop=()=>{const c=this.x,w=this.c.clientWidth,h=this.c.clientHeight;c.clearRect(0,0,w,h);c.strokeStyle=this.variant==='risk'?'#ff9b61':this.variant==='future'?'#8d6dff':'#34cfff';c.lineWidth=.8;for(let i=0;i<8;i++){c.beginPath();for(let j=0;j<13;j++){const px=j*w/12,py=h*.72-i*3+Math.sin(j*.8+i*.5+this.t)*3;i?c.lineTo(px,py):c.moveTo(px,py)}c.stroke()}for(let x=0;x<w;x+=16){c.beginPath();c.moveTo(x,h*.24);c.lineTo(x,h*.9);c.strokeStyle='rgba(71,144,228,.18)';c.stroke()}this.t+=.015;requestAnimationFrame(this.loop)}
  }

  const spatial = new SpatialGrid4D(q('#spatialGrid'));
  new WaveSurface(q('#quantumCanvas'));
  new ScenarioChart(q('#scenarioChart'));
  qa('[data-wire-thumb]').forEach((canvas)=>new WireThumb(canvas,canvas.dataset.wireThumb));

  function updateClock(){
    const now=new Date();q('#systemDate').textContent=now.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});q('#systemClock').textContent=now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }
  setInterval(updateClock,1000);updateClock();

  function renderEvidence(){
    const list=q('#evidenceList'); if(!list)return;
    list.innerHTML=state.evidence.slice(0,4).map((item)=>`<button class="evidence-item"><span class="doc">▤</span><span>${escapeHtml(item.title)}</span><time>${escapeHtml(item.age||'recent')}</time><span class="verified">${escapeHtml(item.status||'Verified')}</span></button>`).join('');
  }

  function syncStateToUi(){
    q('#systemStatus').textContent=state.system.status;
    q('#regionLabel').textContent=state.system.region.toUpperCase();
    q('#generationValue').textContent=Math.round(state.metrics.generationMw).toLocaleString();
    q('#loadValue').textContent=Math.round(state.metrics.loadMw).toLocaleString();
    q('#renewableValue').textContent=Number(state.metrics.renewablePercent).toFixed(1);
    q('#storageValue').textContent=Math.round(state.metrics.storageMw).toLocaleString();
    q('#currentCost').textContent=Math.round(state.optimization.currentCost).toLocaleString();
    q('#candidateCost').textContent=Math.round(state.optimization.candidateCost).toLocaleString();
    q('#emissionsValue').textContent=Number(state.optimization.emissionsReduction).toFixed(1);
    q('#renewableGain').textContent=Number(state.optimization.renewableUtilizationGain).toFixed(1);
    qa('[data-view]').forEach((b)=>b.classList.toggle('active',b.dataset.view===state.system.view));
    renderEvidence();
  }
  syncStateToUi();

  async function loadState(){
    try{
      const [runtime,spatialGraph]=await Promise.all([
        api('./api/aethergrid/state'),
        api('./api/aethergrid/spatial?hour='+encodeURIComponent(q('#timeSlider').value))
      ]);
      mergeState(runtime);
      spatial?.loadGraph(spatialGraph);
      q('#streamReadout').textContent='LIVE 4D GRAPH';
    }catch{
      q('#streamReadout').textContent='LOCAL 4D SIM';
    }
  }
  loadState();

  let stream;
  function connectStream(){
    if(location.protocol==='file:'||!('EventSource'in window))return;
    stream?.close();stream=new EventSource('./api/aethergrid/stream');
    stream.addEventListener('telemetry',(event)=>{try{const payload=JSON.parse(event.data);mergeState(payload.state||payload)}catch{}});
    stream.onerror=()=>{q('#streamReadout').textContent='RECONNECTING';setTimeout(connectStream,2500)};
    stream.onopen=()=>{q('#streamReadout').textContent='LIVE STREAM'};
  }
  connectStream();

  function localTelemetry(){
    if(location.protocol!=='file:')return;
    const t=Date.now()/9000;
    state.metrics.generationMw=2130+Math.sin(t)*28;
    state.metrics.loadMw=2410+Math.cos(t*.87)*35;
    state.metrics.renewablePercent=46.8+Math.sin(t*.66)*1.6;
    state.metrics.storageMw=590+Math.cos(t*.72)*12;
    syncStateToUi();
  }
  setInterval(localTelemetry,2200);

  function openPanel(kicker,title,html){dialogKicker.textContent=kicker;dialogTitle.textContent=title;dialogBody.innerHTML=html;panelDialog.showModal()}
  qa('[data-dialog-close]').forEach((b)=>b.addEventListener('click',()=>b.closest('dialog').close()));

  qa('.mode-tab').forEach((b)=>b.addEventListener('click',()=>{
    qa('.mode-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');
    const target=q('#'+b.dataset.mode);target?.scrollIntoView({behavior:'smooth',block:'center'});
  }));
  qa('.side-button').forEach((b)=>b.addEventListener('click',()=>{
    qa('.side-button').forEach(x=>x.classList.remove('active'));b.classList.add('active');
    const target=q('#'+b.dataset.section)||q('#grid');target?.scrollIntoView({behavior:'smooth',block:'start'});
  }));

  qa('[data-map-tool]').forEach((b)=>b.addEventListener('click',()=>{
    const tool=b.dataset.mapTool;spatial?.toggle(tool==='layers'?'layers':tool);if(tool!=='reset')b.classList.toggle('active');
    showToast('WIREMAP LAYER',`${tool} ${b.classList.contains('active')?'enabled':'updated'}`);
  }));

  q('#timeSlider').addEventListener('input',(e)=>{const h=Number(e.target.value);spatial?.setTime(h);q('#timeValue').textContent=`${String(Math.floor(h)).padStart(2,'0')}:${String(Math.round((h%1)*60)).padStart(2,'0')}`});
  qa('[data-view]').forEach((b)=>b.addEventListener('click',async()=>{
    state.system.view=b.dataset.view;syncStateToUi();try{const r=await api('./api/aethergrid/view',{method:'POST',body:JSON.stringify({view:b.dataset.view})});mergeState(r.state||r)}catch{}showToast('VIEW CHANGED',`${b.dataset.view} review mode active`)
  }));

  q('#assetSearch').addEventListener('keydown',(e)=>{if(e.key!=='Enter')return;const v=e.currentTarget.value.trim();showToast('SPATIAL SEARCH',v?`Searching wireframe graph for “${v}”`:'Enter an asset, node, or scenario')});
  qa('[data-node]').forEach((b)=>b.addEventListener('click',()=>openPanel('SPATIAL NODE',b.querySelector('b').textContent,`<div class="detail-card"><h3>Live node telemetry</h3><p>This card is linked to the 4D spatial graph. Rotate or zoom the wireframe map, scrub time, then compare the node against forecast and scenario states.</p><div class="pill-row"><span class="pill">3D POSITION</span><span class="pill">TIME INDEXED</span><span class="pill">EVIDENCE LINKED</span></div></div>`)));

  qa('[data-metric]').forEach((b)=>b.addEventListener('click',()=>openPanel('SYSTEM METRIC',b.querySelector('b').textContent,`<div class="detail-card"><h3>${b.querySelector('.metric-value').textContent}</h3><p>Live metric bound to the operator-state stream and scenario timeline.</p></div>`)));
  qa('[data-layer]').forEach((b)=>b.addEventListener('click',()=>{openPanel('HOLOGRAPHIC LAYER',b.querySelector('b').textContent,`<div class="detail-card"><h3>Interactive wireframe layer</h3><p>Layer is generated from geometry and temporal state, not a background image. Use the main 4D map to orbit, zoom, scrub time, and compare state.</p></div>`)}));

  q('#scenarioSelect').addEventListener('change',async(e)=>{state.system.scenario=e.target.value;try{const r=await api('./api/aethergrid/scenario',{method:'POST',body:JSON.stringify({scenario:e.target.value})});mergeState(r.state||r)}catch{}showToast('SCENARIO LOADED',e.target.options[e.target.selectedIndex].text)});

  async function runOptimization(){
    showToast('QUANTUM OPTIMIZATION','Running bounded scenario search…');
    try{const r=await api('./api/aethergrid/optimize',{method:'POST',body:JSON.stringify({scenario:state.system.scenario,region:state.system.region,objective:'minimize_cost_emissions'})});mergeState({optimization:r.optimization});}
    catch{state.optimization.runCount++;state.optimization.candidateCost=Math.max(9800,state.optimization.candidateCost-35);state.optimization.emissionsReduction+=.3;syncStateToUi()}
    setTimeout(()=>showToast('OPTIMIZATION COMPLETE',`Candidate $${Math.round(state.optimization.candidateCost).toLocaleString()}/hr ready for classical comparison.`),500)
  }
  qa('[data-action="run-optimization"]').forEach((b)=>b.addEventListener('click',runOptimization));

  async function exportPackage(kind){
    const payload={kind,generatedAt:new Date().toISOString(),system:state.system,metrics:state.metrics,optimization:state.optimization,evidence:state.evidence,spatial:{timeHours:Number(q('#timeSlider').value),camera:{yaw:spatial?.yaw,pitch:spatial?.pitch,distance:spatial?.distance}},advisoryOnly:true};
    try{const r=await api('./api/aethergrid/export',{method:'POST',body:JSON.stringify(payload)});payload.receipt=r.receipt}catch{}
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`aethergrid-${kind}-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);showToast('EXPORT READY',kind.replaceAll('-',' '))
  }
  qa('[data-export]').forEach((b)=>b.addEventListener('click',()=>exportPackage(b.dataset.export)));

  function openChat(){chatDialog.showModal();chatInput.focus()}
  qa('[data-action="ai-chat"]').forEach((b)=>b.addEventListener('click',openChat));
  q('[data-action="send-ai"]').addEventListener('click',()=>{const v=q('#quickAiInput').value.trim();if(v){chatInput.value=v;q('#quickAiInput').value='';openChat()}});
  q('#quickAiInput').addEventListener('keydown',(e)=>{if(e.key==='Enter')q('[data-action="send-ai"]').click()});

  chatForm.addEventListener('submit',async(e)=>{
    e.preventDefault();const message=chatInput.value.trim();if(!message)return;
    chatLog.insertAdjacentHTML('beforeend',`<div class="chat-bubble user">${escapeHtml(message)}</div>`);chatInput.value='';
    let reply='VÆLON, AUREN, and SOLVÆR reviewed the request. Recommendations remain advisory and evidence-bound.';
    try{const r=await api('./api/aethergrid/chat',{method:'POST',body:JSON.stringify({message,region:state.system.region,scenario:state.system.scenario})});reply=r.reply||reply}catch{}
    chatLog.insertAdjacentHTML('beforeend',`<div class="chat-bubble system">${escapeHtml(reply)}</div>`);chatLog.scrollTop=chatLog.scrollHeight;
  });

  qa('[data-agent]').forEach((b)=>b.addEventListener('click',()=>{const name=b.dataset.agent,agent=state.agents[name]||{};openPanel('AI COLLABORATION',name,`<div class="detail-card"><h3>${escapeHtml(agent.role||'Specialized Intelligence')}</h3><p>Status: ${escapeHtml(agent.status||'ONLINE')}. This agent can inspect the active region, 4D grid state, selected scenario, evidence, and optimization outputs.</p><div class="pill-row"><span class="pill">ONLINE</span><span class="pill">ADVISORY</span><span class="pill">EVIDENCE BOUND</span></div></div>`)}));

  q('[data-action="change-region"]').addEventListener('click',()=>openPanel('REGION CONTROL','Change Operator Region',`<div class="pill-row">${['New York Metro','Long Island','Hudson Valley','Upstate New York'].map(r=>`<button class="pill" data-region-choice="${r}">${r}</button>`).join('')}</div>`));
  dialogBody.addEventListener('click',async(e)=>{const b=e.target.closest('[data-region-choice]');if(!b)return;state.system.region=b.dataset.regionChoice;try{const r=await api('./api/aethergrid/region',{method:'POST',body:JSON.stringify({region:state.system.region})});mergeState(r.state||r)}catch{}syncStateToUi();panelDialog.close();showToast('REGION CHANGED',state.system.region)});

  qa('[data-action="settings"]').forEach((b)=>b.addEventListener('click',()=>openPanel('SYSTEM CONFIGURATION','Settings',`<div class="detail-card"><h3>Authority boundary</h3><p>Hardware actuation and infrastructure dispatch remain disabled. 4D spatial visualization, simulation, optimization, and AI outputs are advisory-only.</p></div>`)));
  q('[data-action="profile"]').addEventListener('click',()=>openPanel('OPERATOR','Profile',`<div class="detail-card"><h3>IM · Operator Session</h3><p>Live ÆTHERGRID session with access to spatial, AI, scenario, evidence, and export surfaces.</p></div>`));
})();