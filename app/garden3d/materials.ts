export type GardenMaterials = ReturnType<typeof createGardenMaterials>;

export function createGardenMaterials(B: any, scene: any) {
  const pbr = (name: string, color: string, roughness: number, metallic = 0) => {
    const material = new B.PBRMaterial(name, scene);
    material.albedoColor = B.Color3.FromHexString(color);
    material.roughness = roughness;
    material.metallic = metallic;
    material.environmentIntensity = .55;
    return material;
  };

  const ground = pbr("earth and moss", "#526d3c", .98);
  ground.microSurface = .08;
  ground.albedoTexture = new B.Texture("/garden-3d/textures/leafy-grass-diff.jpg", scene);
  ground.albedoTexture.uScale = 7;
  ground.albedoTexture.vScale = 7;
  ground.bumpTexture = new B.Texture("/garden-3d/textures/leafy-grass-normal.jpg", scene);
  ground.bumpTexture.uScale = 7;
  ground.bumpTexture.vScale = 7;
  ground.bumpTexture.level = .48;
  const path = pbr("warm garden stone", "#9b8c70", .86);
  const pathWet = pbr("wet stone", "#746f63", .34);
  const bark = pbr("old oak bark", "#5b3c25", .94);
  const barkLight = pbr("young oak bark", "#765237", .9);
  for (const material of [bark, barkLight]) {
    material.albedoTexture = new B.Texture("/garden-3d/textures/oak-bark-diff.jpg", scene);
    material.albedoTexture.uScale = 2.2;
    material.albedoTexture.vScale = 5.4;
    material.bumpTexture = new B.Texture("/garden-3d/textures/oak-bark-normal.jpg", scene);
    material.bumpTexture.uScale = 2.2;
    material.bumpTexture.vScale = 5.4;
    material.bumpTexture.level = .62;
  }
  const leaf = pbr("oak leaf", "#3f7838", .74);
  leaf.backFaceCulling = false;
  leaf.twoSidedLighting = true;
  leaf.subSurface.isTranslucencyEnabled = true;
  leaf.subSurface.translucencyIntensity = .32;
  leaf.subSurface.tintColor = B.Color3.FromHexString("#90b85d");
  const leafDark = pbr("oak leaf shadow", "#285330", .78);
  leafDark.backFaceCulling = false;
  leafDark.twoSidedLighting = true;
  const leafGold = pbr("young leaf light", "#82a84c", .7);
  leafGold.backFaceCulling = false;
  leafGold.twoSidedLighting = true;
  const lavender = pbr("lavender flowers", "#7b62a6", .66);
  const stem = pbr("lavender stems", "#55724a", .9);
  const rock = pbr("moss stone", "#687061", .96);
  const reed = pbr("reeds", "#6d8050", .88);
  reed.backFaceCulling = false;

  return { ground, path, pathWet, bark, barkLight, leaf, leafDark, leafGold, lavender, stem, rock, reed };
}
