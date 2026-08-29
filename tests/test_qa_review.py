import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
BUILD_BATCHES = ROOT / 'scripts' / 'qa_review' / 'build_batches.mjs'
RUN_QA = ROOT / 'scripts' / 'qa_review' / 'run_qa.py'


class QaReviewRunnerTests(unittest.TestCase):
    @staticmethod
    def make_view(question_id='q1'):
        return {
            'id': question_id, 'domain': 'natura', 'type': 'test',
            'prompt': 'Testfrage?', 'options': ['A', 'B', 'C', 'D'],
            'keyedAnswer': 'A', 'panelType': 'grafisch', 'panelNote': 'Schema',
        }

    @staticmethod
    def make_evaluation(reference='F1'):
        return {
            'id': reference,
            'eigeneAntwort': 'A',
            'basis': 'wissen',
            'confidence': 'hoch',
            'keyDoubt': False,
            'keyDoubtGrund': '',
            'selbstverraeter': 'keiner',
            'selbstverraeterGrund': '',
            'wissensniveau': 'allgemein',
            'klarheit': 'klar',
            'distraktoren': 'gut',
            'distraktorenGrund': '',
            'urteil': 'behalten',
            'probleme': [],
        }

    @staticmethod
    def write_runner(path, evaluations):
        path.write_text(
            f'import json\nprint(json.dumps({evaluations!r}, ensure_ascii=False))\n',
            encoding='utf-8',
        )

    def run_qa(self, *args):
        return subprocess.run(
            [sys.executable, str(RUN_QA), *map(str, args)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )

    def run_batch_builder(self, *args):
        return subprocess.run(
            ['node', str(BUILD_BATCHES), *map(str, args)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
            timeout=5,
        )

    def test_requires_an_existing_runner_before_processing_batches(self):
        with tempfile.TemporaryDirectory() as temporary:
            batches = Path(temporary) / 'batches'
            batches.mkdir()
            (batches / 'batch_001.json').write_text('[]', encoding='utf-8')
            result = self.run_qa('--batches', batches, '--out', Path(temporary) / 'report.md')

        self.assertEqual(result.returncode, 2)
        self.assertIn('--runner fehlt', result.stderr)

    def test_incomplete_model_coverage_returns_failure_with_diagnostics(self):
        with tempfile.TemporaryDirectory() as temporary:
            temporary = Path(temporary)
            batches = temporary / 'batches'
            batches.mkdir()
            views = [self.make_view(f'q{i}') for i in range(2)]
            (batches / 'batch_001.json').write_text(json.dumps(views), encoding='utf-8')
            runner = temporary / 'fake_runner.py'
            self.write_runner(runner, [self.make_evaluation('F1')])
            report = temporary / 'report.md'

            result = self.run_qa(
                '--batches', batches, '--out', report, '--runner', runner,
            )

            self.assertEqual(result.returncode, 1)
            self.assertTrue(report.exists())
            raw = json.loads(report.with_suffix('.raw.json').read_text(encoding='utf-8'))
            self.assertEqual(len(raw['errors']), 1)
            self.assertEqual(sum(item['eval'] is None for item in raw['items']), 1)

    def test_incomplete_evaluation_schema_returns_failure(self):
        with tempfile.TemporaryDirectory() as temporary:
            temporary = Path(temporary)
            batches = temporary / 'batches'
            batches.mkdir()
            (batches / 'batch_000.json').write_text(
                json.dumps([self.make_view()]), encoding='utf-8')
            runner = temporary / 'fake_runner.py'
            self.write_runner(runner, [{'id': 'F1', 'urteil': 'behalten'}])
            report = temporary / 'report.md'

            result = self.run_qa(
                '--batches', batches, '--out', report, '--runner', runner,
            )

            self.assertEqual(result.returncode, 1)
            raw = json.loads(report.with_suffix('.raw.json').read_text(encoding='utf-8'))
            self.assertIn('ungültige Bewertung', raw['errors'][0][1])
            self.assertIsNone(raw['items'][0]['eval'])

    def test_malformed_batch_produces_partial_report_instead_of_traceback(self):
        with tempfile.TemporaryDirectory() as temporary:
            temporary = Path(temporary)
            batches = temporary / 'batches'
            batches.mkdir()
            (batches / 'batch_000.json').write_text('{', encoding='utf-8')
            (batches / 'batch_001.json').write_text(
                json.dumps([self.make_view()]), encoding='utf-8')
            runner = temporary / 'fake_runner.py'
            self.write_runner(runner, [self.make_evaluation('F1')])
            report = temporary / 'report.md'

            result = self.run_qa(
                '--batches', batches, '--out', report, '--runner', runner,
            )

            self.assertEqual(result.returncode, 1)
            self.assertNotIn('Traceback', result.stderr)
            raw = json.loads(report.with_suffix('.raw.json').read_text(encoding='utf-8'))
            self.assertEqual(len(raw['errors']), 1)
            self.assertEqual(raw['items'][0]['eval']['urteil'], 'behalten')

    def test_duplicate_question_ids_across_batches_return_failure(self):
        with tempfile.TemporaryDirectory() as temporary:
            temporary = Path(temporary)
            batches = temporary / 'batches'
            batches.mkdir()
            payload = json.dumps([self.make_view()])
            (batches / 'batch_000.json').write_text(payload, encoding='utf-8')
            (batches / 'batch_001.json').write_text(payload, encoding='utf-8')
            runner = temporary / 'fake_runner.py'
            self.write_runner(runner, [self.make_evaluation('F1')])
            report = temporary / 'report.md'

            result = self.run_qa(
                '--batches', batches, '--out', report, '--runner', runner,
            )

            self.assertEqual(result.returncode, 1)
            raw = json.loads(report.with_suffix('.raw.json').read_text(encoding='utf-8'))
            self.assertIn('doppelte Frage-ID', raw['errors'][0][1])

    def test_manifest_rejects_stale_batch_before_model_call(self):
        with tempfile.TemporaryDirectory() as temporary:
            temporary = Path(temporary)
            batches = temporary / 'batches'
            batches.mkdir()
            payload = json.dumps([self.make_view()])
            (batches / 'batch_000.json').write_text(payload, encoding='utf-8')
            (batches / 'batch_001.json').write_text(payload, encoding='utf-8')
            (batches / 'manifest.json').write_text(
                json.dumps({'batchCount': 1}), encoding='utf-8')
            runner = temporary / 'fake_runner.py'
            self.write_runner(runner, [self.make_evaluation('F1')])

            result = self.run_qa(
                '--batches', batches, '--out', temporary / 'report.md',
                '--runner', runner,
            )

            self.assertEqual(result.returncode, 2)
            self.assertIn('ungültiger Batch-Snapshot', result.stderr)
            self.assertIn('nicht im Manifest', result.stderr)

    def test_creates_missing_report_directory(self):
        with tempfile.TemporaryDirectory() as temporary:
            temporary = Path(temporary)
            batches = temporary / 'batches'
            batches.mkdir()
            (batches / 'batch_000.json').write_text(
                json.dumps([self.make_view()]), encoding='utf-8')
            runner = temporary / 'fake_runner.py'
            self.write_runner(runner, [self.make_evaluation('F1')])
            report = temporary / 'missing' / 'reports' / 'report.md'

            result = self.run_qa(
                '--batches', batches, '--out', report, '--runner', runner,
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue(report.exists())
            self.assertTrue(report.with_suffix('.raw.json').exists())

    def test_batch_builder_rejects_non_positive_batch_size(self):
        with tempfile.TemporaryDirectory() as temporary:
            result = self.run_batch_builder(
                '--domain', 'natura', '--batch', '0', '--out', temporary,
            )

        self.assertEqual(result.returncode, 2)
        self.assertIn('--batch muss eine positive Ganzzahl sein', result.stderr)

    def test_batch_builder_removes_stale_batches_on_rebuild(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / 'batches'
            first = self.run_batch_builder(
                '--domain', 'astra', '--per-type', '2', '--batch', '1', '--out', output,
            )
            self.assertEqual(first.returncode, 0, first.stderr)
            self.assertGreater(len(list(output.glob('batch_*.json'))), 1)

            second = self.run_batch_builder(
                '--domain', 'astra', '--per-type', '1', '--batch', '1000', '--out', output,
            )

            self.assertEqual(second.returncode, 0, second.stderr)
            manifest = json.loads((output / 'manifest.json').read_text(encoding='utf-8'))
            self.assertEqual(
                sorted(path.name for path in output.glob('batch_*.json')),
                [f'batch_{index:03d}.json' for index in range(manifest['batchCount'])],
            )


if __name__ == '__main__':
    unittest.main()
