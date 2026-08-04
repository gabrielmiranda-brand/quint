// Quint - Motor de Simulación Teatral y Controlador Principal
import { CATALOG, GELS, getFixtureDefaults } from './catalog.js';
import { saveProject, loadProject, clearProject, exportProjectJSON, importProjectJSON } from './storage.js';
import { exportCanvasAsPNG, exportProjectPDF } from './export.js';

// Elementos del DOM
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// Buffers para mezcla aditiva
const planBuffer = document.createElement('canvas'); planBuffer.width = W; planBuffer.height = H;
const pctx = planBuffer.getContext('2d');
const elevBuffer = document.createElement('canvas'); elevBuffer.width = W; elevBuffer.height = H;
const ectx = elevBuffer.getContext('2d');

// Variables de Estado
let currentView = 'plan';
let fixtures = [];
let objects = [];
let idCounter = 1;
let selectedFixtureId = null;
let dragTarget = null;
let dragOffset = { x: 0, y: 0 };
let projectName = 'Mi Planta de Luces';
let stageMeters = { w: 8, d: 6, h: 7 };
let varas = [];
let cues = [];
let currentFadeInterval = null;

function getDefaultVaras() {
  return [
    { id: 1, name: 'Vara Frontal (FOH)', sym: 6.5, isFrontal: true },
    { id: 2, name: 'Vara LX 1', sym: 5.0, isFrontal: false },
    { id: 3, name: 'Vara LX 2', sym: 3.5, isFrontal: false },
    { id: 4, name: 'Vara LX 3', sym: 2.0, isFrontal: false },
    { id: 5, name: 'Vara LX 4', sym: 0.5, isFrontal: false }
  ];
}

const MARGIN = 44;
let strobePhase = true;
let saveTimeout = null;

// Inicialización de la Aplicación
window.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  setupEventListeners();
  renderCatalog();
  
  // Cargar estado guardado o cargar escena por defecto
  const savedState = loadProject();
  if (savedState) {
    stageMeters = savedState.stageMeters;
    fixtures = savedState.fixtures;
    objects = savedState.objects;
    projectName = savedState.projectName || 'Mi Planta de Luces';
    varas = savedState.varas || getDefaultVaras();
    cues = Array.isArray(savedState.cues) ? savedState.cues : [];
    
    // Asegurar que el idCounter no colisione
    const maxFixtureId = fixtures.reduce((max, f) => f.id > max ? f.id : max, 0);
    const maxObjectId = objects.reduce((max, o) => o.id > max ? o.id : max, 0);
    idCounter = Math.max(maxFixtureId, maxObjectId) + 1;
    
    if (fixtures.length > 0) {
      selectedFixtureId = fixtures[0].id;
    }
  } else {
    loadDefaultScene();
  }
  
  // Inicializar entradas del DOM con el estado cargado
  document.getElementById('project-name-input').value = projectName;
  document.getElementById('stageW').value = stageMeters.w;
  document.getElementById('stageD').value = stageMeters.d;
  document.getElementById('stageH').value = stageMeters.h;
  
  updateSaveStatus('saved');
  renderVarasPanel();
  renderFixturePanel();
  renderObjectPanel();
  renderCueList();
  draw();
  
  // Iniciar timer de estrobo
  setInterval(() => {
    if (fixtures.some(f => f.strobe)) {
      strobePhase = !strobePhase;
      draw();
    }
  }, 90);
}

// Escenarios predeterminados
function loadDefaultScene() {
  projectName = 'Ejemplo de Escena';
  stageMeters = { w: 8, d: 6, h: 7 };
  varas = getDefaultVaras();
  cues = [];
  
  fixtures = [
    {
      id: idCounter++,
      kind: 'fixture',
      modelId: 'par-led-18x10',
      name: 'PAR LED 18x10W RGBW 1',
      type: 'led',
      subType: 'wash',
      mountType: 'vara',
      varaId: 4, // Vara LX 3 (sym: 2.0)
      sxm: 2.5,
      sym: 2.0,
      height: 7.0,
      pan: 0,
      tilt: 25,
      dir: 'frente',
      beamAngle: 25,
      color: '#ff3b3b',
      intensity: 85,
      strobe: false,
      channel: 1,
      dmxAddress: '1',
      purpose: 'Cenital Principal Izquierda'
    },
    {
      id: idCounter++,
      kind: 'fixture',
      modelId: 'par-led-18x10',
      name: 'PAR LED 18x10W RGBW 2',
      type: 'led',
      subType: 'wash',
      mountType: 'vara',
      varaId: 4, // Vara LX 3 (sym: 2.0)
      sxm: 5.5,
      sym: 2.0,
      height: 7.0,
      pan: 0,
      tilt: 25,
      dir: 'frente',
      beamAngle: 25,
      color: '#3bff6e',
      intensity: 85,
      strobe: false,
      channel: 2,
      dmxAddress: '5',
      purpose: 'Cenital Principal Derecha'
    },
    {
      id: idCounter++,
      kind: 'fixture',
      modelId: 'etc-source-four',
      name: 'Elipsoidal Source Four (Recorte)',
      type: 'conventional',
      subType: 'spot',
      mountType: 'vara',
      varaId: 2, // Vara LX 1 (sym: 5.0)
      sxm: 4.0,
      sym: 5.0,
      height: 7.0,
      pan: 180,
      tilt: 35,
      dir: 'contra',
      beamAngle: 26,
      color: '#2000aa', // Congo Blue gel
      gelId: 'l181',
      gelCode: 'Lee 181',
      intensity: 90,
      strobe: false,
      channel: 3,
      dmxAddress: '9',
      purpose: 'Contraluz Congo Blue'
    },
    {
      id: idCounter++,
      kind: 'fixture',
      modelId: 'fresnel-1000',
      name: 'Fresnel 1000W Frente',
      type: 'conventional',
      subType: 'wash',
      mountType: 'calle',
      sxm: 0.3,
      sym: 3.0,
      height: 1.8,
      pan: 90,
      tilt: 45,
      dir: 'calle-izq',
      beamAngle: 35,
      color: '#ffb347', // Sin gel
      gelId: 'none',
      gelCode: 'Sin Gel',
      intensity: 75,
      strobe: false,
      channel: 4,
      dmxAddress: '13',
      purpose: 'Calle Lavanda'
    }
  ];
  
  objects = [
    { id: idCounter++, kind: 'object', type: 'persona', sxm: 4, sym: 3.2 },
    { id: idCounter++, kind: 'object', type: 'objeto', sxm: 2.5, sym: 4 }
  ];
  
  selectedFixtureId = fixtures[0].id;
}

// ---------- CÁLCULO DE COORDENADAS Y ESCALA ----------
function planRect() {
  const availW = W - MARGIN * 2, availH = H - MARGIN * 2 - 40;
  const scale = Math.min(availW / stageMeters.w, availH / stageMeters.d);
  const rw = stageMeters.w * scale, rh = stageMeters.d * scale;
  return { x: (W - rw) / 2, y: MARGIN, w: rw, h: rh, scale };
}

function elevRect() {
  const availW = W - MARGIN * 2, availH = H - MARGIN * 2 - 40;
  const scaleX = availW / stageMeters.w, scaleY = availH / stageMeters.h;
  const floorY = MARGIN + availH;
  return { x: marginXOffset(), floorY, scaleX, scaleY, w: availW };
}

// Para centrar o alinear la elevación lateral
function marginXOffset() {
  return MARGIN;
}

function planPixel(sxm, sym) {
  const r = planRect();
  return { x: r.x + sxm * r.scale, y: r.y + sym * r.scale };
}

function planMeters(px, py) {
  const r = planRect();
  return { sxm: (px - r.x) / r.scale, sym: (py - r.y) / r.scale };
}

function isOnstagePlan(sxm, sym) {
  return sxm >= 0 && sxm <= stageMeters.w && sym >= 0 && sym <= stageMeters.d;
}

function isCalle(f) {
  return f.dir === 'calle-izq' || f.dir === 'calle-der';
}

const dirLabel = { frente: 'FRENTE', contra: 'CONTRA', 'calle-izq': 'CALLE IZQ', 'calle-der': 'CALLE DER', cenital: 'CENITAL', piso: 'PISO' };

// Obtiene la posición en pantalla y escala (perspectiva) de un objeto en elevación
function getElevObjectPos(o) {
  const e = elevRect();
  const centerX = e.x + (stageMeters.w / 2) * e.scaleX;
  const depthPercent = o.sym / stageMeters.d;
  const scale = 0.7 + 0.3 * depthPercent; // 70% en el fondo, 100% al frente
  const floorY = e.floorY - (1 - depthPercent) * 40; // Elevar el horizonte del fondo en 40px
  
  // Convergencia hacia el centro según profundidad
  const x = centerX + (o.sxm - stageMeters.w / 2) * e.scaleX * scale;
  return { x, y: floorY, scale };
}

// Obtiene la posición en pantalla y escala de un foco en elevación
function getElevFixturePos(f) {
  const e = elevRect();
  const centerX = e.x + (stageMeters.w / 2) * e.scaleX;
  const depthPercent = f.sym / stageMeters.d;
  const scale = 0.7 + 0.3 * depthPercent;
  const floorY = e.floorY - (1 - depthPercent) * 40;
  
  let x;
  if (isCalle(f)) {
    // Si es calle, se ubica en el extremo izquierdo o derecho
    x = centerX + ((f.dir === 'calle-izq' ? 0 : stageMeters.w) - stageMeters.w / 2) * e.scaleX * scale;
  } else {
    x = centerX + (f.sxm - stageMeters.w / 2) * e.scaleX * scale;
  }
  
  const y = floorY - f.height * e.scaleY * scale;
  return { x, y, scale, floorY };
}

function getFixtureTarget3D(f) {
  // Convertir ángulos pan/tilt a radianes
  // pan va de -180 a 180 (0 apunta al frente/platea, +90 derecha, -90 izquierda)
  // tilt va de 0 (cenital apuntando abajo) a 90 (horizontal)
  const panRad = (f.pan || 0) * Math.PI / 180;
  const tiltRad = (f.tilt || 0) * Math.PI / 180;
  
  const isUpward = (f.mountType === 'piso');
  
  // Componentes del vector de dirección en 3D
  // Eje X: ancho (derecha positivo)
  // Eje Y: profundidad (0 fondo, d frente). 0 pan apunta hacia la platea (+Y).
  // Eje Z: altura (arriba positivo).
  const dx = Math.sin(panRad) * Math.sin(tiltRad);
  const dy = -Math.cos(panRad) * Math.sin(tiltRad);
  const dz = isUpward ? Math.cos(tiltRad) : -Math.cos(tiltRad);
  
  // Plano target (suelo Z=0 o techo Z=stageMeters.h)
  const targetZ = isUpward ? stageMeters.h : 0;
  const distZ = Math.abs(f.height - targetZ);
  
  if (Math.abs(dz) < 0.001) {
    return { x: f.sxm, y: f.sym, z: targetZ };
  }
  
  const t = distZ / Math.abs(dz);
  let tx = f.sxm + dx * t;
  let ty = f.sym + dy * t;
  
  // Limitar para evitar proyección al infinito
  tx = Math.max(-5, Math.min(stageMeters.w + 5, tx));
  ty = Math.max(-5, Math.min(stageMeters.d + 5, ty));
  
  return { x: tx, y: ty, z: targetZ };
}

function beamTriangle(f) {
  const { x: apexX, y: apexY, scale, floorY } = getElevFixturePos(f);
  const e = elevRect();
  
  const target3D = getFixtureTarget3D(f);
  const depthPercent = target3D.y / stageMeters.d;
  const s = 0.7 + 0.3 * depthPercent;
  const targetFloorY = e.floorY - (1 - depthPercent) * 40;
  
  const centerX = e.x + (stageMeters.w / 2) * e.scaleX;
  const targetScreenX = centerX + (target3D.x - stageMeters.w / 2) * e.scaleX * s;
  
  const targetScreenY = (f.mountType === 'piso') 
    ? targetFloorY - stageMeters.h * e.scaleY * s
    : targetFloorY;
    
  const distZ = Math.abs(f.height - target3D.z);
  const spreadM = distZ * Math.tan(f.beamAngle * Math.PI / 180);
  const halfWpx = spreadM * e.scaleX * s;
  
  return {
    apex: { x: apexX, y: apexY },
    p1: { x: targetScreenX - halfWpx, y: targetScreenY },
    p2: { x: targetScreenX + halfWpx, y: targetScreenY }
  };
}

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

