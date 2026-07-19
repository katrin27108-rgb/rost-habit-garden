import { createGardenCameras, type GardenCameras } from "./camera";
import { createEnvironment } from "./environment";
import { createGardenMaterials } from "./materials";
import { createLivingOak, updateLivingOak } from "./oak";
import { registerGardenShaders } from "./shaders";
import { HEALTH_TARGETS, type GardenState } from "./types";
import { createWeatherSystem } from "./weather";

export type GardenRuntime = {
  engine: any;
  scene: any;
  cameras: GardenCameras;
  dispose: () => void;
};

export function createGardenScene(B: any, canvas: HTMLCanvasElement, state: { current: GardenState }, reducedMotion: boolean): GardenRuntime {
  registerGardenShaders(B);
  const engine = new B.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, adaptToDeviceRatio: true }, true);
  engine.setHardwareScalingLevel(state.current.quality === "light" ? 1.45 : Math.min(1.25, 1 / window.devicePixelRatio));
  const scene = new B.Scene(engine);
  scene.clearColor = new B.Color4(.7, .78, .72, 1);
  scene.fogMode = B.Scene.FOGMODE_EXP2;
  scene.fogDensity = .006;
  scene.collisionsEnabled = true;
  scene.skipPointerMovePicking = true;

  const cameras = createGardenCameras(B, scene, canvas);
  scene.activeCamera = cameras.overview;

  const hemi = new B.HemisphericLight("soft sky light", new B.Vector3(0, 1, 0), scene);
  hemi.intensity = .52;
  hemi.groundColor = B.Color3.FromHexString("#4d5b43");
  const sun = new B.DirectionalLight("warm morning sun", new B.Vector3(-.52, -1, .34), scene);
  sun.position.set(18, 28, -15);
  sun.intensity = 1.08;
  const shadow = new B.CascadedShadowGenerator(state.current.quality === "full" ? 2048 : 1024, sun);
  shadow.lambda = .72;
  shadow.stabilizeCascades = true;
  shadow.autoCalcDepthBounds = true;
  shadow.usePercentageCloserFiltering = true;
  shadow.filteringQuality = state.current.quality === "full" ? B.ShadowGenerator.QUALITY_HIGH : B.ShadowGenerator.QUALITY_LOW;

  const materials = createGardenMaterials(B, scene);
  const environment = createEnvironment(B, scene, materials, shadow, state.current.quality);
  const oak = createLivingOak(B, scene, materials, shadow, state.current.quality);
  const weather = createWeatherSystem(B, scene, environment, sun, hemi);

  const pipeline = new B.DefaultRenderingPipeline("soft cinematic garden", true, scene, [cameras.overview, cameras.walk]);
  pipeline.samples = state.current.quality === "full" ? 4 : 1;
  pipeline.fxaaEnabled = true;
  pipeline.sharpenEnabled = true;
  pipeline.sharpen.edgeAmount = .18;
  pipeline.bloomEnabled = state.current.quality === "full";
  pipeline.bloomWeight = .12;
  pipeline.bloomThreshold = .92;

  const resize = () => engine.resize();
  window.addEventListener("resize", resize);
  let currentGrowth = state.current.growth / 100;
  let currentHealth = HEALTH_TARGETS[state.current.health];
  let lastView = state.current.view;
  let last = performance.now();
  let accumulated = 0;
  engine.runRenderLoop(() => {
    const now = performance.now();
    const delta = Math.min(50, now - last);
    last = now;
    accumulated += delta;
    if (reducedMotion && accumulated < 95) return;
    accumulated = 0;
    const targetGrowth = state.current.growth / 100;
    const targetHealth = HEALTH_TARGETS[state.current.health];
    currentGrowth += (targetGrowth - currentGrowth) * (1 - Math.exp(-delta * .0042));
    currentHealth += (targetHealth - currentHealth) * (1 - Math.exp(-delta * .0028));
    if (lastView !== state.current.view) {
      cameras.setView(state.current.view);
      lastView = state.current.view;
    }
    updateLivingOak(B, oak, currentGrowth, currentHealth, now, reducedMotion);
    weather.update(state.current.weather, now);
    scene.render();
  });

  return {
    engine,
    scene,
    cameras,
    dispose() {
      window.removeEventListener("resize", resize);
      scene.dispose();
      engine.dispose();
    },
  };
}
