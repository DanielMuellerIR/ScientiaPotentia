"""Regressionstests für schreibende Werkzeuge im Harvest-Zwischenarchiv."""

import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
HARVEST = ROOT / 'scripts' / 'data_sources' / 'harvest'


class HarvestToolTests(unittest.TestCase):
    def prepare_tool_tree(self, temporary, *script_names):
        root = Path(temporary)
        harvest = root / 'scripts' / 'data_sources' / 'harvest'
        harvest.mkdir(parents=True)
        for name in script_names:
            shutil.copy2(HARVEST / name, harvest / name)
        shared_io = HARVEST / 'json_io.cjs'
        if shared_io.exists():
            shutil.copy2(shared_io, harvest / shared_io.name)
        return root, harvest

    @staticmethod
    def run_node(script, *args):
        return subprocess.run(
            ['node', str(script), *map(str, args)],
            capture_output=True,
            text=True,
            check=False,
            timeout=5,
        )

    @staticmethod
    def write_json(path, value):
        path.write_text(json.dumps(value, ensure_ascii=False), encoding='utf-8')

    def test_apply_corrections_is_dry_by_default(self):
        with tempfile.TemporaryDirectory() as temporary:
            root, harvest = self.prepare_tool_tree(temporary, 'apply_corrections.cjs')
            raw_path = root / 'scripts' / 'data_sources' / 'machina_raw.json'
            original = [{'id': 'hammer', 'attributes': {'kind': 'alt'}}]
            self.write_json(raw_path, original)
            self.write_json(
                harvest / 'corr_machina_test.json',
                [{'id': 'hammer', 'set': {'kind': 'neu'}, 'reason': 'Test'}],
            )

            result = self.run_node(harvest / 'apply_corrections.cjs', 'machina')

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(raw_path.read_text(encoding='utf-8')), original)
            self.assertIn('DRY-RUN', result.stdout)

    def test_apply_corrections_blocks_write_when_one_file_is_invalid(self):
        with tempfile.TemporaryDirectory() as temporary:
            root, harvest = self.prepare_tool_tree(temporary, 'apply_corrections.cjs')
            raw_path = root / 'scripts' / 'data_sources' / 'machina_raw.json'
            original = [{'id': 'hammer', 'attributes': {'kind': 'alt'}}]
            self.write_json(raw_path, original)
            self.write_json(
                harvest / 'corr_machina_a_good.json',
                [{'id': 'hammer', 'set': {'kind': 'neu'}, 'reason': 'Test'}],
            )
            (harvest / 'corr_machina_b_broken.json').write_text('{', encoding='utf-8')

            result = self.run_node(
                harvest / 'apply_corrections.cjs', 'machina', '--write')

            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(json.loads(raw_path.read_text(encoding='utf-8')), original)
            self.assertIn('nicht parsebar', result.stderr)

    def test_apply_corrections_supports_explicit_attribute_and_concept_targets(self):
        with tempfile.TemporaryDirectory() as temporary:
            root, harvest = self.prepare_tool_tree(temporary, 'apply_corrections.cjs')
            raw_path = root / 'scripts' / 'data_sources' / 'machina_raw.json'
            self.write_json(raw_path, [{
                'id': 'hammer',
                'name': 'Alter Name',
                'attributes': {'kind': 'alt', 'value': 1},
            }])
            self.write_json(
                harvest / 'corr_machina_test.json',
                [
                    {'id': 'hammer', 'set': {'attributes.kind': 'neu'}},
                    {'id': 'hammer', 'set': {'concept.name': 'Neuer Name'}},
                    {'id': 'hammer', 'set': {'value': 2}},
                ],
            )

            result = self.run_node(
                harvest / 'apply_corrections.cjs', 'machina', '--write')

            self.assertEqual(result.returncode, 0, result.stderr)
            corrected = json.loads(raw_path.read_text(encoding='utf-8'))[0]
            self.assertEqual(corrected['name'], 'Neuer Name')
            self.assertEqual(corrected['attributes'], {'kind': 'neu', 'value': 2})

    def test_umlaut_fixer_is_dry_by_default(self):
        with tempfile.TemporaryDirectory() as temporary:
            _, harvest = self.prepare_tool_tree(temporary, 'fix_cand_umlauts.cjs')
            candidate_path = harvest / 'cand_machina_test.json'
            original = [{'id': 'test', 'name': 'Test', 'funFact': 'Fuer alle verfuegbar.'}]
            self.write_json(candidate_path, original)

            result = self.run_node(harvest / 'fix_cand_umlauts.cjs')

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(candidate_path.read_text(encoding='utf-8')), original)
            self.assertIn('DRY-RUN', result.stdout)

    def test_append_concepts_rejects_array_as_attribute_object(self):
        with tempfile.TemporaryDirectory() as temporary:
            root, harvest = self.prepare_tool_tree(temporary, 'append_concepts.cjs')
            raw_path = root / 'scripts' / 'data_sources' / 'machina_raw.json'
            candidate_path = harvest / 'candidate.json'
            self.write_json(raw_path, [])
            self.write_json(candidate_path, [{
                'id': 'bad', 'name': 'Defekt', 'category': 'tool', 'attributes': [],
            }])

            result = self.run_node(
                harvest / 'append_concepts.cjs',
                'machina', candidate_path, '--write',
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(raw_path.read_text(encoding='utf-8')), [])
            self.assertIn('Struktur unvollständig', result.stdout)

    def test_dedup_builder_preserves_output_when_catalog_is_invalid(self):
        with tempfile.TemporaryDirectory() as temporary:
            root, harvest = self.prepare_tool_tree(temporary, 'build_dedup.cjs')
            raw_path = root / 'scripts' / 'data_sources' / 'machina_raw.json'
            output_path = harvest / 'dedup_machina.json'
            self.write_json(raw_path, [{'id': 'bad', 'category': 'tool'}])
            self.write_json(output_path, {'sentinel': True})

            result = self.run_node(harvest / 'build_dedup.cjs', 'machina')

            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(
                json.loads(output_path.read_text(encoding='utf-8')), {'sentinel': True})

    def test_minimax_loader_reports_truncated_object(self):
        with tempfile.TemporaryDirectory() as temporary:
            temporary = Path(temporary)
            source = temporary / 'model.txt'
            output = temporary / 'recovered.json'
            source.write_text('[{"id":"ok"},{"id":"abgeschnitten"', encoding='utf-8')

            result = self.run_node(
                HARVEST / 'mm_load.cjs', source, f'--out={output}')

            self.assertEqual(result.returncode, 1)
            self.assertEqual(
                json.loads(output.read_text(encoding='utf-8')), [{'id': 'ok'}])
            self.assertIn('1 verworfen', result.stdout)

    def test_minimax_loader_repairs_mixed_typographic_quotes(self):
        with tempfile.TemporaryDirectory() as temporary:
            temporary = Path(temporary)
            source = temporary / 'model.txt'
            output = temporary / 'recovered.json'
            source.write_text(
                '[{"id":"ok","text":"Das „Zitat" bleibt."}]', encoding='utf-8')

            result = self.run_node(
                HARVEST / 'mm_load.cjs', source, f'--out={output}')

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(
                json.loads(output.read_text(encoding='utf-8')),
                [{'id': 'ok', 'text': 'Das „Zitat“ bleibt.'}],
            )

    def test_case_normalization_uses_existing_spelling_for_tie_break(self):
        with tempfile.TemporaryDirectory() as temporary:
            root, harvest = self.prepare_tool_tree(temporary, 'normalize_case.cjs')
            raw_path = root / 'scripts' / 'data_sources' / 'machina_raw.json'
            concepts = [
                {'id': 'old-a', 'attributes': {'kind': 'Alpha'}},
                {'id': 'old-b', 'attributes': {'kind': 'alpha'}},
                {'id': 'new-a-w1', 'attributes': {'kind': 'Alpha'}},
                {'id': 'new-b-w1', 'attributes': {'kind': 'Alpha'}},
                {'id': 'new-c-w1', 'attributes': {'kind': 'alpha'}},
            ]
            self.write_json(raw_path, concepts)

            result = self.run_node(
                harvest / 'normalize_case.cjs', 'machina', '--wave=w1', '--write')

            self.assertEqual(result.returncode, 0, result.stderr)
            normalized = json.loads(raw_path.read_text(encoding='utf-8'))
            self.assertEqual(
                [item['attributes']['kind'] for item in normalized],
                ['Alpha', 'alpha', 'alpha', 'alpha', 'alpha'],
            )


if __name__ == '__main__':
    unittest.main()