// ---------- RENDERIZADO DEL ESCENARIO (VISTAS) ----------

function drawPlanFloor() {
  const r = planRect();
  ctx.fillStyle = '#050506';
  ctx.fillRect(0, 0, W, H);
  
  // Dibujar escenario físico
  ctx.fillStyle = '#0f0f13';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  
  // Grilla técnica cada 1 metro
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let gx = 0; gx <= stageMeters.w; gx++) {
    const x = r.x + gx * r.scale;
    ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke();
  }
  for (let gy = 0; gy <= stageMeters.d; gy++) {
    const y = r.y + gy * r.scale;
    ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke();
  }
  
  // Borde del escenario (línea discontinua ámbar técnica)
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.setLineDash([]);
  
  // Dibujar Varas LX horizontales en planta
  varas.forEach((v, idx) => {
    const yPx = r.y + v.sym * r.scale;
    ctx.strokeStyle = 'rgba(255, 230, 71, 0.4)';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(r.x, yPx);
    ctx.lineTo(r.x + r.w, yPx);
    ctx.stroke();
    
    // Etiqueta de la vara
    ctx.fillStyle = 'rgba(255, 230, 71, 0.7)';
    ctx.font = '600 7px Inter';
    ctx.textAlign = 'right';
    ctx.fillText(v.name, r.x - 6, yPx + 2.5);
  });
  
  // Texto descriptivo
  ctx.fillStyle = 'rgba(255, 179, 71, 0.8)';
  ctx.font = '600 10px Inter';
  ctx.textAlign = 'left';
  ctx.fillText(`ESCENARIO: ${stageMeters.w.toFixed(1)}m x ${stageMeters.d.toFixed(1)}m · VISTA DE PLANTA`, r.x + 8, r.y - 8);
}

function composePlanLight() {
  pctx.clearRect(0, 0, W, H);
  pctx.globalCompositeOperation = 'lighter';
  
  fixtures.forEach(f => {
    const { r: r_rgb, g: g_rgb, b: b_rgb } = hexToRgb(f.color);
    
    // Calcular target y píxeles en planta
    const target3D = getFixtureTarget3D(f);
    const pTarget = planPixel(target3D.x, target3D.y);
    const pFixture = planPixel(f.sxm, f.sym);
    
    // El radio de cobertura en metros depende de la distancia y el ángulo
    const distZ = Math.abs(f.height - target3D.z);
    const radM = distZ * Math.tan(f.beamAngle * Math.PI / 180);
    const r = planRect();
    const radPx = Math.max(8, radM * r.scale);
    
    const alpha = (f.intensity / 100) * (isOnstagePlan(target3D.x, target3D.y) ? 1.0 : 0.3);
    
    const grad = pctx.createRadialGradient(pTarget.x, pTarget.y, 0, pTarget.x, pTarget.y, radPx);
    grad.addColorStop(0, `rgba(${r_rgb},${g_rgb},${b_rgb},${alpha * 0.95})`);
    grad.addColorStop(0.5, `rgba(${r_rgb},${g_rgb},${b_rgb},${alpha * 0.3})`);
    grad.addColorStop(1, `rgba(${r_rgb},${g_rgb},${b_rgb},0)`);
    
    pctx.fillStyle = grad;
    pctx.beginPath();
    pctx.arc(pTarget.x, pTarget.y, radPx, 0, Math.PI * 2);
    pctx.fill();
    
    // Dibujar línea indicadora de dirección de haz (foco -> target)
    pctx.strokeStyle = `rgba(${r_rgb},${g_rgb},${b_rgb},${alpha * 0.35})`;
    pctx.lineWidth = 1;
    pctx.setLineDash([3, 3]);
    pctx.beginPath();
    pctx.moveTo(pFixture.x, pFixture.y);
    pctx.lineTo(pTarget.x, pTarget.y);
    pctx.stroke();
    pctx.setLineDash([]);
  });
}

function samplePlan(sxm, sym) {
  const p = planPixel(sxm, sym);
  const px = Math.max(0, Math.min(W - 1, Math.round(p.x)));
  const py = Math.max(0, Math.min(H - 1, Math.round(p.y)));
  const d = pctx.getImageData(px, py, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2] };
}

function drawPlanView() {
  drawPlanFloor();
  composePlanLight();
  
  // Renderizar la luz acumulada del buffer
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(planBuffer, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  
  // Renderizar personas y objetos recibiendo el color de la luz
  objects.forEach(o => {
    const p = planPixel(o.sxm, o.sym);
    const light = samplePlan(o.sxm, o.sym);
    drawFigureTinted(ctx, p.x, p.y, o.type, light, isOnstagePlan(o.sxm, o.sym));
  });
  
  // Renderizar los focos propiamente dichos en planta
  fixtures.forEach(f => {
    const p = planPixel(f.sxm, f.sym);
    const isSelected = f.id === selectedFixtureId;
    
    // Círculo base del foco
    ctx.beginPath();
    ctx.arc(p.x, p.y, isSelected ? 9 : 7, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#ffffff' : '#525159';
    ctx.fill();
    
    // Aro exterior del color emitido
    ctx.strokeStyle = f.color;
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.stroke();
    
    // Pequeño aro negro exterior de contraste
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, isSelected ? 10.5 : 8.5, 0, Math.PI * 2);
    ctx.stroke();
    
    // Label con dirección abreviada
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = 'bold 8px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const label = f.dir === 'frente' ? 'F' : f.dir === 'contra' ? 'C' : f.dir === 'calle-izq' ? 'CI' : f.dir === 'calle-der' ? 'CD' : f.dir === 'cenital' ? 'CE' : 'P';
    ctx.fillText(label, p.x, p.y + 0.5);
    
    // Nombre en planta si está seleccionado
    if (isSelected) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '500 8.5px Inter';
      ctx.textAlign = 'left';
      ctx.fillText(`Foco ${f.id} (${f.gelCode || 'RGB'})`, p.x + 12, p.y);
    }
  });
}

function drawElevFloor() {
  const e = elevRect();
  ctx.fillStyle = '#050506';
  ctx.fillRect(0, 0, W, H);
  
  // Grilla de altura y ancho en elevación
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let gy = 0; gy <= stageMeters.h; gy++) {
    // La grilla se renderiza plana en el plano frontal
    const y = e.floorY - gy * e.scaleY;
    ctx.beginPath(); ctx.moveTo(e.x, y); ctx.lineTo(e.x + e.w, y); ctx.stroke();
  }
  for (let gx = 0; gx <= stageMeters.w; gx++) {
    const x = e.x + gx * e.scaleX;
    ctx.beginPath(); ctx.moveTo(x, e.floorY - stageMeters.h * e.scaleY); ctx.lineTo(x, e.floorY); ctx.stroke();
  }
  
  // Dibujar piso en perspectiva (rampa sutil de profundidad)
  const floorYBack = e.floorY - 40; // El fondo está 40px más arriba en pantalla
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.moveTo(e.x, e.floorY);
  ctx.lineTo(e.x, floorYBack);
  ctx.lineTo(e.x + e.w, floorYBack);
  ctx.lineTo(e.x + e.w, e.floorY);
  ctx.closePath();
  ctx.fill();
  
  // Línea de Escenario Frontal (Suelo)
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.7)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(e.x, e.floorY);
  ctx.lineTo(e.x + e.w, e.floorY);
  ctx.stroke();
  
  // Línea de Escenario Posterior (Fondo)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(e.x, floorYBack);
  ctx.lineTo(e.x + e.w, floorYBack);
  ctx.stroke();
  
  // Título e indicaciones en elevación
  ctx.fillStyle = 'rgba(255, 179, 71, 0.8)';
  ctx.font = '600 10px Inter';
  ctx.textAlign = 'left';
  ctx.fillText(`VISTA DE PERFIL (PERSPECTIVA DE PLATEA) · Varas a ${stageMeters.h.toFixed(1)}m`, e.x, floorYBack - stageMeters.h * e.scaleY * 0.7 - 10);
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.font = '700 8.5px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('▽ VISTA FRONTALES DEL PÚBLICO ▽', W / 2, e.floorY + 22);
}

function drawElevBeam(f) {
  const { apex, p1, p2 } = beamTriangle(f);
  const { r, g, b } = hexToRgb(f.color);
  const alpha = f.intensity / 100;
  
  const midx = (p1.x + p2.x) / 2, midy = (p1.y + p2.y) / 2;
  const grad = ctx.createLinearGradient(apex.x, apex.y, midx, midy);
  grad.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.95})`);
  grad.addColorStop(0.6, `rgba(${r},${g},${b},${alpha * 0.25})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(apex.x, apex.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.closePath();
  ctx.fill();
}

function drawElevFixtureBody(f) {
  const isSelected = f.id === selectedFixtureId;
  const { x: apexX, y: apexY, scale } = getElevFixturePos(f);
  const { p1, p2 } = beamTriangle(f);
  
  ctx.save();
  ctx.translate(apexX, apexY);
  
  // Rotar el proyector físico según dirección
  let angle = 0;
  if (f.dir === 'calle-izq') angle = Math.PI / 2;
  else if (f.dir === 'calle-der') angle = -Math.PI / 2;
  else if (f.dir === 'contra') angle = Math.PI;
  
  ctx.rotate(angle);
  
  // Cuerpo del proyector escalado por la profundidad
  ctx.fillStyle = isSelected ? '#ffffff' : '#33333f';
  ctx.fillRect(-7 * scale, -4 * scale, 14 * scale, 8 * scale);
  
  // Lente del color de la luz
  ctx.fillStyle = f.color;
  ctx.beginPath();
  ctx.arc(0, 4 * scale, 5 * scale, 0, Math.PI, false);
  ctx.fill();
  
  ctx.restore();
  
  // Borde de selección
  ctx.strokeStyle = isSelected ? '#ffffff' : '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(apexX - 8 * scale, apexY - 8 * scale, 16 * scale, 16 * scale);
  
  // Etiqueta del proyector
  ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.4)';
  ctx.font = `${isSelected ? 'bold' : 'normal'} ${8 * scale}px Inter`;
  ctx.textAlign = 'center';
  const label = f.mountType === 'vara' ? 'VARA' : f.mountType === 'calle' ? 'CALLE' : 'PISO';
  ctx.fillText(`${label} ${f.id}`, apexX, apexY - 12 * scale);
  
  // Dibujar asas de ajuste de ángulo si está seleccionado
  if (isSelected) {
    [p1, p2].forEach(h => {
      ctx.beginPath();
      ctx.arc(h.x, h.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.stroke();
    });
  }
}

function calculateObjectLighting(o) {
  const front = { r: 0, g: 0, b: 0 };
  const back = { r: 0, g: 0, b: 0 };
  
  fixtures.forEach(f => {
    // Vector desde la luz hasta el objeto (Z=0 del objeto en el suelo)
    const dx = o.sxm - f.sxm;
    const dy = o.sym - f.sym;
    const dz = 0 - f.height;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.1) return;
    
    // Dirección del haz de luz
    const target3D = getFixtureTarget3D(f);
    const tdx = target3D.x - f.sxm;
    const tdy = target3D.y - f.sym;
    const tdz = target3D.z - f.height;
    
    // Calcular ángulo entre la dirección del haz y la dirección al objeto
    const dot = dx * tdx + dy * tdy + dz * tdz;
    const len1 = dist;
    const len2 = Math.hypot(tdx, tdy, tdz);
    if (len2 < 0.1) return;
    
    const cosTheta = dot / (len1 * len2);
    const theta = Math.acos(Math.max(-1, Math.min(1, cosTheta)));
    
    // Si cae dentro del cono del haz
    const halfAngleRad = (f.beamAngle / 2) * Math.PI / 180;
    if (theta <= halfAngleRad) {
      const { r, g, b } = hexToRgb(f.color);
      // Atenuación cuadrática suave por distancia
      const factor = (f.intensity / 100) * Math.max(0, 1 - (dist / 12));
      
      // Si la luz viene de adelante (downstage de la persona, Y mayor)
      if (f.sym > o.sym) {
        front.r += r * factor;
        front.g += g * factor;
        front.b += b * factor;
      } else {
        back.r += r * factor;
        back.g += g * factor;
        back.b += b * factor;
      }
    }
  });
  
  return { front, back };
}

