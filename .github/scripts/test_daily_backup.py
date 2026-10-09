import base64
import importlib.util
import json
import unittest
from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("daily_backup", Path(__file__).with_name("daily_backup.py"))
B = importlib.util.module_from_spec(spec)
spec.loader.exec_module(B)


class CaptureAPI:
    def __init__(self):
        self.calls = []
        self.products = [{"id": "0012345678901", "name": "Mýdlo", "volume": {"number": "4x50", "unit": "ml", "keep": 1}, "custom": {"keep": True}}]
        self.logistics = {"Lilien": {"110": {"PALLET": {"height": "142,0 cm"}, "extra": "keep"}}}

    def call(self, method, path, data=None):
        self.calls.append((method, path, data))
        if path == "/git/ref/heads/main":
            return {"object": {"sha": "source-commit"}}
        assert method == "GET" and path.endswith("?ref=source-commit")
        obj = self.products if "products.json" in path else self.logistics
        raw = json.dumps(obj, ensure_ascii=False).encode()
        return {"encoding": "base64", "content": base64.b64encode(raw).decode()}


class PublishAPI:
    def __init__(self, race=False, existing=False):
        self.calls, self.race, self.existing, self.heads = [], race, existing, 0

    def call(self, method, path, data=None):
        self.calls.append((method, path, data))
        if method == "GET" and path == "/git/ref/heads/main":
            self.heads += 1
            return {"object": {"sha": f"head-{self.heads}"}}
        if method == "GET" and path.startswith("/contents/"):
            if self.existing:
                return {"content": "existing"}
            raise B.ApiError(404)
        if method == "GET" and path.startswith("/git/commits/"):
            return {"tree": {"sha": path.rsplit("/", 1)[1] + "-tree"}}
        if method == "POST" and path == "/git/trees":
            return {"sha": "backup-tree"}
        if method == "POST" and path == "/git/commits":
            return {"sha": "backup-commit"}
        if method == "PATCH":
            assert data["force"] is False
            if self.race and self.heads == 1:
                raise B.ApiError(422)
            return {"object": {"sha": "backup-commit"}}
        raise AssertionError((method, path, data))


class BackupTests(unittest.TestCase):
    def test_capture_pins_both_files_and_preserves_data(self):
        api = CaptureAPI()
        snapshot = B.capture(api, "Feela-CZ/Union-Cosmetic", datetime(2026, 10, 9, 21, 45, tzinfo=timezone.utc))
        self.assertEqual(snapshot["products"], api.products)
        self.assertEqual(snapshot["logistics"], api.logistics)
        self.assertEqual(snapshot["format"], "jason-backup")
        self.assertEqual(snapshot["source"]["commit"], "source-commit")
        self.assertTrue(all(method == "GET" for method, _, _ in api.calls))

    def test_summer_and_winter_local_dates(self):
        for now, day in [("2026-07-09T21:45:00+00:00", "2026-07-09"), ("2026-12-09T22:45:00+00:00", "2026-12-09"), ("2026-10-09T22:30:00+00:00", "2026-10-09")]:
            self.assertTrue(B.archive_path("daily", datetime.fromisoformat(now), "1").endswith(day + ".json"))

    def test_manual_names_are_unique_and_use_prague_date(self):
        now = datetime.fromisoformat("2026-10-09T22:30:00+00:00")
        self.assertEqual(B.archive_path("manual", now, "123"), "backups/manual/2026-10-10/223000Z-123.json")
        self.assertNotEqual(B.archive_path("manual", now, "123"), B.archive_path("manual", now, "124"))

    def test_invalid_data_is_rejected(self):
        for products, logistics in [({}, {}), ([None], {}), ([{"flags": "bad"}], {}), ([{"volume": []}], {}), ([{"brand": {}}], {}), ([], []), ([], {"Lilien": []}), ([], {"Lilien": {"110": {"PALLET": "bad"}}})]:
            with self.assertRaises(ValueError):
                B.validate(products, logistics)
        B.validate([], {})

    def test_publish_adds_only_backup_and_never_force_pushes(self):
        api = PublishAPI()
        self.assertTrue(B.publish(api, "backups/daily/2026/10/2026-10-09.json", {"products": []}))
        tree = next(data for method, path, data in api.calls if path == "/git/trees")
        self.assertEqual(tree["base_tree"], "head-1-tree")
        self.assertEqual([entry["path"] for entry in tree["tree"]], ["backups/daily/2026/10/2026-10-09.json"])

    def test_concurrent_edit_retries_on_new_head(self):
        api = PublishAPI(race=True)
        self.assertTrue(B.publish(api, "backups/daily/2026/10/2026-10-09.json", {}))
        trees = [data["base_tree"] for method, path, data in api.calls if path == "/git/trees"]
        self.assertEqual(trees, ["head-1-tree", "head-2-tree"])
        parents = [data["parents"] for method, path, data in api.calls if path == "/git/commits"]
        self.assertEqual(parents, [["head-1"], ["head-2"]])

    def test_existing_archive_is_immutable(self):
        api = PublishAPI(existing=True)
        self.assertFalse(B.publish(api, "backups/daily/2026/10/2026-10-09.json", {}))
        self.assertTrue(all(method == "GET" for method, _, _ in api.calls))

    def test_non_backup_path_is_rejected(self):
        for path in ["OrderSheet/products.json", "backups/../products.json"]:
            with self.assertRaises(ValueError):
                B.publish(PublishAPI(), path, {})

    def test_wrong_branch_is_rejected_before_network(self):
        with patch.dict(B.os.environ, {"GITHUB_REPOSITORY": "Feela-CZ/Union-Cosmetic", "GH_TOKEN": "test", "GITHUB_REF": "refs/heads/test"}):
            with self.assertRaises(ValueError):
                B.main()


