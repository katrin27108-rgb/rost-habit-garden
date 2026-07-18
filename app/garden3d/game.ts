export type GameNotice = { kind: "npc" | "plant" | "pond"; title: string; text: string } | null;

export type GardenGameRuntime = {
  setGrowth(value: number): void;
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

  const camera = new B.ArcRotateCamera("third person camera", -Math.PI / 2, 1.34, 9.4, new B.Vector3(0, 1.35, 0), scene);
  camera.lowerRadiusLimit = 6.4;
  camera.upperRadiusLimit = 12;
  camera.lowerBetaLimit = 1.02;
  camera.upperBetaLimit = 1.48;
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

  const beds = [[-6.5, -2.5, 4.8, 3.3], [6.4, -1, 4.5, 3], [-5.5, 6, 4, 2.7]];
  beds.forEach(([x, z, width, depth], index) => {
    const bed = B.MeshBuilder.CreateCylinder(`habit bed ${index}`, { diameter: 2, height: .12, tessellation: 48 }, scene);
    bed.scaling.set(width / 2, 1, depth / 2);
    bed.position.set(x, .06, z);
    bed.material = soil;
    bed.receiveShadows = true;
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

  createGardenFolly(B, scene, ruin, shadows);

  const player = B.MeshBuilder.CreateCapsule("player collider", { radius: .38, height: 1.75 }, scene);
  player.position.set(0, .9, -10.8);
  player.isVisible = false;
  player.checkCollisions = true;
  player.ellipsoid = new B.Vector3(.38, .9, .38);
  player.ellipsoidOffset = new B.Vector3(0, .9, 0);

  const playerModel = await loadCharacter(B, scene, player, shadows, false);
  const npcCollider = B.MeshBuilder.CreateCapsule("Mira npc collider", { radius: .38, height: 1.75 }, scene);
  npcCollider.position.set(4.8, .9, 1.8);
  npcCollider.isVisible = false;
  const npcModel = await loadCharacter(B, scene, npcCollider, shadows, true);

  const willowImport = await B.SceneLoader.ImportMeshAsync(null, "/garden-game/models/", "Willow_4.obj", scene);
  const willowRoot = new B.TransformNode("willow source", scene);
  willowImport.meshes.filter((mesh: any) => mesh !== scene.meshes[0]).forEach((mesh: any) => {
    if (!mesh.parent) mesh.parent = willowRoot;
    const materialName = `${mesh.material?.name ?? ""} ${mesh.name}`.toLowerCase();
    mesh.material = materialName.includes("wood") ? treeWood : treeLeaves;
    shadows.addShadowCaster(mesh);
    mesh.receiveShadows = true;
  });
  willowRoot.position.set(-6.5, .12, -2.5);
  willowRoot.scaling.setAll(.65);
  willowRoot.metadata = { interactive: "plant" };

  const boundaryTrees = [[-17, 13, 1.5], [16, 14, 1.35], [-18, -8, 1.55], [17, -7, 1.4]];
  boundaryTrees.forEach(([x, z, scale], index) => {
    const clone = willowRoot.clone(`boundary willow ${index}`);
    clone.position.set(x, 0, z);
    clone.scaling.setAll(scale);
    clone.rotation.y = index * 1.7;
    clone.metadata = null;
  });

  try {
    const shrubImport = await B.SceneLoader.ImportMeshAsync(null, "/garden-game/models/", "shrub_03.gltf", scene);
    const shrubRoot = new B.TransformNode("shrub source", scene);
    shrubImport.meshes.forEach((mesh: any) => { if (!mesh.parent) mesh.parent = shrubRoot; mesh.receiveShadows = true; shadows.addShadowCaster(mesh); });
    shrubRoot.scaling.setAll(.62);
    shrubRoot.position.set(-11, 0, 11);
    [[-14, 8], [-11, -11], [12, -11], [14, 3], [-15, 1], [11, 13], [4, 15], [-5, 15]].forEach(([x, z], index) => {
      const clone = shrubRoot.clone(`garden shrub ${index}`);
      clone.position.set(x, 0, z);
      clone.rotation.y = index * .83;
      clone.scaling.setAll(.48 + (index % 3) * .1);
    });
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
  let activeAnimation = "";
  let npcPoint = 0;
  const npcRoute = [new B.Vector3(4.8, .9, 1.8), new B.Vector3(3.5, .9, 6.5), new B.Vector3(-1.5, .9, 7.5), new B.Vector3(1.5, .9, 2.5)];

  const onKeyDown = (event: KeyboardEvent) => {
    keys.add(event.key.toLowerCase());
    if (event.key.toLowerCase() === "e") interact();
  };
  const onKeyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  const interact = () => { if (nearby) options.onInteract(nearby); };
  const setGrowth = (value: number) => {
    const t = Math.max(.12, Math.min(1, value / 100));
    const scale = .22 + t * .78;
    willowRoot.scaling.setAll(scale);
  };
  setGrowth(options.growth);

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

    const npcTarget = npcRoute[npcPoint];
    const npcDirection = npcTarget.subtract(npcCollider.position);
    npcDirection.y = 0;
    if (npcDirection.length() < .35) npcPoint = (npcPoint + 1) % npcRoute.length;
    else {
      npcDirection.normalize();
      npcCollider.position.addInPlace(npcDirection.scale(1.05 * dt));
      npcModel.root.rotation.y = Math.atan2(npcDirection.x, npcDirection.z);
    }
    if (!npcModel.current) { npcModel.current = "walk"; playAnimation(npcModel.groups, "walk"); }

    const npcDistance = B.Vector3.Distance(player.position, npcCollider.position);
    const plantDistance = B.Vector3.Distance(player.position, willowRoot.position.add(new B.Vector3(0, .9, 0)));
    const pondDistance = B.Vector3.Distance(player.position, pond.position.add(new B.Vector3(0, .9, 0)));
    const nextNearby: GameNotice = npcDistance < 3.1
      ? { kind: "npc", title: "Мира, хранительница сада", text: "Подойти и поговорить" }
      : plantDistance < 3.2
        ? { kind: "plant", title: "Дуб привычки", text: "Осмотреть рост" }
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
