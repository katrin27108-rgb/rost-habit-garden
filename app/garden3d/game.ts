export type GameNotice = { kind: "plot" | "plant" | "pond"; title: string; text: string } | null;
export type PlantKind = "tree" | "flowers" | "shrub";
export type GameWeather = "sun" | "cloud" | "rain";

export type GardenGameRuntime = {
  setGrowth(value: number): void;
  setWeather(value: GameWeather): void;
  plant(kind: PlantKind): void;
  setTouchMove(x: number, z: number): void;
  interact(): void;
  dispose(): void;
};

type GameOptions = {
  growth: number;
  onReady(): void;
  onNearby(notice: GameNotice): void;
  onInteract(notice: GameNotice): void;
};

export async function createGardenGame(B: any, canvas: HTMLCanvasElement, options: GameOptions): Promise<GardenGameRuntime> {
  const engine = new B.Engine(canvas, true, { antialias: true, stencil: true, preserveDrawingBuffer: false });
  engine.setHardwareScalingLevel(Math.max(1, Math.min(1.45, 1 / window.devicePixelRatio)));
  const scene = new B.Scene(engine);
  scene.clearColor = new B.Color4(.59, .76, .82, 1);
  scene.fogMode = B.Scene.FOGMODE_EXP2;
  scene.fogDensity = .0065;
  scene.fogColor = new B.Color3(.68, .79, .73);
  scene.collisionsEnabled = true;
  scene.gravity = new B.Vector3(0, -9.81, 0);

  const camera = new B.ArcRotateCamera("third person camera", -Math.PI / 2, 1.46, 8.8, new B.Vector3(0, 1.25, 0), scene);
  camera.lowerRadiusLimit = 6.4;
  camera.upperRadiusLimit = 12;
  camera.lowerBetaLimit = 1.18;
  camera.upperBetaLimit = 1.54;
  camera.wheelPrecision = 40;
  camera.panningSensibility = 0;
  camera.angularSensibilityX = 2500;
  camera.angularSensibilityY = 2500;
  camera.attachControl(canvas, true);

  const hemi = new B.HemisphericLight("soft sky", new B.Vector3(0, 1, 0), scene);
  hemi.intensity = .72;
  hemi.diffuse = new B.Color3(.77, .87, .72);
  hemi.groundColor = new B.Color3(.22, .30, .20);
  const sun = new B.DirectionalLight("morning sun", new B.Vector3(-.55, -1, .32), scene);
  sun.position = new B.Vector3(22, 35, -18);
  sun.intensity = 1.55;
  sun.diffuse = new B.Color3(1, .89, .64);
  const shadows = new B.ShadowGenerator(2048, sun);
  shadows.useBlurExponentialShadowMap = true;
  shadows.blurKernel = 24;
  shadows.bias = .0007;

  const pbr = (name: string, hex: string, roughness = .9) => {
    const material = new B.PBRMaterial(name, scene);
    material.albedoColor = B.Color3.FromHexString(hex);
    material.roughness = roughness;
    material.metallic = 0;
    return material;
  };
  const grass = pbr("meadow grass", "#6d914c", .98);
  grass.albedoTexture = new B.Texture("/garden-3d/textures/leafy-grass-diff.jpg", scene);
  grass.albedoTexture.uScale = grass.albedoTexture.vScale = 9;
  grass.bumpTexture = new B.Texture("/garden-3d/textures/leafy-grass-normal.jpg", scene);
  grass.bumpTexture.uScale = grass.bumpTexture.vScale = 9;
  grass.bumpTexture.level = .42;
  const stone = pbr("sunlit limestone", "#c6bd9c", .93);
  const soil = pbr("fresh soil", "#47372a", .99);
  const water = pbr("garden pond", "#3f8f9a", .22);
  water.alpha = .78;
  water.metallic = .08;
  const ruin = pbr("weathered garden stone", "#b8b59d", .96);
  const treeWood = pbr("willow wood", "#58402b", .94);
  const treeLeaves = pbr("willow leaves", "#426b37", .82);
  treeLeaves.backFaceCulling = false;
  treeLeaves.twoSidedLighting = true;

  B.Effect.ShadersStore.gardenSkyVertexShader = `
    precision highp float;
    attribute vec3 position;
    uniform mat4 worldViewProjection;
    varying vec3 vDirection;
    void main(void) {
      vDirection = position;
      gl_Position = worldViewProjection * vec4(position, 1.0);
    }
  `;
  B.Effect.ShadersStore.gardenSkyFragmentShader = `
    precision highp float;
    varying vec3 vDirection;
    uniform float weather;
    void main(void) {
      vec3 direction = normalize(vDirection);
      float height = clamp(direction.y * .72 + .42, 0.0, 1.0);
      vec3 clearHorizon = vec3(.60, .78, .83);
      vec3 clearZenith = vec3(.20, .53, .82);
      vec3 greyHorizon = vec3(.53, .62, .61);
      vec3 greyZenith = vec3(.27, .38, .46);
      float cloudiness = clamp(weather, 0.0, 1.0);
      vec3 skyColor = mix(mix(clearHorizon, clearZenith, height), mix(greyHorizon, greyZenith, height), cloudiness);
      vec3 sunDirection = normalize(vec3(.38, .06, .92));
      float sunCore = smoothstep(.985, .995, dot(direction, sunDirection));
      float sunGlow = pow(max(dot(direction, sunDirection), 0.0), 18.0);
      skyColor += (vec3(1.0, .79, .34) * sunCore * 2.1 + vec3(1.0, .72, .28) * sunGlow * .65) * (1.0 - cloudiness);
      gl_FragColor = vec4(skyColor, 1.0);
    }
  `;
  const skyMaterial = new B.ShaderMaterial("living sky", scene, { vertex: "gardenSky", fragment: "gardenSky" }, { attributes: ["position"], uniforms: ["worldViewProjection", "weather"] });
  skyMaterial.backFaceCulling = false;
  skyMaterial.setFloat("weather", 0);
  const sky = B.MeshBuilder.CreateSphere("open sky", { diameter: 160, segments: 24, sideOrientation: B.Mesh.BACKSIDE }, scene);
  sky.material = skyMaterial;
  sky.infiniteDistance = true;
  const sunMaterial = new B.StandardMaterial("sun glow", scene);
  sunMaterial.disableLighting = true;
  sunMaterial.emissiveColor = new B.Color3(1, .82, .38);
  const sunDisc = B.MeshBuilder.CreateSphere("visible sun", { diameter: 5, segments: 24 }, scene);
  sunDisc.position.set(-32, 31, 48);
  sunDisc.material = sunMaterial;
  const cloudMaterial = new B.StandardMaterial("soft clouds", scene);
  cloudMaterial.disableLighting = true;
  cloudMaterial.emissiveColor = new B.Color3(.88, .91, .87);
  cloudMaterial.alpha = .32;
  const clouds = Array.from({ length: 7 }, (_, index) => {
    const cloud = B.MeshBuilder.CreateSphere(`cloud ${index}`, { diameter: 8 + (index % 3) * 2, segments: 16 }, scene);
    cloud.scaling.y = .22;
    cloud.scaling.z = 1.8;
    cloud.position.set(-28 + index * 10, 18 + (index % 2) * 3, 25 + (index % 3) * 9);
    cloud.material = cloudMaterial;
    return cloud;
  });

  const rainTexture = new B.DynamicTexture("rain drop", { width: 16, height: 64 }, scene, false);
  const rainContext = rainTexture.getContext();
  rainContext.clearRect(0, 0, 16, 64);
  rainContext.strokeStyle = "rgba(220,240,255,.9)";
  rainContext.lineWidth = 2;
  rainContext.beginPath();
  rainContext.moveTo(8, 4);
  rainContext.lineTo(8, 60);
  rainContext.stroke();
  rainTexture.update();
  const rain = new B.ParticleSystem("garden rain", 1600, scene);
  rain.particleTexture = rainTexture;
  rain.emitter = new B.Vector3(0, 18, 0);
  rain.minEmitBox = new B.Vector3(-24, 0, -24);
  rain.maxEmitBox = new B.Vector3(24, 0, 24);
  rain.direction1 = new B.Vector3(-.5, -18, 0);
  rain.direction2 = new B.Vector3(.5, -22, .4);
  rain.minLifeTime = .65;
  rain.maxLifeTime = 1.1;
  rain.minSize = .08;
  rain.maxSize = .15;
  rain.emitRate = 1100;
  rain.stop();

  const ground = B.MeshBuilder.CreateGround("open garden ground", { width: 54, height: 54, subdivisions: 3 }, scene);
  ground.material = grass;
  ground.receiveShadows = true;
  ground.checkCollisions = true;

  const pathPoints = [
    [0, 10], [-.4, 8], [.3, 6], [1.1, 4], [.7, 2], [0, 0], [-1.1, -2], [-.6, -4], [.3, -6], [1.2, -8], [.8, -10],
  ];
  pathPoints.forEach(([x, z], index) => {
    const slab = B.MeshBuilder.CreateBox(`path stone ${index}`, { width: 1.02 + (index % 3) * .1, height: .1, depth: .82 }, scene);
    slab.position.set(x, .04, z);
    slab.rotation.y = (index % 2 ? -.08 : .09);
    slab.material = stone;
    slab.receiveShadows = true;
  });

  const plotPositions = [new B.Vector3(-3.2, .05, -6.3), new B.Vector3(6, .05, -1), new B.Vector3(-5.5, .05, 6), new B.Vector3(5.2, .05, 7.2)];
  const plotMaterial = pbr("planting place", "#6f8f60", .8);
  plotMaterial.emissiveColor = new B.Color3(.12, .2, .08);
  plotMaterial.alpha = .64;
  const plotMarkers = plotPositions.map((position: any, index: number) => {
    const ring = B.MeshBuilder.CreateTorus(`planting place ${index + 1}`, { diameter: 3.2, thickness: .1, tessellation: 64 }, scene);
    ring.position.copyFrom(position);
    ring.material = plotMaterial;
    return ring;
  });

  const pond = B.MeshBuilder.CreateCylinder("reflective pond", { diameter: 9, height: .09, tessellation: 64 }, scene);
  pond.scaling.z = .66;
  pond.position.set(9.5, .05, 7.2);
  pond.material = water;
  const pondBorder = B.MeshBuilder.CreateTorus("pond stone rim", { diameter: 9.25, thickness: .34, tessellation: 64 }, scene);
  pondBorder.scaling.z = .66;
  pondBorder.position.set(9.5, .02, 7.2);
  pondBorder.material = stone;
  pondBorder.receiveShadows = true;

  const player = B.MeshBuilder.CreateCapsule("player collider", { radius: .38, height: 1.75 }, scene);
  player.position.set(0, .9, -10.8);
  player.isVisible = false;
  player.checkCollisions = true;
  player.ellipsoid = new B.Vector3(.38, .9, .38);
  player.ellipsoidOffset = new B.Vector3(0, .9, 0);

  const playerModel = await loadCharacter(B, scene, player, shadows, false);

  const willowImport = await B.SceneLoader.ImportMeshAsync(null, "/garden-game/models/", "Willow_4.obj", scene);
  const willowRoot = new B.TransformNode("willow source", scene);
  willowImport.meshes.filter((mesh: any) => mesh !== scene.meshes[0]).forEach((mesh: any) => {
    if (!mesh.parent) mesh.parent = willowRoot;
    const materialName = `${mesh.material?.name ?? ""} ${mesh.name}`.toLowerCase();
    mesh.material = materialName.includes("wood") ? treeWood : treeLeaves;
    shadows.addShadowCaster(mesh);
    mesh.receiveShadows = true;
  });
  willowRoot.position.set(-60, 0, 0);
  willowRoot.scaling.setAll(1);
  let treeSource = willowRoot;
  try {
    const firImport = await B.SceneLoader.ImportMeshAsync(null, "/garden-game/models/fir/", "fir_sapling.gltf", scene);
    const firVariant = [...(firImport.transformNodes ?? []), ...firImport.meshes].find((node: any) => node.name === "fir_sapling_a");
    if (firVariant) {
      const firSource = new B.TransformNode("detailed tree source", scene);
      firVariant.parent = firSource;
      firSource.position.set(-70, 0, 0);
      firSource.scaling.setAll(1);
      firImport.meshes.forEach((mesh: any) => { shadows.addShadowCaster(mesh); mesh.receiveShadows = true; });
      [...(firImport.transformNodes ?? []), ...firImport.meshes].filter((node: any) => node.name === "fir_sapling_b" || node.name === "fir_sapling_c").forEach((node: any) => node.setEnabled(false));
      treeSource = firSource;
    }
  } catch {
    // На слабом устройстве остаётся облегчённая модель дерева.
  }

  try {
    const shrubImport = await B.SceneLoader.ImportMeshAsync(null, "/garden-game/models/", "shrub_03.gltf", scene);
    const shrubRoot = new B.TransformNode("shrub source", scene);
    shrubImport.meshes.forEach((mesh: any) => { if (!mesh.parent) mesh.parent = shrubRoot; mesh.receiveShadows = true; shadows.addShadowCaster(mesh); });
    shrubRoot.scaling.setAll(1);
    shrubRoot.position.set(-60, 0, 8);
    scene.metadata = { ...(scene.metadata ?? {}), shrubRoot };
  } catch {
    // Игра остаётся доступной, даже если дополнительная растительность не загрузилась.
  }

  const pipeline = new B.DefaultRenderingPipeline("garden cinematic pipeline", true, scene, [camera]);
  pipeline.fxaaEnabled = true;
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = .78;
  pipeline.bloomWeight = .24;
  pipeline.imageProcessingEnabled = true;
  pipeline.imageProcessing.contrast = 1.18;
  pipeline.imageProcessing.exposure = .92;
  pipeline.imageProcessing.toneMappingEnabled = true;

  const keys = new Set<string>();
  let touchX = 0;
  let touchZ = 0;
  let nearby: GameNotice = null;
  let nearbyPlot = -1;
  let activeAnimation = "";
  let currentGrowth = options.growth;
  const planted: Array<{ root: any; kind: PlantKind; base: number } | null> = plotPositions.map(() => null);

  const onKeyDown = (event: KeyboardEvent) => {
    keys.add(event.key.toLowerCase());
    if (event.key.toLowerCase() === "e") interact();
  };
  const onKeyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  const interact = () => { if (nearby) options.onInteract(nearby); };
  const setGrowth = (value: number) => {
    currentGrowth = value;
    const t = Math.max(.12, Math.min(1, value / 100));
    planted.forEach((entry) => entry?.root.scaling.setAll(entry.base * (.22 + t * .78)));
  };
  setGrowth(options.growth);

  const plant = (kind: PlantKind) => {
    if (nearbyPlot < 0) return;
    planted[nearbyPlot]?.root.dispose();
    const position = plotPositions[nearbyPlot];
    let root: any;
    let base = 1;
    if (kind === "tree") {
      root = treeSource.clone(`habit tree ${nearbyPlot}`);
      base = treeSource === willowRoot ? 1.15 : 1;
    } else if (kind === "shrub" && scene.metadata?.shrubRoot) {
      root = scene.metadata.shrubRoot.clone(`habit shrub ${nearbyPlot}`);
      base = .72;
    } else {
      root = createFlowerPatch(B, scene, `habit flowers ${nearbyPlot}`);
      base = 1;
    }
    root.position.copyFrom(position);
    root.rotation.y = nearbyPlot * 1.4;
    root.metadata = { interactive: "plant", plot: nearbyPlot };
    planted[nearbyPlot] = { root, kind, base };
    plotMarkers[nearbyPlot].setEnabled(false);
    setGrowth(currentGrowth);
  };

  const setWeather = (value: GameWeather) => {
    if (value === "sun") {
      skyMaterial.setFloat("weather", 0); sun.intensity = 1.55; hemi.intensity = .72; sunDisc.setEnabled(false); cloudMaterial.alpha = .22; scene.fogDensity = .0065; rain.stop();
    } else if (value === "cloud") {
      skyMaterial.setFloat("weather", .72); sun.intensity = .72; hemi.intensity = .62; sunDisc.setEnabled(false); cloudMaterial.alpha = .72; scene.fogDensity = .009; rain.stop();
    } else {
      skyMaterial.setFloat("weather", 1); sun.intensity = .45; hemi.intensity = .5; sunDisc.setEnabled(false); cloudMaterial.alpha = .88; scene.fogDensity = .012; rain.start();
    }
  };
  setWeather("sun");

  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(.035, engine.getDeltaTime() / 1000);
    let x = touchX + (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
    let z = touchZ + (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
    const moving = Math.abs(x) + Math.abs(z) > .1;
    if (moving) {
      const forward = camera.getForwardRay().direction.clone();
      forward.y = 0;
      forward.normalize();
      const right = B.Vector3.Cross(forward, B.Axis.Y).normalize();
      const direction = forward.scale(z).add(right.scale(x)).normalize();
      const next = player.position.add(direction.scale(4.1 * dt));
      if (Math.abs(next.x) < 20.5 && Math.abs(next.z) < 20.5 && B.Vector3.DistanceSquared(next, new B.Vector3(9.5, .9, 7.2)) > 24) {
        player.position.copyFrom(next);
      }
      playerModel.root.rotation.y = Math.atan2(direction.x, direction.z);
    }
    const wantedAnimation = moving ? "walk" : "idle";
    if (wantedAnimation !== activeAnimation) {
      activeAnimation = wantedAnimation;
      playAnimation(playerModel.groups, wantedAnimation);
    }
    camera.target = B.Vector3.Lerp(camera.target, player.position.add(new B.Vector3(0, .75, 0)), .13);

    nearbyPlot = plotPositions.findIndex((position: any, index: number) => !planted[index] && B.Vector3.Distance(player.position, position.add(new B.Vector3(0, .9, 0))) < 2.7);
    const plantIndex = planted.findIndex((entry, index) => entry && B.Vector3.Distance(player.position, plotPositions[index].add(new B.Vector3(0, .9, 0))) < 3.1);
    const pondDistance = B.Vector3.Distance(player.position, pond.position.add(new B.Vector3(0, .9, 0)));
    const nextNearby: GameNotice = nearbyPlot >= 0
      ? { kind: "plot", title: `Свободное место № ${nearbyPlot + 1}`, text: "Выбрать, что посадить" }
      : plantIndex >= 0
        ? { kind: "plant", title: "Растение привычки", text: "Осмотреть рост" }
        : pondDistance < 5.8
          ? { kind: "pond", title: "Садовый пруд", text: "Прислушаться к воде" }
          : null;
    if (nextNearby?.kind !== nearby?.kind) { nearby = nextNearby; options.onNearby(nearby); }
  });

  engine.runRenderLoop(() => scene.render());
  const resize = () => engine.resize();
  window.addEventListener("resize", resize);
  options.onReady();

  return {
    setGrowth,
    setWeather,
    plant,
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

async function loadCharacter(B: any, scene: any, collider: any, shadows: any, npc: boolean) {
  const result = await B.SceneLoader.ImportMeshAsync(null, "/garden-game/models/", "HVGirl.glb", scene);
  const root = new B.TransformNode(npc ? "npc model" : "player model", scene);
  root.parent = collider;
  root.position.y = -.88;
  // HVGirl is authored at roughly eight times the scene's meter scale.
  root.scaling.setAll(.1);
  result.meshes.forEach((mesh: any) => {
    if (!mesh.parent) mesh.parent = root;
    mesh.receiveShadows = true;
    shadows.addShadowCaster(mesh);
  });
  if (npc) {
    result.meshes.forEach((mesh: any) => {
      if (!mesh.material) return;
      mesh.material = mesh.material.clone(`${mesh.material.name} garden keeper`);
      if (mesh.material.albedoColor) mesh.material.albedoColor = mesh.material.albedoColor.multiply(new B.Color3(.76, 1, .82));
    });
  }
  playAnimation(result.animationGroups, "idle");
  return { root, groups: result.animationGroups, current: "" };
}

function playAnimation(groups: any[], wanted: "walk" | "idle") {
  groups.forEach((group) => group.stop());
  const match = groups.find((group) => group.name.toLowerCase().includes(wanted === "walk" ? "walk" : "idle")) ?? groups[0];
  match?.start(true, 1, match.from, match.to, false);
}

function createFlowerPatch(B: any, scene: any, name: string) {
  const root = new B.TransformNode(name, scene);
  const stemMaterial = new B.StandardMaterial(`${name} stems`, scene);
  stemMaterial.diffuseColor = new B.Color3(.23, .48, .22);
  const flowerMaterial = new B.StandardMaterial(`${name} petals`, scene);
  flowerMaterial.diffuseColor = new B.Color3(.58, .42, .78);
  flowerMaterial.emissiveColor = new B.Color3(.08, .03, .12);
  for (let index = 0; index < 18; index++) {
    const angle = index * 2.399;
    const radius = .24 + (index % 5) * .16;
    const height = .38 + (index % 4) * .11;
    const stem = B.MeshBuilder.CreateCylinder(`${name} stem ${index}`, { diameter: .025, height, tessellation: 8 }, scene);
    stem.parent = root;
    stem.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
    stem.material = stemMaterial;
    const bloom = B.MeshBuilder.CreateIcoSphere(`${name} bloom ${index}`, { radius: .08 + (index % 3) * .015, subdivisions: 2 }, scene);
    bloom.parent = root;
    bloom.position.set(stem.position.x, height, stem.position.z);
    bloom.scaling.y = 1.25;
    bloom.material = flowerMaterial;
  }
  return root;
}

function createGardenFolly(B: any, scene: any, material: any, shadows: any) {
  const root = new B.TransformNode("garden folly", scene);
  root.position.set(0, 0, 16.5);
  [-2.4, 2.4].forEach((x) => {
    const column = B.MeshBuilder.CreateCylinder("old pavilion column", { diameter: .82, height: 5.3, tessellation: 20 }, scene);
    column.position.set(x, 2.65, 0);
    column.parent = root;
    column.material = material;
    shadows.addShadowCaster(column);
    const capital = B.MeshBuilder.CreateBox("weathered capital", { width: 1.25, height: .34, depth: 1.25 }, scene);
    capital.position.set(x, 5.18, 0);
    capital.parent = root;
    capital.material = material;
  });
  const lintel = B.MeshBuilder.CreateBox("pavilion lintel", { width: 6, height: .55, depth: 1.1 }, scene);
  lintel.position.set(0, 5.5, 0);
  lintel.parent = root;
  lintel.material = material;
  shadows.addShadowCaster(lintel);
  const steps = [0, 1, 2].map((index) => B.MeshBuilder.CreateBox(`pavilion step ${index}`, { width: 6 - index * .7, height: .18, depth: 1.2 }, scene));
  steps.forEach((step, index) => { step.position.set(0, .09 + index * .14, -1.6 + index * .35); step.parent = root; step.material = material; });
}
