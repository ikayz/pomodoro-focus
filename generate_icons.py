import math
import struct
import zlib
import os

def create_png(width, height, rgba_data):
    """
    Creates a valid PNG file in bytes from a list of (r, g, b, a) tuples of length width * height.
    """
    def chunk(tag, data):
        return (
            struct.pack('>I', len(data)) +
            tag +
            data +
            struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
        )

    # 8-byte PNG signature
    png = b'\x89PNG\r\n\x1a\n'

    # IHDR chunk: width, height, bit_depth=8, color_type=6 (RGBA), compression=0, filter=0, interlace=0
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png += chunk(b'IHDR', ihdr)

    # Raw scanlines with filter byte 0 at the start of each row
    raw_scanlines = bytearray()
    for y in range(height):
        raw_scanlines.append(0)  # Filter type 0: None
        for x in range(width):
            idx = (y * width + x) * 4
            raw_scanlines.extend(rgba_data[idx:idx+4])

    idat = zlib.compress(bytes(raw_scanlines), level=9)
    png += chunk(b'IDAT', idat)
    png += chunk(b'IEND', b'')
    return png

def render_icon(size):
    """
    Renders a Pomodoro tomato icon with a leaf and timer notch into an RGBA bytearray.
    """
    rgba = bytearray(size * size * 4)
    cx = size / 2.0
    cy = size * 0.54  # slightly below center to leave room for leaf
    rx = size * 0.40  # horizontal radius
    ry = size * 0.38  # vertical radius

    # Leaf coordinates
    stem_x = cx
    stem_top_y = size * 0.08
    stem_base_y = cy - ry * 0.7

    for y in range(size):
        for x in range(size):
            idx = (y * size + x) * 4

            # Coordinates relative to center
            dx = (x + 0.5 - cx) / rx
            dy = (y + 0.5 - cy) / ry
            dist_sq = dx * dx + dy * dy

            # Check tomato body (soft indentation at top center)
            indent = 0.22 * math.exp(-((x + 0.5 - cx) / (rx * 0.5)) ** 2) if (y + 0.5) < cy else 0.0
            effective_dist = math.sqrt(dist_sq) + indent

            # Anti-aliasing margin
            pixel_size = 1.0 / min(rx, ry)
            edge_lower = 1.0 - pixel_size
            edge_upper = 1.0 + pixel_size

            # Leaf/Stem check
            # Stem: small quadratic curve
            in_stem = False
            stem_alpha = 0.0
            if size * 0.06 <= y <= cy - ry * 0.5:
                stem_center_x = cx + math.sin((y - size * 0.06) / (size * 0.4) * math.pi) * (size * 0.06)
                if abs(x + 0.5 - stem_center_x) <= size * 0.045:
                    in_stem = True
                    stem_alpha = 1.0

            # Leaf to the right
            lx = (x + 0.5 - (cx + size * 0.12)) / (size * 0.22)
            ly = (y + 0.5 - (size * 0.16)) / (size * 0.10)
            leaf_dist = lx * lx + ly * ly
            in_leaf = leaf_dist <= 1.0

            # Combine rendering
            if in_stem or in_leaf:
                # Emerald Green Leaf (#10B981)
                r, g, b = 16, 185, 129
                # Add slight shadow/highlight to leaf
                if in_leaf and lx > 0:
                    r, g, b = 5, 150, 105
                rgba[idx] = r
                rgba[idx+1] = g
                rgba[idx+2] = b
                rgba[idx+3] = 255
            elif effective_dist <= edge_upper:
                # Anti-aliased alpha for tomato body
                alpha = 1.0
                if effective_dist > edge_lower:
                    alpha = (edge_upper - effective_dist) / (edge_upper - edge_lower)
                    alpha = max(0.0, min(1.0, alpha))

                # Color: Vibrant Red Gradient (#EF4444 to #DC2626)
                light_dx = (x + 0.5 - (cx - rx * 0.3)) / rx
                light_dy = (y + 0.5 - (cy - ry * 0.3)) / ry
                light_dist = math.sqrt(light_dx * light_dx + light_dy * light_dy)

                # Base red
                base_r = int(244 - light_dist * 40)
                base_g = int(67 - light_dist * 30)
                base_b = int(54 - light_dist * 20)

                base_r = max(200, min(255, base_r))
                base_g = max(30, min(80, base_g))
                base_b = max(30, min(80, base_b))

                # Timer dial white circle in center if size >= 32
                if size >= 32:
                    timer_r = rx * 0.48
                    cdx = (x + 0.5 - cx)
                    cdy = (y + 0.5 - (cy + ry * 0.05))
                    c_dist = math.sqrt(cdx * cdx + cdy * cdy)

                    # Dial ring (white outline)
                    ring_thickness = max(1.2, size * 0.04)
                    if abs(c_dist - timer_r) < ring_thickness:
                        # Crisp white ring
                        base_r, base_g, base_b = 255, 255, 255
                    elif c_dist < timer_r:
                        # Semi-translucent dial face
                        base_r = int(base_r * 0.85 + 255 * 0.15)
                        base_g = int(base_g * 0.85 + 255 * 0.15)
                        base_b = int(base_b * 0.85 + 255 * 0.15)

                        # Clock hands: at 12 o'clock and 3 o'clock (25-min pomodoro arc!)
                        angle = math.atan2(cdx, -cdy)  # 0 at top, pi/2 at right
                        # Pomodoro wedge from 0 to 2.6 radians (~25 min)
                        if 0 <= angle <= 2.6 and c_dist < timer_r * 0.8:
                            base_r = int(base_r * 0.7 + 255 * 0.3)
                            base_g = int(base_g * 0.7 + 255 * 0.3)
                            base_b = int(base_b * 0.7 + 255 * 0.3)

                rgba[idx] = base_r
                rgba[idx+1] = base_g
                rgba[idx+2] = base_b
                rgba[idx+3] = int(alpha * 255)

    return create_png(size, size, rgba)

