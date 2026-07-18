export type GameNotice = { kind: "plot" | "plant" | "pond"; title: string; text: string } | null;
export type PlantKind = "tree" | "flowers" | "shrub";
export type GameWeather = "sun" | "cloud" | "rain";
export type DecorationKind = "fertilizer" | "lantern" | "birdhouse" | "bench" | "pond";
export type TimeOfDay = "day" | "evening" | "night";
export type PlacementItem =
  | { category: "plant"; kind: PlantKind; habitId: string; habitName: string; growth: number; durationDays: number }
  | { category: "decoration"; kind: DecorationKind };

export type GardenGameRuntime = {
  setGrowth(value: number): void;
  setHabitGrowth(habitId: string, value: number): void;
  setWeather(value: GameWeather): void;
  setTimeOfDay(value: TimeOfDay): void;
  beginPlacement(item: PlacementItem): void;
  cancelPlacement(): void;
  setTouchMove(x: number, z: number): void;
  interact(): void;
  dispose(): void;
};

type GameOptions = {
  growth: number;
  onReady(): void;
  onNearby(notice: GameNotice): void;
  onInteract(notice: GameNotice): void;
  onPlacementComplete(item: PlacementItem): void;
};

type Planted = {
  root: any;
  kind: PlantKind;
  habitId: string;
  habitName: string;
  durationDays: number;
  baseScale: number;
  targetGrowth: number;
  displayGrowth: number;
  position: any;
};

const ASSET_ROOT = "/free-assets/quaternius/";

