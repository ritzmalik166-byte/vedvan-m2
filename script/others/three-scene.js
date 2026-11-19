/* ==========================================================================
   Vedvan — Three.js ambient scene (ES module, loaded on demand by core.js)
   Only fetched when a page contains an element such as:
     <div data-three-scene data-count="600" data-color="#d4b483"></div>
   Renders drifting light particles ("pollen") on a transparent canvas.
   Pauses off-screen, renders one still frame for reduced motion, and shares
   GSAP's ticker instead of starting its own animation loop.
   ========================================================================== */
import * as THREE from 'three';

function createDotTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function mountScene(el, { reducedMotion = false, maxPixelRatio = 1.75 } = {}) {
  const count = Math.min(Number(el.dataset.count) || 600, 3000);
  const color = el.dataset.color || '#d4b483';

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
  renderer.domElement.setAttribute('aria-hidden', 'true');
  Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.z = 12;

  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 24;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 14;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const texture = createDotTexture();
  const material = new THREE.PointsMaterial({
    color,
    size: 0.12,
    map: texture,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);

  function resize() {
    const width = el.clientWidth || 1;
    const height = el.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  let visible = true;
  function tick(time) {
    if (!visible) return;
    const t = typeof time === 'number' ? time : performance.now() / 1000;
    points.rotation.y = t * 0.02;
    points.position.y = Math.sin(t * 0.3) * 0.25;
    renderer.render(scene, camera);
  }

  const gsap = window.gsap;
  if (!reducedMotion) {
    if (gsap) gsap.ticker.add(tick);
    else renderer.setAnimationLoop((ms) => tick(ms / 1000));
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(el);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  visibilityObserver.observe(el);
  resize();

  return function destroy() {
    if (gsap) gsap.ticker.remove(tick);
    renderer.setAnimationLoop(null);
    resizeObserver.disconnect();
    visibilityObserver.disconnect();
    geometry.dispose();
    material.dispose();
    texture.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
