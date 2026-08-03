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
  renderFixturePanel();
  renderObjectPanel();
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
  fixtures = [
    {
      id: idCounter++,
      kind: 'fixture',
      modelId: 'par-led-18x10',
      name: 'PAR LED 18x10W RGBW 1',
      type: 'led',
      subType: 'wash',
      sxm: 2.5,
      sym: 1.5,
      height: 5.0,
      dir: 'frente',
      beamAngle: 25,
      color: '#ff3b3b',
      intensity: 85,
      strobe: false
    },
    {
      id: idCounter++,
      kind: 'fixture',
      modelId: 'par-led-18x10',
      name: 'PAR LED 18x10W RGBW 2',
      type: 'led',
      subType: 'wash',
      sxm: 5.5,
      sym: 1.5,
      height: 5.0,
      dir: 'frente',
      beamAngle: 25,
      color: '#3bff6e',
      intensity: 85,
      strobe: false
    },
    {
      id: idCounter++,
      kind: 'fixture',
      modelId: 'etc-source-four',
      name: 'Elipsoidal Source Four (Recorte)',
      type: 'conventional',
      subType: 'spot',
      sxm: 4,
      sym: 5.2,
      height: 5.5,
      dir: 'contra',
      beamAngle: 26,
      color: '#2000aa', // Congo Blue gel
      gelId: 'l181',
      gelCode: 'Lee 181',
      intensity: 90,
      strobe: false
    },
    {
      id: idCounter++,
      kind: 'fixture',
      modelId: 'fresnel-1000',
      name: 'Fresnel 1000W Frente',
      type: 'conventional',
      subType: 'wash',
      sxm: 0.3,
      sym: 3,
      height: 1.8,
      dir: 'calle-izq',
      beamAngle: 35,
      color: '#ffb347', // Sin gel (tungsteno directo)
      gelId: 'none',
      gelCode: 'Sin Gel',
      intensity: 75,
      strobe: false
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

function beamTriangle(f) {
  const { x: apexX, y: apexY, scale, floorY } = getElevFixturePos(f);
  const e = elevRect();
  
  if (isCalle(f)) {
    const depthPercent = f.sym / stageMeters.d;
    const s = 0.7 + 0.3 * depthPercent;
    // La calle cruza horizontalmente hasta el lado opuesto
    const farX = e.x + (stageMeters.w / 2) * e.scaleX + ((f.dir === 'calle-izq' ? stageMeters.w : 0) - stageMeters.w / 2) * e.scaleX * s;
    const halfSpreadPx = stageMeters.w * Math.tan(f.beamAngle * Math.PI / 180) * e.scaleY * s;
    return { 
      apex: { x: apexX, y: apexY }, 
      p1: { x: farX, y: apexY - halfSpreadPx }, 
      p2: { x: farX, y: apexY + halfSpreadPx } 
    };
  }
  
  if (f.dir === 'piso') {
    // Proyector de piso apunta hacia arriba (nadir/supina)
    const ceilingY = floorY - stageMeters.h * e.scaleY * scale;
    const spreadM = (stageMeters.h - f.height) * Math.tan(f.beamAngle * Math.PI / 180);
    const halfWpx = spreadM * e.scaleX * scale;
    return {
      apex: { x: apexX, y: apexY },
      p1: { x: apexX - halfWpx, y: ceilingY },
      p2: { x: apexX + halfWpx, y: ceilingY }
    };
  }
  
  const halfWm = f.height * Math.tan(f.beamAngle * Math.PI / 180);
  const halfWpx = halfWm * e.scaleX * scale;
  return { 
    apex: { x: apexX, y: apexY }, 
    p1: { x: apexX - halfWpx, y: floorY }, 
    p2: { x: apexX + halfWpx, y: floorY } 
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
  
  // Texto descriptivo
  ctx.fillStyle = 'rgba(255, 179, 71, 0.8)';
  ctx.font = '600 10px Inter';
  ctx.fillText(`ESCENARIO: ${stageMeters.w.toFixed(1)}m x ${stageMeters.d.toFixed(1)}m · VISTA DE PLANTA`, r.x + 8, r.y - 8);
}

function composePlanLight() {
  pctx.clearRect(0, 0, W, H);
  pctx.globalCompositeOperation = 'lighter';
  
  fixtures.forEach(f => {
    if (f.strobe && !strobePhase) return;
    const { r, g, b } = hexToRgb(f.color);
    const p = planPixel(f.sxm, f.sym);
    
    // El radio de cobertura crece según el ángulo de haz y la altura
    const rad = 25 + f.beamAngle * 4;
    const alpha = (f.intensity / 100) * (isOnstagePlan(f.sxm, f.sym) ? 1 : 0.3);
    
    const grad = pctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
    grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},${alpha * 0.4})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    
    pctx.fillStyle = grad;
    pctx.beginPath();
    pctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
    pctx.fill();
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
  ctx.fillText(`${dirLabel[f.dir]} ${f.id}`, apexX, apexY - 12 * scale);
  
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
  
  // Restablecer composite
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
  
  // 1. Verificar si arrastra asas de haz en elevación
  if (currentView === 'elev' && selectedFixtureId !== null) {
    const f = fixtures.find(f => f.id === selectedFixtureId);
    if (f) {
      const { p1, p2 } = beamTriangle(f);
      if (Math.hypot(p1.x - mx, p1.y - my) < 9) { dragTarget = { kind: 'beam', id: f.id, side: 'p1' }; return; }
      if (Math.hypot(p2.x - mx, p2.y - my) < 9) { dragTarget = { kind: 'beam', id: f.id, side: 'p2' }; return; }
    }
  }
  
  // 2. Verificar si hace click en objetos
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    const p = currentView === 'plan' ? planPixel(o.sxm, o.sym) : getElevObjectPos(o);
    const hLimit = currentView === 'plan' ? 20 : 45 * p.scale;
    if (Math.hypot(p.x - mx, p.y - my) < 22 && my > p.y - hLimit && my < p.y + 6) {
      dragTarget = { kind: 'object', id: o.id };
      dragOffset = { x: p.x - mx, y: p.y - my };
      return;
    }
  }
  
  // 3. Verificar si hace click en focos
  for (let i = fixtures.length - 1; i >= 0; i--) {
    const f = fixtures[i];
    const p = currentView === 'plan' ? planPixel(f.sxm, f.sym) : getElevFixturePos(f);
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
  
  if (dragTarget.kind === 'fixture') {
    const f = fixtures.find(f => f.id === dragTarget.id);
    if (currentView === 'plan') {
      const m = planMeters(mx + dragOffset.x, my + dragOffset.y);
      f.sxm = Math.max(-1, Math.min(stageMeters.w + 1, m.sxm));
      f.sym = Math.max(-1, Math.min(stageMeters.d + 1, m.sym));
    } else {
      const er = elevRect();
      const centerX = er.x + (stageMeters.w / 2) * er.scaleX;
      const depthPercent = f.sym / stageMeters.d;
      const scale = 0.7 + 0.3 * depthPercent;
      const floorY = er.floorY - (1 - depthPercent) * 40;
      
      if (isCalle(f)) {
        f.height = (floorY - (my + dragOffset.y)) / (er.scaleY * scale);
        f.height = Math.max(0.5, Math.min(stageMeters.h, f.height));
        f.dir = (mx + dragOffset.x) < centerX ? 'calle-izq' : 'calle-der';
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
  const angle = (idCounter * 53) % 360;
  
  const f = {
    id: idCounter++,
    kind: 'fixture',
    ...defaults,
    // Posición por defecto dispersa en escenario
    sxm: stageMeters.w / 2 + Math.cos(angle * Math.PI / 180) * 1.5,
    sym: stageMeters.d / 2 + Math.sin(angle * Math.PI / 180) * 1.0,
    height: defaults.type === 'conventional' ? 5.0 : 4.5,
    dir: 'frente'
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
    exportProjectJSON(stageMeters, fixtures, objects, projectName);
  });
  document.getElementById('json-import-input').addEventListener('change', e => {
    if (e.target.files.length === 0) return;
    importProjectJSON(e.target.files[0])
      .then(res => {
        stageMeters = res.stageMeters;
        fixtures = res.fixtures;
        objects = res.objects;
        projectName = res.projectName;
        
        // Sincronizar UI
        document.getElementById('project-name-input').value = projectName;
        document.getElementById('stageW').value = stageMeters.w;
        document.getElementById('stageD').value = stageMeters.d;
        document.getElementById('stageH').value = stageMeters.h;
        
        if (fixtures.length > 0) selectedFixtureId = fixtures[0].id;
        else selectedFixtureId = null;
        
        renderFixturePanel();
        renderObjectPanel();
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
        
        renderFixturePanel();
        renderObjectPanel();
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
      draw();
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
    const success = saveProject(stageMeters, fixtures, objects, projectName);
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
    const isSelected = f.id === selectedFixtureId;
    const card = document.createElement('div');
    card.className = `fixture-card ${isSelected ? 'selected' : ''}`;
    card.setAttribute('style', `--glow-color: ${f.color}`);
    
    // Generar bloque de color: mezclador RGB o lista de Geles
    let colorControlHTML = '';
    if (f.type === 'conventional') {
      // Proyector tradicional con filtros Gel
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
      // Proyector LED inteligente con mezclador RGB
      colorControlHTML = `
        <div class="color-picker-row">
          <label>Color Luz</label>
          <input type="color" value="${f.color}" data-color-picker="${f.id}">
          <span style="font-size:10px;color:var(--ink-dim)">RGB Inteligente</span>
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
        <span>Dir: ${dirLabel[f.dir]}</span>
        <span>Apertura: ${Math.round(f.beamAngle)}°</span>
      </div>
      
      ${isSelected ? `
      <div class="fixture-card-controls">
        <div class="range-group">
          <label>Dirección</label>
          <select data-dir-select="${f.id}" style="flex:1;padding:4px 6px;font-size:11px;">
            <option value="frente" ${f.dir === 'frente' ? 'selected' : ''}>Frente</option>
            <option value="contra" ${f.dir === 'contra' ? 'selected' : ''}>Contra</option>
            <option value="calle-izq" ${f.dir === 'calle-izq' ? 'selected' : ''}>Calle Izq.</option>
            <option value="calle-der" ${f.dir === 'calle-der' ? 'selected' : ''}>Calle Der.</option>
            <option value="cenital" ${f.dir === 'cenital' ? 'selected' : ''}>Cenital (Vara)</option>
            <option value="piso" ${f.dir === 'piso' ? 'selected' : ''}>Razante (Piso)</option>
          </select>
        </div>
        
        ${colorControlHTML}
        
        <div class="range-group">
          <label>Intensidad</label>
          <input type="range" min="0" max="100" value="${f.intensity}" data-intensity-range="${f.id}">
          <span class="range-value">${f.intensity}%</span>
        </div>
        
        <div class="range-group">
          <label>Altura</label>
          <input type="range" min="0.5" max="${stageMeters.h}" step="0.1" value="${f.height.toFixed(1)}" data-height-range="${f.id}">
          <span class="range-value">${f.height.toFixed(1)}m</span>
        </div>
        
        <div class="range-group">
          <label>Zoom/Haz</label>
          <input type="range" min="${f.minAngle || 2}" max="${f.maxAngle || 70}" value="${Math.round(f.beamAngle)}" data-angle-range="${f.id}">
          <span class="range-value">${Math.round(f.beamAngle)}°</span>
        </div>
        
        <div class="range-group" style="justify-content: space-between;">
          <span style="font-size: 11px; color: var(--ink-dim);">Estrobo</span>
          <button type="button" class="toggle-btn ${f.strobe ? 'on' : ''}" data-strobe-btn="${f.id}">${f.strobe ? 'ON' : 'OFF'}</button>
        </div>
      </div>
      ` : ''}
    `;
    
    // Seleccionar tarjeta si se hace click en el contenedor (pero no en sus inputs)
    card.addEventListener('click', e => {
      if (e.target.closest('input, select, button')) return;
      selectedFixtureId = f.id;
      renderFixturePanel();
      draw();
    });
    
    list.appendChild(card);
  });
  
  // Asignar controladores de eventos en el panel
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
  
  list.querySelectorAll('[data-dir-select]').forEach(select => {
    select.addEventListener('change', e => {
      const f = fixtures.find(f => f.id === parseInt(e.target.dataset.dirSelect));
      f.dir = e.target.value;
      
      // Ajustar alturas por defecto si se reasigna a una calle (1.8m)
      if (f.dir.startsWith('calle')) {
        f.height = 1.8;
      } else if (f.dir === 'piso') {
        f.height = 0.2; // Razante de piso
      } else if (f.dir === 'cenital') {
        f.height = stageMeters.h - 0.5; // colgado de vara
      } else {
        f.height = f.dir === 'contra' ? 5.5 : 5.0;
      }
      
      renderFixturePanel();
      draw();
      triggerAutosave();
    });
  });

  list.querySelectorAll('[data-color-picker]').forEach(picker => {
    picker.addEventListener('input', e => {
      const f = fixtures.find(f => f.id === parseInt(e.target.dataset.colorPicker));
      f.color = e.target.value;
      
      // Actualizar el color de glow en tiempo real en la tarjeta
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

// Devuelve el punto físico target (X, Y, Z) al que apunta la luz en 3D
function getPerspFixtureTarget(f) {
  let tx = f.sxm;
  let ty = f.sym;
  let tz = 0; // Suelo por defecto
  
  if (f.dir === 'frente') {
    ty = Math.max(0, f.sym - 1.5); // Apunta hacia el fondo (upstage)
  } else if (f.dir === 'contra') {
    ty = Math.min(stageMeters.d, f.sym + 1.5); // Apunta hacia adelante (downstage)
  } else if (f.dir === 'calle-izq') {
    tx = Math.min(stageMeters.w, f.sxm + 2.5); // Apunta hacia la derecha
    tz = f.height; // mantiene altura constante
  } else if (f.dir === 'calle-der') {
    tx = Math.max(0, f.sxm - 2.5); // Apunta hacia la izquierda
    tz = f.height;
  } else if (f.dir === 'cenital') {
    tz = 0; // Cenital apunta directo al suelo
  } else if (f.dir === 'piso') {
    tz = stageMeters.h; // Apunta directo al techo
  }
  
  return { x: tx, y: ty, z: tz };
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
  
  // Pared Trasera (Foro)
  ctx.fillStyle = '#070709';
  ctx.beginPath();
  ctx.moveTo(fBL.x, fBL.y);
  ctx.lineTo(cBL.x, cBL.y);
  ctx.lineTo(cBR.x, cBR.y);
  ctx.lineTo(fBR.x, fBR.y);
  ctx.closePath();
  ctx.fill();
  
  // Dibujar contornos del cubo escénico
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  // Aristas verticales traseras
  ctx.moveTo(fBL.x, fBL.y); ctx.lineTo(cBL.x, cBL.y);
  ctx.moveTo(fBR.x, fBR.y); ctx.lineTo(cBR.x, cBR.y);
  // Aristas horizontales traseras
  ctx.moveTo(fBL.x, fBL.y); ctx.lineTo(fBR.x, fBR.y);
  ctx.moveTo(cBL.x, cBL.y); ctx.lineTo(cBR.x, cBR.y);
  ctx.stroke();
  
  // Embocadura (Borde frontal)
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fFL.x, fFL.y);
  ctx.lineTo(fFR.x, fFR.y);
  ctx.stroke();
  
  // 2. Dibujar Varas de iluminación arriba (LX pipes)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 2.5;
  const numVaras = 4;
  for (let i = 1; i <= numVaras; i++) {
    // Varas distribuidas por profundidad
    const vy = (stageMeters.d / (numVaras + 1)) * i;
    const vL = project3D(0.2, vy, stageMeters.h);
    const vR = project3D(stageMeters.w - 0.2, vy, stageMeters.h);
    
    ctx.beginPath();
    ctx.moveTo(vL.x, vL.y);
    ctx.lineTo(vR.x, vR.y);
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = '600 7px Inter';
    ctx.textAlign = 'right';
    ctx.fillText(`Vara LX ${i}`, vL.x - 6, vL.y + 2.5);
  }
  
  // Vara frontal (fuera de escenario)
  const vfL = project3D(0.2, stageMeters.d * 1.1, stageMeters.h);
  const vfR = project3D(stageMeters.w - 0.2, stageMeters.d * 1.1, stageMeters.h);
  ctx.beginPath();
  ctx.moveTo(vfL.x, vfL.y);
  ctx.lineTo(vfR.x, vfR.y);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.textAlign = 'right';
  ctx.fillText('Vara Frontal', vfL.x - 6, vfL.y + 2.5);

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
  const rad = (f.dir === 'piso')
    ? (stageMeters.h - f.height) * Math.tan(f.beamAngle * Math.PI / 180)
    : f.height * Math.tan(f.beamAngle * Math.PI / 180);
    
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
    if (isCalle(f)) {
      // Las calles proyectan en el plano YZ (altura/profundidad)
      py = target.y + rad * Math.cos(angle);
      pz = target.z + rad * Math.sin(angle);
    } else {
      // Frente, contra y cenital proyectan en el plano XY (suelo)
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
  ctx.fillText(`${dirLabel[f.dir][0]}${f.id}`, pos.x, pos.y - 8 * scale);
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