export async function createGardenGame(B: any, canvas: HTMLCanvasElement, options: GameOptions): Promise<GardenGameRuntime> {
  const engine = new B.Engine(canvas, true, { antialias: true, stencil: true, preserveDrawingBuffer: false });
  engine.setHardwareScalingLevel(Math.max(1, Math.min(1.35, 1 / window.devicePixelRatio)));
  const scene = new B.Scene(engine);
  scene.clearColor = B.Color4.FromHexString("#8fd4d8ff");
  scene.fogMode = B.Scene.FOGMODE_EXP2;
  scene.fogDensity = .007;
  scene.fogColor = B.Color3.FromHexString("#b9d7c0");
  scene.collisionsEnabled = true;

  const camera = new B.ArcRotateCamera(
    "illustrated third person camera",
    -Math.PI * .52,
    .96,
    15.2,
    new B.Vector3(0, 1.2, -6.5),
    scene,
  );
  camera.fov = .68;
  camera.lowerRadiusLimit = 10.5;
  camera.upperRadiusLimit = 19;
  camera.lowerBetaLimit = .78;
  camera.upperBetaLimit = 1.28;
  camera.wheelPrecision = 38;
  camera.panningSensibility = 0;
  camera.angularSensibilityX = 3000;
  camera.angularSensibilityY = 3000;
  camera.attachControl(canvas, true);
  camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");

  const skyLight = new B.HemisphericLight("painted skylight", new B.Vector3(0, 1, 0), scene);
  skyLight.intensity = .76;
  skyLight.diffuse = B.Color3.FromHexString("#fff0c2");
  skyLight.groundColor = B.Color3.FromHexString("#315a50");
  const sun = new B.DirectionalLight("warm illustrated sun", new B.Vector3(-.55, -1, .3), scene);
  sun.position = new B.Vector3(22, 32, -18);
  sun.intensity = 1.18;
  sun.diffuse = B.Color3.FromHexString("#ffd08a");
  const shadows = new B.ShadowGenerator(2048, sun);
  shadows.useBlurExponentialShadowMap = true;
  shadows.blurKernel = 24;
  shadows.bias = .0008;

  const material = (name: string, color: string, emissive = 0) => {
    const value = new B.StandardMaterial(name, scene);
    value.diffuseColor = B.Color3.FromHexString(color);
    value.specularColor = new B.Color3(.035, .03, .04);
    value.emissiveColor = value.diffuseColor.scale(emissive);
    return value;
  };
  const palette = {
    grass: material("painted meadow", "#659458", .025),
    grassLight: material("sunny meadow patches", "#9dbb61", .035),
    grassDark: material("cool meadow patches", "#3f765d", .02),
    soil: material("warm planting soil", "#7a473a", .025),
    soilLight: material("soft bed edge", "#b86a46", .025),
    path: material("apricot garden path", "#d57650", .035),
    pathLight: material("sunlit path", "#efa25f", .045),
    stone: material("painted garden stone", "#c6b788", .03),
    stoneShade: material("mossy garden stone", "#7f8d66", .025),
    wood: material("warm painted wood", "#8c4f3d", .025),
    woodDark: material("shadowed painted wood", "#573946", .02),
    water: material("teal pond water", "#3eaaa4", .08),
    waterLight: material("pond glints", "#a2e0c7", .15),
    coral: material("coral flowers", "#ef6f61", .07),
    pink: material("pink flowers", "#f39aaa", .08),
    yellow: material("sunny flowers", "#f7d66d", .08),
    purple: material("violet flowers", "#9c73c8", .07),
    leaf: material("painted leaf", "#3c8a62", .03),
  };

  registerSky(B);
  const skyMaterial = new B.ShaderMaterial("hand painted sky", scene, { vertex: "rostSky", fragment: "rostSky" }, {
    attributes: ["position"], uniforms: ["worldViewProjection", "weather", "night"],
  });
  skyMaterial.backFaceCulling = false;
  skyMaterial.setFloat("weather", 0);
  skyMaterial.setFloat("night", 0);
  const sky = B.MeshBuilder.CreateSphere("painted sky dome", { diameter: 140, segments: 28, sideOrientation: B.Mesh.BACKSIDE }, scene);
  sky.material = skyMaterial;
  sky.infiniteDistance = true;
  sky.isPickable = false;

  const sunDiscMaterial = material("sun glow", "#ffd36b", .75);
  sunDiscMaterial.disableLighting = true;
  const sunDisc = B.MeshBuilder.CreateSphere("visible soft sun", { diameter: 5.5, segments: 24 }, scene);
  sunDisc.position.set(-32, 31, 38);
  sunDisc.material = sunDiscMaterial;
  const moonMaterial = material("moon glow", "#d8e7ff", .85);
  moonMaterial.disableLighting = true;
  const moonDisc = B.MeshBuilder.CreateSphere("visible moon", { diameter: 4.4, segments: 24 }, scene);
  moonDisc.position.set(30, 27, 38);
  moonDisc.material = moonMaterial;
  moonDisc.setEnabled(false);

  const cloudMaterial = material("warm clouds", "#fff2d4", .25);
  cloudMaterial.alpha = .88;
  const cloudRoots = Array.from({ length: 7 }, (_, index) => createCloud(B, scene, cloudMaterial, index));

  const ground = B.MeshBuilder.CreateGround("endless illustrated meadow", { width: 110, height: 100, subdivisions: 2 }, scene);
  ground.material = palette.grass;
  ground.receiveShadows = true;
  ground.checkCollisions = true;

  createMeadowPatches(B, scene, palette, shadows);
  createDistantWorld(B, scene, palette, shadows);
  createPath(B, scene, palette);
  createFence(B, scene, palette, shadows);
  const pond = createPond(B, scene, palette, shadows);
  createSunroom(B, scene, palette, shadows);

  const player = B.MeshBuilder.CreateCapsule("player collider", { radius: .38, height: 1.75 }, scene);
  player.position.set(0, .9, -9.4);
  player.isVisible = false;
  player.checkCollisions = true;
  player.ellipsoid = new B.Vector3(.38, .9, .38);
  const playerModel = await loadCharacter(B, scene, player, shadows);

  const [treeSource, shrubSource, flowerSource] = await Promise.all([
    loadFreeSource(B, scene, shadows, "BirchTree_1.gltf", "free birch source"),
    loadFreeSource(B, scene, shadows, "Bush_Large_Flowers.gltf", "free flowering shrub source"),
    loadFreeSource(B, scene, shadows, "Flower_1_Clump.gltf", "free flower source"),
  ]);

  decorateBoundaries(B, scene, palette, shadows, treeSource, shrubSource, flowerSource);

  const rainTexture = makeRainTexture(B, scene);
  const rain = new B.ParticleSystem("soft garden rain", 1300, scene);
  rain.particleTexture = rainTexture;
  rain.emitter = new B.Vector3(0, 18, 0);
  rain.minEmitBox = new B.Vector3(-17, 0, -15);
  rain.maxEmitBox = new B.Vector3(17, 0, 15);
  rain.direction1 = new B.Vector3(-.5, -20, 0);
  rain.direction2 = new B.Vector3(.5, -24, .35);
  rain.minLifeTime = .62;
  rain.maxLifeTime = 1;
  rain.minSize = .065;
  rain.maxSize = .12;
  rain.emitRate = 1500;
  rain.minSize = .085;
  rain.maxSize = .17;
  rain.stop();

  const pipeline = new B.DefaultRenderingPipeline("illustrated garden finish", true, scene, [camera]);
  pipeline.fxaaEnabled = true;
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = .82;
  pipeline.bloomWeight = .16;
  pipeline.imageProcessingEnabled = true;
  pipeline.imageProcessing.contrast = 1.28;
  pipeline.imageProcessing.exposure = .88;
  pipeline.imageProcessing.toneMappingEnabled = true;
  pipeline.imageProcessing.vignetteEnabled = true;
  pipeline.imageProcessing.vignetteWeight = 1.1;
  pipeline.imageProcessing.vignetteColor = B.Color4.FromHexString("#2a364944");

  const keys = new Set<string>();
  let touchX = 0;
  let touchZ = 0;
  let nearby: GameNotice = null;
  let activeAnimation = "";
  let initialHabitGrowth = options.growth;
  let weather: GameWeather = "sun";
  let timeOfDay: TimeOfDay = "day";
  let placement: { item: PlacementItem; preview: any; position: any; valid: boolean } | null = null;
  let decorationSerial = 0;
  const planted: Planted[] = [];

  const onKeyDown = (event: KeyboardEvent) => {
    keys.add(event.key.toLowerCase());
    if (event.key.toLowerCase() === "e") interact();
    if (event.key === "Escape") cancelPlacement();
  };
  const onKeyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  const interact = () => { if (nearby) options.onInteract(nearby); };
  const setHabitGrowth = (habitId: string, value: number) => {
    const entry = planted.find((plant) => plant.habitId === habitId);
    if (entry) entry.targetGrowth = value;
    if (habitId === "water") initialHabitGrowth = value;
  };
  const setGrowth = (value: number) => setHabitGrowth("water", value);
  const applyGrowth = () => {
    planted.forEach((entry) => {
      const t = Math.max(.03, Math.min(1, entry.displayGrowth / 100));
      const eased = t * t * (3 - 2 * t);
      const scale = entry.baseScale * (.08 + eased * .92);
      entry.root.scaling.setAll(scale);
      entry.root.position.y = .02 - (1 - eased) * .12;
    });
  };

  const createPlantAt = (item: Extract<PlacementItem, { category: "plant" }>, position: any) => {
    const { kind } = item;
    let root: any;
    let baseScale = 1;
    if (kind === "tree") {
      root = cloneSource(treeSource, `habit birch ${planted.length}`);
      baseScale = 1.08;
    } else if (kind === "shrub") {
      root = cloneSource(shrubSource, `habit shrub ${planted.length}`);
      baseScale = 1.35;
    } else {
      root = createStylizedFlowerGarden(B, scene, palette, shadows, `habit flower garden ${planted.length}`);
      baseScale = 1;
    }
    root.position.copyFrom(position);
    root.rotation.y = planted.length * 1.17;
    root.metadata = { interactive: "plant", habitId: item.habitId };
    planted.push({
      root,
      kind,
      habitId: item.habitId,
      habitName: item.habitName,
      durationDays: item.durationDays,
      baseScale,
      targetGrowth: item.growth,
      displayGrowth: item.growth,
      position: position.clone(),
    });
    applyGrowth();
  };
  const isValidPlacement = (position: any) => {
    const outside = Math.abs(position.x) > 13.7 || position.z < -11.8 || position.z > 11.4;
    const inPond = ((position.x + 9.2) ** 2 / 21 + (position.z - 3.2) ** 2 / 13) < 1;
    const nearRoom = B.Vector3.Distance(position, new B.Vector3(10.2, 0, 9.8)) < 3.6;
    const nearPlayer = B.Vector3.Distance(position, new B.Vector3(player.position.x, 0, player.position.z)) < 1.2;
    return !outside && !inPond && !nearRoom && !nearPlayer;
  };
  const cancelPlacement = () => {
    if (!placement) return;
    placement.preview.dispose(false, true);
    placement = null;
    camera.attachControl(canvas, true);
  };
  const beginPlacement = (item: PlacementItem) => {
    cancelPlacement();
    camera.detachControl();
    const preview = createPlacementPreview(B, scene, palette, item);
    const initial = new B.Vector3(player.position.x, .04, Math.min(10.8, player.position.z + 3.2));
    preview.position.copyFrom(initial);
    placement = { item, preview, position: initial, valid: isValidPlacement(initial) };
    setPreviewValidity(B, preview, placement.valid);
  };
  const placeCurrent = () => {
    if (!placement?.valid) return;
    const { item, position, preview } = placement;
    const exact = position.clone();
    preview.dispose(false, true);
    placement = null;
    camera.attachControl(canvas, true);
    if (item.category === "plant") createPlantAt(item, exact);
    else if (item.kind === "fertilizer") createMagicBurst(B, scene, palette, exact);
    else if (item.kind === "lantern") createLantern(B, scene, palette, shadows, exact, decorationSerial++);
    else if (item.kind === "birdhouse") createBirdhouse(B, scene, palette, shadows, exact, decorationSerial++);
    else if (item.kind === "bench") createBench(B, scene, palette, shadows, exact, decorationSerial++);
    else createMiniPond(B, scene, palette, shadows, exact, decorationSerial++);
    options.onPlacementComplete(item);
  };

  scene.onPointerObservable.add((pointerInfo: any) => {
    if (!placement) return;
    if (pointerInfo.type === B.PointerEventTypes.POINTERMOVE || pointerInfo.type === B.PointerEventTypes.POINTERDOWN) {
      const pick = scene.pick(scene.pointerX, scene.pointerY, (mesh: any) => mesh === ground);
      if (pick?.hit && pick.pickedPoint) {
        placement.position = new B.Vector3(pick.pickedPoint.x, .04, pick.pickedPoint.z);
        placement.preview.position.copyFrom(placement.position);
        placement.valid = isValidPlacement(placement.position);
        setPreviewValidity(B, placement.preview, placement.valid);
      }
    }
    if (pointerInfo.type === B.PointerEventTypes.POINTERDOWN) placeCurrent();
  });

  const applyAtmosphere = () => {
    const night = timeOfDay === "night";
    const evening = timeOfDay === "evening";
    const nightMix = night ? 1 : evening ? .42 : 0;
    const cloudy = weather === "sun" ? 0 : weather === "cloud" ? .65 : 1;
    skyMaterial.setFloat("weather", cloudy);
    skyMaterial.setFloat("night", nightMix);
    sun.intensity = night ? .16 : evening ? .62 : weather === "sun" ? 1.18 : weather === "cloud" ? .72 : .44;
    skyLight.intensity = night ? .28 : evening ? .5 : weather === "sun" ? .76 : weather === "cloud" ? .64 : .54;
    scene.fogDensity = weather === "sun" ? .007 : weather === "cloud" ? .011 : .015;
    scene.fogColor = B.Color3.FromHexString(night ? "#16283c" : evening ? "#c98773" : weather === "sun" ? "#b9d7c0" : weather === "cloud" ? "#8fa8a3" : "#687f83");
    sunDisc.setEnabled(!night && weather === "sun");
    moonDisc.setEnabled(night);
    cloudMaterial.alpha = weather === "sun" ? .42 : weather === "cloud" ? .82 : .96;
    cloudMaterial.diffuseColor = B.Color3.FromHexString(night ? "#526174" : weather === "sun" ? "#fff2d4" : weather === "cloud" ? "#d4d7c8" : "#8999a0");
    cloudRoots.forEach((cloud) => cloud.scaling.setAll(weather === "sun" ? .82 : weather === "cloud" ? 1.08 : 1.24));
    pipeline.imageProcessing.exposure = night ? .56 : evening ? .72 : weather === "sun" ? .88 : weather === "cloud" ? .76 : .66;
    pipeline.imageProcessing.contrast = night ? 1.15 : weather === "sun" ? 1.28 : 1.2;
    pipeline.imageProcessing.vignetteWeight = weather === "rain" ? 1.65 : 1.1;
    palette.water.diffuseColor = B.Color3.FromHexString(night ? "#24516c" : weather === "rain" ? "#2f777d" : "#3eaaa4");
    if (weather === "rain") rain.start(); else rain.stop();
  };
  const setWeather = (value: GameWeather) => { weather = value; applyAtmosphere(); };
  const setTimeOfDay = (value: TimeOfDay) => { timeOfDay = value; applyAtmosphere(); };
  applyAtmosphere();
  createPlantAt({ category: "plant", kind: "tree", habitId: "water", habitName: "Утренний стакан воды", growth: initialHabitGrowth, durationDays: 30 }, new B.Vector3(-4.5, .04, -3.4));

  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(.035, engine.getDeltaTime() / 1000);
    planted.forEach((entry) => {
      entry.displayGrowth += (entry.targetGrowth - entry.displayGrowth) * Math.min(1, dt * 2.4);
    });
    applyGrowth();

    let x = touchX + (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
    let z = touchZ + (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
    const moving = Math.abs(x) + Math.abs(z) > .1;
    if (moving) {
      const forward = camera.getForwardRay().direction.clone();
      forward.y = 0;
      forward.normalize();
      const right = B.Vector3.Cross(B.Axis.Y, forward).normalize();
      const direction = forward.scale(z).add(right.scale(x)).normalize();
      const next = player.position.add(direction.scale(3.8 * dt));
      const outside = Math.abs(next.x) > 14.2 || next.z < -12.6 || next.z > 12.3;
      const inPond = ((next.x + 9.2) ** 2 / 18 + (next.z - 3.2) ** 2 / 10) < 1;
      if (!outside && !inPond) player.position.copyFrom(next);
      playerModel.root.rotation.y = Math.atan2(direction.x, direction.z);
    }
    const wantedAnimation = moving ? "walk" : "idle";
    if (wantedAnimation !== activeAnimation) {
      activeAnimation = wantedAnimation;
      playAnimation(playerModel.groups, wantedAnimation);
    }
    camera.target = B.Vector3.Lerp(camera.target, player.position.add(new B.Vector3(0, .75, 0)), .1);
    cloudRoots.forEach((cloud, index) => {
      const wind = weather === "rain" ? 1.9 : weather === "cloud" ? 1.25 : 1;
      cloud.position.x += dt * (.22 + index * .018) * wind;
      if (cloud.position.x > 42) cloud.position.x = -42;
    });
    pond.glints.forEach((glint: any, index: number) => {
      glint.scaling.x = .65 + Math.sin(performance.now() * .0015 + index) * .22;
      glint.position.y = .11 + Math.sin(performance.now() * .001 + index) * .012;
    });

    const plantIndex = planted.findIndex((entry) => B.Vector3.Distance(player.position, entry.position.add(new B.Vector3(0, .9, 0))) < 3);
    const pondDistance = B.Vector3.Distance(player.position, pond.root.position.add(new B.Vector3(0, .9, 0)));
    const nextNearby: GameNotice = plantIndex >= 0
        ? { kind: "plant", title: planted[plantIndex].habitName, text: `Рост растения: ${Math.round(planted[plantIndex].targetGrowth)}% из ${planted[plantIndex].durationDays} дней` }
        : pondDistance < 5.1
          ? { kind: "pond", title: "Тихий пруд", text: weather === "rain" ? "Послушать дождь" : "Остановиться у воды" }
          : null;
    if (nextNearby?.kind !== nearby?.kind || nextNearby?.title !== nearby?.title) {
      nearby = nextNearby;
      options.onNearby(nearby);
    }
  });

  engine.runRenderLoop(() => scene.render());
  const resize = () => engine.resize();
  window.addEventListener("resize", resize);
  options.onReady();

  return {
    setGrowth,
    setHabitGrowth,
    setWeather,
    setTimeOfDay,
    beginPlacement,
    cancelPlacement,
    setTouchMove(x, z) { touchX = x; touchZ = z; },
    interact,
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", resize);
      scene.dispose();
      engine.dispose();
    },
  };
}

