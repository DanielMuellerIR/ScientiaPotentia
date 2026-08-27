import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
RUN_QA = ROOT / 'scripts' / 'qa_review' / 'run_qa.py'


class QaReviewRunnerTests(unittest.TestCase):
    def run_qa(self, *args):
        return subprocess.run(
            [sys.executable, str(RUN_QA), *map(str, args)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
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
            views = [
                {
                    'id': f'q{i}', 'domain': 'natura', 'type': 'test',
                    'prompt': f'Frage {i}?', 'options': ['A', 'B', 'C', 'D'],
                    'keyedAnswer': 'A', 'panelType': 'grafisch', 'panelNote': 'Schema',
                }
                for i in range(2)
            ]
            (batches / 'batch_001.json').write_text(json.dumps(views), encoding='utf-8')
            runner = temporary / 'fake_runner.py'
            runner.write_text(
                'import json\nprint(json.dumps([{"id": "F1", "urteil": "behalten"}]))\n',
                encoding='utf-8',
            )
            report = temporary / 'report.md'

            result = self.run_qa(
                '--batches', batches, '--out', report, '--runner', runner,
            )

            self.assertEqual(result.returncode, 1)
            self.assertTrue(report.exists())
            raw = json.loads(report.with_suffix('.raw.json').read_text(encoding='utf-8'))
            self.assertEqual(len(raw['errors']), 1)
            self.assertEqual(sum(item['eval'] is None for item in raw['items']), 1)


if __name__ == '__main__':
    unittest.main()
