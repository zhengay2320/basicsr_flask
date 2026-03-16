from pathlib import Path
import yaml
from tensorboard.backend.event_processing.event_accumulator import EventAccumulator

from app.extensions import db
from app.models.task_run import TaskRun


class MetricSummaryService:
    def __init__(self, basicsr_root: str):
        self.basicsr_root = Path(basicsr_root).resolve()

    def _has_event_files(self, folder: Path) -> bool:
        if not folder or not folder.exists() or not folder.is_dir():
            return False
        for p in folder.rglob("*"):
            if p.is_file() and "events.out.tfevents" in p.name:
                return True
        return False

    def _load_run_config_name(self, run: TaskRun):
        if not run.run_config_path:
            return None

        config_path = Path(run.run_config_path)
        if not config_path.exists():
            return None

        try:
            with config_path.open("r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
            name = data.get("name")
            if isinstance(name, str) and name.strip():
                return name.strip()
        except Exception:
            return None

        return None

    def _discover_tensorboard_dir(self, run: TaskRun):
        # 1) 优先根据 run yaml 的 name 精准定位
        config_name = self._load_run_config_name(run)
        if config_name:
            tb_dir = self.basicsr_root / "tb_logger" / f"train_{config_name}"
            if self._has_event_files(tb_dir):
                return tb_dir

        # 2) 其次使用 run.tensorboard_dir
        if run.tensorboard_dir:
            tb_dir = Path(run.tensorboard_dir)
            if self._has_event_files(tb_dir):
                return tb_dir

        # 3) 最后兜底扫描 tb_logger 下最新有效目录
        tb_root = self.basicsr_root / "tb_logger"
        if not tb_root.exists():
            return None

        valid_dirs = [p for p in tb_root.iterdir() if p.is_dir() and self._has_event_files(p)]
        if not valid_dirs:
            return None

        valid_dirs.sort(key=lambda x: x.stat().st_mtime, reverse=True)
        return valid_dirs[0]

    def summarize_run_metrics(self, run: TaskRun, commit: bool = True):
        tb_dir = self._discover_tensorboard_dir(run)
        if not tb_dir:
            return {
                "metric_summary_json": {},
                "best_metric_max_json": {},
                "best_metric_min_json": {},
            }

        try:
            event_acc = EventAccumulator(str(tb_dir))
            event_acc.Reload()
            tags = event_acc.Tags().get("scalars", [])
        except Exception:
            return {
                "metric_summary_json": {},
                "best_metric_max_json": {},
                "best_metric_min_json": {},
            }

        metric_summary = {}
        best_max = {}
        best_min = {}

        for tag in tags:
            try:
                events = event_acc.Scalars(tag)
            except Exception:
                continue

            if not events:
                continue

            values = [float(x.value) for x in events]

            metric_summary[tag] = {
                "last": values[-1],
                "max": max(values),
                "min": min(values),
                "count": len(values),
            }
            best_max[tag] = max(values)
            best_min[tag] = min(values)

        run.metric_summary_json = metric_summary
        run.best_metric_max_json = best_max
        run.best_metric_min_json = best_min

        if commit:
            db.session.commit()

        return {
            "metric_summary_json": metric_summary,
            "best_metric_max_json": best_max,
            "best_metric_min_json": best_min,
        }
