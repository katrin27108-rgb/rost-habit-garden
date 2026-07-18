import { smoothstep } from "./types";
import type { GardenMaterials } from "./materials";

type BranchSegment = {
  node: any;
  cylinder: any;
  length: number;
  birth: number;
  phase: number;
  basePosition: any;
  baseRotation: any;
};

type LeafCluster = {
  mesh: any;
  birth: number;
  baseScale: any;
  basePosition: any;
  phase: number;
};

export type LivingOak = {
  root: any;
  seed: any;
  sprout: any;
  segments: BranchSegment[];
  leaves: LeafCluster[];
  acorns: LeafCluster[];
  leafMaterials: any[];
};

function seeded(index: number) {
  const value = Math.sin(index * 113.41 + 9.73) * 41927.171;
  return value - Math.floor(value);
}

function orientationFromY(B: any, direction: any) {
  const up = B.Axis.Y;
  const dir = direction.normalize();
  const dot = Math.min(1, Math.max(-1, B.Vector3.Dot(up, dir)));
  const axis = B.Vector3.Cross(up, dir);
  if (axis.lengthSquared() < .00001) return B.Quaternion.Identity();
  return B.Quaternion.RotationAxis(axis.normalize(), Math.acos(dot));
}

export function createLivingOak(B: any, scene: any, materials: GardenMaterials, shadow: any, quality: "full" | "light"): LivingOak {
  const root = new B.TransformNode("one habit — living oak", scene);
  root.position.set(5.8, .15, -1.5);
  const segments: BranchSegment[] = [];
  const leaves: LeafCluster[] = [];
  const acorns: LeafCluster[] = [];

  const seed = B.MeshBuilder.CreateSphere("oak seed", { diameter: .56, segments: 20 }, scene);
  seed.parent = root;
  seed.position.set(0, .13, 0);
  seed.scaling.set(.78, 1.15, .78);
  seed.rotation.z = .42;
  seed.material = materials.barkLight;
  shadow.addShadowCaster(seed);

  const sprout = new B.TransformNode("oak sprout", scene);
  sprout.parent = root;
  const sproutStem = B.MeshBuilder.CreateCylinder("oak sprout stem", { height: 2.35, diameterTop: .095, diameterBottom: .19, tessellation: 11 }, scene);
  sproutStem.parent = sprout;
  sproutStem.position.y = 1.18;
  sproutStem.material = materials.stem;
  const sproutLeafLeft = B.MeshBuilder.CreateSphere("first oak leaf left", { diameter: .72, segments: 20 }, scene);
  sproutLeafLeft.parent = sprout;
  sproutLeafLeft.position.set(-.34, 1.95, 0);
  sproutLeafLeft.scaling.set(1.45, .48, .72);
  sproutLeafLeft.rotation.z = -.55;
  sproutLeafLeft.material = materials.leafGold;
  const sproutLeafRight = sproutLeafLeft.clone("first oak leaf right");
  sproutLeafRight.position.x = .34;
  sproutLeafRight.rotation.z = .55;
  shadow.addShadowCaster(sproutLeafLeft);
  shadow.addShadowCaster(sproutLeafRight);

  let cursor = 0;
  const addSegment = (start: any, end: any, radius: number, birth: number, material: any) => {
    const direction = end.subtract(start);
    const length = direction.length();
    const node = new B.TransformNode(`oak growth joint ${cursor}`, scene);
    node.parent = root;
    node.position.copyFrom(start);
    node.rotationQuaternion = orientationFromY(B, direction);
    const cylinder = B.MeshBuilder.CreateCylinder(`oak branch ${cursor}`, {
      height: length,
      diameterTop: Math.max(.035, radius * 1.22),
      diameterBottom: radius * 2,
      tessellation: radius > .18 ? 11 : 7,
    }, scene);
    cylinder.parent = node;
    cylinder.position.y = length / 2;
    cylinder.material = material;
    cylinder.receiveShadows = true;
    shadow.addShadowCaster(cylinder);
    const segment = { node, cylinder, length, birth, phase: seeded(cursor) * Math.PI * 2, basePosition: start.clone(), baseRotation: node.rotationQuaternion.clone() };
    segments.push(segment);
    cursor += 1;
    return segment;
  };

  const trunkPoints = [new B.Vector3(0, 0, 0)];
  for (let i = 1; i <= 13; i++) {
    const prev = trunkPoints[i - 1];
    trunkPoints.push(new B.Vector3(
      Math.sin(i * .68) * .12 + i * .035,
      prev.y + .73 + i * .025,
      Math.cos(i * .53) * .1,
    ));
    addSegment(prev, trunkPoints[i], .48 * (1 - i / 17), .08 + i * .025, i < 5 ? materials.bark : materials.barkLight);
  }

  let branchIndex = 0;
  const branchTips: Array<{ point: any; birth: number; phase: number }> = [];
  for (let level = 3; level <= 12; level++) {
    const branchCount = level < 6 ? 3 : 4;
    for (let b = 0; b < branchCount; b++) {
      const start = trunkPoints[level];
      const angle = level * 2.18 + b * (Math.PI * 2 / branchCount) + seeded(branchIndex) * .45;
      const length = (2.3 + level * .16) * (.82 + seeded(branchIndex + 4) * .34);
      const rise = .68 + seeded(branchIndex + 2) * 1.25;
      const middle = start.add(new B.Vector3(Math.cos(angle) * length * .48, rise * .56, Math.sin(angle) * length * .48));
      const tip = start.add(new B.Vector3(Math.cos(angle) * length, rise, Math.sin(angle) * length));
      const birth = .31 + level * .027 + b * .006;
      addSegment(start, middle, .2 * (1 - level / 21), birth, materials.barkLight);
      addSegment(middle, tip, .14 * (1 - level / 22), birth + .045, materials.barkLight);

      const sideAngle = angle + (b % 2 ? .72 : -.72);
      const sideTip = middle.add(new B.Vector3(Math.cos(sideAngle) * length * .46, .62 + seeded(branchIndex + 9) * .35, Math.sin(sideAngle) * length * .46));
      addSegment(middle, sideTip, .08, birth + .085, materials.barkLight);
      branchTips.push({ point: tip, birth: birth + .13, phase: angle }, { point: sideTip, birth: birth + .16, phase: sideAngle });
      branchIndex += 1;
    }
  }

  const materialCycle = [materials.leaf, materials.leafDark, materials.leafGold];
  branchTips.forEach((tip, index) => {
    const clusters = quality === "full" ? 4 : 2;
    for (let i = 0; i < clusters; i++) {
      const offsetAngle = tip.phase + i * 2.2 + seeded(index * 10 + i);
      const radius = .45 + seeded(index * 15 + i) * .62;
      const mesh = B.MeshBuilder.CreateIcoSphere(`oak leaf crown ${index}-${i}`, { radius: .44 + seeded(index + i * 8) * .28, subdivisions: quality === "full" ? 3 : 2 }, scene);
      mesh.parent = root;
      mesh.position.copyFrom(tip.point.add(new B.Vector3(Math.cos(offsetAngle) * radius, (seeded(index + i) - .15) * .75, Math.sin(offsetAngle) * radius)));
      mesh.scaling.set(1.05 + seeded(index + i * 2) * .5, .6 + seeded(index + i * 3) * .38, .9 + seeded(index + i * 5) * .46);
      mesh.rotation.set(seeded(index + i) * .6, offsetAngle, seeded(index + i + 7) * .45);
      mesh.material = materialCycle[(index + i) % materialCycle.length];
      mesh.receiveShadows = true;
      shadow.addShadowCaster(mesh);
      leaves.push({ mesh, birth: Math.min(.79, tip.birth - .08 + i * .012), baseScale: mesh.scaling.clone(), basePosition: mesh.position.clone(), phase: tip.phase + i });
    }
  });

  for (let i = 0; i < 22; i++) {
    const parent = leaves[(i * 13) % leaves.length];
    const acorn = B.MeshBuilder.CreateSphere(`oak acorn ${i}`, { diameter: .12, segments: 8 }, scene);
    acorn.parent = root;
    acorn.position.copyFrom(parent.basePosition.add(new B.Vector3((seeded(i) - .5) * .8, -.45 - seeded(i + 2) * .32, (seeded(i + 4) - .5) * .8)));
    acorn.scaling.y = 1.4;
    acorn.material = materials.barkLight;
    shadow.addShadowCaster(acorn);
    acorns.push({ mesh: acorn, birth: .91 + seeded(i) * .05, baseScale: acorn.scaling.clone(), basePosition: acorn.position.clone(), phase: seeded(i + 10) * 6.2 });
  }

  return { root, seed, sprout, segments, leaves, acorns, leafMaterials: materialCycle };
}

