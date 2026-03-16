from flask import Blueprint, jsonify, request, current_app
from flask_login import login_required, current_user
import os
from app.models.task import Task
from app.models.task_run import TaskRun
from app.models.task_config import TaskConfig
from app.models.run_event import RunEvent
from app.services.run_service import RunService
from app.services.run_monitor_service import RunMonitorService
from app.services.hardware_monitor_service import HardwareMonitorService
from app.services.metric_summary_service import MetricSummaryService

run_api_bp = Blueprint("run_api", __name__)


def get_metric_service():
    basicsr_root = current_app.config["BASICSR_ROOT"]
    return MetricSummaryService(basicsr_root=basicsr_root)


def get_run_service():
    basicsr_root = current_app.config["BASICSR_ROOT"]
    storage_root = current_app.config["STORAGE_ROOT"]
    python_exec = current_app.config.get("PYTHON_EXEC", "python")
    return RunService(
        basicsr_root=basicsr_root,
        storage_root=storage_root,
        python_exec=python_exec
    )


def get_monitor_service():
    basicsr_root = current_app.config["BASICSR_ROOT"]
    return RunMonitorService(basicsr_root=basicsr_root)


def get_hardware_service():
    return HardwareMonitorService()


@run_api_bp.route("", methods=["POST"])
@login_required
def create_run():
    user_id = int(current_user.id)
    data = request.get_json(silent=True) or {}

    task_id = data.get("task_id")
    gpu_mode = (data.get("gpu_mode") or "single").strip()
    gpu_devices = (data.get("gpu_devices") or "").strip()
    run_name = (data.get("run_name") or "").strip() or None

    if not task_id:
        return jsonify({"code": 400, "message": "task_id is required"}), 400

    if gpu_mode not in ["single", "multi", "cpu"]:
        return jsonify({"code": 400, "message": "invalid gpu_mode"}), 400

    task = Task.query.filter_by(id=int(task_id), user_id=user_id, is_deleted=False).first()
    if not task:
        return jsonify({"code": 404, "message": "task not found"}), 404

    if not task.current_config_id:
        return jsonify({
            "code": 400,
            "message": "当前任务没有有效配置，请先重新创建或保存任务配置"
        }), 400

    config = TaskConfig.query.filter_by(
        id=task.current_config_id,
        task_id=task.id,
        user_id=user_id,
        is_active=True
    ).first()

    if not config:
        return jsonify({
            "code": 400,
            "message": "当前任务配置不存在或未激活"
        }), 400

    try:
        service = get_run_service()
        run = service.create_and_start_run(
            user_id=user_id,
            task_id=int(task_id),
            gpu_mode=gpu_mode,
            gpu_devices=gpu_devices,
            run_name=run_name
        )
    except Exception as e:
        return jsonify({"code": 500, "message": f"start run failed: {str(e)}"}), 500

    return jsonify({
        "code": 201,
        "message": "run started",
        "data": {
            "run_id": run.id,
            "status": run.status,
            "pid": run.process_pid,
            "gpu_mode": run.gpu_mode,
            "gpu_devices": run.gpu_devices
        }
    }), 201

@run_api_bp.route("/task/<int:task_id>", methods=["GET"])
@login_required
def list_runs_by_task(task_id):
    user_id = int(current_user.id)

    runs = TaskRun.query.filter(
        TaskRun.task_id == task_id,
        TaskRun.user_id == user_id
    ).order_by(TaskRun.created_at.desc()).all()

    monitor_service = get_monitor_service()
    metric_service = get_metric_service()

    data = []
    for run in runs:
        try:
            run = monitor_service.refresh_run_status(run)
        except Exception:
            pass

        summary = metric_service.summarize_run_metrics(run)

        data.append({
            "id": run.id,
            "task_id": run.task_id,
            "run_name": run.run_name,
            "status": run.status,
            "run_type": run.run_type,
            "gpu_mode": run.gpu_mode,
            "gpu_devices": run.gpu_devices,
            "pid": run.process_pid,
            "started_at": run.started_at.isoformat() if run.started_at else None,
            "ended_at": run.ended_at.isoformat() if run.ended_at else None,
            "metric_summary_json": summary["metric_summary_json"],
            "best_metric_max_json": summary["best_metric_max_json"],
            "best_metric_min_json": summary["best_metric_min_json"],
        })

    return jsonify({
        "code": 200,
        "message": "ok",
        "data": data
    })



@run_api_bp.route("/<int:run_id>", methods=["GET"])
@login_required
def get_run_detail(run_id):
    user_id = int(current_user.id)
    monitor_service = get_monitor_service()

    try:
        run = monitor_service.get_run_or_raise(run_id, user_id)
        run = monitor_service.refresh_run_status(run)
    except Exception as e:
        return jsonify({"code": 404, "message": str(e)}), 404

    metric_service = get_metric_service()
    summary = metric_service.summarize_run_metrics(run)

    return jsonify({
        "code": 200,
        "message": "ok",
        "data": {
            "id": run.id,
            "task_id": run.task_id,
            "run_name": run.run_name,
            "status": run.status,
            "run_type": run.run_type,
            "gpu_mode": run.gpu_mode,
            "gpu_devices": run.gpu_devices,
            "pid": run.process_pid,
            "run_config_path": run.run_config_path,
            "log_dir": run.log_dir,
            "tensorboard_dir": run.tensorboard_dir,
            "started_at": run.started_at.isoformat() if run.started_at else None,
            "ended_at": run.ended_at.isoformat() if run.ended_at else None,
            "duration_seconds": run.duration_seconds,
            "error_message": run.error_message,
            "metric_summary_json": summary["metric_summary_json"],
            "best_metric_max_json": summary["best_metric_max_json"],
            "best_metric_min_json": summary["best_metric_min_json"],
        }
    })