function registerSky(B: any) {
  B.Effect.ShadersStore.rostSkyVertexShader = `
    precision highp float;
    attribute vec3 position;
    uniform mat4 worldViewProjection;
    varying vec3 vDirection;
    void main(void) { vDirection = position; gl_Position = worldViewProjection * vec4(position, 1.0); }
  `;
  B.Effect.ShadersStore.rostSkyFragmentShader = `
    precision highp float;
    varying vec3 vDirection;
    uniform float weather;
    uniform float night;
    void main(void) {
      vec3 d = normalize(vDirection);
      float h = clamp(d.y * .72 + .42, 0.0, 1.0);
      vec3 warmHorizon = vec3(.72, .88, 1.0);
      vec3 clearTop = vec3(.16, .55, .88);
      vec3 rainyHorizon = vec3(.43, .58, .59);
      vec3 rainyTop = vec3(.18, .31, .39);
      vec3 col = mix(mix(warmHorizon, clearTop, h), mix(rainyHorizon, rainyTop, h), weather);
      vec3 nightHorizon = vec3(.12, .22, .31);
      vec3 nightTop = vec3(.025, .055, .14);
      col = mix(col, mix(nightHorizon, nightTop, h), night);
      float band = sin((d.x + d.z) * 8.0 + h * 12.0) * .012;
      col += band * (1.0 - weather) * (1.0 - night);
      gl_FragColor = vec4(col, 1.0);
    }
  `;
}

