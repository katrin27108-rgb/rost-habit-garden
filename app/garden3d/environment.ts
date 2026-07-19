import type { GardenMaterials } from "./materials";

export type GardenEnvironment = {
  ground: any;
  pond: any;
  sky: any;
  pathStones: any[];
  wettable: any[];
  grass: any[];
};

function seeded(index: number) {
  const value = Math.sin(index * 91.731 + 13.19) * 43758.5453;
  return value - Math.floor(value);
}

export function createEnvironment(B: any, scene: any, materials: GardenMaterials, shadow: any, quality: "full" | "light"): GardenEnvironment {
  const ground = B.MeshBuilder.CreateGround("sculpted meadow", { width: 54, height: 48, subdivisions: 54 }, scene);
  const positions = ground.getVerticesData(B.VertexBuffer.PositionKind);
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const z = positions[i + 2];
    const pondBasin = Math.exp(-((x + 10) ** 2 / 34 + (z - 2) ** 2 / 22)) * 1.6;
    positions[i + 1] = Math.sin(x * .22) * .22 + Math.cos(z * .18) * .16 - pondBasin;
  }
  ground.updateVerticesData(B.VertexBuffer.PositionKind, positions);
  const normals: number[] = [];
  B.VertexData.ComputeNormals(positions, ground.getIndices(), normals);
  ground.updateVerticesData(B.VertexBuffer.NormalKind, normals);
  ground.refreshBoundingInfo();
  ground.material = materials.ground;
  ground.receiveShadows = true;
  ground.checkCollisions = true;

  const sky = B.MeshBuilder.CreateSphere("living sky", { diameter: 150, segments: 24 }, scene);
  sky.isPickable = false;
  sky.infiniteDistance = true;
  const skyMaterial = new B.ShaderMaterial("atmosphere", scene, { vertex: "gardenSky", fragment: "gardenSky" }, { attributes: ["position"], uniforms: ["worldViewProjection", "time", "topColor", "horizonColor", "cloudiness"] });
  skyMaterial.backFaceCulling = false;
  skyMaterial.disableDepthWrite = true;
  sky.material = skyMaterial;

  const pond = B.MeshBuilder.CreateDisc("pond water", { radius: 5.3, tessellation: 96 }, scene);
  pond.rotation.x = Math.PI / 2;
  pond.scaling.y = .7;
  pond.position.set(-10, -.52, 2);
  const water = new B.ShaderMaterial("pond reflections", scene, { vertex: "gardenWater", fragment: "gardenWater" }, { attributes: ["position", "uv"], uniforms: ["worldViewProjection", "time", "rain", "skyTint"] });
  water.alpha = .92;
  water.backFaceCulling = false;
  pond.material = water;
  pond.receiveShadows = true;

  const pathStones: any[] = [];
  const wettable: any[] = [];
  for (let i = 0; i < 23; i++) {
    const t = i / 22;
    const z = 19 - t * 35;
    const x = 4.4 + Math.sin(t * Math.PI * 2.1) * 2.2 + t * 2;
    const stone = B.MeshBuilder.CreateCylinder(`path stone ${i}`, { height: .12 + seeded(i) * .08, diameter: 1.6 + seeded(i + 31) * .55, tessellation: 9 }, scene);
    stone.position.set(x, .08 + Math.sin(x * .22) * .12 + Math.cos(z * .18) * .08, z);
    stone.scaling.z = .6 + seeded(i + 8) * .24;
    stone.rotation.y = seeded(i + 16) * Math.PI;
    stone.material = materials.path;
    stone.metadata = { dryMaterial: materials.path, wetMaterial: materials.pathWet };
    stone.receiveShadows = true;
    pathStones.push(stone);
    wettable.push(stone);
  }

  const grass: any[] = [];
  const grassCount = quality === "full" ? 520 : 210;
  const bladeSource = B.MeshBuilder.CreatePlane("grass blade source", { width: .07, height: .65 }, scene);
  bladeSource.material = materials.reed;
  bladeSource.isVisible = false;
  bladeSource.position.y = -99;
  for (let i = 0; i < grassCount; i++) {
    const angle = seeded(i + 42) * Math.PI * 2;
    const radius = Math.sqrt(seeded(i + 103)) * 24;
    let x = Math.cos(angle) * radius;
    let z = Math.sin(angle) * radius * .88;
    if (((x + 10) ** 2 / 32 + (z - 2) ** 2 / 18) < 1.3) continue;
    if (Math.abs(x - (5 + Math.sin((19 - z) / 35 * Math.PI * 2.1) * 2.2)) < 1.2) continue;
    const blade = bladeSource.clone(`meadow blade ${i}`);
    blade.isVisible = true;
    blade.position.set(x, .36 + Math.sin(x * .22) * .22 + Math.cos(z * .18) * .16, z);
    blade.rotation.y = angle;
    const scale = .65 + seeded(i + 8) * .8;
    blade.scaling.set(scale, scale, scale);
    grass.push(blade);
  }

  for (let i = 0; i < 28; i++) {
    const angle = i / 28 * Math.PI * 2;
    const x = -10 + Math.cos(angle) * (5.4 + seeded(i) * .35);
    const z = 2 + Math.sin(angle) * (3.7 + seeded(i + 3) * .22);
    const rock = B.MeshBuilder.CreateIcoSphere(`pond bank stone ${i}`, { radius: .45 + seeded(i + 10) * .38, subdivisions: 2 }, scene);
    rock.position.set(x, -.17 + seeded(i + 5) * .2, z);
    rock.scaling.set(1.2, .62, .86);
    rock.rotation.set(seeded(i) * .5, angle, seeded(i + 2) * .3);
    rock.material = materials.rock;
    rock.receiveShadows = true;
    shadow.addShadowCaster(rock);
    wettable.push(rock);
  }

  createLavenderBorder(B, scene, materials, shadow);
  createDistantTreeLine(B, scene, materials, shadow, quality);
  return { ground, pond, sky: skyMaterial, pathStones, wettable, grass };
}

