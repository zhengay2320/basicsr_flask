import os
from datetime import datetime
from pathlib import Path
import re

import psutil
from tensorboard.backend.event_processing.event_accumulator import EventAccumulator

from app.extensions import db
from app.models.task_run import TaskRun
from app.models.run_event import RunEvent

class RunMonitorService:
    ERROR_KEYWORDS = [
        "traceback",
        "runtimeerror",
        "exception",
        "cuda out of memory",
        "oom",
        "error:"
    ]

    SUCCESS_KEYWORDS = [
        "end of training",
        "training completed",
        "save the latest model",
        "saving models and training states"
    ]

    ANSI_ESCAPE_RE = re.compile(r'\x1B\[[0-?]*[ -/]*[@-~]')

    def __init__(self, basicsr_root: str = None):
        self.basicsr_root = Path(basicsr_root).resolve() if basicsr_root else None

    def strip_ansi(self, text: str):
        if not text:
            return ""
        return self.ANSI_ESCAPE_RE.sub("", text)

    def get_run_or_raise(self, run_id: int, user_id: int):
        run = TaskRun.query.filter_by(id=run_id, user_id=user_id).first()
        if not run:
            raise ValueError("run not found")
        return run

    def refresh_run_status(self, run: TaskRun):
        if run.status in ["success", "failed", "stopped", "canceled", "timeout"]:
            return run

        pid = run.process_pid
        stdout_log = Path(run.log_dir) / "stdout.log" if run.log_dir else None
        stderr_log = Path(run.log_dir) / "stderr.log" if run.log_dir else None

        alive = False
        if pid:
            try:
                alive = psutil.pid_exists(pid)
            except Exception:
                alive = False

        if alive:
            if run.status != "running":
                run.status = "running"
                db.session.add(RunEvent(
                    run_id=run.id,
                    event_type="status_refresh",
                    event_level="info",
                    message="Run is still running",
                    event_time=datetime.utcnow()
                ))
                db.session.commit()
            return run

        stderr_text = ""
        stdout_text = ""

        if stderr_log and stderr_log.exists():
            try:
                stderr_text = stderr_log.read_text(encoding="utf-8", errors="ignore").lower()
            except Exception:
                stderr_text = ""

        if stdout_log and stdout_log.exists():
            try:
                stdout_text = stdout_log.read_text(encoding="utf-8", errors="ignore").lower()
            except Exception:
                stdout_text = ""

        failed = any(k in stderr_text for k in self.ERROR_KEYWORDS) or any(k in stdout_text for k in self.ERROR_KEYWORDS)
        success = any(k in stdout_text for k in self.SUCCESS_KEYWORDS)

        if failed:
            run.status = "failed"
            if not run.ended_at:
                run.ended_at = datetime.utcnow()
            if run.started_at and run.ended_at:
                run.duration_seconds = int((run.ended_at - run.started_at).total_seconds())
            run.error_message = "Training crashed or exited abnormally"
            db.session.add(RunEvent(
                run_id=run.id,
                event_type="failed",
                event_level="error",
                message=run.error_message,
                event_time=datetime.utcnow()
            ))
            db.session.commit()
            return run

        if success or run.status in ["running", "starting"]:
            run.status = "success"
            if not run.ended_at:
                run.ended_at = datetime.utcnow()
            if run.started_at and run.ended_at:
                run.duration_seconds = int((run.ended_at - run.started_at).total_seconds())
            db.session.add(RunEvent(
                run_id=run.id,
                event_type="finished",
                event_level="info",
                message="Run finished successfully",
                event_time=datetime.utcnow()
            ))
            db.session.commit()
            return run

        run.status = "failed"
        if not run.ended_at:
            run.ended_at = datetime.utcnow()
        if run.started_at and run.ended_at:
            run.duration_seconds = int((run.ended_at - run.started_at).total_seconds())
        run.error_message = "Run process disappeared unexpectedly"
        db.session.add(RunEvent(
            run_id=run.id,
            event_type="failed",
            event_level="error",
            message=run.error_message,
            event_time=datetime.utcnow()
        ))
        db.session.commit()
        return run

    def read_log(self, run: TaskRun, log_type: str = "stdout", max_lines: int = 300):
        if log_type not in ["stdout", "stderr"]:
            raise ValueError("log_type must be stdout or stderr")

        if not run.log_dir:
            return ""

        log_file = Path(run.log_dir) / f"{log_type}.log"
        if not log_file.exists():
            return ""

        try:
            raw_text = log_file.read_text(encoding="utf-8", errors="ignore")
            clean_text = self.strip_ansi(raw_text)
            lines = clean_text.splitlines()
            return "\n".join(lines[-max_lines:])
        except Exception:
            return ""

    def _has_event_files(self, folder: Path):
        if not folder or not folder.exists() or not folder.is_dir():
            return False
        for p in folder.rglob("*"):
            if p.is_file() and "events.out.tfevents" in p.name:
                return True
        return False

    def _load_run_config_name(self, run: TaskRun):
        """
        从 run.run_config_path 对应的 yml 中读取 name 字段。
        例如：
            name: RealESRNetx2plus_1000k_B12G4
        返回：
            RealESRNetx2plus_1000k_B12G4
        """
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
            return None
        except Exception:
            return None

    def _get_tb_dir_from_config_name(self, run: TaskRun):
        """
        根据 BasicSR 规则：
        <BASICSR_ROOT>/tb_logger/train_<config_name>
        """
        if not self.basicsr_root:
            return None

        config_name = self._load_run_config_name(run)
        if not config_name:
            return None

        tb_dir = self.basicsr_root / "tb_logger" / f"train_{config_name}"
        return tb_dir

    def _discover_tensorboard_dir(self, run: TaskRun):
        """
        更鲁棒的优先级：
        1. 根据当前 run 的 config yml 读取 name 字段，拼出:
           BASICSR_ROOT/tb_logger/train_<name>
        2. 如果 run.tensorboard_dir 本身存在 event 文件，也可使用
        3. 最后才兜底扫描 tb_logger 下最新目录
        """
        # 1) 最优先：根据 yml 的 name 字段定位
        tb_dir_by_name = self._get_tb_dir_from_config_name(run)
        if tb_dir_by_name and self._has_event_files(tb_dir_by_name):
            return tb_dir_by_name

        # 2) 其次：run.tensorboard_dir
        if run.tensorboard_dir:
            tb_dir = Path(run.tensorboard_dir)
            if self._has_event_files(tb_dir):
                return tb_dir

        # 3) 兜底：扫描 BASICSR_ROOT/tb_logger 下最近的有效目录
        if not self.basicsr_root:
            return None

        tb_root = self.basicsr_root / "tb_logger"
        if not tb_root.exists():
            return None

        subdirs = [p for p in tb_root.iterdir() if p.is_dir()]
        valid_dirs = [d for d in subdirs if self._has_event_files(d)]
        if valid_dirs:
            valid_dirs.sort(key=lambda x: x.stat().st_mtime, reverse=True)
            return valid_dirs[0]

        return None

    def read_tensorboard_scalars(self, run: TaskRun):
        tb_dir = self._discover_tensorboard_dir(run)
        if not tb_dir:
            return {}

        try:
            event_acc = EventAccumulator(str(tb_dir))
            event_acc.Reload()
            tags = event_acc.Tags().get("scalars", [])
            result = {}
            for tag in tags:
                events = event_acc.Scalars(tag)
                result[tag] = [
                    {"step": item.step, "value": item.value}
                    for item in events
                ]
            return result
        except Exception:
            return {}

    def get_tensorboard_dir_for_run(self, run: TaskRun):
        tb_dir = self._discover_tensorboard_dir(run)
        return str(tb_dir) if tb_dir else None