function drawElevObject(o) {
  const { x, y: floorY, scale } = getElevObjectPos(o);
  const { front, back } = calculateObjectLighting(o);
  
  const baseR = 24, baseG = 24, baseB = 28;
  const onstage = o.sxm >= 0 && o.sxm <= stageMeters.w && o.sym >= 0 && o.sym <= stageMeters.d;
  
  ctx.save();
  
  // Simular Contraluz (Rim Light / Luz de Recorte trasera) usando sombra con brillo
  if (back.r > 2 || back.g > 2 || back.b > 2) {
    ctx.shadowColor = `rgba(${Math.min(255, back.r * 1.8)}, ${Math.min(255, back.g * 1.8)}, ${Math.min(255, back.b * 1.8)}, 0.95)`;
    ctx.shadowBlur = 12 * scale;
  }
  
  // Color del sujeto = Color base + iluminación frontal recibida
  ctx.fillStyle = `rgb(${Math.min(255, baseR + front.r)}, ${Math.min(255, baseG + front.g)}, ${Math.min(255, baseB + front.b)})`;
  
  if (o.type === 'persona') {
    drawPersonSilhouette(ctx, x, floorY, scale);
  } else {
    drawPropBox(ctx, x, floorY, scale);
  }
  
  ctx.restore();
  
  // Borde sutil
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  if (o.type === 'persona') {
    ctx.beginPath();
    ctx.ellipse(x, floorY - 38 * scale, 6 * scale, 6 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeRect(x - 14 * scale, floorY - 24 * scale, 28 * scale, 24 * scale);
  }
  
  if (!onstage) {
    ctx.fillStyle = 'rgba(255, 92, 92, 0.7)';
    ctx.font = '600 8.5px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('FUERA DE ESCENA', x, floorY + 12);
  }
}

function drawElevView() {
  drawElevFloor();
  
  const e = elevRect();
  ctx.save();
  
  // Coleccionar todos los elementos dibujables en elevación
  const items = [];
  fixtures.forEach(f => {
    // Añadimos el haz y el proyector físico como entidades separadas para ordenarlas por Y
    items.push({ type: 'beam', y: f.sym, ref: f });
    items.push({ type: 'fixture', y: f.sym, ref: f });
  });
  objects.forEach(o => {
    items.push({ type: 'object', y: o.sym, ref: o });
  });
  
  // Algoritmo del pintor (Painter's Algorithm): ordenar de atrás hacia adelante (Y ascendente)
  // Si tienen el mismo Y, el orden es: haz, objeto, proyector físico
  items.sort((a, b) => {
    if (Math.abs(a.y - b.y) < 0.01) {
      const order = { 'beam': 1, 'object': 2, 'fixture': 3 };
      return order[a.type] - order[b.type];
    }
    return a.y - b.y;
  });
  
  // Renderizar ordenado
  items.forEach(item => {
    if (item.type === 'beam') {
      ctx.globalCompositeOperation = 'lighter';
      drawElevBeam(item.ref);
    } else if (item.type === 'fixture') {
      ctx.globalCompositeOperation = 'source-over';
      drawElevFixtureBody(item.ref);
    } else if (item.type === 'object') {
      ctx.globalCompositeOperation = 'source-over';
      drawElevObject(item.ref);
    }
  });
  
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}

function draw() {
  if (currentView === 'plan') drawPlanView();
  else if (currentView === 'elev') drawElevView();
  else drawPerspView();
}

// ---------- SILUETAS Y COLORES DINÁMICOS (PLANTA) ----------
function drawFigureTinted(c, x, y, type, light, onstage) {
  const baseR = 24, baseG = 24, baseB = 28;
  c.save();
  
  c.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
  if (type === 'persona') drawPersonSilhouette(c, x, y);
  else drawPropBox(c, x, y);
  
  c.globalCompositeOperation = 'source-atop';
  const lum = (light.r + light.g + light.b) / (255 * 3);
  c.fillStyle = `rgba(${light.r},${light.g},${light.b},${Math.min(0.95, lum * 1.6 + 0.1)})`;
  if (type === 'persona') drawPersonSilhouette(c, x, y);
  else drawPropBox(c, x, y);
  
  c.restore();
  
  c.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  c.lineWidth = 1;
  if (type === 'persona') {
    c.beginPath(); c.ellipse(x, y - 38, 6, 6, 0, 0, Math.PI * 2); c.stroke();
  } else {
    c.strokeRect(x - 14, y - 24, 28, 24);
  }
  
  if (!onstage) {
    c.fillStyle = 'rgba(255, 92, 92, 0.7)';
    c.font = '600 8.5px Inter';
    c.textAlign = 'center';
    c.fillText('FUERA DE ESCENA', x, y + 12);
  }
}

function drawPersonSilhouette(c, x, y, scale = 1.0) {
  const headR = 6 * scale;
  const shoulderW = 9 * scale;
  const shoulderYOffset = 30 * scale;
  const headYOffset = 38 * scale;
  
  // Cabeza
  c.beginPath(); 
  c.ellipse(x, y - headYOffset, headR, headR, 0, 0, Math.PI * 2); 
  c.fill();
  
  // Hombros / Cuerpo
  c.beginPath();
  c.moveTo(x - shoulderW, y);
  c.quadraticCurveTo(x - shoulderW - (2 * scale), y - shoulderYOffset, x, y - shoulderYOffset);
  c.quadraticCurveTo(x + shoulderW + (2 * scale), y - shoulderYOffset, x + shoulderW, y);
  c.closePath();
  c.fill();
}

function drawPropBox(c, x, y, scale = 1.0) {
  const w = 28 * scale;
  const h = 24 * scale;
  c.fillRect(x - w / 2, y - h, w, h);
}

// ---------- INTERACCIÓN (MOUSE / ARRASTRE Y SOLTAR) ----------
canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  
  // 1. Verificar si arrastra Varas LX
  if (currentView === 'plan') {
    const r = planRect();
    for (let i = 0; i < varas.length; i++) {
      const v = varas[i];
      const yPx = r.y + v.sym * r.scale;
      if (Math.abs(my - yPx) < 7) {
        dragTarget = { kind: 'vara', id: v.id, index: i };
        dragOffset = { x: 0, y: yPx - my };
        return;
      }
    }
  } else if (currentView === 'persp') {
    for (let i = 0; i < varas.length; i++) {
      const v = varas[i];
      const vL = project3D(0.2, v.sym, stageMeters.h);
      const yPx = vL.y;
      if (Math.abs(my - yPx) < 8) {
        dragTarget = { kind: 'vara', id: v.id, index: i };
        dragOffset = { x: 0, y: yPx - my };
        return;
      }
    }
  }
  
  // 2. Verificar si arrastra asas de haz en elevación
  if (currentView === 'elev' && selectedFixtureId !== null) {
    const f = fixtures.find(f => f.id === selectedFixtureId);
    if (f) {
      const { p1, p2 } = beamTriangle(f);
      if (Math.hypot(p1.x - mx, p1.y - my) < 9) { dragTarget = { kind: 'beam', id: f.id, side: 'p1' }; return; }
      if (Math.hypot(p2.x - mx, p2.y - my) < 9) { dragTarget = { kind: 'beam', id: f.id, side: 'p2' }; return; }
    }
  }
  
  // 3. Verificar si hace click en objetos
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    let p;
    if (currentView === 'plan') {
      p = planPixel(o.sxm, o.sym);
    } else if (currentView === 'elev') {
      p = getElevObjectPos(o);
    } else { // persp
      p = project3D(o.sxm, o.sym, 0);
    }
    
    const hLimit = currentView === 'plan' ? 20 : 45 * p.scale;
    if (Math.hypot(p.x - mx, p.y - my) < 22 && my > p.y - hLimit && my < p.y + 6) {
      dragTarget = { kind: 'object', id: o.id };
      dragOffset = { x: p.x - mx, y: p.y - my };
      return;
    }
  }
  
  // 4. Verificar si hace click en focos
  for (let i = fixtures.length - 1; i >= 0; i--) {
    const f = fixtures[i];
    let p;
    if (currentView === 'plan') {
      p = planPixel(f.sxm, f.sym);
    } else if (currentView === 'elev') {
      p = getElevFixturePos(f);
    } else { // persp
      p = project3D(f.sxm, f.sym, f.height);
    }
    
    if (Math.hypot(p.x - mx, p.y - my) < 14) {
      dragTarget = { kind: 'fixture', id: f.id };
      selectedFixtureId = f.id;
      dragOffset = { x: p.x - mx, y: p.y - my };
      renderFixturePanel();
      draw();
      return;
    }
  }
});