function createLavenderBorder(B: any, scene: any, materials: GardenMaterials, shadow: any) {
  for (let patch = 0; patch < 5; patch++) {
    const cx = 10 + patch * 1.1;
    const cz = 7.5 - patch * .8;
    for (let i = 0; i < 14; i++) {
      const a = seeded(patch * 30 + i) * Math.PI * 2;
      const r = seeded(patch * 30 + i + 8) * .75;
      const stem = B.MeshBuilder.CreateCylinder(`lavender stem ${patch}-${i}`, { height: .8, diameter: .035, tessellation: 5 }, scene);
      stem.position.set(cx + Math.cos(a) * r, .46, cz + Math.sin(a) * r);
      stem.rotation.z = (seeded(i + patch) - .5) * .22;
      stem.material = materials.stem;
      const bloom = B.MeshBuilder.CreateIcoSphere(`lavender bloom ${patch}-${i}`, { radius: .12, subdivisions: 1 }, scene);
      bloom.position.copyFrom(stem.position);
      bloom.position.y += .42;
      bloom.scaling.y = 1.8;
      bloom.material = materials.lavender;
      shadow.addShadowCaster(bloom);
    }
  }
}

function createDistantTreeLine(B: any, scene: any, materials: GardenMaterials, shadow: any, quality: "full" | "light") {
  const count = quality === "full" ? 34 : 18;
  for (let i = 0; i < count; i++) {
    const x = -25 + i * (50 / (count - 1)) + (seeded(i) - .5) * 2;
    const z = -20 - seeded(i + 4) * 4;
    const trunk = B.MeshBuilder.CreateCylinder(`distant trunk ${i}`, { height: 3.8 + seeded(i + 3) * 2.4, diameterTop: .22, diameterBottom: .55, tessellation: 7 }, scene);
    trunk.position.set(x, 2, z);
    trunk.material = materials.bark;
    const crown = B.MeshBuilder.CreateIcoSphere(`distant crown ${i}`, { radius: 2.2 + seeded(i + 8), subdivisions: 2 }, scene);
    crown.position.set(x, 5.1 + seeded(i + 2) * 1.5, z);
    crown.scaling.set(.8 + seeded(i) * .45, 1.15 + seeded(i + 9) * .45, .8 + seeded(i + 11) * .4);
    crown.material = i % 3 === 0 ? materials.leafGold : materials.leafDark;
    shadow.addShadowCaster(crown);
  }
}