function createCloud(B: any, scene: any, cloudMaterial: any, index: number) {
  const root = new B.TransformNode(`painted cloud ${index}`, scene);
  root.position.set(-32 + index * 10, 16 + (index % 2) * 2.5, 21 + (index % 3) * 6);
  const pieces = 4 + index % 3;
  for (let piece = 0; piece < pieces; piece++) {
    const puff = B.MeshBuilder.CreateSphere(`cloud ${index} puff ${piece}`, { diameter: 4.2 + (piece % 2) * 1.4, segments: 14 }, scene);
    puff.parent = root;
    puff.position.set((piece - pieces / 2) * 1.5, Math.sin(piece) * .45, (piece % 2) * .7);
    puff.scaling.y = .48;
    puff.material = cloudMaterial;
    puff.isPickable = false;
  }
  return root;
}

function createMeadowPatches(B: any, scene: any, palette: any, shadows: any) {
  const patches = [
    [-11, -7, 5.2, 2.3, .2, palette.grassDark], [10, -8, 5, 2.8, -.2, palette.grassLight],
    [9.5, 8, 5, 2.4, .25, palette.grassDark], [-4, 9, 6, 2.5, -.15, palette.grassLight],
    [-12, 7, 3.6, 2.2, .1, palette.grassLight],
  ];
  patches.forEach(([x, z, width, depth, rotation, patchMaterial], index) => {
    const patch = B.MeshBuilder.CreateDisc(`painted meadow patch ${index}`, { radius: 1, tessellation: 40 }, scene);
    patch.rotation.x = Math.PI / 2;
    patch.rotation.z = rotation;
    patch.position.set(x, .018, z);
    patch.scaling.set(width, depth, 1);
    patch.material = patchMaterial;
  });
}

