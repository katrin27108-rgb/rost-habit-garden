import type { GardenCamera, GardenWalker } from "./types";

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function updateWalker(
  walker: GardenWalker,
  target: GardenWalker | null,
  direction: GardenWalker,
  dt: number,
) {
  let dx = direction.x;
  let dy = direction.y;
  let moving = dx !== 0 || dy !== 0;

  if (!moving && target) {
    dx = target.x - walker.x;
    dy = target.y - walker.y;
    moving = Math.hypot(dx, dy) > 8;
  }

  if (moving) {
    const length = Math.hypot(dx, dy) || 1;
    const speed = dt * .19;
    walker.x += dx / length * speed;
    walker.y += dy / length * speed;
  }

  walker.x = clamp(walker.x, -650, 650);
  walker.y = clamp(walker.y, -190, 390);

  // The pond occupies the lower-left part of the painted world.
  const pondX = -410;
  const pondY = 235;
  const normalized = Math.hypot((walker.x - pondX) / 210, (walker.y - pondY) / 112);
  if (normalized < 1) {
    const angle = Math.atan2((walker.y - pondY) / 112, (walker.x - pondX) / 210);
    walker.x = pondX + Math.cos(angle) * 218;
    walker.y = pondY + Math.sin(angle) * 118;
  }

  return moving;
}

export function updateCamera(camera: GardenCamera, walker: GardenWalker, dt: number, exploring: boolean) {
  const targetX = exploring ? walker.x : 0;
  const targetY = exploring ? walker.y - 35 : 35;
  const ease = 1 - Math.exp(-dt * (exploring ? .0045 : .0028));
  camera.x += (targetX - camera.x) * ease;
  camera.y += (targetY - camera.y) * ease;
}

export function sceneZoom(width: number, exploring: boolean) {
  const mobile = width < 560;
  return (mobile ? 1.12 : exploring ? 1.03 : .94) * clamp(width / 900, .62, 1.12);
}

export function projectPoint(
  x: number,
  y: number,
  width: number,
  height: number,
  zoom: number,
  camera: GardenCamera,
) {
  return {
    x: width / 2 + (x - camera.x) * zoom,
    y: height * .64 + (y - camera.y) * zoom * .54,
  };
}

