from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = ROOT / "scripts" / "migrate_json_to_sql.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("migrate_json_to_sql", SCRIPT_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_migration_script_moves_runtime_settings_into_sqlite(tmp_path: Path) -> None:
    module = _load_module()
    storage_dir = tmp_path / "storage"
    storage_dir.mkdir(parents=True, exist_ok=True)
    (storage_dir / "runtime_model.json").write_text(
        json.dumps({"active_model": "qwen-plus"}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (storage_dir / "runtime_retrieval.json").write_text(
        json.dumps(
            {
                "strategy": "hybrid",
                "top_k": 6,
                "candidate_k": 16,
                "keyword_weight": 0.6,
                "semantic_weight": 0.4,
                "rerank_weight": 0.5,
                "min_score": 0.11,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    database_url = f"sqlite:///{(tmp_path / 'migrated.db').as_posix()}"

    assert module.main(["--storage-dir", str(storage_dir), "--database-url", database_url]) == 0

    from app.services.runtime_models import RuntimeModelService
    from app.services.runtime_retrieval import RuntimeRetrievalService
    from app.sql_repositories import SqlDatabase, SqlRuntimeSettingsRepository

    runtime_repo = SqlRuntimeSettingsRepository(SqlDatabase(database_url))
    model_service = RuntimeModelService(storage_path=storage_dir / "runtime_model.json", runtime_store=runtime_repo)
    retrieval_service = RuntimeRetrievalService(
        storage_path=storage_dir / "runtime_retrieval.json",
        runtime_store=runtime_repo,
    )

    assert model_service.get_active_model() == "qwen-plus"
    assert retrieval_service.get_settings().top_k == 6
    assert retrieval_service.get_settings().candidate_k == 16
