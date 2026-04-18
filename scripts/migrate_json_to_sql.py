from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT / "backend"))

from app.sql_repositories import SqlDatabase, SqlRuntimeSettingsRepository


def _read_json(path: Path) -> object:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def migrate_runtime_settings(storage_dir: Path, database_url: str) -> int:
    database = SqlDatabase(database_url)
    runtime_repo = SqlRuntimeSettingsRepository(database)

    runtime_model = _read_json(storage_dir / "runtime_model.json")
    if isinstance(runtime_model, dict) and runtime_model:
        runtime_repo.set("runtime_model", runtime_model)

    runtime_retrieval = _read_json(storage_dir / "runtime_retrieval.json")
    if isinstance(runtime_retrieval, dict) and runtime_retrieval:
        runtime_repo.set("runtime_retrieval", runtime_retrieval)

    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Migrate JSON runtime settings into the SQL backend.")
    parser.add_argument("--storage-dir", type=Path, default=ROOT / "backend" / "storage")
    parser.add_argument("--database-url", required=True)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return migrate_runtime_settings(args.storage_dir, args.database_url)


if __name__ == "__main__":
    raise SystemExit(main())
