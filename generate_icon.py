"""生成应用图标。用法：python3 generate_icon.py"""
from PIL import Image, ImageDraw

OUT = "/workspace/desktop-todo/src-tauri/icons"


def make(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    margin = int(size * 0.08)
    # 圆角琥珀色背景
    d.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=int(size * 0.18),
        fill=(255, 193, 7, 255),
    )
    # 白色对勾
    w = size
    p1 = (int(w * 0.30), int(w * 0.52))
    p2 = (int(w * 0.44), int(w * 0.66))
    p3 = (int(w * 0.72), int(w * 0.34))
    lw = max(4, int(w * 0.09))
    d.line([p1, p2], fill=(255, 255, 255, 255), width=lw)
    d.line([p2, p3], fill=(255, 255, 255, 255), width=lw)
    return img


sizes = [32, 128, 256, 512]
imgs = {s: make(s) for s in sizes}

imgs[512].save(f"{OUT}/icon.png")
imgs[32].save(f"{OUT}/32x32.png")
imgs[128].save(f"{OUT}/128x128.png")
imgs[256].save(f"{OUT}/128x128@2x.png")
imgs[512].save(
    f"{OUT}/icon.ico",
    sizes=[(32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
print("图标已生成:", sizes)
