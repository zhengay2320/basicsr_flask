from datetime import datetime
from pathlib import Path
import os
import signal
import subprocess
import yaml
import re

from app.extensions import db
from app.models.task import Task
from app.models.task_run import TaskRun
from app.models.task_config import TaskConfig
from app.models.run_event import RunEvent


def _is_active_status(status: str) -> bool:
    s = (status or "").lower()
    return (
        ("running" in s or "pending" in s or "queued" in s or "resume" in s)
        and not any(x in s for x in ["success", "failed", "stopped", "finished", "completed"])
    )


class RunControlService:
    def __init__(self, basicsr_root: str, storage_root: str, python_exec: str = None):
        self.basicsr_root = Path(basicsr_root).resolve()
        self.storage_root = Path(storage_root).resolve()
        self.python_exec = python_exec or "python"

    def delete_run(self, run_id: int, user_id: int):
        run = TaskRun.query.filter_by(id=run_id, user_id=user_id).first()
        if not run:
            raise ValueError("run not found")

        if _is_active_status(run.status):
            raise ValueError("run is still active, please stop it before deleting")

        task_id = run.task_id

        paths_to_cleanup = []
        for p in [
            run.work_dir,
            run.log_dir,
            run.checkpoint_dir,
            run.output_dir,
            run.tensorboard_dir,
        ]:
            if p:
                paths_to_cleanup.append(Path(p))

        db.session.add(RunEvent(
            run_id=run.id,
            event_type="deleted",
            event_level="warning",
            message="Run deleted manually",
            event_time=datetime.utcnow()
        ))
        db.session.flush()

        db.session.delete(run)
        db.session.commit()

        # 提交后再清理文件，避免文件删除异常导致数据库事务回滚混乱
        for path in paths_to_cleanup:
            try:
                if path.exists():
                    shutil.rmtree(path, ignore_errors=True)
            except Exception:
                pass

        return {
            "run_id": run_id,
            "task_id": task_id
        }

    def _terminate_process_group(self, pid: int, timeout: int = 10):
        if not pid:
            return

        try:
            pgid = os.getpgid(pid)
        except ProcessLookupError:
            return
        except Exception:
            pgid = None

        if pgid is not None:
            try:
                os.killpg(pgid, signal.SIGTERM)
            except ProcessLookupError:
                return
            except Exception:
                pass

            deadline = time.time() + timeout
            while time.time() < deadline:
                if not psutil.pid_exists(pid):
                    return
                time.sleep(0.3)

            try:
                os.killpg(pgid, signal.SIGKILL)
            except ProcessLookupError:
                return
            except Exception:
                pass

            deadline = time.time() + 5
            while time.time() < deadline:
                if not psutil.pid_exists(pid):
                    return
                time.sleep(0.2)
            return

        try:
            proc = psutil.Process(pid)
            proc.terminate()
            proc.wait(timeout=timeout)
        except psutil.TimeoutExpired:
            try:
                proc.kill()
                proc.wait(timeout=5)
            except Exception:
                pass
        except Exception:
            pass

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

    def _write_yaml(self, yaml_data: dict, save_path: Path):
        with save_path.open("w", encoding="utf-8") as f:
            yaml.safe_dump(yaml_data, f, allow_unicode=True, sort_keys=False)

    def _extract_numeric_prefix(self, state_path: Path):
        stem = state_path.stem
        match = re.match(r"^(\d+)$", stem)
        if match:
            return int(match.group(1))
        return -1

    def _find_latest_state_file_by_name(self, run: TaskRun):
        """
        返回:
            (latest_state_path, inherited_name)
        如果没找到 state，latest_state_path 返回 None，但 inherited_name 仍可用
        """
        config_data = self._load_yaml(run.run_config_path)
        run_name = config_data.get("name")
        if not run_name or not isinstance(run_name, str):
            raise ValueError("运行配置中缺少 name 字段，无法定位 training_states")

        training_states_dir = self.basicsr_root / "experiments" / run_name / "training_states"
        if not training_states_dir.exists():
            return None, run_name

        state_files = list(training_states_dir.glob("*.state"))
        if not state_files:
            return None, run_name

        state_files.sort(key=lambda p: self._extract_numeric_prefix(p), reverse=True)
        best_state = state_files[0]

        if self._extract_numeric_prefix(best_state) < 0:
            return None, run_name

        return str(best_state), run_name

    def stop_run(self, run_id: int, user_id: int):
        run = TaskRun.query.filter_by(id=run_id, user_id=user_id).first()
        if not run:
            raise ValueError("run not found")

        if run.status in ["success", "failed", "stopped", "canceled", "timeout"]:
            return run

        if run.process_pid:
            self._terminate_process_group(run.process_pid, timeout=10)

        run.status = "stopped"
        run.ended_at = datetime.utcnow()
        if run.started_at and run.ended_at:
            run.duration_seconds = int((run.ended_at - run.started_at).total_seconds())

        db.session.add(RunEvent(
            run_id=run.id,
            event_type="stopped",
            event_level="warning",
            message="Run stopped manually",
            event_time=datetime.utcnow()
        ))
        db.session.commit()
        return run

    def resume_run_from_run(self, run_id: int, user_id: int, gpu_mode: str, gpu_devices: str = None, run_name: str = None):
        source_run = TaskRun.query.filter_by(id=run_id, user_id=user_id).first()
        if not source_run:
            raise ValueError("source run not found")

        task = Task.query.filter_by(id=source_run.task_id, user_id=user_id, is_deleted=False).first()
        if not task:
            raise ValueError("task not found")

        if not source_run.run_config_path:
            raise ValueError("source run has no run_config_path")

        latest_state_path, inherited_name = self._find_latest_state_file_by_name(source_run)
        if not inherited_name:
            raise ValueError("无法从历史运行配置中解析 name")

        config = None
        if task.current_config_id:
            config = TaskConfig.query.filter_by(
                id=task.current_config_id,
                task_id=task.id,
                user_id=user_id
            ).first()

        new_run = TaskRun(
            task_id=task.id,
            user_id=user_id,
            config_id=config.id if config else source_run.config_id,
            run_name=run_name or f"{source_run.run_name or f'run-{source_run.id}'}-resume",
            run_type="resume",
            status="starting",
            trigger_type="manual",
            run_config_path="",
            work_dir="",
            log_dir="",
            checkpoint_dir="",
            output_dir="",
            tensorboard_dir="",
            command_text="",
            process_pid=None,
            exit_code=None,
            gpu_mode=gpu_mode,
            gpu_devices=gpu_devices or source_run.gpu_devices or "",
            resume_from=latest_state_path or "auto_resume",
            parent_run_id=source_run.id
        )
        db.session.add(new_run)
        db.session.flush()

        dirs = self._ensure_run_dir(user_id, task.id, new_run.id)
        new_run.work_dir = str(dirs["run_dir"])
        new_run.log_dir = str(dirs["log_dir"])
        new_run.checkpoint_dir = str(dirs["checkpoint_dir"])
        new_run.output_dir = str(dirs["output_dir"])

        resume_config = self._load_yaml(source_run.run_config_path)
        resume_config["name"] = inherited_name

        if "path" not in resume_config or not isinstance(resume_config["path"], dict):
            resume_config["path"] = {}

        use_auto_resume = latest_state_path is None
        if not use_auto_resume:
            resume_config["path"]["resume_state"] = latest_state_path
        else:
            # 没找到 .state 时，清掉显式 resume_state，改走 --auto_resume
            resume_config["path"].pop("resume_state", None)

        run_yaml_path = dirs["config_dir"] / f"run_{new_run.id}.yml"
        self._write_yaml(resume_config, run_yaml_path)

        new_run.run_config_path = str(run_yaml_path)
        new_run.tensorboard_dir = str(self.basicsr_root / "tb_logger" / f"train_{inherited_name}")

        script_path = self.basicsr_root / "basicsr" / "train.py"
        if not script_path.exists():
            raise FileNotFoundError(f"BasicSR train.py not found: {script_path}")

        env = os.environ.copy()
        if gpu_mode in ["single", "multi"] and new_run.gpu_devices:
            env["CUDA_VISIBLE_DEVICES"] = new_run.gpu_devices

        stdout_log = Path(new_run.log_dir) / "stdout.log"
        stderr_log = Path(new_run.log_dir) / "stderr.log"

        cmd = [
            self.python_exec,
            str(script_path),
            "-opt",
            str(run_yaml_path)
        ]
        if use_auto_resume:
            cmd.append("--auto_resume")

        new_run.command_text = " ".join(cmd)

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

        new_run.process_pid = proc.pid
        new_run.status = "running"
        new_run.started_at = datetime.utcnow()

        msg = (
            f"Run resumed with resume_state={latest_state_path}, inherited name={inherited_name}, "
            f"source_run_id={source_run.id}"
            if latest_state_path
            else
            f"Run resumed with --auto_resume, inherited name={inherited_name}, source_run_id={source_run.id}"
        )

        db.session.add(RunEvent(
            run_id=new_run.id,
            event_type="resumed",
            event_level="info",
            message=msg,
            event_time=datetime.utcnow()
        ))
        db.session.commit()
        return new_run
