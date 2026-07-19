declare global {
  interface Window {
    BABYLON?: any;
  }
}

let loading: Promise<any> | undefined;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing?.dataset.ready === "true") return resolve();
    const script = existing ?? document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => { script.dataset.ready = "true"; resolve(); };
    script.onerror = () => reject(new Error(`Не удалось загрузить ${src}`));
    if (!existing) document.head.appendChild(script);
  });
}

export function loadBabylon() {
  if (loading) return loading;
  loading = (async () => {
    if (!window.BABYLON) await loadScript("/vendor/babylon.js");
    if (!window.BABYLON) throw new Error("3D-движок не запустился");
    await loadScript("/vendor/babylonjs.loaders.min.js");
    return window.BABYLON;
  })();
  return loading;
}