function createDistantWorld(B: any, scene: any, palette: any, shadows: any) {
  const hillMaterials = [palette.grassDark, palette.grass, palette.grassLight];
  const hills = [
    [-32, 31, 18, 5], [-14, 35, 22, 6], [7, 34, 21, 5.5], [28, 31, 18, 5],
    [-38, 8, 17, 4.5], [38, 7, 18, 5], [-31, -25, 20, 5], [31, -27, 23, 5.5],
  ];
  hills.forEach(([x, z, width, height], index) => {
    const hill = B.MeshBuilder.CreateSphere(`soft distant hill ${index}`, { diameter: 2, segments: 20 }, scene);
    hill.position.set(x, height * .2 - .7, z);
    hill.scaling.set(width * .62, height * .5, width * .35);
    hill.material = hillMaterials[index % hillMaterials.length];
    hill.receiveShadows = true;
    hill.isPickable = false;
  });
  for (let index = 0; index < 18; index++) {
    const angle = index / 18 * Math.PI * 2;
    const radius = 24 + index % 3 * 3;
    const trunk = B.MeshBuilder.CreateCylinder(`distant tree trunk ${index}`, { height: 3.8 + index % 3, diameter: .34, tessellation: 7 }, scene);
    trunk.position.set(Math.cos(angle) * radius, 1.8, Math.sin(angle) * radius);
    trunk.material = palette.woodDark;
    trunk.isPickable = false;
    const crown = B.MeshBuilder.CreateSphere(`distant painted crown ${index}`, { diameter: 3.4 + index % 4 * .35, segments: 10 }, scene);
    crown.position.set(trunk.position.x, 4.4 + index % 3 * .55, trunk.position.z);
    crown.scaling.set(.85, 1.25, .75);
    crown.material = index % 3 === 0 ? palette.grassLight : palette.grassDark;
    crown.isPickable = false;
    shadows.addShadowCaster(crown);
  }
}

function createPath(B: any, scene: any, palette: any) {
  const points = [
    [0, -14], [0, -12.2], [.1, -10.4], [.2, -8.7], [.05, -7], [-.2, -5.3], [-.1, -3.5], [.1, -1.7],
    [0, 0], [-.2, 1.8], [.15, 3.6], [.4, 5.4], [.1, 7.2], [0, 9], [0, 11],
  ];
  points.forEach(([x, z], index) => {
    const stone = B.MeshBuilder.CreateCylinder(`warm path stone ${index}`, { diameter: 1.25 + (index % 3) * .13, height: .09, tessellation: 18 }, scene);
    stone.position.set(x, .055, z);
    stone.scaling.z = .62;
    stone.rotation.y = (index % 2 ? -.12 : .1);
    stone.material = index % 4 === 0 ? palette.pathLight : palette.path;
    stone.receiveShadows = true;
  });
}

function createFence(B: any, scene: any, palette: any, shadows: any) {
  const makeSegment = (x: number, z: number, rotate: boolean, index: number) => {
    const root = new B.TransformNode(`garden fence segment ${index}`, scene);
    root.position.set(x, 0, z);
    root.rotation.y = rotate ? Math.PI / 2 : 0;
    for (const postX of [-1.45, 1.45]) {
      const post = B.MeshBuilder.CreateCylinder(`fence post ${index}-${postX}`, { height: 1.55, diameter: .2, tessellation: 8 }, scene);
      post.parent = root;
      post.position.set(postX, .76, 0);
      post.material = palette.woodDark;
      shadows.addShadowCaster(post);
    }
    for (const y of [.5, 1.05]) {
      const rail = B.MeshBuilder.CreateBox(`fence rail ${index}-${y}`, { width: 3, height: .12, depth: .14 }, scene);
      rail.parent = root;
      rail.position.y = y;
      rail.rotation.z = (index % 2 ? -.02 : .025);
      rail.material = palette.wood;
      shadows.addShadowCaster(rail);
    }
  };
  let index = 0;
  for (let x = -13.5; x <= 13.5; x += 3) makeSegment(x, 13.1, false, index++);
  for (let z = -10; z <= 10; z += 3) {
    makeSegment(-15.2, z, true, index++);
    makeSegment(15.2, z, true, index++);
  }
}

function createPond(B: any, scene: any, palette: any, shadows: any) {
  const root = new B.TransformNode("illustrated garden pond", scene);
  root.position.set(-9.2, 0, 3.2);
  const water = B.MeshBuilder.CreateCylinder("painted pond water", { diameter: 7.2, height: .09, tessellation: 64 }, scene);
  water.parent = root;
  water.scaling.z = .68;
  water.position.y = .04;
  water.material = palette.water;
  for (let index = 0; index < 20; index++) {
    const angle = index / 20 * Math.PI * 2;
    const rock = B.MeshBuilder.CreateIcoSphere(`pond edge stone ${index}`, { radius: .42 + index % 3 * .055, subdivisions: 2 }, scene);
    rock.parent = root;
    rock.position.set(Math.cos(angle) * 3.65, .15, Math.sin(angle) * 2.48);
    rock.scaling.set(1.15, .56, .85);
    rock.rotation.y = angle;
    rock.material = index % 4 === 0 ? palette.stoneShade : palette.stone;
    rock.receiveShadows = true;
    shadows.addShadowCaster(rock);
  }
  for (let index = 0; index < 5; index++) {
    const pad = B.MeshBuilder.CreateCylinder(`lily pad ${index}`, { diameter: .62 + index % 2 * .18, height: .025, tessellation: 18 }, scene);
    pad.parent = root;
    pad.position.set(-1.7 + index * .75, .11, Math.sin(index * 2) * .75);
    pad.material = palette.leaf;
  }
  const glints = Array.from({ length: 6 }, (_, index) => {
    const glint = B.MeshBuilder.CreateBox(`pond glint ${index}`, { width: .85, height: .018, depth: .045 }, scene);
    glint.parent = root;
    glint.position.set(-1.8 + index * .7, .11, -1 + (index % 3) * .8);
    glint.material = palette.waterLight;
    return glint;
  });
  return { root, glints };
}