export function updateLivingOak(B: any, oak: LivingOak, growth: number, health: number, time: number, reducedMotion: boolean) {
  const wind = reducedMotion ? 0 : .018 + health * .035;
  const droop = (1 - health) * .58;
  const seedLife = 1 - smoothstep(.09, .22, growth);
  oak.seed.setEnabled(seedLife > .01);
  oak.seed.scaling.set(.78 * seedLife, 1.15 * seedLife, .78 * seedLife);
  const sproutRise = smoothstep(.055, .2, growth);
  const sproutFade = 1 - smoothstep(.33, .47, growth);
  const sproutLife = sproutRise * sproutFade;
  oak.sprout.setEnabled(sproutLife > .01);
  oak.sprout.scaling.set(.65 + sproutRise * .35, sproutLife, .65 + sproutRise * .35);
  oak.sprout.rotation.z = (1 - health) * .22 + (reducedMotion ? 0 : Math.sin(time * .0011) * .025 * health);
  for (const segment of oak.segments) {
    const grown = smoothstep(segment.birth, segment.birth + .12, growth);
    segment.cylinder.scaling.y = Math.max(.001, grown);
    segment.cylinder.scaling.x = .38 + grown * .62;
    segment.cylinder.scaling.z = .38 + grown * .62;
    segment.cylinder.position.y = segment.length * grown / 2;
    segment.node.setEnabled(grown > .002);
    segment.node.rotationQuaternion.copyFrom(segment.baseRotation);
    if (!reducedMotion && grown > .5) {
      const sway = Math.sin(time * .00072 + segment.phase) * wind * Math.min(1, segment.birth * 1.7);
      segment.node.rotate(B.Axis.Z, sway, B.Space.LOCAL);
    }
  }

  for (const leaf of [...oak.leaves, ...oak.acorns]) {
    const emerged = smoothstep(leaf.birth, leaf.birth + .085, growth);
    const asleep = .72 + health * .28;
    leaf.mesh.setEnabled(emerged > .004);
    const pulse = reducedMotion ? 1 : 1 + Math.sin(time * .0011 + leaf.phase) * .018 * health;
    leaf.mesh.scaling.set(
      leaf.baseScale.x * emerged * pulse,
      leaf.baseScale.y * emerged * asleep,
      leaf.baseScale.z * emerged * pulse,
    );
    leaf.mesh.position.x = leaf.basePosition.x + Math.sin(time * .00065 + leaf.phase) * wind * .9;
    leaf.mesh.position.y = leaf.basePosition.y - droop * (.22 + leaf.birth * .55);
    leaf.mesh.position.z = leaf.basePosition.z + Math.cos(time * .00058 + leaf.phase) * wind * .75;
    leaf.mesh.rotation.z = droop * .28 + Math.sin(time * .0007 + leaf.phase) * wind;
  }

  const healthy = B.Color3.FromHexString("#3f7838");
  const dry = B.Color3.FromHexString("#7a6840");
  const shadowHealthy = B.Color3.FromHexString("#285330");
  const shadowDry = B.Color3.FromHexString("#5d5138");
  const youngHealthy = B.Color3.FromHexString("#82a84c");
  const youngDry = B.Color3.FromHexString("#8b7846");
  oak.leafMaterials[0].albedoColor = B.Color3.Lerp(dry, healthy, health);
  oak.leafMaterials[1].albedoColor = B.Color3.Lerp(shadowDry, shadowHealthy, health);
  oak.leafMaterials[2].albedoColor = B.Color3.Lerp(youngDry, youngHealthy, health);
}