canvas.addEventListener('mousemove', e => {
  if (!dragTarget) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  
  if (dragTarget.kind === 'beam') {
    const f = fixtures.find(f => f.id === dragTarget.id);
    const er = elevRect();
    const { x: apexX, y: apexY } = getElevFixturePos(f);
    const depthPercent = f.sym / stageMeters.d;
    const scale = 0.7 + 0.3 * depthPercent;
    
    if (isCalle(f)) {
      const halfSpreadPx = Math.max(4, Math.abs(my - apexY));
      const halfSpreadM = halfSpreadPx / er.scaleY;
      f.beamAngle = Math.max(2, Math.min(70, Math.atan(halfSpreadM / (stageMeters.w * scale)) * 180 / Math.PI));
    } else {
      const halfWpx = Math.max(4, Math.abs(mx - apexX));
      const halfWm = halfWpx / er.scaleX;
      f.beamAngle = Math.max(3, Math.min(70, Math.atan(halfWm / (f.height * scale)) * 180 / Math.PI));
    }
    
    renderFixturePanel();
    draw();
    triggerAutosave();
    return;
  }
  
  if (dragTarget.kind === 'vara') {
    const idx = dragTarget.index;
    let clampedSym;
    if (currentView === 'plan') {
      const r = planRect();
      const sym = (my + dragOffset.y - r.y) / r.scale;
      clampedSym = Math.max(0.1, Math.min(stageMeters.d - 0.1, sym));
    } else if (currentView === 'persp') {
      const un = unproject3D(mx, my + dragOffset.y, stageMeters.h);
      clampedSym = Math.max(0.1, Math.min(stageMeters.d - 0.1, un.y));
    } else {
      return;
    }
    
    varas[idx].sym = clampedSym;
    
    // Sincronizar todos los focos montados en esta vara
    fixtures.forEach(f => {
      if (f.mountType === 'vara' && f.varaId === varas[idx].id) {
        f.sym = clampedSym;
      }
    });
    
    renderVarasPanel();
    renderFixturePanel();
    draw();
    triggerAutosave();
    return;
  }

  if (dragTarget.kind === 'fixture') {
    const f = fixtures.find(f => f.id === dragTarget.id);
    if (currentView === 'plan') {
      const m = planMeters(mx + dragOffset.x, my + dragOffset.y);
      if (f.mountType === 'vara') {
        f.sxm = Math.max(0.1, Math.min(stageMeters.w - 0.1, m.sxm));
        const targetVara = varas.find(v => v.id === f.varaId);
        if (targetVara) f.sym = targetVara.sym;
      } else if (f.mountType === 'calle') {
        f.sym = Math.max(0.1, Math.min(stageMeters.d - 0.1, m.sym));
        f.sxm = f.sxm < stageMeters.w / 2 ? 0 : stageMeters.w;
      } else {
        f.sxm = Math.max(0.1, Math.min(stageMeters.w - 0.1, m.sxm));
        f.sym = Math.max(0.1, Math.min(stageMeters.d - 0.1, m.sym));
      }
    } else if (currentView === 'persp') {
      if (f.mountType === 'vara') {
        const un = unproject3D(mx + dragOffset.x, my + dragOffset.y, stageMeters.h);
        f.sxm = Math.max(0.1, Math.min(stageMeters.w - 0.1, un.x));
        const targetVara = varas.find(v => v.id === f.varaId);
        if (targetVara) f.sym = targetVara.sym;
      } else if (f.mountType === 'calle') {
        const xLock = f.sxm < stageMeters.w / 2 ? 0 : stageMeters.w;
        const rx = xLock - stageMeters.w / 2;
        const cx = W / 2;
        const baseScale = (W - 140) / stageMeters.w;
        const denom = rx * baseScale;
        const backScale = 0.55;
        let scale = 0.7;
        if (Math.abs(denom) > 0.001) {
          scale = (mx + dragOffset.x - cx) / denom;
        }
        scale = Math.max(backScale, Math.min(1.2, scale));
        const t = (scale - backScale) / (1.0 - backScale);
        f.sym = Math.max(0.1, Math.min(stageMeters.d - 0.1, t * stageMeters.d));
        
        const cy = H / 2 + 10;
        const floorYBack = cy - 50;
        const floorYFront = cy + 100;
        const floorY = floorYBack + (floorYFront - floorYBack) * t;
        const heightScale = (H - 180) / stageMeters.h;
        f.height = (floorY - (my + dragOffset.y)) / (heightScale * scale);
        f.height = Math.max(0.5, Math.min(stageMeters.h, f.height));
      } else { // piso
        const un = unproject3D(mx + dragOffset.x, my + dragOffset.y, 0.2);
        f.sxm = Math.max(0.1, Math.min(stageMeters.w - 0.1, un.x));
        f.sym = Math.max(0.1, Math.min(stageMeters.d - 0.1, un.y));
      }
    } else {
      const er = elevRect();
      const centerX = er.x + (stageMeters.w / 2) * er.scaleX;
      const depthPercent = f.sym / stageMeters.d;
      const scale = 0.7 + 0.3 * depthPercent;
      const floorY = er.floorY - (1 - depthPercent) * 40;
      
      if (f.mountType === 'vara') {
        f.sxm = (mx + dragOffset.x - centerX) / (er.scaleX * scale) + stageMeters.w / 2;
        f.sxm = Math.max(0, Math.min(stageMeters.w, f.sxm));
        f.height = stageMeters.h;
      } else if (f.mountType === 'piso') {
        f.sxm = (mx + dragOffset.x - centerX) / (er.scaleX * scale) + stageMeters.w / 2;
        f.sxm = Math.max(0, Math.min(stageMeters.w, f.sxm));
        f.height = 0.2;
      } else if (f.mountType === 'calle') {
        f.height = (floorY - (my + dragOffset.y)) / (er.scaleY * scale);
        f.height = Math.max(0.5, Math.min(stageMeters.h, f.height));
      } else {
        f.sxm = (mx + dragOffset.x - centerX) / (er.scaleX * scale) + stageMeters.w / 2;
        f.sxm = Math.max(0, Math.min(stageMeters.w, f.sxm));
        f.height = (floorY - (my + dragOffset.y)) / (er.scaleY * scale);
        f.height = Math.max(0.5, Math.min(stageMeters.h, f.height));
      }
    }
    renderFixturePanel();
    draw();
    triggerAutosave();
    return;
  }
  
  if (dragTarget.kind === 'object') {
    const o = objects.find(o => o.id === dragTarget.id);
    if (currentView === 'plan') {
      const m = planMeters(mx + dragOffset.x, my + dragOffset.y);
      o.sxm = Math.max(-1, Math.min(stageMeters.w + 1, m.sxm));
      o.sym = Math.max(-1, Math.min(stageMeters.d + 1, m.sym));
    } else if (currentView === 'persp') {
      const un = unproject3D(mx + dragOffset.x, my + dragOffset.y, 0);
      o.sxm = Math.max(0.1, Math.min(stageMeters.w - 0.1, un.x));
      o.sym = Math.max(0.1, Math.min(stageMeters.d - 0.1, un.y));
    } else {
      const er = elevRect();
      const centerX = er.x + (stageMeters.w / 2) * er.scaleX;
      const depthPercent = o.sym / stageMeters.d;
      const scale = 0.7 + 0.3 * depthPercent;
      
      o.sxm = (mx + dragOffset.x - centerX) / (er.scaleX * scale) + stageMeters.w / 2;
      o.sxm = Math.max(0, Math.min(stageMeters.w, o.sxm));
    }
    renderObjectPanel();
    draw();
    triggerAutosave();
  }
});

window.addEventListener('mouseup', () => {
  dragTarget = null;
});

// ---------- CARGA Y RENDERIZADO DEL CATÁLOGO ----------
function renderCatalog() {
  const grid = document.getElementById('catalog-items-grid');
  grid.innerHTML = '';
  
  CATALOG.forEach(m => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'catalog-card';
    card.innerHTML = `
      <div class="catalog-card-header">
        <span class="catalog-card-title">${m.name}</span>
        <span class="catalog-card-badge">${m.type === 'led' ? 'LED' : 'Conv.'}</span>
      </div>
      <div class="catalog-card-brand">${m.brand}</div>
      <p class="catalog-card-desc">${m.description}</p>
      <div class="catalog-card-specs">
        <span>Apertura: ${m.minAngle}° - ${m.maxAngle}°</span>
        <span>${m.subType.toUpperCase()}</span>
      </div>
    `;
    
    card.addEventListener('click', () => {
      addFixtureFromCatalog(m.id);
      document.getElementById('catalog-dialog').close();
    });
    
    grid.appendChild(card);
  });
}

function addFixtureFromCatalog(modelId) {
  const defaults = getFixtureDefaults(modelId);
  const targetVara = varas.find(v => !v.isFrontal) || varas[0];
  
  const maxChan = fixtures.reduce((max, fix) => Math.max(max, fix.channel || 0), 0);
  const nextChan = maxChan + 1;
  const maxDmx = fixtures.reduce((max, fix) => Math.max(max, parseInt(fix.dmxAddress) || 0), 0);
  const nextDmx = maxDmx + 1;
  
  const f = {
    id: idCounter++,
    kind: 'fixture',
    ...defaults,
    mountType: 'vara',
    varaId: targetVara ? targetVara.id : 1,
    sxm: stageMeters.w / 2,
    sym: targetVara ? targetVara.sym : 3.0,
    height: stageMeters.h,
    pan: 0,
    tilt: 35,
    dir: 'frente',
    channel: nextChan,
    dmxAddress: String(nextDmx),
    purpose: ''
  };
  
  fixtures.push(f);
  selectedFixtureId = f.id;
  renderFixturePanel();
  draw();
  triggerAutosave();
}

// ---------- MANEJO DE DIÁLOGOS NATIVOS Y BOTONES ----------
function setupEventListeners() {
  // Modal de Catálogo
  const catalogDialog = document.getElementById('catalog-dialog');
  document.getElementById('btn-open-catalog').addEventListener('click', () => catalogDialog.showModal());
  document.getElementById('close-catalog-btn').addEventListener('click', () => catalogDialog.close());

  // Modal de Proyectos/Storage
  const storageDialog = document.getElementById('storage-dialog');
  document.getElementById('open-storage-btn').addEventListener('click', () => {
    // Actualizar datos del autoguardado antes de abrir
    document.getElementById('local-save-fixtures').innerText = `${fixtures.length} focos`;
    document.getElementById('local-save-objects').innerText = `${objects.length} elementos`;
    storageDialog.showModal();
  });
  document.querySelectorAll('#close-storage-btn').forEach(btn => {
    btn.addEventListener('click', () => storageDialog.close());
  });

  // Modal de Exportación
  const exportDialog = document.getElementById('export-dialog');
  document.getElementById('open-export-btn').addEventListener('click', () => exportDialog.showModal());
  document.querySelectorAll('#close-export-btn').forEach(btn => {
    btn.addEventListener('click', () => exportDialog.close());
  });

  // Acciones de Exportación
  document.getElementById('export-png-action-btn').addEventListener('click', () => {
    exportCanvasAsPNG(canvas, currentView);
    exportDialog.close();
  });
  document.getElementById('export-pdf-action-btn').addEventListener('click', () => {
    exportProjectPDF(canvas, stageMeters, fixtures, objects, projectName, currentView);
    exportDialog.close();
  });

  // Importación/Exportación JSON
  document.getElementById('json-export-btn').addEventListener('click', () => {
    exportProjectJSON(stageMeters, fixtures, objects, varas, cues, projectName);
  });
  document.getElementById('json-import-input').addEventListener('change', e => {
    if (e.target.files.length === 0) return;
    importProjectJSON(e.target.files[0])
      .then(res => {
        stageMeters = res.stageMeters;
        fixtures = res.fixtures;
        objects = res.objects;
        projectName = res.projectName;
        varas = res.varas || getDefaultVaras();
        cues = res.cues || [];
        
        // Sincronizar UI
        document.getElementById('project-name-input').value = projectName;
        document.getElementById('stageW').value = stageMeters.w;
        document.getElementById('stageD').value = stageMeters.d;
        document.getElementById('stageH').value = stageMeters.h;
        
        if (fixtures.length > 0) selectedFixtureId = fixtures[0].id;
        else selectedFixtureId = null;
        
        renderVarasPanel();
        renderFixturePanel();
        renderObjectPanel();
        renderCueList();
        draw();
        triggerAutosave();
        storageDialog.close();
      })
      .catch(err => {
        alert(err.message);
      });
  });

  // Nombre del proyecto
  document.getElementById('project-name-input').addEventListener('input', e => {
    projectName = e.target.value || 'Mi Planta de Luces';
    triggerAutosave();
  });

  // Escenario y dimensiones
  document.getElementById('stageW').addEventListener('input', e => {
    stageMeters.w = Math.max(2, parseFloat(e.target.value) || 8);
    draw();
    triggerAutosave();
  });
  document.getElementById('stageD').addEventListener('input', e => {
    stageMeters.d = Math.max(2, parseFloat(e.target.value) || 6);
    draw();
    triggerAutosave();
  });
  document.getElementById('stageH').addEventListener('input', e => {
    stageMeters.h = Math.max(3, parseFloat(e.target.value) || 7);
    draw();
    triggerAutosave();
  });

  // Presets Rápidos de Escenario
  document.getElementById('btn-preset-small').addEventListener('click', () => {
    stageMeters = { w: 6, d: 4, h: 5 };
    updateStageInputs();
  });
  document.getElementById('btn-preset-med').addEventListener('click', () => {
    stageMeters = { w: 10, d: 8, h: 7 };
    updateStageInputs();
  });
  document.getElementById('btn-preset-large').addEventListener('click', () => {
    stageMeters = { w: 15, d: 10, h: 9 };
    updateStageInputs();
  });

  // Botón Reiniciar Escena
  document.getElementById('btn-reset-stage').addEventListener('click', () => {
    showConfirm(
      '¿Reiniciar Escenario?',
      'Esta acción borrará todas las luces y objetos agregados, regresando al estado inicial. No se puede deshacer.',
      () => {
        clearProject();
        loadDefaultScene();
        
        document.getElementById('project-name-input').value = projectName;
        updateStageInputs();
        
        renderVarasPanel();
        renderFixturePanel();
        renderObjectPanel();
        renderCueList();
        draw();
        triggerAutosave();
      }
    );
  });

  // Cambio de Vista
  document.querySelectorAll('#viewSwitch button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#viewSwitch button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      
      const canvasEl = document.getElementById('stage');
      const patchEl = document.getElementById('patch-view-container');
      const overlayEl = document.getElementById('floor-label');
      
      if (currentView === 'patch') {
        canvasEl.style.display = 'none';
        if (overlayEl) overlayEl.style.display = 'none';
        patchEl.style.display = 'block';
        renderPatchView();
      } else {
        canvasEl.style.display = 'block';
        if (overlayEl) overlayEl.style.display = 'block';
        patchEl.style.display = 'none';
        draw();
      }
    });
  });

  // Tabs Laterales
  document.querySelectorAll('.sidebar-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-tabs button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  // Agregar Objetos
  document.getElementById('addPersonBtn').addEventListener('click', () => addObject('persona'));
  document.getElementById('addPropBtn').addEventListener('click', () => addObject('objeto'));

  // Agregar Varas LX
  document.getElementById('btn-add-vara').addEventListener('click', () => {
    const nonFrontalVaras = varas.filter(v => !v.isFrontal);
    const nextNum = nonFrontalVaras.length + 1;
    const newVara = {
      id: Math.max(...varas.map(v => v.id), 0) + 1,
      name: `Vara LX ${nextNum}`,
      sym: Math.max(0.2, stageMeters.d - 1.0 - (nextNum * 0.8)),
      isFrontal: false
    };
    newVara.sym = Math.max(0.1, Math.min(stageMeters.d - 0.1, newVara.sym));
    varas.push(newVara);
    renderVarasPanel();
    draw();
    triggerAutosave();
  });

  // Agregar Escena (Cue)
  document.getElementById('btn-add-cue').addEventListener('click', () => {
    const cueName = prompt('Ingrese el nombre de la escena:', `Escena ${cues.length + 1}`);
    if (cueName === null) return;
    const name = cueName.trim() || `Escena ${cues.length + 1}`;
    
    const intensities = {};
    const colors = {};
    fixtures.forEach(f => {
      intensities[f.id] = f.intensity;
      colors[f.id] = f.color;
    });
    
    const fadeTime = parseFloat(document.getElementById('cue-fade-time').value) || 1.5;
    
    cues.push({
      id: Date.now(),
      name,
      fadeTime,
      intensities,
      colors
    });
    
    renderCueList();
    triggerAutosave();
  });
}

