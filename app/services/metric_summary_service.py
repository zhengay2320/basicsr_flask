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
        """
        只查当前 run 对应的 TensorBoard 目录：
        1. BASICSR_ROOT/tb_logger/<name>
        2. BASICSR_ROOT/tb_logger/train_<name>（兼容旧规则）
        3. run.tensorboard_dir
        不再扫描全局最新目录。
        """
        config_name = self._load_run_config_name(run)
        if config_name:
            tb_root = self.basicsr_root / "tb_logger"

            candidates = [
                tb_root / config_name,  # 新规则
                tb_root / f"train_{config_name}",  # 兼容旧规则
            ]

            for tb_dir in candidates:
                if self._has_event_files(tb_dir):
                    return tb_dir

        if run.tensorboard_dir:
            tb_dir = Path(run.tensorboard_dir)
            if self._has_event_files(tb_dir):
                return tb_dir

        return None

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