function createSunroom(B: any, scene: any, palette: any, shadows: any) {
  const root = new B.TransformNode("little garden sunroom", scene);
  root.position.set(10.3, 0, 10.2);
  const floor = B.MeshBuilder.CreateCylinder("sunroom floor", { diameter: 4.4, height: .18, tessellation: 24 }, scene);
  floor.parent = root;
  floor.position.y = .08;
  floor.scaling.z = .75;
  floor.material = palette.pathLight;
  for (const x of [-1.55, 1.55]) {
    const post = B.MeshBuilder.CreateCylinder(`sunroom post ${x}`, { height: 3.4, diameter: .24, tessellation: 8 }, scene);
    post.parent = root;
    post.position.set(x, 1.75, 0);
    post.material = palette.woodDark;
    shadows.addShadowCaster(post);
  }
  const roof = B.MeshBuilder.CreateCylinder("sunroom roof", { diameterTop: .4, diameterBottom: 4.6, height: 1.25, tessellation: 8 }, scene);
  roof.parent = root;
  roof.position.y = 4;
  roof.scaling.z = .75;
  roof.material = palette.coral;
  shadows.addShadowCaster(roof);
}

function createPlacementPreview(B: any, scene: any, palette: any, item: PlacementItem) {
  const root = new B.TransformNode("placement preview", scene);
  const previewMaterial = new B.StandardMaterial("placement preview material", scene);
  previewMaterial.diffuseColor = B.Color3.FromHexString("#b8f28f");
  previewMaterial.emissiveColor = B.Color3.FromHexString("#4b913f").scale(.3);
  previewMaterial.alpha = .62;
  previewMaterial.backFaceCulling = false;
  root.metadata = { previewMaterial };
  const add = (mesh: any) => {
    mesh.parent = root;
    mesh.material = previewMaterial;
    mesh.isPickable = false;
    return mesh;
  };
  if (item.category === "plant" && item.kind === "tree") {
    add(B.MeshBuilder.CreateCylinder("preview tree trunk", { height: 2.5, diameterTop: .22, diameterBottom: .42, tessellation: 10 }, scene)).position.y = 1.25;
    const crown = add(B.MeshBuilder.CreateSphere("preview tree crown", { diameter: 2.35, segments: 16 }, scene));
    crown.position.y = 3;
    crown.scaling.set(1, 1.15, .82);
  } else if (item.category === "plant" && item.kind === "flowers") {
    for (let index = 0; index < 9; index++) {
      const flower = add(B.MeshBuilder.CreateSphere(`preview flower ${index}`, { diameter: .28, segments: 10 }, scene));
      flower.position.set(Math.cos(index * 2.4) * (.25 + index % 3 * .2), .35 + index % 3 * .12, Math.sin(index * 2.4) * (.25 + index % 3 * .2));
    }
  } else if (item.category === "plant") {
    const shrub = add(B.MeshBuilder.CreateSphere("preview shrub", { diameter: 1.65, segments: 16 }, scene));
    shrub.position.y = .72;
    shrub.scaling.set(1.25, .8, 1);
  } else if (item.kind === "lantern" || item.kind === "birdhouse") {
    add(B.MeshBuilder.CreateCylinder("preview post", { height: 2.1, diameter: .15, tessellation: 8 }, scene)).position.y = 1.05;
    const top = add(item.kind === "lantern"
      ? B.MeshBuilder.CreateSphere("preview lantern", { diameter: .55, segments: 12 }, scene)
      : B.MeshBuilder.CreateBox("preview birdhouse", { size: .7 }, scene));
    top.position.y = 2.2;
  } else if (item.kind === "bench") {
    const seat = add(B.MeshBuilder.CreateBox("preview bench", { width: 1.8, height: .65, depth: .55 }, scene));
    seat.position.y = .65;
  } else if (item.kind === "pond") {
    const water = add(B.MeshBuilder.CreateCylinder("preview decorative pond", { diameter: 4.2, height: .1, tessellation: 32 }, scene));
    water.position.y = .06;
    water.scaling.z = .68;
  } else {
    const sparkle = add(B.MeshBuilder.CreatePolyhedron("preview fertilizer", { type: 1, size: .65 }, scene));
    sparkle.position.y = .7;
  }
  return root;
}

function setPreviewValidity(B: any, preview: any, valid: boolean) {
  const value = valid ? "#b8f28f" : "#ff786e";
  preview.metadata.previewMaterial.diffuseColor = B.Color3.FromHexString(value);
  preview.metadata.previewMaterial.emissiveColor = B.Color3.FromHexString(value).scale(.22);
}

function createStylizedFlowerGarden(B: any, scene: any, palette: any, shadows: any, name: string) {
  const root = new B.TransformNode(name, scene);
  const flowerMaterials = [palette.coral, palette.pink, palette.purple, palette.yellow];
  for (let index = 0; index < 13; index++) {
    const radius = .18 + (index % 5) * .16;
    const angle = index * 2.34;
    const height = .42 + (index % 4) * .12;
    const stem = B.MeshBuilder.CreateCylinder(`${name} stem ${index}`, { height, diameter: .045, tessellation: 7 }, scene);
    stem.parent = root;
    stem.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
    stem.material = palette.leaf;
    const center = new B.Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
    for (let petal = 0; petal < 5; petal++) {
      const petalAngle = petal * Math.PI * .4;
      const mesh = B.MeshBuilder.CreateSphere(`${name} petal ${index}-${petal}`, { diameter: .18, segments: 10 }, scene);
      mesh.parent = root;
      mesh.position.copyFrom(center.add(new B.Vector3(Math.cos(petalAngle) * .1, 0, Math.sin(petalAngle) * .1)));
      mesh.scaling.set(.7, .35, 1.25);
      mesh.rotation.y = -petalAngle;
      mesh.material = flowerMaterials[index % flowerMaterials.length];
      shadows.addShadowCaster(mesh);
    }
    const heart = B.MeshBuilder.CreateSphere(`${name} center ${index}`, { diameter: .13, segments: 10 }, scene);
    heart.parent = root;
    heart.position.copyFrom(center.add(new B.Vector3(0, .018, 0)));
    heart.material = palette.yellow;
  }
  return root;
}