def main():
    os.makedirs('icons', exist_ok=True)
    for sz in [16, 32, 48, 128]:
        png_bytes = render_icon(sz)
        with open(f'icons/icon{sz}.png', 'wb') as f:
            f.write(png_bytes)
        print(f"Generated icons/icon{sz}.png ({len(png_bytes)} bytes)")

    # Also create icon.svg
    svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <radialGradient id="gradTomato" cx="38%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FF6B6B"/>
      <stop offset="70%" stop-color="#EE3A3A"/>
      <stop offset="100%" stop-color="#C51616"/>
    </radialGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.25"/>
    </filter>
  </defs>
  <!-- Tomato Body -->
  <path d="M 64 24 C 44 24 20 38 20 72 C 20 102 42 118 64 118 C 86 118 108 102 108 72 C 108 38 84 24 64 24 Z" 
        fill="url(#gradTomato)" filter="url(#shadow)"/>
  
  <!-- Stem & Leaf -->
  <path d="M 64 10 C 64 10 68 20 64 28 C 60 20 64 10 64 10 Z" fill="#047857"/>
  <path d="M 64 24 C 74 14 90 14 96 20 C 88 28 76 28 64 24 Z" fill="#10B981"/>
  <path d="M 64 24 C 54 16 42 18 36 24 C 44 28 54 28 64 24 Z" fill="#059669"/>

  <!-- Dial Face -->
  <circle cx="64" cy="74" r="28" fill="rgba(255,255,255,0.12)" stroke="#FFFFFF" stroke-width="2.5"/>
  <!-- 25-minute Pomodoro Arc (from 12 to 5 o'clock) -->
  <path d="M 64 74 L 64 50 A 24 24 0 0 1 87.8 70.3 Z" fill="rgba(255,255,255,0.4)"/>
  <!-- Center Pin -->
  <circle cx="64" cy="74" r="3.5" fill="#FFFFFF"/>
</svg>'''
    with open('icons/icon.svg', 'w') as f:
        f.write(svg_content)
    print("Generated icons/icon.svg")

if __name__ == '__main__':
    main()