function updateStageInputs() {
  document.getElementById('stageW').value = stageMeters.w;
  document.getElementById('stageD').value = stageMeters.d;
  document.getElementById('stageH').value = stageMeters.h;
  draw();
  triggerAutosave();
}

function addObject(type) {
  const o = {
    id: idCounter++,
    kind: 'object',
    type,
    sxm: stageMeters.w / 2 + (Math.random() - 0.5) * 2,
    sym: stageMeters.d / 2 + (Math.random() - 0.5) * 2
  };
  objects.push(o);
  renderObjectPanel();
  draw();
  triggerAutosave();
  
  // Cambiar a tab de objetos para ver el nuevo agregado
  document.getElementById('tab-objetos-btn').click();
}

// ---------- COMPONENTE DE CONFIRMACIÓN PERSISTENTE ----------
function showConfirm(title, message, onOk) {
  const dialog = document.getElementById('confirm-dialog');
  document.getElementById('confirm-title').innerText = title;
  document.getElementById('confirm-message').innerText = message;
  
  const cancelBtn = document.getElementById('confirm-cancel-btn');
  const okBtn = document.getElementById('confirm-ok-btn');
  
  const cleanUp = () => {
    cancelBtn.removeEventListener('click', handleCancel);
    okBtn.removeEventListener('click', handleOk);
    dialog.close();
  };
  
  const handleCancel = () => cleanUp();
  const handleOk = () => {
    onOk();
    cleanUp();
  };
  
  cancelBtn.addEventListener('click', handleCancel);
  okBtn.addEventListener('click', handleOk);
  
  dialog.showModal();
}

// ---------- AUTOGUARDADO INDICADORES ----------
function triggerAutosave() {
  updateSaveStatus('saving');
  if (saveTimeout) clearTimeout(saveTimeout);
  
  saveTimeout = setTimeout(() => {
    const success = saveProject(stageMeters, fixtures, objects, varas, cues, projectName);
    updateSaveStatus(success ? 'saved' : 'error');
  }, 1000);
}

function updateSaveStatus(status) {
  const el = document.getElementById('save-status');
  if (status === 'saved') {
    el.innerText = 'Guardado';
    el.className = 'save-status';
  } else if (status === 'saving') {
    el.innerText = 'Guardando...';
    el.className = 'save-status saving';
  } else {
    el.innerText = 'Error al Guardar';
    el.className = 'save-status unsaved';
  }
}

// ---------- PANELES LATERALES RENDER ----------

