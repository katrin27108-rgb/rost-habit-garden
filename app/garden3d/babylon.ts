declare global {
  interface Window {
    BABYLON?: any;
  }
}

let loading: Promise<any> | undefined;

export function loadBabylon() {
  if (window.BABYLON) return Promise.resolve(window.BABYLON);
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/vendor/babylon.js";
    script.async = true;
    script.onload = () => window.BABYLON ? resolve(window.BABYLON) : reject(new Error("Babylon.js не запустился"));
    script.onerror = () => reject(new Error("Не удалось загрузить локальный 3D-движок"));
    document.head.appendChild(script);
  });

  return loading;
}