function createMagicBurst(B: any, scene: any, palette: any, position: any) {
  const texture = new B.DynamicTexture("fertilizer sparkle", { width: 32, height: 32 }, scene, false);
  const context = texture.getContext();
  context.clearRect(0, 0, 32, 32);
  context.fillStyle = "rgba(255,232,120,.95)";
  context.beginPath();
  context.arc(16, 16, 10, 0, Math.PI * 2);
  context.fill();
  texture.update();
  const particles = new B.ParticleSystem("fertilizer magic", 180, scene);
  particles.particleTexture = texture;
  particles.emitter = position.add(new B.Vector3(0, .4, 0));
  particles.minEmitBox = new B.Vector3(-.7, 0, -.7);
  particles.maxEmitBox = new B.Vector3(.7, .2, .7);
  particles.direction1 = new B.Vector3(-1, 2.2, -1);
  particles.direction2 = new B.Vector3(1, 4.2, 1);
  particles.gravity = new B.Vector3(0, -2.5, 0);
  particles.color1 = new B.Color4(1, .83, .28, 1);
  particles.color2 = new B.Color4(.45, .9, .45, 1);
  particles.minLifeTime = .45;
  particles.maxLifeTime = 1.15;
  particles.minSize = .07;
  particles.maxSize = .18;
  particles.emitRate = 260;
  particles.targetStopDuration = .7;
  particles.disposeOnStop = true;
  particles.start();
}

function createMiniPond(B: any, scene: any, palette: any, shadows: any, position: any, index: number) {
  const root = new B.TransformNode(`decorative pond ${index} ${Date.now()}`, scene);
  root.position.copyFrom(position);
  const water = B.MeshBuilder.CreateCylinder("decorative pond water", { diameter: 4.2, height: .09, tessellation: 48 }, scene);
  water.parent = root;
  water.position.y = .04;
  water.scaling.z = .68;
  water.material = palette.water;
  for (let stoneIndex = 0; stoneIndex < 16; stoneIndex++) {
    const angle = stoneIndex / 16 * Math.PI * 2;
    const stone = B.MeshBuilder.CreateIcoSphere(`decorative pond stone ${stoneIndex}`, { radius: .3 + stoneIndex % 3 * .035, subdivisions: 2 }, scene);
    stone.parent = root;
    stone.position.set(Math.cos(angle) * 2.16, .13, Math.sin(angle) * 1.48);
    stone.scaling.set(1.1, .55, .82);
    stone.material = stoneIndex % 4 === 0 ? palette.stoneShade : palette.stone;
    shadows.addShadowCaster(stone);
  }
  for (let padIndex = 0; padIndex < 3; padIndex++) {
    const pad = B.MeshBuilder.CreateCylinder(`decorative lily pad ${padIndex}`, { diameter: .5, height: .02, tessellation: 18 }, scene);
    pad.parent = root;
    pad.position.set(-.7 + padIndex * .65, .11, Math.sin(padIndex * 1.8) * .4);
    pad.material = palette.leaf;
  }
}

function createLantern(B: any, scene: any, palette: any, shadows: any, position: any, index: number) {
  const root = new B.TransformNode(`garden lantern ${index} ${Date.now()}`, scene);
  root.position.copyFrom(position);
  const pole = B.MeshBuilder.CreateCylinder("lantern pole", { height: 2.15, diameter: .13, tessellation: 8 }, scene);
  pole.parent = root;
  pole.position.y = 1.07;
  pole.material = palette.woodDark;
  const cap = B.MeshBuilder.CreateCylinder("lantern cap", { diameterTop: .05, diameterBottom: .65, height: .42, tessellation: 8 }, scene);
  cap.parent = root;
  cap.position.y = 2.2;
  cap.material = palette.coral;
  const glow = B.MeshBuilder.CreateSphere("lantern warm glow", { diameter: .38, segments: 14 }, scene);
  glow.parent = root;
  glow.position.y = 1.88;
  glow.material = palette.yellow;
  shadows.addShadowCaster(pole);
  const light = new B.PointLight(`lantern light ${index}`, root.position.add(new B.Vector3(0, 1.9, 0)), scene);
  light.diffuse = B.Color3.FromHexString("#ffd37b");
  light.intensity = .78;
  light.range = 7;
}

function createBirdhouse(B: any, scene: any, palette: any, shadows: any, position: any, index: number) {
  const root = new B.TransformNode(`birdhouse ${index} ${Date.now()}`, scene);
  root.position.copyFrom(position);
  const post = B.MeshBuilder.CreateCylinder("birdhouse post", { height: 2.2, diameter: .16, tessellation: 8 }, scene);
  post.parent = root;
  post.position.y = 1.1;
  post.material = palette.woodDark;
  const house = B.MeshBuilder.CreateBox("little birdhouse", { width: .76, height: .72, depth: .58 }, scene);
  house.parent = root;
  house.position.y = 2.25;
  house.material = palette.coral;
  const roof = B.MeshBuilder.CreateCylinder("birdhouse roof", { diameter: 1.06, height: .22, tessellation: 4 }, scene);
  roof.parent = root;
  roof.position.y = 2.68;
  roof.rotation.y = Math.PI / 4;
  roof.scaling.z = .78;
  roof.material = palette.pathLight;
  const hole = B.MeshBuilder.CreateCylinder("birdhouse opening", { diameter: .22, height: .03, tessellation: 20 }, scene);
  hole.parent = root;
  hole.position.set(0, 2.3, -.305);
  hole.rotation.x = Math.PI / 2;
  hole.material = palette.woodDark;
  [post, house, roof].forEach((mesh) => shadows.addShadowCaster(mesh));
}

