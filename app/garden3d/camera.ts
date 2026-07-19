import type { GardenView } from "./types";

export type GardenCameras = {
  overview: any;
  walk: any;
  setView: (view: GardenView) => void;
  moveWalk: (x: number, z: number) => void;
};

export function createGardenCameras(B: any, scene: any, canvas: HTMLCanvasElement): GardenCameras {
  const overview = new B.ArcRotateCamera("garden overview", .88, 1.03, 34, new B.Vector3(1.6, 3.2, -.5), scene);
  overview.lowerRadiusLimit = 12;
  overview.upperRadiusLimit = 44;
  overview.lowerBetaLimit = .55;
  overview.upperBetaLimit = 1.38;
  overview.wheelPrecision = 38;
  overview.pinchPrecision = 65;
  overview.panningSensibility = 0;
  overview.attachControl(canvas, true);

  const walk = new B.UniversalCamera("walk through the garden", new B.Vector3(7.2, 1.65, 13.2), scene);
  walk.setTarget(new B.Vector3(5.8, 2.1, -1.5));
  walk.speed = .32;
  walk.angularSensibility = 3100;
  walk.inertia = .84;
  walk.minZ = .08;
  walk.ellipsoid = new B.Vector3(.45, .85, .45);
  walk.checkCollisions = true;
  walk.applyGravity = false;
  walk.keysUp = [87, 38];
  walk.keysDown = [83, 40];
  walk.keysLeft = [65, 37];
  walk.keysRight = [68, 39];

  let active: GardenView = "overview";
  const setView = (view: GardenView) => {
    if (view === active) return;
    if (view === "walk") {
      overview.detachControl();
      walk.attachControl(canvas, true);
      scene.activeCamera = walk;
    } else {
      walk.detachControl();
      overview.attachControl(canvas, true);
      scene.activeCamera = overview;
    }
    active = view;
  };

  return {
    overview,
    walk,
    setView,
    moveWalk(x, z) {
      const forward = walk.getDirection(B.Axis.Z);
      forward.y = 0;
      forward.normalize();
      const right = B.Vector3.Cross(B.Axis.Y, forward).normalize();
      const next = walk.position.add(forward.scale(z * .36)).add(right.scale(x * .36));
      const pond = ((next.x + 10) ** 2 / 36 + (next.z - 2) ** 2 / 20) < 1;
      if (!pond && Math.abs(next.x) < 24 && Math.abs(next.z) < 21) walk.position.copyFrom(next);
    },
  };
}
