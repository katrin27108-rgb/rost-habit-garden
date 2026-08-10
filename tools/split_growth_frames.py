from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
GROWTH = ROOT / "public" / "plants" / "growth"
SPECIES = ("sunflower", "tomato", "lavender", "monstera")
ALPHA_THRESHOLD = 24
MIN_COMPONENT_PIXELS = 40
OUTPUT_SIZE = 384
BOTTOM_MARGIN = 30


def component_masks(source: Image.Image) -> list[Image.Image]:
    width, height = source.size
    alpha = source.getchannel("A")
    alpha_pixels = alpha.load()
    visited = bytearray(width * height)
    masks = [Image.new("L", source.size, 0) for _ in range(16)]
    mask_pixels = [mask.load() for mask in masks]

    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index] or alpha_pixels[x, y] < ALPHA_THRESHOLD:
                continue

            visited[index] = 1
            queue = deque([(x, y)])
            component: list[tuple[int, int]] = []
            min_x = max_x = x
            min_y = max_y = y

            while queue:
                current_x, current_y = queue.popleft()
                component.append((current_x, current_y))
                min_x = min(min_x, current_x)
                max_x = max(max_x, current_x)
                min_y = min(min_y, current_y)
                max_y = max(max_y, current_y)

                for neighbor_y in range(max(0, current_y - 1), min(height, current_y + 2)):
                    for neighbor_x in range(max(0, current_x - 1), min(width, current_x + 2)):
                        neighbor_index = neighbor_y * width + neighbor_x
                        if visited[neighbor_index] or alpha_pixels[neighbor_x, neighbor_y] < ALPHA_THRESHOLD:
                            continue
                        visited[neighbor_index] = 1
                        queue.append((neighbor_x, neighbor_y))

            if len(component) < MIN_COMPONENT_PIXELS:
                continue

            center_x = (min_x + max_x) / 2
            center_y = (min_y + max_y) / 2
            column = min(3, max(0, int(center_x * 4 / width)))
            row = min(3, max(0, int(center_y * 4 / height)))
            destination = mask_pixels[row * 4 + column]
            for pixel_x, pixel_y in component:
                destination[pixel_x, pixel_y] = alpha_pixels[pixel_x, pixel_y]

    return masks


for species in SPECIES:
    source_path = GROWTH / f"{species}-growth.png"
    source = Image.open(source_path).convert("RGBA")
    masks = component_masks(source)
    output_dir = GROWTH / species
    output_dir.mkdir(exist_ok=True)

    for frame, mask in enumerate(masks):
        isolated = Image.new("RGBA", source.size, (0, 0, 0, 0))
        isolated.paste(source, mask=mask)
        bounds = isolated.getbbox()
        if bounds is None:
            raise ValueError(f"No visible plant found for {species} frame {frame}")

        subject = isolated.crop(bounds)
        target_extent = 270 + frame * 4
        scale = min(target_extent / subject.width, target_extent / subject.height)
        subject = subject.resize(
            (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
            Image.Resampling.LANCZOS,
        )
        frame_image = Image.new("RGBA", (OUTPUT_SIZE, OUTPUT_SIZE), (0, 0, 0, 0))
        frame_image.alpha_composite(subject, ((OUTPUT_SIZE - subject.width) // 2, OUTPUT_SIZE - BOTTOM_MARGIN - subject.height))
        frame_image.save(output_dir / f"{frame:02d}.png", optimize=True)

    print(f"{species}: 16 isolated {OUTPUT_SIZE}x{OUTPUT_SIZE} frames")