@run_api_bp.route("/<int:run_id>/refresh-status", methods=["POST"])
@login_required
def refresh_run_status(run_id):
    user_id = int(current_user.id)
    monitor_service = get_monitor_service()

    try:
        run = monitor_service.get_run_or_raise(run_id, user_id)
        run = monitor_service.refresh_run_status(run)
    except Exception as e:
        return jsonify({"code": 404, "message": str(e)}), 404

    return jsonify({
        "code": 200,
        "message": "ok",
        "data": {
            "run_id": run.id,
            "status": run.status,
            "ended_at": run.ended_at.isoformat() if run.ended_at else None,
            "error_message": run.error_message
        }
    })


@run_api_bp.route("/<int:run_id>/log", methods=["GET"])
@login_required
def get_run_log(run_id):
    user_id = int(current_user.id)

    log_type = request.args.get("log_type", "stdout")
    max_lines = request.args.get("max_lines", default=300, type=int)

    monitor_service = get_monitor_service()
    try:
        run = monitor_service.get_run_or_raise(run_id, user_id)
        log_text = monitor_service.read_log(run, log_type=log_type, max_lines=max_lines)
    except Exception as e:
        return jsonify({"code": 404, "message": str(e)}), 404

    return jsonify({
        "code": 200,
        "message": "ok",
        "data": {
            "run_id": run.id,
            "log_type": log_type,
            "content": log_text
        }
    })


@run_api_bp.route("/<int:run_id>/tb-scalars", methods=["GET"])
@login_required
def get_tb_scalars(run_id):
    user_id = int(current_user.id)
    monitor_service = get_monitor_service()

    try:
        run = monitor_service.get_run_or_raise(run_id, user_id)
        run = monitor_service.refresh_run_status(run)

        tensorboard_dir = monitor_service.get_tensorboard_dir_for_run(run)
        scalars = monitor_service.read_tensorboard_scalars(run)
    except Exception as e:
        return jsonify({"code": 404, "message": str(e)}), 404

    return jsonify({
        "code": 200,
        "message": "ok",
        "data": {
            "run_id": run.id,
            "status": run.status,
            "tensorboard_dir": tensorboard_dir,
            "scalars": scalars
        }
    })


@run_api_bp.route("/<int:run_id>/events", methods=["GET"])
@login_required
def run_events(run_id):
    user_id = int(current_user.id)

    run = TaskRun.query.filter_by(id=run_id, user_id=user_id).first()
    if not run:
        return jsonify({"code": 404, "message": "run not found"}), 404

    events = RunEvent.query.filter_by(run_id=run_id).order_by(RunEvent.event_time.desc()).all()

    data = []
    for event in events:
        data.append({
            "id": event.id,
            "event_type": event.event_type,
            "event_level": event.event_level,
            "message": event.message,
            "event_time": event.event_time.isoformat() if event.event_time else None
        })

    return jsonify({"code": 200, "message": "ok", "data": data})


@run_api_bp.route("/<int:run_id>/hardware", methods=["GET"])
@login_required
def get_run_hardware(run_id):
    user_id = int(current_user.id)

    run = TaskRun.query.filter_by(id=run_id, user_id=user_id).first()
    if not run:
        return jsonify({"code": 404, "message": "run not found"}), 404

    service = get_hardware_service()
    data = service.get_run_hardware_snapshot(run)

    return jsonify({
        "code": 200,
        "message": "ok",
        "data": {
            "run_id": run.id,
            "status": run.status,
            "gpu_mode": run.gpu_mode,
            "gpu_devices": run.gpu_devices,
            "snapshot": data
        }
    })



@run_api_bp.route("/<int:run_id>/config", methods=["GET"])
@login_required
def get_run_bound_config(run_id):
    user_id = int(current_user.id)

    run = TaskRun.query.filter_by(id=run_id, user_id=user_id).first()
    if not run:
        return jsonify({"code": 404, "message": "run not found"}), 404

    config = TaskConfig.query.filter_by(
        id=run.config_id,
        task_id=run.task_id,
        user_id=user_id
    ).first()

    if not config:
        return jsonify({"code": 404, "message": "bound config not found"}), 404

    content = ""
    if run.run_config_path and os.path.exists(run.run_config_path):
        with open(run.run_config_path, "r", encoding="utf-8") as f:
            content = f.read()
    elif config.yaml_path and os.path.exists(config.yaml_path):
        # 兜底：如果运行快照不存在，就退回配置版本文件
        with open(config.yaml_path, "r", encoding="utf-8") as f:
            content = f.read()

    return jsonify({
        "code": 200,
        "message": "ok",
        "data": {
            "run_id": run.id,
            "task_id": run.task_id,
            "config_id": config.id,
            "config_version_no": config.version_no,
            "config_name": config.config_name,
            "config_yaml_path": config.yaml_path,
            "run_config_path": run.run_config_path,
            "content": content
        }
    })
