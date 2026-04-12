from __future__ import annotations

import importlib.util
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = ROOT / "scripts" / "check_placeholder_corruption.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("check_placeholder_corruption", SCRIPT_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_placeholder_guard_accepts_clean_file(tmp_path: Path) -> None:
    module = _load_module()
    clean_file = tmp_path / "clean.jsx"
    clean_file.write_text('const title = "登录工作台";\n', encoding="utf-8")

    assert module.main([str(clean_file)]) == 0


def test_placeholder_guard_rejects_question_mark_runs(tmp_path: Path) -> None:
    module = _load_module()
    bad_file = tmp_path / "broken.jsx"
    corrupted_text = "?" * 5
    bad_file.write_text(f'const title = "{corrupted_text}";\n', encoding="utf-8")

    assert module.main([str(bad_file)]) == 1
