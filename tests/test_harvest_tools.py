"""Regressionstests für schreibende Werkzeuge im Harvest-Zwischenarchiv."""

import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import re


ROOT = Path(__file__).resolve().parents[1]
HARVEST = ROOT / 'scripts' / 'data_sources' / 'harvest'


class HarvestToolTests(unittest.TestCase):
    def test_lingua_language_qids_are_unique_after_alias_consolidation(self):
        concepts = json.loads(
            (ROOT / 'scripts/data_sources/lingua_raw.json').read_text(encoding='utf-8'))
        by_qid = {}
        for concept in concepts:
            if concept.get('category') != 'language':
                continue
            match = re.search(r'/wiki/(Q\d+)', concept.get('sourceUrl', ''))
            if match:
                by_qid.setdefault(match.group(1), []).append(concept['id'])
        self.assertEqual(
            {qid: ids for qid, ids in by_qid.items() if len(ids) > 1}, {})

    def prepare_tool_tree(self, temporary, *script_names):
        root = Path(temporary)
        harvest = root / 'scripts' / 'data_sources' / 'harvest'
        harvest.mkdir(parents=True)
        for name in script_names:
            shutil.copy2(HARVEST / name, harvest / name)
        shared_io = HARVEST / 'json_io.cjs'
        if shared_io.exists():
            shutil.copy2(shared_io, harvest / shared_io.name)
        for shared_name in (
            'concept_validation.cjs', 'image_resolution_policy.cjs',
            'IMAGE_BLACKLIST.json', 'resolve_images_p18_v2.cjs',
        ):
            shared = HARVEST / shared_name
            if shared.exists() and not (harvest / shared_name).exists():
                shutil.copy2(shared, harvest / shared_name)
        license_policy = ROOT / 'scripts' / 'lib' / 'image_license_policy.js'
        if license_policy.exists():
            policy_target = root / 'scripts' / 'lib' / license_policy.name
            policy_target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(license_policy, policy_target)
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
            original = [{'id': 'hammer', 'name': 'Hammer', 'category': 'tool',
                         'attributes': {'kind': 'alt'}}]
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
            original = [{'id': 'hammer', 'name': 'Hammer', 'category': 'tool',
                         'attributes': {'kind': 'alt'}}]
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
                'category': 'tool',
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

    def test_apply_corrections_rejects_destructive_null_and_empty_source_values(self):
        with tempfile.TemporaryDirectory() as temporary:
            root, harvest = self.prepare_tool_tree(temporary, 'apply_corrections.cjs')
            raw_path = root / 'scripts' / 'data_sources' / 'machina_raw.json'
            original = [{
                'id': 'hammer', 'name': 'Hammer', 'category': 'tool',
                'sourceName': 'Quelle', 'sourceUrl': 'https://example.test/fact',
                'attributes': {'kind': 'Werkzeug'},
            }]
            self.write_json(raw_path, original)
            self.write_json(harvest / 'corr_machina_test.json', [
                {'id': 'hammer', 'set': {'concept.name': None}},
                {'id': 'hammer', 'set': {'concept.sourceUrl': ''}},
            ])

            result = self.run_node(
                harvest / 'apply_corrections.cjs', 'machina', '--write')

            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(json.loads(raw_path.read_text(encoding='utf-8')), original)

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

    def test_append_concepts_rejects_candidates_without_traceable_source(self):
        with tempfile.TemporaryDirectory() as temporary:
            root, harvest = self.prepare_tool_tree(temporary, 'append_concepts.cjs')
            raw_path = root / 'scripts' / 'data_sources' / 'machina_raw.json'
            candidate_path = harvest / 'candidate.json'
            self.write_json(raw_path, [])
            self.write_json(candidate_path, [{
                'id': 'unbelegt', 'name': 'Unbelegt', 'category': 'tool',
                'attributes': {'kind': 'Test'},
            }])

            result = self.run_node(
                harvest / 'append_concepts.cjs', 'machina', candidate_path, '--write')

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(raw_path.read_text(encoding='utf-8')), [])
            self.assertIn('sourceName', result.stdout)

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
            self.assertIn('verworfen', result.stdout)

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

    def test_minimax_loader_salvages_but_fails_on_truncated_array_wrapper(self):
        with tempfile.TemporaryDirectory() as temporary:
            temporary = Path(temporary)
            source = temporary / 'model.txt'
            output = temporary / 'recovered.json'
            source.write_text('[{"id":"ok"},', encoding='utf-8')

            result = self.run_node(HARVEST / 'mm_load.cjs', source, f'--out={output}')

            self.assertEqual(result.returncode, 1)
            self.assertEqual(json.loads(output.read_text(encoding='utf-8')), [{'id': 'ok'}])
            self.assertIn('Array', result.stdout)

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

    def test_apply_images_is_dry_by_default_and_writes_only_explicitly(self):
        with tempfile.TemporaryDirectory() as temporary:
            root, harvest = self.prepare_tool_tree(temporary, 'apply_images.cjs')
            raw_path = root / 'scripts' / 'data_sources' / 'machina_raw.json'
            mapping_path = root / 'mapping.json'
            original = [{'id': 'hammer', 'name': 'Hammer'}]
            mapping = [{
                'id': 'hammer',
                'imageFile': 'https://commons.wikimedia.org/wiki/File%3AHammer.jpg',
                'imageLicense': 'CC BY-SA 4.0',
                'imageAttribution': 'Beispielautor',
            }]
            self.write_json(raw_path, original)
            self.write_json(mapping_path, mapping)

            dry = self.run_node(
                harvest / 'apply_images.cjs', 'machina',
                f'--mapping={mapping_path}',
            )

            self.assertEqual(dry.returncode, 0, dry.stderr)
            self.assertEqual(json.loads(raw_path.read_text(encoding='utf-8')), original)
            self.assertIn('DRY-RUN', dry.stdout)

            written = self.run_node(
                harvest / 'apply_images.cjs', 'machina',
                f'--mapping={mapping_path}', '--write',
            )

            self.assertEqual(written.returncode, 0, written.stderr)
            concept = json.loads(raw_path.read_text(encoding='utf-8'))[0]
            self.assertEqual(concept['imageFile'], mapping[0]['imageFile'])
            self.assertEqual(concept['imageLicense'], 'CC BY-SA 4.0')
            self.assertEqual(concept['imageAttribution'], 'Beispielautor')

    def test_apply_images_rejects_unknown_ids_and_blacklisted_guernica(self):
        with tempfile.TemporaryDirectory() as temporary:
            root, harvest = self.prepare_tool_tree(temporary, 'apply_images.cjs')
            raw_path = root / 'scripts' / 'data_sources' / 'cultura_raw.json'
            mapping_path = root / 'mapping.json'
            original = [{'id': 'known', 'name': 'Bekannt'}]
            self.write_json(raw_path, original)
            base = {
                'imageFile': "https://commons.wikimedia.org/wiki/File%3APablo_Picasso%27s_Guernica.jpg",
                'imageLicense': 'CC BY-SA 4.0', 'imageAttribution': 'Autor',
            }
            self.write_json(mapping_path, [{'id': 'unknown', **base}])

            unknown = self.run_node(
                harvest / 'apply_images.cjs', 'cultura', f'--mapping={mapping_path}', '--write')
            self.assertNotEqual(unknown.returncode, 0)
            self.assertIn('unbekannte id', unknown.stderr)
            self.assertEqual(json.loads(raw_path.read_text(encoding='utf-8')), original)

            self.write_json(mapping_path, [{'id': 'guernica', **base}])
            self.write_json(raw_path, [{'id': 'guernica', 'name': 'Guernica'}])
            blocked = self.run_node(
                harvest / 'apply_images.cjs', 'cultura', f'--mapping={mapping_path}', '--write')
            self.assertNotEqual(blocked.returncode, 0)
            self.assertIn('gesperrtes Konzept', blocked.stderr)

    def test_batched_image_policy_handles_p18_redirects_and_ambiguous_titles(self):
        script = HARVEST / 'resolve_images_batched.cjs'
        code = f"""
const resolver = require({json.dumps(str(script))});
const byTitle = new Map([
  ['Alias A', {{ id: 'a' }}], ['Alias B', {{ id: 'b' }}],
]);
const rows = resolver.collectResolvedPageImages(['Alias A', 'Alias B'], byTitle, {{
  redirects: [{{ from: 'Alias A', to: 'Ziel' }}, {{ from: 'Alias B', to: 'Ziel' }}],
  pages: {{ 1: {{ title: 'Ziel', original: {{ source: 'https://upload.wikimedia.org/a/Bild.jpg?x=1#y' }} }} }},
}});
console.log(JSON.stringify({{
  unique: [...resolver.uniqueFinalPageImages(rows).assignments],
  ambiguous: resolver.uniqueFinalPageImages(rows).ambiguous,
  preferred: resolver.selectP18File([
    {{ rank: 'deprecated', mainsnak: {{ datavalue: {{ value: 'Alt.jpg' }} }} }},
    {{ rank: 'normal', mainsnak: {{ datavalue: {{ value: 'Normal.jpg' }} }} }},
    {{ rank: 'preferred', mainsnak: {{ datavalue: {{ value: 'Preferred.jpg' }} }} }},
  ]),
  multipleNormal: resolver.selectP18File([
    {{ rank: 'normal', mainsnak: {{ datavalue: {{ value: 'A.jpg' }} }} }},
    {{ rank: 'normal', mainsnak: {{ datavalue: {{ value: 'B.jpg' }} }} }},
  ]),
  io: resolver.pageTitleForConcept({{ id: 'io', name: 'Io' }}, 'astra'),
}}));
"""
        result = subprocess.run(
            ['node', '-e', code], capture_output=True, text=True, check=False, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr)
        value = json.loads(result.stdout)
        self.assertEqual(value['unique'], [])
        self.assertEqual(value['ambiguous'][0]['ids'], ['a', 'b'])
        self.assertEqual(value['preferred'], 'Preferred.jpg')
        self.assertIsNone(value['multipleNormal'])
        self.assertEqual(value['io'], 'Io (Mond)')

    def test_apply_images_rejects_entire_invalid_mapping_before_write(self):
        with tempfile.TemporaryDirectory() as temporary:
            root, harvest = self.prepare_tool_tree(temporary, 'apply_images.cjs')
            raw_path = root / 'scripts' / 'data_sources' / 'machina_raw.json'
            mapping_path = root / 'mapping.json'
            original = [{'id': 'first'}, {'id': 'second'}]
            self.write_json(raw_path, original)
            self.write_json(mapping_path, [
                {
                    'id': 'first',
                    'imageFile': 'https://commons.wikimedia.org/wiki/File%3AFirst.jpg',
                    'imageLicense': 'CC BY 4.0',
                    'imageAttribution': 'Erster Autor',
                },
                {
                    'id': 'second',
                    'imageFile': 'https://example.invalid/not-commons.jpg',
                    'imageLicense': 'CC BY 4.0',
                    'imageAttribution': 'Zweiter Autor',
                },
            ])

            result = self.run_node(
                harvest / 'apply_images.cjs', 'machina',
                f'--mapping={mapping_path}', '--write',
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(json.loads(raw_path.read_text(encoding='utf-8')), original)
            self.assertIn('keine Commons-Dateiseite', result.stderr)

    def test_apply_images_rejects_unknown_license_before_write(self):
        with tempfile.TemporaryDirectory() as temporary:
            root, harvest = self.prepare_tool_tree(temporary, 'apply_images.cjs')
            raw_path = root / 'scripts' / 'data_sources' / 'machina_raw.json'
            mapping_path = root / 'mapping.json'
            original = [{'id': 'hammer'}]
            self.write_json(raw_path, original)
            self.write_json(mapping_path, [{
                'id': 'hammer',
                'imageFile': 'https://commons.wikimedia.org/wiki/File%3AHammer.jpg',
                'imageLicense': 'unbekannte Lizenz',
                'imageAttribution': 'Beispielautor',
            }])

            result = self.run_node(
                harvest / 'apply_images.cjs', 'machina',
                f'--mapping={mapping_path}', '--write',
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(json.loads(raw_path.read_text(encoding='utf-8')), original)
            self.assertIn('keine erlaubte freie Lizenz', result.stderr)

    def test_batched_image_resolver_rejects_unknown_domain_before_network(self):
        with tempfile.TemporaryDirectory() as temporary:
            _, harvest = self.prepare_tool_tree(
                temporary, 'resolve_images_batched.cjs')

            result = self.run_node(
                harvest / 'resolve_images_batched.cjs', 'not_a_domain')

            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Unbekannte Domain', result.stderr)

    def test_batched_image_resolver_marks_duplicate_sources_as_ambiguous(self):
        script = HARVEST / 'resolve_images_batched.cjs'
        code = f"""
const resolver = require({json.dumps(str(script))});
const groups = new Map();
resolver.addGroupedConcept(groups, 'Gelenk', {{ id: 'a' }});
resolver.addGroupedConcept(groups, 'Gelenk', {{ id: 'b' }});
resolver.addGroupedConcept(groups, 'Knochen', {{ id: 'c' }});
const result = resolver.uniqueSourceMap(groups);
console.log(JSON.stringify({{
  unique: [...result.unique.keys()],
  ambiguous: result.ambiguous,
}}));
"""

        result = subprocess.run(
            ['node', '-e', code], capture_output=True, text=True,
            check=False, timeout=5,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        indexed = json.loads(result.stdout)
        self.assertEqual(indexed['unique'], ['Knochen'])
        self.assertEqual(
            indexed['ambiguous'], [{'key': 'Gelenk', 'ids': ['a', 'b']}])

    def test_natura_harvest_keeps_german_single_word_animal_names(self):
        scripts = [
            HARVEST / 'wikidata_natura.cjs',
            HARVEST / 'wikidata_natura_wd2.cjs',
            HARVEST / 'wikidata_natura_wd3.cjs',
            HARVEST / 'wikidata_natura_wd4.cjs',
        ]
        code = f"""
const paths = {json.dumps([str(path) for path in scripts])};
const results = paths.map(path => {{
  const {{ isBinomial }} = require(path);
  return {{
    tiger: isBinomial('Tiger'),
    troglodytes: isBinomial('Troglodytes'),
    binomial: isBinomial('Panthera leo'),
    trinomial: isBinomial('Homo sapiens sapiens'),
    commonName: isBinomial('Kleiner roter Panda'),
  }};
}});
console.log(JSON.stringify(results));
"""

        result = subprocess.run(
            ['node', '-e', code], capture_output=True, text=True,
            check=False, timeout=5,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        for classification in json.loads(result.stdout):
            self.assertFalse(classification['tiger'])
            self.assertFalse(classification['troglodytes'])
            self.assertTrue(classification['binomial'])
            self.assertTrue(classification['trinomial'])
            self.assertFalse(classification['commonName'])

    def test_astra_harvest_distinguishes_orange_dwarfs_and_giants(self):
        script = HARVEST / 'wikidata_astra_w4.cjs'
        code = f"""
const {{ classifySpectralClass, mapStarType }} = require({json.dumps(str(script))});
console.log(JSON.stringify({{
  dwarf: classifySpectralClass('K2 V'),
  giant: classifySpectralClass('K0 III'),
  yellowSupergiant: classifySpectralClass('F8 Iab'),
  orangeSubgiant: classifySpectralClass('K1 IV'),
  orangeSupergiant: classifySpectralClass('K5 Ib'),
  orangeIntermediateSupergiant: classifySpectralClass('K4 Ib-II'),
  genericMainSequence: mapStarType(new Set(['Hauptreihenstern'])),
  mapped: mapStarType(new Set(['Oranger Zwerg'])),
}}));
"""

        result = subprocess.run(
            ['node', '-e', code], capture_output=True, text=True,
            check=False, timeout=5,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), {
            'dwarf': 'Oranger Zwerg',
            'giant': 'Oranger Riese',
            'yellowSupergiant': 'Gelber Überriese',
            'orangeSubgiant': 'Oranger Unterriese',
            'orangeSupergiant': 'Oranger Überriese',
            'orangeIntermediateSupergiant': 'Oranger Überriese',
            'genericMainSequence': None,
            'mapped': 'Oranger Zwerg',
        })

    def test_lingua_identity_keeps_meaningful_parentheses_and_rejects_ambiguity(self):
        helper = HARVEST / 'lingua_harvest_helpers.cjs'
        code = f"""
const h = require({json.dumps(str(helper))});
let ambiguous = '';
try {{
  h.selectLanguageFacts([
    {{ speakers: {{ value: '100' }}, scriptLabel: {{ value: 'Lateinisch' }} }},
    {{ speakers: {{ value: '200' }}, scriptLabel: {{ value: 'Lateinisch' }} }},
  ]);
}} catch (error) {{ ambiguous = error.message; }}
console.log(JSON.stringify({{
  language: h.normalizeEntityName('Wu (Chinesisch)'),
  river: h.normalizeEntityName('Wu (Fluss)'),
  ambiguous,
}}));
"""
        result = subprocess.run(
            ['node', '-e', code], capture_output=True, text=True, check=False, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr)
        value = json.loads(result.stdout)
        self.assertEqual(value['language'], 'wu')
        self.assertEqual(value['river'], 'wu fluss')
        self.assertIn('mehrdeutige P1098', value['ambiguous'])

    def test_wikiquote_cleaner_removes_source_suffix_but_preserves_inner_dash(self):
        cleaner = HARVEST / 'wikiquote_cleaning.cjs'
        code = f"""
const {{ stripQuotationMarks }} = require({json.dumps(str(cleaner))});
console.log(JSON.stringify([
  stripQuotationMarks('Ein Satz. – Werk, Seite 12'),
  stripQuotationMarks('Freiheit – die ich meine – bleibt kostbar.'),
]));
"""
        result = subprocess.run(
            ['node', '-e', code], capture_output=True, text=True, check=False, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), [
            'Ein Satz.', 'Freiheit – die ich meine – bleibt kostbar.',
        ])

    def test_question_audit_rejects_options_without_answer_key(self):
        with tempfile.TemporaryDirectory() as temporary:
            data = Path(temporary)
            self.write_json(data / 'questions_machina.json', [{
                'id': 'missing-key', 'type': 'name', 'prompt': 'Was ist richtig?',
                'options': ['Erste', 'Zweite', 'Dritte', 'Vierte'],
            }])
            result = subprocess.run(
                ['node', str(ROOT / 'scripts' / 'audit_questions.cjs'), 'machina',
                 f'--data-dir={data}'],
                cwd=ROOT, capture_output=True, text=True, check=False, timeout=5)
            self.assertEqual(result.returncode, 1)
            self.assertIn('correctAnswer fehlt', result.stdout)

    def test_attribution_backfill_writes_nothing_when_one_credit_is_unresolved(self):
        helper = HARVEST / 'staged_attribution_writes.cjs'
        code = f"""
const {{ commitCompletedAttributionBackfill }} = require({json.dumps(str(helper))});
const writes = [];
const count = commitCompletedAttributionBackfill({{
  domainData: new Map([['homo', {{ file: 'homo.json', records: [{{ id: 'x' }}] }}]]),
  changedDomains: new Set(['homo']), unresolved: ['homo:y'], write: true,
  writeJsonAtomic: (...args) => writes.push(args),
}});
console.log(JSON.stringify({{ count, writes }}));
"""
        result = subprocess.run(
            ['node', '-e', code], capture_output=True, text=True, check=False, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), {'count': 0, 'writes': []})


if __name__ == '__main__':
    unittest.main()
