import io
import tempfile
import unittest
from pathlib import Path

from PIL import Image
from product_thumbnails import generate


class ThumbnailTests(unittest.TestCase):
    def test_small_cached_previews_preserve_originals_and_regenerate_changed_photos(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            folder = root / "OrderSheet/img"
            folder.mkdir(parents=True)
            original = folder / "0012345678901.jpg"
            Image.new("RGB", (600, 1800), "red").save(original)
            before = original.read_bytes()
            self.assertEqual(generate(root), (1, 1))
            preview = folder / "thumbnails" / original.name
            with Image.open(preview) as image:
                self.assertEqual(image.size, (96, 96))
                self.assertEqual(image.getpixel((0, 0)), (255, 255, 255))
            self.assertLess(preview.stat().st_size, 10000)
            self.assertEqual(original.read_bytes(), before)
            self.assertEqual((folder / "thumbnails/photo-index.js").read_text(), 'window.JASON_PHOTO_IDS=["0012345678901"];\n')
            self.assertEqual(generate(root), (1, 0))
            Image.new("RGB", (1600, 400), "blue").save(original)
            self.assertEqual(generate(root), (1, 1))
            custom = folder / "thumbnails" / "custom.jpg"
            custom.write_bytes(b"keep")
            original.unlink()
            self.assertEqual(generate(root), (0, 0))
            self.assertFalse(preview.exists())
            self.assertEqual((folder / "thumbnails/photo-index.js").read_text(), 'window.JASON_PHOTO_IDS=[];\n')
            self.assertEqual(custom.read_bytes(), b"keep")


if __name__ == "__main__":
    unittest.main()
