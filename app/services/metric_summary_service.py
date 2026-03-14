from tensorboard.backend.event_processing.event_accumulator import EventAccumulator
from pathlib import Path

from app.extensions import db
from app.models.task_run import TaskRun


class MetricSummaryService:
    def __init__(self, basicsr_root: str):
        self.basicsr_root = Path(basicsr_root).resolve()

    def _find_tb_dir(self, run: TaskRun):
        if run.tensorboard_dir:
            p = Path(run.tensorboard_dir)
            if p.exists():
                return p
        return None

    def summarize_run_metrics(self, run: TaskRun):
        tb_dir = self._find_tb_dir(run)
        if not tb_dir:
            return None

        try:
            event_acc = EventAccumulator(str(tb_dir))
            event_acc.Reload()
            tags = event_acc.Tags().get("scalars", [])
        except Exception:
            return None

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
                "count": len(values)
            }
            best_max[tag] = max(values)
            best_min[tag] = min(values)

        run.metric_summary_json = metric_summary
        run.best_metric_max_json = best_max
        run.best_metric_min_json = best_min
        db.session.commit()

        return {
            "metric_summary_json": metric_summary,
            "best_metric_max_json": best_max,
            "best_metric_min_json": best_min
        }
