import os
import subprocess
import yaml

from datetime import datetime
from pathlib import Path

from app.extensions import db
from app.models.task import Task
from app.models.task_run import TaskRun
from app.models.task_config import TaskConfig
from app.models.run_event import RunEvent


class RunService:
    def __init__(self, basicsr_root: str, storage_root: str, python_exec: str = None):
        self.basicsr_root = Path(basicsr_root).resolve()
        self.storage_root = Path(storage_root).resolve()
        self.python_exec = python_exec or "python"

    def _ensure_run_dir(self, user_id: int, task_id: int, run_id: int):
        run_dir = self.storage_root / "users" / str(user_id) / "tasks" / str(task_id) / "runs" / str(run_id)
        log_dir = run_dir / "logs"
        checkpoint_dir = run_dir / "checkpoints"
        output_dir = run_dir / "outputs"
        config_dir = run_dir / "config"
        tb_dir = run_dir / "tensorboard"

        for folder in [run_dir, log_dir, checkpoint_dir, output_dir, config_dir, tb_dir]:
            folder.mkdir(parents=True, exist_ok=True)

        return {
            "run_dir": run_dir,
            "log_dir": log_dir,
            "checkpoint_dir": checkpoint_dir,
            "output_dir": output_dir,
            "config_dir": config_dir,
            "tensorboard_dir": tb_dir
        }

    def _load_yaml(self, yaml_path: str):
        path = Path(yaml_path)
        if not path.exists():
            raise FileNotFoundError(f"config yaml not found: {yaml_path}")
        with path.open("r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}

    def _make_unique_run_name(self, base_name: str, run_id: int):
        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        base_name = (base_name or "train_task").strip()
        return f"{base_name}_run_{run_id}_{ts}"

    def _write_run_yaml(self, yaml_data: dict, save_path: Path):
        with save_path.open("w", encoding="utf-8") as f:
            yaml.safe_dump(yaml_data, f, allow_unicode=True, sort_keys=False)

    def create_and_start_run(self, user_id: int, task_id: int, gpu_mode: str, gpu_devices: str = None, run_name: str = None):
        task = Task.query.filter_by(id=task_id, user_id=user_id, is_deleted=False).first()
        if not task:
            raise ValueError("Task not found")

        if not task.current_config_id:
            raise ValueError("Task has no active config")

        config = TaskConfig.query.filter_by(id=task.current_config_id, task_id=task.id).first()
        if not config:
            raise ValueError("Task config not found")

        run = TaskRun(
            task_id=task.id,
            user_id=user_id,
            config_id=config.id,
            run_name=run_name or f"task-{task.id}-run",
            run_type=task.task_type,
            status="starting",
            trigger_type="manual",
            run_config_path="",
            work_dir="",
            log_dir="",
            checkpoint_dir="",
            output_dir="",
            tensorboard_dir="",
            command_text="",
            gpu_mode=gpu_mode,
            gpu_devices=gpu_devices or ""
        )
        db.session.add(run)
        db.session.flush()

        dirs = self._ensure_run_dir(user_id, task.id, run.id)
        run.work_dir = str(dirs["run_dir"])
        run.log_dir = str(dirs["log_dir"])
        run.checkpoint_dir = str(dirs["checkpoint_dir"])
        run.output_dir = str(dirs["output_dir"])

        config_data = self._load_yaml(config.yaml_path)
        original_name = config_data.get("name", f"task_{task.id}")
        unique_name = self._make_unique_run_name(original_name, run.id)
        config_data["name"] = unique_name

        run_yaml_path = dirs["config_dir"] / f"run_{run.id}.yml"
        self._write_run_yaml(config_data, run_yaml_path)
        run.run_config_path = str(run_yaml_path)

        run.tensorboard_dir = str(self.basicsr_root / "tb_logger" / f"train_{unique_name}")

        script_name = "train.py" if task.task_type == "train" else "test.py"
        script_path = self.basicsr_root / "basicsr" / script_name
        if not script_path.exists():
            raise FileNotFoundError(f"BasicSR script not found: {script_path}")

        env = os.environ.copy()
        if gpu_mode in ["single", "multi"] and gpu_devices:
            env["CUDA_VISIBLE_DEVICES"] = gpu_devices

        stdout_log = Path(run.log_dir) / "stdout.log"
        stderr_log = Path(run.log_dir) / "stderr.log"

        cmd = [
            self.python_exec,
            str(script_path),
            "-opt",
            str(run_yaml_path)
        ]
        run.command_text = " ".join(cmd)

        stdout_fp = open(stdout_log, "a", encoding="utf-8")
        stderr_fp = open(stderr_log, "a", encoding="utf-8")

        proc = subprocess.Popen(
            cmd,
            cwd=str(self.basicsr_root),
            stdout=stdout_fp,
            stderr=stderr_fp,
            stdin=subprocess.DEVNULL,
            env=env,
            close_fds=True,
            start_new_session=True
        )

        run.process_pid = proc.pid
        run.status = "running"
        run.started_at = datetime.utcnow()

        db.session.add(RunEvent(
            run_id=run.id,
            event_type="started",
            event_level="info",
            message=f"Run started with PID={proc.pid}, config name={unique_name}",
            event_time=datetime.utcnow()
        ))
        db.session.commit()

        return run