function createBench(B: any, scene: any, palette: any, shadows: any, position: any, index: number) {
  const root = new B.TransformNode(`garden bench ${index} ${Date.now()}`, scene);
  root.position.copyFrom(position);
  root.rotation.y = -index * .6;
  const seat = B.MeshBuilder.CreateBox("bench seat", { width: 1.75, height: .18, depth: .52 }, scene);
  seat.parent = root;
  seat.position.y = .65;
  seat.material = palette.wood;
  const back = B.MeshBuilder.CreateBox("bench back", { width: 1.75, height: .65, depth: .14 }, scene);
  back.parent = root;
  back.position.set(0, 1.05, .22);
  back.rotation.x = -.1;
  back.material = palette.wood;
  for (const x of [-.65, .65]) {
    const leg = B.MeshBuilder.CreateBox(`bench leg ${x}`, { width: .16, height: .68, depth: .42 }, scene);
    leg.parent = root;
    leg.position.set(x, .33, 0);
    leg.material = palette.woodDark;
    shadows.addShadowCaster(leg);
  }
  shadows.addShadowCaster(seat);
  shadows.addShadowCaster(back);
}

async function loadCharacter(B: any, scene: any, collider: any, shadows: any) {
  const result = await B.SceneLoader.ImportMeshAsync(null, "/garden-game/models/", "HVGirl.glb", scene);
  const root = new B.TransformNode("only garden character", scene);
  root.parent = collider;
  root.position.y = -.88;
  root.scaling.setAll(.1);
  result.meshes.forEach((mesh: any) => {
    if (!mesh.parent) mesh.parent = root;
    mesh.receiveShadows = true;
    shadows.addShadowCaster(mesh);
  });
  playAnimation(result.animationGroups, "idle");
  return { root, groups: result.animationGroups };
}

function playAnimation(groups: any[], wanted: "walk" | "idle") {
  groups.forEach((group) => group.stop());
  const match = groups.find((group) => group.name.toLowerCase().includes(wanted)) ?? groups[0];
  match?.start(true, 1, match.from, match.to, false);
}

async function loadFreeSource(B: any, scene: any, shadows: any, file: string, name: string) {
  try {
    const result = await B.SceneLoader.ImportMeshAsync(null, ASSET_ROOT, file, scene);
    const root = new B.TransformNode(name, scene);
    result.meshes.forEach((mesh: any) => {
      if (!mesh.parent) mesh.parent = root;
      mesh.receiveShadows = true;
      shadows.addShadowCaster(mesh);
      if (mesh.material) {
        mesh.material.roughness = .9;
        mesh.material.metallic = 0;
        if (mesh.material.specularColor) mesh.material.specularColor.set(.04, .04, .04);
      }
    });
    root.position.set(-80, 0, 0);
    return root;
  } catch (error) {
    throw new Error(`Не удалось загрузить бесплатный ресурс ${file}: ${error instanceof Error ? error.message : "ошибка"}`);
  }
}

function cloneSource(source: any, name: string) {
  const clone = source.instantiateHierarchy(null, { doNotInstantiate: true }, (node: any) => {
    node.name = `${name} ${node.name}`;
  });
  clone.name = name;
  clone.setEnabled(true);
  clone.getChildMeshes?.().forEach((mesh: any) => mesh.setEnabled(true));
  clone.position.set(0, 0, 0);
  return clone;
}

function decorateBoundaries(B: any, scene: any, palette: any, shadows: any, treeSource: any, shrubSource: any, flowerSource: any) {
  const trees = [[-11.2, 8.6, .9], [-7.8, 11.2, 1.05], [10.8, 8.2, .88], [11.8, 1.2, .78], [-11.6, -3.5, .82]];
  trees.forEach(([x, z, scale], index) => {
    const tree = cloneSource(treeSource, `boundary painted birch ${index}`);
    tree.position.set(x, 0, z);
    tree.scaling.setAll(scale);
    tree.rotation.y = index * 1.41;
  });
  const shrubs = [[-11.8, -10], [-8.8, 11.6], [8.2, 11.8], [13.1, 4.2], [-13, 1], [11, -10.5]];
  shrubs.forEach(([x, z], index) => {
    const shrub = cloneSource(shrubSource, `boundary flowering shrub ${index}`);
    shrub.position.set(x, .05, z);
    shrub.scaling.setAll(1.15 + index % 2 * .22);
    shrub.rotation.y = index * .9;
  });
  const flowerMaterials = [palette.coral, palette.pink, palette.yellow, palette.purple];
  for (let patch = 0; patch < 9; patch++) {
    const baseX = -12 + (patch * 3.1) % 25;
    const baseZ = patch % 2 ? 10.7 : -10.7;
    for (let index = 0; index < 3; index++) {
      const flower = cloneSource(flowerSource, `garden edge flower ${patch}-${index}`);
      flower.position.set(baseX + index * .32, .02, baseZ + Math.sin(index * 2) * .25);
      flower.scaling.setAll(.95 + index * .12);
      flower.rotation.y = patch + index;
      flower.getChildMeshes?.().forEach((mesh: any) => {
        if (mesh.material) {
          mesh.material = flowerMaterials[(patch + index) % flowerMaterials.length];
          mesh.material.backFaceCulling = false;
        }
        shadows.addShadowCaster(mesh);
      });
    }
  }
}

function makeRainTexture(B: any, scene: any) {
  const texture = new B.DynamicTexture("painted rain drop", { width: 8, height: 48 }, scene, false);
  const context = texture.getContext();
  context.clearRect(0, 0, 8, 48);
  context.strokeStyle = "rgba(220,245,255,.86)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(4, 2);
  context.lineTo(4, 46);
  context.stroke();
  texture.update();
  return texture;
}
