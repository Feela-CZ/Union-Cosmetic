"""Remove only explicitly deleted PPWR files once no product uses them.

No age-based/orphan sweep: a newly uploaded file may still be waiting for its
product metadata to be saved. Git history and backup commits are retained.
"""
import os
import re
from datetime import datetime
from daily_backup import GitHub, read_file, validate, ApiError
import json

FILE = re.compile(r"OrderSheet/img/labels/ppwr-[a-zA-Z0-9_-]+\.(pdf|jpg|png|webp|docx|xlsx|zip)\Z")


def ppwr_path(value):
    path = value.get('path') if isinstance(value, dict) else value
    if not isinstance(path, str) or not FILE.fullmatch(path):
        raise ValueError('Invalid PPWR reference; cleanup skipped')
    return path


def deletion_paths(products, entries):
    if not isinstance(products, list) or any(not isinstance(p, dict) for p in products):
        raise ValueError('Invalid catalog; cleanup skipped')
    references, deleted = set(), set()
    for product in products:
        ppwr = product.get('ppwr')
        if ppwr is None:
            continue
        if not isinstance(ppwr, dict) or not isinstance(ppwr.get('archive'), list):
            raise ValueError('Invalid PPWR; cleanup skipped')
        for asset in [ppwr.get('current'), *ppwr['archive']]:
            if asset is not None:
                references.add(ppwr_path(asset))
        tombstones = ppwr.get('deleted', [])
        if not isinstance(tombstones, list):
            raise ValueError('Invalid deletion record; cleanup skipped')
        for entry in tombstones:
            if not isinstance(entry, dict) or not isinstance(entry.get('deletedAt'), str):
                raise ValueError('Invalid deletion record; cleanup skipped')
            datetime.fromisoformat(entry['deletedAt'].replace('Z', '+00:00'))
            deleted.add(ppwr_path(entry))
    # Protect the same attachment even if it was reused as a product label.
    for product in products:
        labels = product.get('labels') or {}
        if isinstance(labels, dict):
            for value in labels.values():
                path = value.get('path') if isinstance(value, dict) else value
                if isinstance(path, str) and FILE.fullmatch(path):
                    references.add(path)
    existing = {e['path'] for e in entries if e.get('type') == 'blob' and e.get('mode') == '100644'}
    return sorted((deleted - references) & existing)


def cleanup(api):
    for attempt in range(4):
        parent = api.call('GET', '/git/ref/heads/main')['object']['sha']
        commit = api.call('GET', '/git/commits/' + parent)
        tree_sha = commit['tree']['sha']
        result = api.call('GET', '/git/trees/' + tree_sha + '?recursive=1')
        if result.get('truncated') or not isinstance(result.get('tree'), list):
            raise ValueError('Incomplete tree; cleanup skipped')
        products = json.loads(read_file(api, 'OrderSheet/products.json', parent))
        validate(products, {})
        paths = deletion_paths(products, result['tree'])
        if not paths:
            return 0
        tree = api.call('POST', '/git/trees', {
            'base_tree': tree_sha,
            'tree': [{'path': path, 'type': 'blob', 'mode': '100644', 'sha': None} for path in paths]
        })['sha']
        sha = api.call('POST', '/git/commits', {
            'message': f'ppwr: remove {len(paths)} explicitly deleted unused attachments',
            'tree': tree, 'parents': [parent]
        })['sha']
        if api.call('GET', '/git/ref/heads/main')['object']['sha'] != parent:
            continue
        try:
            # Non-fast-forward updates are rejected; recompute from fresh head.
            api.call('PATCH', '/git/refs/heads/main', {'sha': sha, 'force': False})
            return len(paths)
        except ApiError as error:
            if error.status not in (409, 422) or attempt == 3:
                raise
    raise RuntimeError('Concurrent updates prevented PPWR cleanup')


if __name__ == '__main__':
    if os.environ.get('GITHUB_REF') != 'refs/heads/main':
        raise ValueError('PPWR cleanup runs only on main')
    api = GitHub(os.environ['GITHUB_REPOSITORY'], os.environ['GH_TOKEN'])
    print(f'Removed PPWR files: {cleanup(api)}')
