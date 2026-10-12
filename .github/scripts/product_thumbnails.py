"""Build small product previews; original photos are never changed."""
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
from urllib.request import Request, urlopen

from PIL import Image, ImageOps

SIZE = 96
QUALITY = 78
OUTPUT = "OrderSheet/img/thumbnails"


def thumbnail(source):
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original).convert("RGBA")
        image.thumbnail((SIZE, SIZE), Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (SIZE, SIZE), "white")
        canvas.paste(image, ((SIZE-image.width)//2, (SIZE-image.height)//2), image)
        output = io.BytesIO()
        canvas.save(output, "JPEG", quality=QUALITY, optimize=True)
        return output.getvalue()


def generate(root):
    folder = Path(root) / "OrderSheet/img"
    output = Path(root) / OUTPUT
    if not folder.is_dir():
        raise ValueError("Photo folder missing; no thumbnails written")
    manifest_path = output / "sources.json"
    old = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    previous = old.get("sources", {})
    current = {}
    output.mkdir(parents=True, exist_ok=True)
    changed = 0
    for source in sorted(folder.glob("*.jpg")):
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        current[source.name] = digest
        destination = output / source.name
        if (old.get("size"), old.get("quality"), previous.get(source.name)) == (SIZE, QUALITY, digest) and destination.exists():
            continue
        destination.write_bytes(thumbnail(source))
        changed += 1
    # Remove only outputs previously recorded by this generator.
    for name in previous.keys() - current.keys():
        if Path(name).name == name and name.endswith(".jpg"):
            (output / name).unlink(missing_ok=True)
    manifest_path.write_text(json.dumps({"version": 1, "size": SIZE, "quality": QUALITY, "sources": current}, indent=2) + "\n")
    return len(current), changed


def git(*args, check=True):
    return subprocess.run(["git", *args], check=check, capture_output=True, text=True)


def publish():
    # This mode is restricted to a disposable GitHub Actions checkout.
    if os.environ.get("GITHUB_ACTIONS") != "true" or os.environ.get("GITHUB_REF") != "refs/heads/main":
        raise ValueError("Publishing runs only in GitHub Actions on main")
    repository = os.environ["GITHUB_REPOSITORY"]
    token = os.environ["GH_TOKEN"]
    for attempt in range(4):
        git("fetch", "origin", "main")
        git("reset", "--hard", "FETCH_HEAD")
        parent = git("rev-parse", "HEAD").stdout.strip()
        count, changed = generate(Path.cwd())
        git("add", "--", OUTPUT)
        paths = git("diff", "--cached", "--name-only").stdout.splitlines()
        if any(not path.startswith(OUTPUT + "/") for path in paths):
            raise ValueError("Unexpected staged file; publish stopped")
        if not paths:
            print(f"Thumbnails current: {count}")
            break
        git("-c", "user.name=github-actions[bot]", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com", "commit", "-m", f"photos: update {changed} lightweight product previews")
        result = git("push", "origin", "HEAD:main", check=False)
        if result.returncode == 0:
            print(f"Thumbnails ready: {count}; regenerated: {changed}")
            break
        git("fetch", "origin", "main")
        if git("rev-parse", "FETCH_HEAD").stdout.strip() == parent or attempt == 3:
            raise RuntimeError("Could not publish thumbnails with a normal fast-forward push")
        # Rebuild from the new head, preserving concurrent photos and data.
    # GITHUB_TOKEN commits do not start the Pages build automatically.
    # Request the existing branch-based Pages build without changing hosting.
    request = Request(f"https://api.github.com/repos/{repository}/pages/builds", data=b"{}", method="POST", headers={
        "Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
        "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Union-Cosmetic-product-thumbnails"})
    with urlopen(request, timeout=45) as response:
        print(f"Pages build requested: HTTP {response.status}")


if __name__ == "__main__":
    publish()