function renderFixturePanel() {
  const list = document.getElementById('fixtureList');
  list.innerHTML = '';
  
  if (fixtures.length === 0) {
    list.innerHTML = `<div class="field-tip text-center" style="text-align:center;padding:20px;">No hay focos agregados. Haz click en "Agregar Foco" arriba para sumar luminarias del catálogo.</div>`;
    return;
  }
  
  fixtures.forEach(f => {
    // Si no tiene definido mountType por compatibilidad
    if (!f.mountType) {
      if (f.dir && f.dir.startsWith('calle')) f.mountType = 'calle';
      else if (f.dir === 'piso') f.mountType = 'piso';
      else f.mountType = 'vara';
    }
    if (f.mountType === 'vara' && !f.varaId) {
      const targetVara = varas[0];
      f.varaId = targetVara ? targetVara.id : 1;
    }
    if (f.pan === undefined) f.pan = 0;
    if (f.tilt === undefined) f.tilt = 35;
    
    const isSelected = f.id === selectedFixtureId;
    const card = document.createElement('div');
    card.className = `fixture-card ${isSelected ? 'selected' : ''}`;
    card.setAttribute('style', `--glow-color: ${f.color}`);
    
    // Generar bloque de color: mezclador RGB o lista de Geles
    let colorControlHTML = '';
    if (f.type === 'conventional') {
      let gelOptions = GELS.map(g => `
        <option value="${g.id}" ${f.gelId === g.id ? 'selected' : ''}>
          [${g.code}] ${g.name}
        </option>
      `).join('');
      
      colorControlHTML = `
        <div class="color-picker-row">
          <label>Filtro Gel</label>
          <select data-gel-picker="${f.id}" class="gel-picker-select">
            ${gelOptions}
          </select>
        </div>
      `;
    } else {
      colorControlHTML = `
        <div class="color-picker-row">
          <label>Color Luz</label>
          <input type="color" value="${f.color}" data-color-picker="${f.id}">
          <span style="font-size:10px;color:var(--ink-dim)">RGB Inteligente</span>
        </div>
      `;
    }

    // Lógica condicional de soportes
    let supportControlsHTML = '';
    if (f.mountType === 'vara') {
      const targetVara = varas.find(v => v.id === f.varaId) || varas[0];
      supportControlsHTML = `
        <div class="range-group">
          <label>Vara LX</label>
          <select data-vara-assign="${f.id}" style="flex:1;padding:4px 6px;font-size:11px;">
            ${varas.map(v => `<option value="${v.id}" ${f.varaId === v.id ? 'selected' : ''}>${v.name}</option>`).join('')}
          </select>
        </div>
        <div class="range-group">
          <label>Posición en Vara</label>
          <input type="range" min="0.1" max="${stageMeters.w - 0.1}" step="0.1" value="${f.sxm.toFixed(1)}" data-vara-pos-range="${f.id}">
          <span class="range-value">${f.sxm.toFixed(1)}m</span>
        </div>
        <div style="font-size: 10px; color: var(--ink-dim); padding-top: 2px;">
          * Altura fija a parrilla (${stageMeters.h.toFixed(1)}m). Profundidad Y (${targetVara ? targetVara.sym.toFixed(1) : 0}m) ligada a Vara.
        </div>
      `;
    } else if (f.mountType === 'calle') {
      supportControlsHTML = `
        <div class="range-group">
          <label>Extremo Lateral</label>
          <select data-side-select="${f.id}" style="flex:1;padding:4px 6px;font-size:11px;">
            <option value="izq" ${f.sxm < stageMeters.w / 2 ? 'selected' : ''}>Izquierda</option>
            <option value="der" ${f.sxm >= stageMeters.w / 2 ? 'selected' : ''}>Derecha</option>
          </select>
        </div>
        <div class="range-group">
          <label>Profundidad (Y)</label>
          <input type="range" min="0.1" max="${stageMeters.d - 0.1}" step="0.1" value="${f.sym.toFixed(1)}" data-calle-depth-range="${f.id}">
          <span class="range-value">${f.sym.toFixed(1)}m</span>
        </div>
        <div class="range-group">
          <label>Altura (Z)</label>
          <input type="range" min="0.5" max="${stageMeters.h}" step="0.1" value="${f.height.toFixed(1)}" data-calle-height-range="${f.id}">
          <span class="range-value">${f.height.toFixed(1)}m</span>
        </div>
      `;
    } else { // piso
      supportControlsHTML = `
        <div class="range-group">
          <label>Posición X</label>
          <input type="range" min="0.1" max="${stageMeters.w - 0.1}" step="0.1" value="${f.sxm.toFixed(1)}" data-piso-x-range="${f.id}">
          <span class="range-value">${f.sxm.toFixed(1)}m</span>
        </div>
        <div class="range-group">
          <label>Posición Y</label>
          <input type="range" min="0.1" max="${stageMeters.d - 0.1}" step="0.1" value="${f.sym.toFixed(1)}" data-piso-y-range="${f.id}">
          <span class="range-value">${f.sym.toFixed(1)}m</span>
        </div>
        <div style="font-size: 10px; color: var(--ink-dim); padding-top: 2px;">
          * Altura fija a ras de piso (0.2m).
        </div>
      `;
    }

    card.innerHTML = `
      <div class="fixture-card-header">
        <div class="fixture-card-title">
          <span class="color-indicator"></span>
          <span>${f.name}</span>
        </div>
        <button type="button" class="fixture-card-delete" data-del-btn="${f.id}" title="Eliminar foco">&times;</button>
      </div>
      
      <div class="fixture-card-meta">
        <span>Montaje: ${f.mountType === 'vara' ? 'VARA' : f.mountType === 'calle' ? 'CALLE' : 'PISO'}</span>
        <span>Apertura: ${Math.round(f.beamAngle)}°</span>
      </div>
      
      ${isSelected ? `
      <div class="fixture-card-controls">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:8px;">
          <div>
            <label style="font-size:10px; color:var(--ink-dim); display:block; margin-bottom:2px;">Canal Consola</label>
            <input type="number" value="${f.channel || ''}" placeholder="--" data-channel-input="${f.id}" style="width:100%; background:#0f0f13; border:1px solid var(--border); color:#fff; border-radius:3px; padding:3px 6px; font-size:11px; box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:10px; color:var(--ink-dim); display:block; margin-bottom:2px;">Dirección DMX</label>
            <input type="text" value="${f.dmxAddress || ''}" placeholder="--" data-dmx-input="${f.id}" style="width:100%; background:#0f0f13; border:1px solid var(--border); color:#fff; border-radius:3px; padding:3px 6px; font-size:11px; box-sizing:border-box;">
          </div>
        </div>
        <div style="margin-bottom:8px;">
          <label style="font-size:10px; color:var(--ink-dim); display:block; margin-bottom:2px;">Propósito / Apuntamiento</label>
          <input type="text" value="${f.purpose || ''}" placeholder="Puntería del haz..." data-purpose-input="${f.id}" style="width:100%; background:#0f0f13; border:1px solid var(--border); color:#fff; border-radius:3px; padding:3px 6px; font-size:11px; box-sizing:border-box;">
        </div>
        
        <div class="range-group">
          <label>Soporte</label>
          <select data-mount-select="${f.id}" style="flex:1;padding:4px 6px;font-size:11px;font-weight:600;">
            <option value="vara" ${f.mountType === 'vara' ? 'selected' : ''}>Vara LX (Colgado)</option>
            <option value="calle" ${f.mountType === 'calle' ? 'selected' : ''}>Calle Lateral (Truss)</option>
            <option value="piso" ${f.mountType === 'piso' ? 'selected' : ''}>Sobre Piso (De Suelo)</option>
          </select>
        </div>
        
        ${supportControlsHTML}
        
        <hr style="border:0;border-top:1px solid var(--border);margin:8px 0;">
        
        <div class="range-group">
          <label>Giro (Pan)</label>
          <input type="range" min="-180" max="180" step="5" value="${Math.round(f.pan || 0)}" data-pan-range="${f.id}">
          <span class="range-value">${Math.round(f.pan || 0)}°</span>
        </div>
        
        <div class="range-group">
          <label>Pivote (Tilt)</label>
          <input type="range" min="0" max="90" step="5" value="${Math.round(f.tilt || 0)}" data-tilt-range="${f.id}">
          <span class="range-value">${Math.round(f.tilt || 0)}°</span>
        </div>
        
        ${colorControlHTML}
        
        <div class="range-group">
          <label>Intensidad</label>
          <input type="range" min="0" max="100" value="${f.intensity}" data-intensity-range="${f.id}">
          <span class="range-value">${f.intensity}%</span>
        </div>
        
        <div class="range-group">
          <label>Zoom/Haz</label>
          <input type="range" min="${f.minAngle || 2}" max="${f.maxAngle || 70}" value="${Math.round(f.beamAngle)}" data-angle-range="${f.id}">
          <span class="range-value">${Math.round(f.beamAngle)}°</span>
        </div>
      </div>
      ` : ''}
    `;
    
    card.addEventListener('click', e => {
      if (e.target.closest('input, select, button')) return;
      selectedFixtureId = f.id;
      renderFixturePanel();
      draw();
    });
    
    list.appendChild(card);
  });
  
  list.querySelectorAll('[data-del-btn]').forEach(btn => {
    btn.addEventListener('click', e => {
      const fid = parseInt(e.target.dataset.delBtn);
      fixtures = fixtures.filter(f => f.id !== fid);
      if (selectedFixtureId === fid) {
        selectedFixtureId = fixtures.length > 0 ? fixtures[0].id : null;
      }
      renderFixturePanel();
      draw();
      triggerAutosave();
    });
  });
  
  list.querySelectorAll('[data-channel-input]').forEach(input => {
    input.addEventListener('input', e => {
      const f = fixtures.find(f => f.id === parseInt(e.target.dataset.channelInput));
      if (f) {
        f.channel = parseInt(e.target.value) || null;
        triggerAutosave();
      }
    });
  });
  
  list.querySelectorAll('[data-dmx-input]').forEach(input => {
    input.addEventListener('input', e => {
      const f = fixtures.find(f => f.id === parseInt(e.target.dataset.dmxInput));
      if (f) {
        f.dmxAddress = e.target.value;
        triggerAutosave();
      }
    });
  });
  
  list.querySelectorAll('[data-purpose-input]').forEach(input => {
    input.addEventListener('input', e => {
      const f = fixtures.find(f => f.id === parseInt(e.target.dataset.purposeInput));
      if (f) {
        f.purpose = e.target.value;
        triggerAutosave();
      }
    });
  });

  list.querySelectorAll('[data-mount-select]').forEach(select => {
    select.addEventListener('change', e => {
      const f = fixtures.find(f => f.id === parseInt(e.target.dataset.mountSelect));
      f.mountType = e.target.value;
      if (f.mountType === 'vara') {
        const targetVara = varas[0];
        f.varaId = targetVara ? targetVara.id : 1;
        f.sym = targetVara ? targetVara.sym : 3.0;
        f.height = stageMeters.h;
        f.tilt = 35;
      } else if (f.mountType === 'piso') {
        f.height = 0.2;
        f.tilt = 70; // apuntando hacia arriba
      } else if (f.mountType === 'calle') {
        f.height = 1.8;
        f.sxm = 0; // Izquierda
        f.tilt = 45;
      }
      renderFixturePanel();
      draw();
      triggerAutosave();
    });
  });
  
  list.querySelectorAll('[data-vara-assign]').forEach(select => {
    select.addEventListener('change', e => {
      const f = fixtures.find(f => f.id === parseInt(e.target.dataset.varaAssign));
      f.varaId = parseInt(e.target.value);
      const targetVara = varas.find(v => v.id === f.varaId);
      if (targetVara) {
        f.sym = targetVara.sym;
      }
      draw();
      triggerAutosave();
    });
  });
  
  list.querySelectorAll('[data-vara-pos-range]').forEach(range => {
    range.addEventListener('input', e => {
      const f = fixtures.find(f => f.id === parseInt(e.target.dataset.varaPosRange));
      f.sxm = parseFloat(e.target.value);
      range.nextElementSibling.innerText = `${f.sxm.toFixed(1)}m`;
      draw();
      triggerAutosave();
    });
  });
  
  list.querySelectorAll('[data-side-select]').forEach(select => {
    select.addEventListener('change', e => {
      const f = fixtures.find(f => f.id === parseInt(e.target.dataset.sideSelect));
      f.sxm = e.target.value === 'izq' ? 0 : stageMeters.w;
      draw();
      triggerAutosave();
    });
  });
  
  list.querySelectorAll('[data-calle-depth-range]').forEach(range => {
    range.addEventListener('input', e => {
      const f = fixtures.find(f => f.id === parseInt(e.target.dataset.calleDepthRange));
      f.sym = parseFloat(e.target.value);
      range.nextElementSibling.innerText = `${f.sym.toFixed(1)}m`;
      draw();
      triggerAutosave();
    });
  });
  
  list.querySelectorAll('[data-calle-height-range]').forEach(range => {
    range.addEventListener('input', e => {
      const f = fixtures.find(f => f.id === parseInt(e.target.dataset.calleHeightRange));
      f.height = parseFloat(e.target.value);
      range.nextElementSibling.innerText = `${f.height.toFixed(1)}m`;
      draw();
      triggerAutosave();
    });
  });
  
  list.querySelectorAll('[data-piso-x-range]').forEach(range => {
    range.addEventListener('input', e => {
      const f = fixtures.find(f => f.id === parseInt(e.target.dataset.pisoXRange));
      f.sxm = parseFloat(e.target.value);
      range.nextElementSibling.innerText = `${f.sxm.toFixed(1)}m`;
      draw();
      triggerAutosave();
    });
  });
  
  list.querySelectorAll('[data-piso-y-range]').forEach(range => {
    range.addEventListener('input', e => {
      const f = fixtures.find(f => f.id === parseInt(e.target.dataset.pisoYRange));
      f.sym = parseFloat(e.target.value);
      range.nextElementSibling.innerText = `${f.sym.toFixed(1)}m`;
      draw();
      triggerAutosave();
    });
  });

  list.querySelectorAll('[data-pan-range]').forEach(range => {
    range.addEventListener('input', e => {
      const f = fixtures.find(f => f.id === parseInt(e.target.dataset.panRange));
      f.pan = parseInt(e.target.value);
      range.nextElementSibling.innerText = `${f.pan}°`;
      draw();
      triggerAutosave();
    });
  });

  list.querySelectorAll('[data-tilt-range]').forEach(range => {
    range.addEventListener('input', e => {
      const f = fixtures.find(f => f.id === parseInt(e.target.dataset.tiltRange));
      f.tilt = parseInt(e.target.value);
      range.nextElementSibling.innerText = `${f.tilt}°`;
      draw();
      triggerAutosave();
    });
  });
  
  list.querySelectorAll('[data-color-picker]').forEach(picker => {
    picker.addEventListener('input', e => {
      const f = fixtures.find(f => f.id === parseInt(e.target.dataset.colorPicker));
      f.color = e.target.value;
      picker.closest('.fixture-card').style.setProperty('--glow-color', f.color);
      draw();
      triggerAutosave();
    });
  });

  list.querySelectorAll('[data-gel-picker]').forEach(select => {
    select.addEventListener('change', e => {
      const f = fixtures.find(f => f.id === parseInt(e.target.dataset.gelPicker));
      const gel = GELS.find(g => g.id === e.target.value);
      if (gel) {
        f.gelId = gel.id;
        f.gelCode = gel.code;
        f.color = gel.hex;
        select.closest('.fixture-card').style.setProperty('--glow-color', f.color);
        draw();
        triggerAutosave();
      }
    });
  });

  list.querySelectorAll('[data-intensity-range]').forEach(range => {
    range.addEventListener('input', e => {
      const f = fixtures.find(f => f.id === parseInt(e.target.dataset.intensityRange));
      f.intensity = parseInt(e.target.value);
      range.nextElementSibling.innerText = `${f.intensity}%`;
      draw();
      triggerAutosave();
    });
  });

  list.querySelectorAll('[data-height-range]').forEach(range => {
    range.addEventListener('input', e => {
      const f = fixtures.find(f => f.id === parseInt(e.target.dataset.heightRange));
      f.height = parseFloat(e.target.value);
      range.nextElementSibling.innerText = `${f.height.toFixed(1)}m`;
      draw();
      triggerAutosave();
    });
  });

  list.querySelectorAll('[data-angle-range]').forEach(range => {
    range.addEventListener('input', e => {
      const f = fixtures.find(f => f.id === parseInt(e.target.dataset.angleRange));
      f.beamAngle = parseInt(e.target.value);
      range.nextElementSibling.innerText = `${f.beamAngle}°`;
      draw();
      triggerAutosave();
    });
  });

  list.querySelectorAll('[data-strobe-btn]').forEach(btn => {
    btn.addEventListener('click', e => {
      const f = fixtures.find(f => f.id === parseInt(e.target.dataset.strobeBtn));
      f.strobe = !f.strobe;
      btn.innerText = f.strobe ? 'ON' : 'OFF';
      btn.classList.toggle('on', f.strobe);
      draw();
      triggerAutosave();
    });
  });
}

function renderObjectPanel() {
  const list = document.getElementById('objectList');
  list.innerHTML = '';
  
  if (objects.length === 0) {
    list.innerHTML = `<div class="field-tip text-center" style="text-align:center;padding:20px;">No hay personas ni objetos en escena. Utiliza los botones superiores para agregarlos.</div>`;
    return;
  }
  
  objects.forEach(o => {
    const card = document.createElement('div');
    card.className = 'fixture-card';
    const onstage = o.sxm >= 0 && o.sxm <= stageMeters.w && o.sym >= 0 && o.sym <= stageMeters.d;
    
    card.innerHTML = `
      <div class="fixture-card-header">
        <div class="fixture-card-title">
          <span>${o.type === 'persona' ? '👤 Persona' : '📦 Objeto'} ${o.id}</span>
        </div>
        <button type="button" class="fixture-card-delete" data-del-obj="${o.id}">&times;</button>
      </div>
      <div class="fixture-card-meta">
        <span>Estado: <span class="${onstage ? 'text-success' : 'text-danger'}">${onstage ? 'En escena' : 'Fuera de escena'}</span></span>
        <span>Posición: ${o.sxm.toFixed(1)}m, ${o.sym.toFixed(1)}m</span>
      </div>
    `;
    
    card.querySelector('[data-del-obj]').addEventListener('click', e => {
      const oid = parseInt(e.target.dataset.delObj);
      objects = objects.filter(o => o.id !== oid);
      renderObjectPanel();
      draw();
      triggerAutosave();
    });
    
    list.appendChild(card);
  });
}

// ---------- PROYECCIÓN Y DIBUJO PERSPECTIVA 3D ----------

// Proyecta coordenadas físicas 3D (x, y, z) a coordenadas de pantalla (px, py)
function project3D(x, y, z) {
  const cx = W / 2;
  const cy = H / 2 + 10;
  
  // Normalizar Y (profundidad): 0 es el fondo, stageMeters.d es el frente
  const t = y / stageMeters.d;
  
  // Escala en perspectiva: 0.55 en el fondo, 1.0 al frente
  const backScale = 0.55;
  const scale = backScale + (1.0 - backScale) * t;
  
  // Posición del horizonte e interpolación del piso
  const floorYBack = cy - 50;
  const floorYFront = cy + 100;
  const floorY = floorYBack + (floorYFront - floorYBack) * t;
  
  // Coordenadas X en perspectiva convergiendo al centro
  const rx = x - stageMeters.w / 2;
  const baseScale = (W - 140) / stageMeters.w;
  const px = cx + rx * baseScale * scale;
  
  // Altura Z escalada con perspectiva
  const heightScale = (H - 180) / stageMeters.h;
  const py = floorY - z * heightScale * scale;
  
  return { x: px, y: py, scale };
}

// Invierte coordenadas de pantalla (mx, my) a coordenadas físicas (x, y) de escenario en un plano Z dado
function unproject3D(mx, my, z) {
  const cx = W / 2;
  const cy = H / 2 + 10;
  const floorYBack = cy - 50;
  const floorYFront = cy + 100;
  const backScale = 0.55;
  const heightScale = (H - 180) / stageMeters.h;
  const baseScale = (W - 140) / stageMeters.w;
  
  const A = (floorYFront - floorYBack) - z * heightScale * (1.0 - backScale);
  const B = floorYBack - z * heightScale * backScale;
  
  let t = 0.5;
  if (Math.abs(A) > 0.0001) {
    t = (my - B) / A;
  }
  t = Math.max(-0.5, Math.min(1.5, t));
  
  const y = t * stageMeters.d;
  const scale = backScale + (1.0 - backScale) * t;
  const x = stageMeters.w / 2 + (mx - cx) / (baseScale * scale);
  
  return { x, y };
}

