export type GardenResources = {
  environment: HTMLImageElement;
  oakCanopy: HTMLImageElement;
  willowCanopy: HTMLImageElement;
  lavenderBush: HTMLImageElement;
};

let cached: Promise<GardenResources> | undefined;

function projectAsset(path: string) {
  const prefix = typeof location !== "undefined" && location.pathname.startsWith("/rost-habit-garden")
    ? "/rost-habit-garden"
    : "";
  return `${prefix}${path}`;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Не удалось загрузить ресурс ${src}`));
    image.src = src;
  });
}

export function loadGardenResources() {
  cached ??= Promise.all([
    loadImage(projectAsset("/garden-prototype/garden-environment-v1.webp")),
    loadImage(projectAsset("/garden-prototype/oak-canopy-v1.webp")),
    loadImage(projectAsset("/garden-prototype/willow-canopy-v1.webp")),
    loadImage(projectAsset("/garden-prototype/lavender-bush-v1.webp")),
  ]).then(([environment, oakCanopy, willowCanopy, lavenderBush]) => ({ environment, oakCanopy, willowCanopy, lavenderBush }));
  return cached;
}
