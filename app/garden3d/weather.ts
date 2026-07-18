import type { GardenEnvironment } from "./environment";
import type { GardenWeather } from "./types";

export type WeatherSystem = {
  rain: any;
  update: (weather: GardenWeather, time: number) => void;
};

export function createWeatherSystem(B: any, scene: any, environment: GardenEnvironment, sun: any, hemi: any): WeatherSystem {
  const texture = B.RawTexture.CreateRGBATexture(new Uint8Array([
    255, 255, 255, 0,
    235, 244, 255, 115,
    235, 244, 255, 210,
    255, 255, 255, 0,
  ]), 1, 4, scene, false, false, B.Texture.NEAREST_SAMPLINGMODE);
  const rain = new B.ParticleSystem("real rain", 1400, scene);
  rain.particleTexture = texture;
  rain.emitter = new B.Vector3(0, 20, 0);
  rain.minEmitBox = new B.Vector3(-22, 0, -18);
  rain.maxEmitBox = new B.Vector3(22, 0, 18);
  rain.direction1 = new B.Vector3(-1.2, -22, .4);
  rain.direction2 = new B.Vector3(-2.1, -28, -.4);
  rain.minLifeTime = .75;
  rain.maxLifeTime = 1.2;
  rain.minSize = .055;
  rain.maxSize = .11;
  rain.emitRate = 0;
  rain.color1 = new B.Color4(.73, .84, .91, .62);
  rain.color2 = new B.Color4(.9, .95, 1, .38);
  rain.blendMode = B.ParticleSystem.BLENDMODE_STANDARD;
  rain.start();

  let currentCloud = 0;
  let currentRain = 0;
  return {
    rain,
    update(weather, time) {
      const targetCloud = weather === "clear" ? .12 : weather === "overcast" ? .7 : 1;
      const targetRain = weather === "rain" ? 1 : 0;
      currentCloud += (targetCloud - currentCloud) * .035;
      currentRain += (targetRain - currentRain) * .05;
      rain.emitRate = Math.round(currentRain * 880);
      sun.intensity = 1.08 - currentCloud * .48;
      hemi.intensity = .54 - currentCloud * .12;
      sun.diffuse = B.Color3.Lerp(B.Color3.FromHexString("#fff1ca"), B.Color3.FromHexString("#aebbc3"), currentCloud);
      scene.fogDensity = .006 + currentCloud * .009;
      scene.fogColor = B.Color3.Lerp(B.Color3.FromHexString("#dce8d5"), B.Color3.FromHexString("#7d8a88"), currentCloud);
      scene.imageProcessingConfiguration.exposure = .91 - currentCloud * .1;
      scene.imageProcessingConfiguration.contrast = 1.22 - currentCloud * .08;
      scene.imageProcessingConfiguration.colorCurvesEnabled = false;
      environment.sky.setFloat("time", time);
      environment.sky.setFloat("cloudiness", currentCloud);
      environment.sky.setColor3("topColor", B.Color3.Lerp(B.Color3.FromHexString("#6aa8d7"), B.Color3.FromHexString("#465963"), currentCloud));
      environment.sky.setColor3("horizonColor", B.Color3.Lerp(B.Color3.FromHexString("#f2dfb5"), B.Color3.FromHexString("#b2b9b4"), currentCloud));
      environment.pond.material.setFloat("time", time);
      environment.pond.material.setFloat("rain", currentRain);
      environment.pond.material.setColor3("skyTint", B.Color3.Lerp(B.Color3.FromHexString("#70a4a2"), B.Color3.FromHexString("#46585c"), currentCloud));
      for (const stone of environment.wettable) {
        if (stone.metadata?.dryMaterial) stone.material = currentRain > .25 ? stone.metadata.wetMaterial : stone.metadata.dryMaterial;
      }
    },
  };
}