// Devuelve el punto físico target (X, Y, Z) al que apunta la luz en 3D
function getPerspFixtureTarget(f) {
  return getFixtureTarget3D(f);
}

function drawPerspStage() {
  ctx.fillStyle = '#050506';
  ctx.fillRect(0, 0, W, H);
  
  // 1. Dibujar paredes y piso del escenario
  const fBL = project3D(0, 0, 0); // Back Floor Left
  const fBR = project3D(stageMeters.w, 0, 0); // Back Floor Right
  const fFL = project3D(0, stageMeters.d, 0); // Front Floor Left
  const fFR = project3D(stageMeters.w, stageMeters.d, 0); // Front Floor Right
  
  const cBL = project3D(0, 0, stageMeters.h); // Back Ceiling Left
  const cBR = project3D(stageMeters.w, 0, stageMeters.h); // Back Ceiling Right
  const cFL = project3D(0, stageMeters.d, stageMeters.h); // Front Ceiling Left
  const cFR = project3D(stageMeters.w, stageMeters.d, stageMeters.h); // Front Ceiling Right
  
  // Piso
  ctx.fillStyle = '#0a0a0d';
  ctx.beginPath();
  ctx.moveTo(fFL.x, fFL.y);
  ctx.lineTo(fBL.x, fBL.y);
  ctx.lineTo(fBR.x, fBR.y);
  ctx.lineTo(fFR.x, fFR.y);
  ctx.closePath();
  ctx.fill();
  
  // Pared Izquierda
  ctx.fillStyle = '#08080a';
  ctx.beginPath();
  ctx.moveTo(fBL.x, fBL.y);
  ctx.lineTo(cBL.x, cBL.y);
  ctx.lineTo(cFL.x, cFL.y);
  ctx.lineTo(fFL.x, fFL.y);
  ctx.closePath();
  ctx.fill();
  
  // Pared Derecha
  ctx.fillStyle = '#08080a';
  ctx.beginPath();
  ctx.moveTo(fBR.x, fBR.y);
  ctx.lineTo(cBR.x, cBR.y);
  ctx.lineTo(cFR.x, cFR.y);
  ctx.lineTo(fFR.x, fFR.y);
  ctx.closePath();
  ctx.fill();
  
  // Pared Trasera (Foro)
  ctx.fillStyle = '#060608';
  ctx.beginPath();
  ctx.moveTo(fBL.x, fBL.y);
  ctx.lineTo(cBL.x, cBL.y);
  ctx.lineTo(cBR.x, cBR.y);
  ctx.lineTo(fBR.x, fBR.y);
  ctx.closePath();
  ctx.fill();
  
  // Techo
  ctx.fillStyle = '#0b0b0e';
  ctx.beginPath();
  ctx.moveTo(cFL.x, cFL.y);
  ctx.lineTo(cBL.x, cBL.y);
  ctx.lineTo(cBR.x, cBR.y);
  ctx.lineTo(cFR.x, cFR.y);
  ctx.closePath();
  ctx.fill();
  
  // Grilla en perspectiva en el piso (cada 1 metro)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let gx = 0; gx <= stageMeters.w; gx++) {
    const p1 = project3D(gx, 0, 0);
    const p2 = project3D(gx, stageMeters.d, 0);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
  }
  for (let gy = 0; gy <= stageMeters.d; gy++) {
    const p1 = project3D(0, gy, 0);
    const p2 = project3D(stageMeters.w, gy, 0);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
  }
  
  // Dibujar contornos del cubo escénico
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  // Aristas de la pared trasera (Foro)
  ctx.moveTo(fBL.x, fBL.y); ctx.lineTo(cBL.x, cBL.y);
  ctx.moveTo(fBR.x, fBR.y); ctx.lineTo(cBR.x, cBR.y);
  ctx.moveTo(fBL.x, fBL.y); ctx.lineTo(fBR.x, fBR.y);
  ctx.moveTo(cBL.x, cBL.y); ctx.lineTo(cBR.x, cBR.y);
  // Aristas laterales de techo y piso
  ctx.moveTo(cBL.x, cBL.y); ctx.lineTo(cFL.x, cFL.y);
  ctx.moveTo(cBR.x, cBR.y); ctx.lineTo(cFR.x, cFR.y);
  ctx.moveTo(fBL.x, fBL.y); ctx.lineTo(fFL.x, fFL.y);
  ctx.moveTo(fBR.x, fBR.y); ctx.lineTo(fFR.x, fFR.y);
  ctx.stroke();
  
  // Embocadura / Marco de Proscenio (Borde frontal completo)
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.6)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  // Lado izquierdo
  ctx.moveTo(fFL.x, fFL.y);
  ctx.lineTo(cFL.x, cFL.y);
  // Arco superior
  ctx.lineTo(cFR.x, cFR.y);
  // Lado derecho
  ctx.lineTo(fFR.x, fFR.y);
  ctx.stroke();
  
  // 2. Dibujar Varas de iluminación arriba (LX pipes) desde el estado global `varas`
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 2.5;
  varas.forEach(v => {
    const vL = project3D(0.2, v.sym, stageMeters.h);
    const vR = project3D(stageMeters.w - 0.2, v.sym, stageMeters.h);
    
    ctx.beginPath();
    ctx.moveTo(vL.x, vL.y);
    ctx.lineTo(vR.x, vR.y);
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = '600 7px Inter';
    ctx.textAlign = 'right';
    ctx.fillText(v.name, vL.x - 6, vL.y + 2.5);
  });

  // 3. Dibujar Calles (Trusses laterales)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1.5;
  const numCalles = 2;
  for (let i = 1; i <= numCalles; i++) {
    const cy = (stageMeters.d / (numCalles + 1)) * i;
    // Izquierda
    const cILBase = project3D(0, cy, 0);
    const cILTop = project3D(0, cy, 4.0);
    ctx.beginPath(); ctx.moveTo(cILBase.x, cILBase.y); ctx.lineTo(cILTop.x, cILTop.y); ctx.stroke();
    // Derecha
    const cDLBase = project3D(stageMeters.w, cy, 0);
    const cDLTop = project3D(stageMeters.w, cy, 4.0);
    ctx.beginPath(); ctx.moveTo(cDLBase.x, cDLBase.y); ctx.lineTo(cDLTop.x, cDLTop.y); ctx.stroke();
  }

  // Título
  ctx.fillStyle = 'rgba(255, 179, 71, 0.8)';
  ctx.font = '600 10px Inter';
  ctx.textAlign = 'left';
  ctx.fillText('PREVISUALIZACIÓN ESCÉNICA 3D (PERSPECTIVA)', 18, 22);
}

