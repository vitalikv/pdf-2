import * as THREE from 'three';
import './style/main.css';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import { PanelUI } from './panelUI';

import { IsometricPdfToSvg } from './pdfToSvg';
import { PdfEditor } from './pdfEditor';

let renderer, camera, controls, labelRenderer;
export let scene, mapControlInit, container;

export let isometricPdfToSvg, pdfEditor;

init();
render();
initStart();

function init() {
  const div = document.createElement('div');
  div.innerHTML = `<div style="position: fixed; top: 70px; bottom:0; left: 0; right: 0;"></div>`;
  container = div.children[0];
  document.body.append(container);

  const bgColor = 0x263238 / 2;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(bgColor, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(1, 1.5, 1).multiplyScalar(50);
  light.shadow.mapSize.setScalar(2048);
  light.shadow.bias = -1e-4;
  light.shadow.normalBias = 0.05;
  light.castShadow = true;

  const shadowCam = light.shadow.camera;
  shadowCam.bottom = shadowCam.left = -30;
  shadowCam.top = 30;
  shadowCam.right = 45;

  const size = 30;
  const divisions = 30;

  const gridHelper = new THREE.GridHelper(size, divisions);
  scene.add(gridHelper);

  scene.add(light);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.4));

  const cameraP = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 50);
  cameraP.position.set(10, 10, -10);
  cameraP.far = 1000;
  cameraP.updateProjectionMatrix();

  const aspect = renderer.domElement.clientWidth / renderer.domElement.clientHeight;
  const d = 5;
  const cameraO = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 100000);
  cameraO.position.copy(cameraP.position.clone());
  cameraO.updateMatrixWorld();
  cameraO.updateProjectionMatrix();

  camera = cameraP;

  controls = new OrbitControls(camera, container);
  mapControlInit = { control: controls };

  window.addEventListener(
    'resize',
    function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();

      renderer.setSize(window.innerWidth, window.innerHeight);
    },
    false
  );
}

function initStart() {
  const panelUI = new PanelUI();
  panelUI.init();

  //isometricPdfToSvg = new IsometricPdfToSvg();

  pdfEditor = new PdfEditor();
}

function render() {
  requestAnimationFrame(render);

  controls.update();

  renderer.render(scene, camera);
}