class PruneAPI(PublishAPI):
    protected = "backups/daily/2026/10/2026-10-09.json"
    old = "backups/daily/2026/09/2026-09-09.json"
    manual_old = "backups/manual/2026-09-09/214500Z-123.json"
    boundary = "backups/daily/2026/09/2026-09-10.json"

    def __init__(self, race=False, invalid=False, missing=False, truncated=False):
        super().__init__(race=race)
        self.invalid, self.missing, self.truncated = invalid, missing, truncated

    def call(self, method, path, data=None):
        if method == "GET" and path.startswith("/git/trees/"):
            self.calls.append((method, path, data))
            if "?recursive=1" not in path:
                return {"tree": [{"path": "backups", "type": "tree", "sha": "folder"}], "truncated": False}
            # A concurrent edit rescues an old file by removing it. Retry must
            # rebuild the list rather than replay a stale deletion.
            paths = [self.old, self.manual_old, self.boundary, "backups/README.md", "backups/manual/notes.json"]
            if not self.missing:
                paths.append(self.protected)
            if self.heads > 1:
                paths.remove(self.old)
            return {"tree": [{"path": p.removeprefix("backups/"), "type": "blob"} for p in paths], "truncated": self.truncated}
        if method == "GET" and path.startswith("/contents/"):
            self.calls.append((method, path, data))
            obj = {"format": "jason-backup", "version": 1, "products": [], "logistics": {}}
            if self.invalid:
                obj["products"] = "invalid"
            return {"encoding": "base64", "content": base64.b64encode(json.dumps(obj).encode()).decode()}
        return super().call(method, path, data)


class RetentionTests(unittest.TestCase):
    def test_exact_30_calendar_days_and_both_archive_kinds(self):
        api = PruneAPI()
        self.assertEqual(B.prune(api, api.protected), 2)
        tree = next(data for method, path, data in api.calls if method == "POST" and path == "/git/trees")
        self.assertEqual(tree["base_tree"], "head-1-tree")
        self.assertEqual(tree["tree"], [{"path": p, "mode": "100644", "type": "blob", "sha": None} for p in [api.old, api.manual_old]])
        self.assertNotIn(api.boundary, [e["path"] for e in tree["tree"]])

    def test_only_valid_owned_paths_are_recognized(self):
        for p in ["backups/README.md", "backups/manual/notes.json", "OrderSheet/products.json", "OrderSheet/img/2026-01-01.jpg", "backups/daily/2026/01/2026-02-01.json", "backups/daily/2026/02/2026-02-30.json", "backups/daily/../2026-01-01.json"]:
            self.assertIsNone(B.backup_date(p))
        self.assertEqual(B.backup_date(PruneAPI.protected), date(2026, 10, 9))

    def test_leap_month_boundary_and_future_archives(self):
        protected = "backups/daily/2028/03/2028-03-01.json"
        paths = ["backups/daily/2028/01/2028-01-31.json", "backups/daily/2028/02/2028-02-01.json", "backups/daily/2028/02/2028-02-29.json", "backups/daily/2028/03/2028-03-02.json", protected]
        self.assertEqual(B.expired_archives([{"path": p, "type": "blob"} for p in paths], protected), paths[:1])

    def test_delayed_job_uses_archive_day_not_utc_or_next_day(self):
        protected = B.archive_path("daily", datetime.fromisoformat("2026-10-09T22:30:00+00:00"), "1")
        boundary = "backups/daily/2026/09/2026-09-10.json"
        self.assertEqual(B.expired_archives([{"path": boundary, "type": "blob"}], protected), [])

    def test_invalid_missing_or_incomplete_current_archive_blocks_all_deletes(self):
        for options in [{"invalid": True}, {"missing": True}, {"truncated": True}]:
            api = PruneAPI(**options)
            with self.assertRaises(ValueError):
                B.prune(api, api.protected)
            self.assertTrue(all(method == "GET" for method, _, _ in api.calls))

    def test_concurrent_edits_rebuild_deletions_and_never_force(self):
        api = PruneAPI(race=True)
        self.assertEqual(B.prune(api, api.protected), 1)
        trees = [data for method, path, data in api.calls if method == "POST" and path == "/git/trees"]
        self.assertEqual([t["base_tree"] for t in trees], ["head-1-tree", "head-2-tree"])
        self.assertEqual([e["path"] for e in trees[1]["tree"]], [api.manual_old])
        self.assertTrue(all(data["force"] is False for method, _, data in api.calls if method == "PATCH"))

    def test_no_expired_backups_means_no_write(self):
        api = PruneAPI()
        with patch.object(B, "expired_archives", return_value=[]):
            self.assertEqual(B.prune(api, api.protected), 0)
        self.assertTrue(all(method == "GET" for method, _, _ in api.calls))

    def test_capture_or_publish_failure_never_runs_cleanup(self):
        env = {"GITHUB_REPOSITORY": "Feela-CZ/Union-Cosmetic", "GH_TOKEN": "test", "GITHUB_REF": "refs/heads/main"}
        for failure in ["capture", "publish"]:
            with patch.dict(B.os.environ, env), patch.object(B, "capture", return_value={}), patch.object(B, "publish", return_value=True), patch.object(B, "prune") as cleanup:
                with patch.object(B, failure, side_effect=ValueError("failed")):
                    with self.assertRaises(ValueError):
                        B.main()
                cleanup.assert_not_called()


if __name__ == "__main__":
    unittest.main()