function drawPerspBeam(f) {
  const apex = project3D(f.sxm, f.sym, f.height);
  const target = getPerspFixtureTarget(f);
  
  // Radio del haz en el target
  const distZ = Math.abs(f.height - target.z);
  const rad = distZ * Math.tan(f.beamAngle * Math.PI / 180);
    
  const { r, g, b } = hexToRgb(f.color);
  const alpha = f.intensity / 100;
  
  // Dibujar elipse de impacto en perspectiva (16 pasos)
  const steps = 16;
  const points = [];
  
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    let px = target.x;
    let py = target.y;
    let pz = target.z;
    
    // Distorsión del haz según la dirección del proyector
    if (f.mountType === 'calle') {
      // Las calles proyectan en el plano YZ (altura/profundidad)
      py = target.y + rad * Math.cos(angle);
      pz = target.z + rad * Math.sin(angle);
    } else {
      // Frente, contra, cenital y piso proyectan en el plano XY (suelo/techo)
      px = target.x + rad * Math.cos(angle);
      py = target.y + rad * Math.sin(angle);
    }
    
    const screenPt = project3D(px, py, pz);
    points.push(screenPt);
  }
  
  // Dibujar volumen del haz (cono volumétrico translúcido)
  for (let i = 0; i < steps; i++) {
    ctx.beginPath();
    ctx.moveTo(apex.x, apex.y);
    ctx.lineTo(points[i].x, points[i].y);
    ctx.lineTo(points[i+1].x, points[i+1].y);
    ctx.closePath();
    
    const midX = (points[i].x + points[i+1].x) / 2;
    const midY = (points[i].y + points[i+1].y) / 2;
    
    const grad = ctx.createLinearGradient(apex.x, apex.y, midX, midY);
    grad.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.22})`);
    grad.addColorStop(0.7, `rgba(${r},${g},${b},${alpha * 0.08})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    
    ctx.fillStyle = grad;
    ctx.fill();
  }
  
  // Dibujar elipse de proyección en el suelo/superficie
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i <= steps; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.12})`;
  ctx.fill();
}

function drawPerspFixtureBody(f) {
  const isSelected = f.id === selectedFixtureId;
  const pos = project3D(f.sxm, f.sym, f.height);
  const scale = pos.scale;
  
  ctx.save();
  ctx.translate(pos.x, pos.y);
  
  // Dibujar cuerpo de la luminaria
  ctx.fillStyle = isSelected ? '#ffffff' : '#3c3c46';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  
  ctx.beginPath();
  ctx.arc(0, 0, 5 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  
  // Núcleo del color de la luz
  ctx.fillStyle = f.color;
  ctx.beginPath();
  ctx.arc(0, 0, 3 * scale, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
  
  ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(255,255,255,0.45)';
  ctx.font = `${isSelected ? '600' : 'normal'} ${7.5 * scale}px Inter`;
  ctx.textAlign = 'center';
  const label = f.mountType === 'vara' ? 'V' : f.mountType === 'calle' ? 'C' : 'P';
  ctx.fillText(`${label}${f.id}`, pos.x, pos.y - 8 * scale);
}

function drawPerspObject(o) {
  const pos = project3D(o.sxm, o.sym, 0);
  const scale = pos.scale;
  const { front, back } = calculateObjectLighting(o);
  
  const baseR = 24, baseG = 24, baseB = 28;
  
  ctx.save();
  
  // Contraluz halo
  if (back.r > 2 || back.g > 2 || back.b > 2) {
    ctx.shadowColor = `rgba(${Math.min(255, back.r * 1.8)}, ${Math.min(255, back.g * 1.8)}, ${Math.min(255, back.b * 1.8)}, 0.95)`;
    ctx.shadowBlur = 12 * scale;
  }
  
  // Cuerpo del sujeto
  ctx.fillStyle = `rgb(${Math.min(255, baseR + front.r)}, ${Math.min(255, baseG + front.g)}, ${Math.min(255, baseB + front.b)})`;
  if (o.type === 'persona') {
    drawPersonSilhouette(ctx, pos.x, pos.y, scale);
  } else {
    drawPropBox(ctx, pos.x, pos.y, scale);
  }
  
  ctx.restore();
  
  // Borde
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  if (o.type === 'persona') {
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y - 38 * scale, 6 * scale, 6 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeRect(pos.x - 14 * scale, pos.y - 24 * scale, 28 * scale, 24 * scale);
  }
}

function drawPerspView() {
  drawPerspStage();
  
  // Coleccionar elementos ordenados por profundidad Y
  const items = [];
  fixtures.forEach(f => {
    items.push({ type: 'beam', y: f.sym, ref: f });
    items.push({ type: 'fixture', y: f.sym, ref: f });
  });
  objects.forEach(o => {
    items.push({ type: 'object', y: o.sym, ref: o });
  });
  
  // Ordenar de atrás (Y=0) hacia adelante (Y=stageMeters.d)
  items.sort((a, b) => {
    if (Math.abs(a.y - b.y) < 0.01) {
      const order = { 'beam': 1, 'object': 2, 'fixture': 3 };
      return order[a.type] - order[b.type];
    }
    return a.y - b.y;
  });
  
  items.forEach(item => {
    if (item.type === 'beam') {
      ctx.globalCompositeOperation = 'lighter';
      drawPerspBeam(item.ref);
    } else if (item.type === 'fixture') {
      ctx.globalCompositeOperation = 'source-over';
      drawPerspFixtureBody(item.ref);
    } else if (item.type === 'object') {
      ctx.globalCompositeOperation = 'source-over';
      drawPerspObject(item.ref);
    }
  });
  
  ctx.globalCompositeOperation = 'source-over';
  
  // Mostrar cartel indicativo de sólo vista
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '500 9px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('Edita posiciones en vista de Planta o Perfil; esta vista es de previsualización 3D', W / 2, H - 15);
}

// ---------- RENDERIZADO DEL PANEL DE VARAS ----------
function renderVarasPanel() {
  const container = document.getElementById('varas-list-container');
  if (!container) return;
  container.innerHTML = '';
  
  varas.forEach((v, index) => {
    const row = document.createElement('div');
    row.className = 'range-group';
    row.style.marginBottom = '12px';
    row.style.flexDirection = 'column';
    row.style.alignItems = 'stretch';
    row.innerHTML = `
      <div style="display:flex; justify-content:space-between; width:100%; align-items:center; margin-bottom:4px;">
        <span style="font-size:11px; font-weight:600; color:var(--text-light);">${v.name}</span>
        ${v.isFrontal ? '' : `<button type="button" class="btn-delete-vara" data-index="${index}" style="background:none; border:none; color:var(--ink-dim); font-size:14px; cursor:pointer;" title="Eliminar Vara">&times;</button>`}
      </div>
      <div style="display:flex; align-items:center; gap:8px; width:100%;">
        <input type="range" min="0.1" max="${stageMeters.d - 0.1}" step="0.1" value="${v.sym}" data-vara-slider="${index}" style="flex:1;">
        <span style="font-size:10px; min-width:30px; text-align:right; color:var(--ink-dim);">${v.sym.toFixed(1)}m</span>
      </div>
    `;
    container.appendChild(row);
  });
  
  // Eventos de sliders de varas
  container.querySelectorAll('[data-vara-slider]').forEach(slider => {
    slider.addEventListener('input', e => {
      const idx = parseInt(e.target.dataset.varaSlider);
      const val = parseFloat(e.target.value);
      varas[idx].sym = val;
      
      // Sincronizar profundidad de focos acoplados a esta vara
      fixtures.forEach(f => {
        if (f.mountType === 'vara' && f.varaId === varas[idx].id) {
          f.sym = val;
        }
      });
      
      draw();
      triggerAutosave();
    });
  });
  
  // Evento de eliminación de vara
  container.querySelectorAll('.btn-delete-vara').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = parseInt(e.target.dataset.index);
      const deletedVara = varas[idx];
      
      // Desacoplar luces de la vara eliminada cambiándolas a modo Piso
      fixtures.forEach(f => {
        if (f.mountType === 'vara' && f.varaId === deletedVara.id) {
          f.mountType = 'piso';
          f.height = 0.2;
          f.tilt = 70;
        }
      });
      
      varas.splice(idx, 1);
      renderVarasPanel();
      renderFixturePanel();
      draw();
      triggerAutosave();
    });
  });
}

// ---------- VISTA DE FICHA TÉCNICA (PATCH) ----------
function renderPatchView() {
  const container = document.getElementById('patch-view-container');
  if (!container) return;
  
  if (fixtures.length === 0) {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--ink-dim); gap:12px;">
        <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none"><path d="M12 20h9M3 20v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8M3 10V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"/></svg>
        <span style="font-size:14px; font-weight:500;">No hay focos agregados al escenario</span>
        <p style="font-size:12px; max-width:280px; text-align:center; margin:0;">Agrega focos desde el catálogo para visualizar la planilla de canales aquí.</p>
      </div>
    `;
    return;
  }
  
  const sorted = [...fixtures].sort((a, b) => (a.channel || 0) - (b.channel || 0));
  
  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <h3 style="font-size:15px; font-weight:600; color:#fff; margin:0;">Planilla de Canales (Patch Técnico)</h3>
      <button type="button" class="btn btn-outline btn-sm" id="btn-print-patch" style="font-size:11px; padding:4px 8px;">Imprimir Planilla</button>
    </div>
    <table class="patch-table" style="width:100%; border-collapse:collapse; text-align:left; font-size:12px; color:#e0e0ea;">
      <thead>
        <tr style="border-bottom:1.5px solid var(--border); color:#a0a0b0;">
          <th style="padding:10px 8px; width:80px;">Canal</th>
          <th style="padding:10px 8px;">Luminaria</th>
          <th style="padding:10px 8px;">Montaje/Soporte</th>
          <th style="padding:10px 8px;">Color / Gel</th>
          <th style="padding:10px 8px; width:100px;">Dirección DMX</th>
          <th style="padding:10px 8px;">Propósito / Apuntamiento</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  sorted.forEach(f => {
    let supportDesc = '';
    if (f.mountType === 'vara') {
      const v = varas.find(x => x.id === f.varaId);
      supportDesc = v ? `${v.name} (Y: ${v.sym.toFixed(1)}m)` : 'Vara LX';
    } else if (f.mountType === 'calle') {
      supportDesc = `Calle ${f.sxm < stageMeters.w / 2 ? 'Izquierda' : 'Derecha'}`;
    } else {
      supportDesc = `Piso (X: ${f.sxm.toFixed(1)}m, Y: ${f.sym.toFixed(1)}m)`;
    }
    
    let gelLabel = f.gelCode || 'Sin Gel';
    if (f.type === 'led') {
      gelLabel = `RGBW (${f.color})`;
    }
    
    html += `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.05);" data-fix-id="${f.id}">
        <td style="padding:8px;">
          <input type="number" class="patch-input patch-channel" value="${f.channel || ''}" placeholder="--" style="width:60px; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:#fff; border-radius:3px; padding:3px 6px; text-align:center; font-size:11px;">
        </td>
        <td style="padding:8px; font-weight:500;">${f.name}</td>
        <td style="padding:8px; color:#a0a0b0;">${supportDesc}</td>
        <td style="padding:8px;">
          <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${f.color}; vertical-align:middle; margin-right:6px; border:1px solid rgba(255,255,255,0.2);"></span>
          ${gelLabel}
        </td>
        <td style="padding:8px;">
          <input type="text" class="patch-input patch-dmx" value="${f.dmxAddress || ''}" placeholder="--" style="width:80px; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:#fff; border-radius:3px; padding:3px 6px; text-align:center; font-size:11px;">
        </td>
        <td style="padding:8px;">
          <input type="text" class="patch-input patch-purpose" value="${f.purpose || ''}" placeholder="Puntería del haz..." style="width:100%; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:#fff; border-radius:3px; padding:3px 6px; font-size:11px;">
        </td>
      </tr>
    `;
  });
  
  html += `
      </tbody>
    </table>
  `;
  
  container.innerHTML = html;
  
  container.querySelectorAll('tr[data-fix-id]').forEach(tr => {
    const fid = parseInt(tr.dataset.fixId);
    const f = fixtures.find(x => x.id === fid);
    if (!f) return;
    
    tr.querySelector('.patch-channel').addEventListener('input', e => {
      f.channel = parseInt(e.target.value) || null;
      triggerAutosave();
    });
    tr.querySelector('.patch-dmx').addEventListener('input', e => {
      f.dmxAddress = e.target.value;
      triggerAutosave();
    });
    tr.querySelector('.patch-purpose').addEventListener('input', e => {
      f.purpose = e.target.value;
      triggerAutosave();
    });
  });
  
  document.getElementById('btn-print-patch').addEventListener('click', () => {
    window.print();
  });
}

// ---------- GESTIÓN DE ESCENAS (CUES) ----------
function renderCueList() {
  const container = document.getElementById('cueList');
  if (!container) return;
  
  if (cues.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:24px 8px; color:var(--ink-dim); font-size:11px;">
        No hay escenas grabadas.<br>Configura la iluminación y presiona "+ Grabar Escena".
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  cues.forEach((cue, index) => {
    const card = document.createElement('div');
    card.className = 'fixture-card';
    card.style = 'padding:10px 12px; display:flex; flex-direction:column; gap:6px; background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:4px; margin-bottom:8px; box-sizing:border-box;';
    
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <span style="font-weight:600; font-size:12px; color:#fff;">Cue ${index + 1}: ${cue.name}</span>
        <button type="button" class="btn-delete-cue" data-index="${index}" style="background:none; border:none; color:var(--ink-dim); font-size:16px; cursor:pointer;" title="Eliminar Escena">&times;</button>
      </div>
      <div style="font-size:10px; color:var(--ink-dim); display:flex; gap:12px;">
        <span>${Object.keys(cue.intensities).length} Focos</span>
        <span>Fade: ${cue.fadeTime}s</span>
      </div>
      <div style="display:flex; gap:6px; margin-top:4px; width:100%;">
        <button type="button" class="btn btn-xs btn-primary play-cue-btn" data-index="${index}" style="flex:1; font-size:10px; padding:3px 6px;">▶ Reproducir</button>
        <button type="button" class="btn btn-xs btn-outline update-cue-btn" data-index="${index}" style="flex:1; font-size:10px; padding:3px 6px;" title="Sobrescribir con estado actual">Actualizar</button>
      </div>
    `;
    
    card.querySelector('.play-cue-btn').addEventListener('click', () => {
      fadeToCue(cue);
    });
    
    card.querySelector('.update-cue-btn').addEventListener('click', () => {
      showConfirm(
        '¿Actualizar Escena?',
        `¿Sobrescribir la escena "${cue.name}" con el estado de luces actual del escenario?`,
        () => {
          const intensities = {};
          const colors = {};
          fixtures.forEach(f => {
            intensities[f.id] = f.intensity;
            colors[f.id] = f.color;
          });
          cue.intensities = intensities;
          cue.colors = colors;
          cue.fadeTime = parseFloat(document.getElementById('cue-fade-time').value) || 1.5;
          renderCueList();
          triggerAutosave();
        }
      );
    });
    
    card.querySelector('.btn-delete-cue').addEventListener('click', e => {
      e.stopPropagation();
      showConfirm(
        '¿Eliminar Escena?',
        `¿Estás seguro de que deseas eliminar la escena "${cue.name}"?`,
        () => {
          cues.splice(index, 1);
          renderCueList();
          triggerAutosave();
        }
      );
    });
    
    container.appendChild(card);
  });
}

function fadeToCue(cue) {
  if (currentFadeInterval) {
    cancelAnimationFrame(currentFadeInterval);
  }
  
  const durationMs = (parseFloat(document.getElementById('cue-fade-time').value) || cue.fadeTime || 1.5) * 1000;
  if (durationMs <= 0) {
    fixtures.forEach(f => {
      if (cue.intensities[f.id] !== undefined) f.intensity = cue.intensities[f.id];
      if (cue.colors[f.id] !== undefined) f.color = cue.colors[f.id];
    });
    draw();
    renderFixturePanel();
    return;
  }
  
  const startTime = performance.now();
  const startState = fixtures.map(f => ({
    id: f.id,
    intensity: f.intensity,
    rgb: hexToRgb(f.color) || { r: 255, g: 179, b: 71 }
  }));
  
  function updateFade(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1.0, elapsed / durationMs);
    
    const ease = 0.5 - 0.5 * Math.cos(progress * Math.PI);
    
    fixtures.forEach(f => {
      const start = startState.find(s => s.id === f.id);
      if (!start) return;
      
      const targetIntensity = cue.intensities[f.id] !== undefined ? cue.intensities[f.id] : f.intensity;
      f.intensity = start.intensity + (targetIntensity - start.intensity) * ease;
      
      const targetColorHex = cue.colors[f.id] || f.color;
      const targetRgb = hexToRgb(targetColorHex) || { r: 255, g: 179, b: 71 };
      const r = Math.round(start.rgb.r + (targetRgb.r - start.rgb.r) * ease);
      const g = Math.round(start.rgb.g + (targetRgb.g - start.rgb.g) * ease);
      const b = Math.round(start.rgb.b + (targetRgb.b - start.rgb.b) * ease);
      f.color = rgbToHex(r, g, b);
    });
    
    draw();
    renderFixturePanel();
    
    if (progress < 1.0) {
      currentFadeInterval = requestAnimationFrame(updateFade);
    } else {
      currentFadeInterval = null;
    }
  }
  
  currentFadeInterval = requestAnimationFrame(updateFade);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
