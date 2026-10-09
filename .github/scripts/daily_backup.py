"""Archive Jason data from one Git commit without changing the live catalog."""
import base64
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

PRODUCTS_PATH = "OrderSheet/products.json"
LOGISTICS_PATH = "JSON edit GUI/logistics.json"
BRANCH = "main"
LOCAL_TIMEZONE = "Europe/Prague"


class ApiError(RuntimeError):
    def __init__(self, status):
        self.status = status
        super().__init__(f"GitHub API failed with HTTP {status}")


class GitHub:
    def __init__(self, repository, token):
        if not re.fullmatch(r"[\w.-]+/[\w.-]+", repository):
            raise ValueError("Invalid repository")
        self.base = f"https://api.github.com/repos/{repository}"
        self.token = token

    def call(self, method, path, data=None):
        body = None if data is None else json.dumps(data, ensure_ascii=False).encode("utf-8")
        headers = {"Accept": "application/vnd.github+json",
                   "Authorization": f"Bearer {self.token}",
                   "X-GitHub-Api-Version": "2022-11-28",
                   "User-Agent": "Union-Cosmetic-daily-backup"}
        if body is not None:
            headers["Content-Type"] = "application/json"
        request = Request(self.base + path, data=body, headers=headers, method=method)
        for attempt in range(3):
            try:
                with urlopen(request, timeout=45) as response:
                    raw = response.read()
                    return json.loads(raw) if raw else None
            except HTTPError as error:
                if method == "GET" and error.code >= 500 and attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                raise ApiError(error.code) from None


def read_file(api, path, commit):
    result = api.call("GET", f"/contents/{quote(path, safe='/')}?ref={commit}")
    if result.get("encoding") != "base64" or not isinstance(result.get("content"), str):
        raise ValueError(f"Cannot read {path}")
    return base64.b64decode(result["content"]).decode("utf-8")


def validate(products, logistics):
    if not isinstance(products, list) or any(not isinstance(p, dict) for p in products):
        raise ValueError("Invalid products JSON; no backup written")
    if not isinstance(logistics, dict):
        raise ValueError("Invalid logistics JSON; no backup written")
    for product in products:
        for field in ("brand", "type", "id", "hs", "name", "csName", "key", "carton_ean"):
            value = product.get(field)
            if value is not None and (isinstance(value, bool) or not isinstance(value, (str, int, float))):
                raise ValueError("Invalid product field; no backup written")
        if product.get("volume") is not None and not isinstance(product["volume"], dict):
            raise ValueError("Invalid product volume; no backup written")
        if product.get("flags") is not None and (not isinstance(product["flags"], list) or any(not isinstance(flag, str) for flag in product["flags"])):
            raise ValueError("Invalid product flags; no backup written")
    for keys in logistics.values():
        if not isinstance(keys, dict) or any(not isinstance(data, dict) for data in keys.values()):
            raise ValueError("Invalid logistics JSON; no backup written")
        for data in keys.values():
            for section in ("ITEM", "CARTON", "LAYER", "PALLET"):
                if data.get(section) is not None and not isinstance(data[section], dict):
                    raise ValueError("Invalid logistics section; no backup written")
    # A valid empty catalog must also be recoverable; never silently use older data.


def capture(api, repository, now):
    ref = api.call("GET", f"/git/ref/heads/{BRANCH}")
    commit = ref["object"]["sha"]
    products_raw = read_file(api, PRODUCTS_PATH, commit)
    logistics_raw = read_file(api, LOGISTICS_PATH, commit)
    products, logistics = json.loads(products_raw), json.loads(logistics_raw)
    validate(products, logistics)
    return {
        "format": "jason-backup", "version": 1,
        "createdAt": now.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "products": products, "logistics": logistics,
        "photos": {}, "pendingPhotos": [],
        "source": {
            "repository": repository, "branch": BRANCH, "commit": commit,
            "timezone": LOCAL_TIMEZONE,
            "paths": {"products": PRODUCTS_PATH, "logistics": LOGISTICS_PATH,
                      "photos": "OrderSheet/img"},
            "sha256": {
                "products": hashlib.sha256(products_raw.encode("utf-8")).hexdigest(),
                "logistics": hashlib.sha256(logistics_raw.encode("utf-8")).hexdigest()
            },
            "photoRecovery": "Restore OrderSheet/img from the source commit; image bytes are retained in Git history."
        }
    }


def archive_path(kind, now, run_id):
    local = now.astimezone(ZoneInfo(LOCAL_TIMEZONE))
    if kind == "daily":
        # A delayed 23:45 job that starts after midnight still belongs to the
        # previous day's archive. createdAt records the actual snapshot time.
        day = local - timedelta(days=1) if local.hour < 23 else local
        return f"backups/daily/{day:%Y/%m/%Y-%m-%d}.json"
    if kind != "manual" or not re.fullmatch(r"[\w-]+", run_id):
        raise ValueError("Invalid backup kind or run ID")
    return f"backups/manual/{local:%Y-%m-%d}/{now.astimezone(timezone.utc):%H%M%SZ}-{run_id}.json"


def publish(api, path, snapshot):
    # Only append archives. A concurrent product edit is preserved by rebasing
    # the archive tree on the new head, never by overwriting or force-pushing.
    if not path.startswith("backups/") or ".." in path.split("/"):
        raise ValueError("Backup path must be inside backups/")
    content = json.dumps(snapshot, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    for attempt in range(4):
        parent = api.call("GET", f"/git/ref/heads/{BRANCH}")["object"]["sha"]
        try:
            api.call("GET", f"/contents/{quote(path, safe='/')}?ref={parent}")
            return False  # The day's archive is immutable, including manual reruns.
        except ApiError as error:
            if error.status != 404:
                raise
        tree_sha = api.call("GET", f"/git/commits/{parent}")["tree"]["sha"]
        tree = api.call("POST", "/git/trees", {
            "base_tree": tree_sha,
            "tree": [{"path": path, "mode": "100644", "type": "blob", "content": content}]
        })["sha"]
        commit = api.call("POST", "/git/commits", {
            "message": f"backup: archive Jason data ({path})",
            "tree": tree, "parents": [parent]
        })["sha"]
        try:
            api.call("PATCH", f"/git/refs/heads/{BRANCH}", {"sha": commit, "force": False})
            return True
        except ApiError as error:
            if error.status not in (409, 422) or attempt == 3:
                raise
    raise RuntimeError("Could not append backup")


def main():
    repository = os.environ["GITHUB_REPOSITORY"]
    token = os.environ["GH_TOKEN"]
    if os.environ.get("GITHUB_REF") != f"refs/heads/{BRANCH}":
        raise ValueError("Backups run only on main")
    now = datetime.now(timezone.utc)
    kind = os.environ.get("BACKUP_KIND", "manual")
    path = archive_path(kind, now, os.environ.get("GITHUB_RUN_ID", "local"))
    api = GitHub(repository, token)
    snapshot = capture(api, repository, now)
    created = publish(api, path, snapshot)
    message = f"{'Created' if created else 'Already archived'}: {path}"
    print(message)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as output:
            output.write(f"## Jason data backup\n\n{message}\n\n")
            output.write(f"Products: {len(snapshot['products'])}. Source commit: `{snapshot['source']['commit']}`.\n")
            output.write("Restore the JSON through **Data a připojení → Obnovit zálohu Jason**.\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Backup failed: {error}", file=sys.stderr)
        sys.exit(1)
