import unittest
from ppwr_cleanup import deletion_paths, cleanup
from daily_backup import ApiError
P = 'OrderSheet/img/labels/ppwr-test.pdf'
Q = 'OrderSheet/img/labels/ppwr-still-uploading.pdf'
T = {'path': P, 'deletedAt': '2026-10-22T12:00:00Z'}
TREE = [{'path': p, 'mode': '100644', 'type': 'blob'} for p in [P, Q, 'OrderSheet/products.json']]
class Rules(unittest.TestCase):
    def test_explicit_unused_only(self):
        self.assertEqual(deletion_paths([{'ppwr': {'current': None, 'archive': [], 'deleted': [T]}}], TREE), [P])
        self.assertEqual(deletion_paths([], TREE), [])
    def test_shared_current_and_archives_protect_files(self):
        deleted = {'ppwr': {'current': None, 'archive': [], 'deleted': [T]}}
        for info in [{'current': {'path': P}, 'archive': []}, {'current': None, 'archive': [{'path': P}]}]:
            self.assertEqual(deletion_paths([deleted, {'ppwr': info}], TREE), [])
        self.assertEqual(deletion_paths([deleted, {'labels': {'front': {'path': P}}}], TREE), [])
    def test_invalid_paths_or_catalog_stop_cleanup(self):
        for bad in ['../products.json', 'OrderSheet/products.json', 'OrderSheet/img/labels/ordinary.pdf']:
            with self.assertRaises(ValueError):
                deletion_paths([{'ppwr': {'archive': [], 'deleted': [{**T, 'path': bad}]}}], TREE)
        with self.assertRaises(ValueError): deletion_paths({}, TREE)
        with self.assertRaises(ValueError): deletion_paths([{'ppwr': {'archive': {}}}], TREE)
    def test_repeated_deletion_is_idempotent(self):
        self.assertEqual(deletion_paths([{'ppwr': {'archive': [], 'deleted': [T]}}], []), [])
if __name__ == '__main__': unittest.main()

class Publish(unittest.TestCase):
    def test_concurrent_reference_recomputes_and_preserves_new_user_change(self):
        import base64, json
        class API:
            def __init__(self): self.head_reads=0; self.mutations=[]
            def call(self, method, url, data=None):
                if method == 'POST':
                    self.mutations.append((url,data)); return {'sha':'candidate'}
                if url == '/git/ref/heads/main':
                    self.head_reads += 1
                    return {'object': {'sha': 'old' if self.head_reads == 1 else 'new'}}
                if url.startswith('/git/commits/'): return {'tree': {'sha': 'tree'}}
                if url.startswith('/git/trees/'): return {'tree':TREE,'truncated':False}
                if url.startswith('/contents/'):
                    info={'current':None,'archive':[],'deleted':[T]}
                    if 'ref=new' in url: info['current']={'path':P}
                    return {'encoding':'base64','content':base64.b64encode(json.dumps([{'ppwr':info}]).encode()).decode()}
                raise AssertionError((method,url))
        api=API(); self.assertEqual(cleanup(api),0)
        self.assertEqual(len(api.mutations),2)
        self.assertTrue(all(m[0] != '/git/refs/heads/main' for m in api.mutations))
        self.assertEqual(api.mutations[0][1]['base_tree'],'tree')
        self.assertEqual(api.mutations[0][1]['tree'],[{'path':P,'type':'blob','mode':'100644','sha':None}])
    def test_incomplete_tree_never_writes(self):
        class API:
            def call(self, method, url, data=None):
                if method != 'GET': raise AssertionError('Must not write')
                if url == '/git/ref/heads/main': return {'object':{'sha':'head'}}
                if url.startswith('/git/commits/'): return {'tree':{'sha':'tree'}}
                return {'truncated':True,'tree':TREE}
        with self.assertRaises(ValueError): cleanup(API())


class AdditionalFormats(unittest.TestCase):
    def test_new_extensions_are_deleted_only_when_explicit_and_unused(self):
        for ext in ['docx','xlsx','zip']:
            path='OrderSheet/img/labels/ppwr-new.'+ext
            rows=[{'path':path,'type':'blob','mode':'100644'}]
            deleted={'ppwr':{'current':None,'archive':[],'deleted':[{**T,'path':path}]}}
            self.assertEqual(deletion_paths([deleted],rows),[path])
            self.assertEqual(deletion_paths([deleted,{'ppwr':{'current':{'path':path},'archive':[]}}],rows),[])
            self.assertEqual(deletion_paths([deleted,{'ppwr':{'current':None,'archive':[{'path':path}]}}],rows),[])
