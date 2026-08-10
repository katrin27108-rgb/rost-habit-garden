from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
GROWTH = ROOT / "public" / "plants" / "growth"
SOURCES = ROOT / "assets" / "plants-growth-sources"
SPECIES = ("sunflower", "tomato", "lavender", "monstera", "oak", "apple", "peony", "sakura")
GRID_COLUMNS = 5
GRID_ROWS = 6
FRAME_COUNT = GRID_COLUMNS * GRID_ROWS
OUTPUT_SIZE = 384
ALPHA_THRESHOLD = 56
VISIBLE_ALPHA = 220
MIN_COMPONENT_PIXELS = 24
SAFE_EDGE = 5
REGION_SCALE = 1.6


def component_masks(source: Image.Image) -> list[Image.Image]:
    """Assign every connected foreground component to its nearest atlas cell."""
    width, height = source.size
    alpha = source.getchannel("A")
    alpha_pixels = alpha.load()
    visited = bytearray(width * height)
    masks = [Image.new("L", source.size, 0) for _ in range(FRAME_COUNT)]
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
            column = min(GRID_COLUMNS - 1, max(0, int(center_x * GRID_COLUMNS / width)))
            row = min(GRID_ROWS - 1, max(0, int(center_y * GRID_ROWS / height)))
            destination = mask_pixels[row * GRID_COLUMNS + column]
            for pixel_x, pixel_y in component:
                destination[pixel_x, pixel_y] = alpha_pixels[pixel_x, pixel_y]

    return masks


def fixed_region(source: Image.Image, column: int, row: int) -> Image.Image:
    """Crop a padded, fixed-size region while preserving relative stage scale."""
    cell_width = source.width / GRID_COLUMNS
    cell_height = source.height / GRID_ROWS
    region_size = round(max(cell_width, cell_height) * REGION_SCALE)
    center_x = (column + 0.5) * cell_width
    center_y = (row + 0.5) * cell_height
    left = round(center_x - region_size / 2)
    top = round(center_y - region_size / 2)

    region = Image.new("RGBA", (region_size, region_size), (0, 0, 0, 0))
    source_left = max(0, left)
    source_top = max(0, top)
    source_right = min(source.width, left + region_size)
    source_bottom = min(source.height, top + region_size)
    if source_right > source_left and source_bottom > source_top:
        crop = source.crop((source_left, source_top, source_right, source_bottom))
        region.alpha_composite(crop, (source_left - left, source_top - top))
    return region


def ensure_safe_frame(frame: Image.Image, species: str, index: int) -> None:
    alpha = frame.getchannel("A").point(lambda value: 255 if value >= VISIBLE_ALPHA else 0)
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError(f"No visible plant found for {species} frame {index}")

    left, top, right, bottom = bounds
    if left < SAFE_EDGE or top < SAFE_EDGE or right > OUTPUT_SIZE - SAFE_EDGE or bottom > OUTPUT_SIZE - SAFE_EDGE:
        raise ValueError(
            f"Unsafe crop for {species} frame {index}: {bounds}; "
            f"expected at least {SAFE_EDGE}px transparent padding"
        )


for species in SPECIES:
    source_path = SOURCES / f"{species}-growth-30-alpha.png"
    source = Image.open(source_path).convert("RGBA")
    masks = component_masks(source)
    output_dir = GROWTH / species
    output_dir.mkdir(exist_ok=True)

    for index, mask in enumerate(masks):
        isolated = Image.new("RGBA", source.size, (0, 0, 0, 0))
        isolated.paste(source, mask=mask)
        row, column = divmod(index, GRID_COLUMNS)
        region = fixed_region(isolated, column, row)
        frame = region.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.Resampling.LANCZOS)
        ensure_safe_frame(frame, species, index)
        frame.save(output_dir / f"{index:02d}.png", optimize=True)

    print(f"{species}: {FRAME_COUNT} isolated {OUTPUT_SIZE}x{OUTPUT_SIZE} frames")
