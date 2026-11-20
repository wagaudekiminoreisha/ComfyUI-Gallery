import json
from pathlib import Path
import sys,tempfile,unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from prefix_library import update,read,SERVER_SESSION

class SnapshotDefaultsTests(unittest.TestCase):
    def test_opt_in_is_per_image_and_prefix_and_survives_pair_updates(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'prefixes.json'
            first=update(path,{'action':'save','name':'Identity','terms':['blue_shirt'],'revision':read(path)[1]})
            id=first['library']['prefixes'][0]['id']
            paired=update(path,{'action':'associate','prefix_id':id,'image_keys':['sha256:a','sha256:b'],'revision':first['revision']})
            self.assertNotIn('prefer_snapshots',paired['library']['associations']['sha256:a'])
            preferred=update(path,{'action':'snapshot_default','prefix_id':id,'image_keys':['sha256:a'],'enabled':True,'revision':paired['revision']})
            self.assertEqual(preferred['library']['associations']['sha256:a']['prefer_snapshots'],[id])
            self.assertNotIn('prefer_snapshots',preferred['library']['associations']['sha256:b'])
            rep=update(path,{'action':'associate','prefix_id':id,'image_keys':['sha256:a'],'revision':preferred['revision']})
            self.assertEqual(rep['library']['associations']['sha256:a']['prefer_snapshots'],[id])
            cleared=update(path,{'action':'snapshot_default','prefix_id':id,'image_keys':['sha256:a'],'enabled':False,'revision':rep['revision']})
            self.assertNotIn('prefer_snapshots',cleared['library']['associations']['sha256:a'])
            self.assertEqual(len(SERVER_SESSION),32)
            self.assertNotIn('session_id',json.loads(path.read_text(encoding='utf-8')))
            before=path.read_bytes()
            with self.assertRaises(ValueError):update(path,{'action':'snapshot_default','prefix_id':id,'image_keys':['missing'],'enabled':True,'revision':cleared['revision']})
            self.assertEqual(path.read_bytes(),before)
