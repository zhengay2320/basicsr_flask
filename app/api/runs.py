from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models.task import Task
from app.models.task_run import TaskRun

run_bp = Blueprint("runs", __name__)


@run_bp.route("", methods=["POST"])
@jwt_required()
def create_run():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    task_id = data.get("task_id")
    run_name = data.get("run_name")
    run_type = (data.get("run_type") or "train").strip()
    gpu_mode = (data.get("gpu_mode") or "single").strip()
    gpu_devices = data.get("gpu_devices")
    config_id = data.get("config_id")

    if not task_id:
        return jsonify({
            "code": 400,
            "message": "task_id is required"
        }), 400

    task = Task.query.filter_by(
        id=task_id,
        user_id=user_id,
        is_deleted=False
    ).first()

    if not task:
        return jsonify({
            "code": 404,
            "message": "task not found"
        }), 404

    if run_type not in ["train", "test", "resume"]:
        return jsonify({
            "code": 400,
            "message": "invalid run_type"
        }), 400

    if gpu_mode not in ["single", "multi", "cpu"]:
        return jsonify({
            "code": 400,
            "message": "invalid gpu_mode"
        }), 400

    run = TaskRun(
        task_id=task.id,
        user_id=user_id,
        config_id=config_id or task.current_config_id,
        run_name=run_name,
        run_type=run_type,
        status="pending",
        trigger_type="manual",
        run_config_path="",
        work_dir="",
        log_dir="",
        checkpoint_dir="",
        output_dir="",
        tensorboard_dir="",
        command_text="",
        gpu_mode=gpu_mode,
        gpu_devices=gpu_devices
    )

    db.session.add(run)
    db.session.commit()

    return jsonify({
        "code": 201,
        "message": "run created",
        "data": run.to_dict()
    }), 201


@run_bp.route("", methods=["GET"])
@jwt_required()
def list_runs():
    user_id = int(get_jwt_identity())

    query = TaskRun.query.filter_by(user_id=user_id)

    task_id = request.args.get("task_id", type=int)
    status = request.args.get("status")

    if task_id:
        query = query.filter(TaskRun.task_id == task_id)
    if status:
        query = query.filter(TaskRun.status == status)

    runs = query.order_by(TaskRun.created_at.desc()).all()

    return jsonify({
        "code": 200,
        "message": "ok",
        "data": [run.to_dict() for run in runs]
    })


@run_bp.route("/<int:run_id>", methods=["GET"])
@jwt_required()
def get_run(run_id):
    user_id = int(get_jwt_identity())

    run = TaskRun.query.filter_by(
        id=run_id,
        user_id=user_id
    ).first()

    if not run:
        return jsonify({
            "code": 404,
            "message": "run not found"
        }), 404

    return jsonify({
        "code": 200,
        "message": "ok",
        "data": run.to_dict()
    })


@run_bp.route("/<int:run_id>/stop", methods=["POST"])
@jwt_required()
def stop_run(run_id):
    user_id = int(get_jwt_identity())

    run = TaskRun.query.filter_by(
        id=run_id,
        user_id=user_id
    ).first()

    if not run:
        return jsonify({
            "code": 404,
            "message": "run not found"
        }), 404

    if run.status in ["success", "failed", "stopped", "canceled"]:
        return jsonify({
            "code": 400,
            "message": f"run already finished: {run.status}"
        }), 400

    run.status = "stopped"
    db.session.commit()

    return jsonify({
        "code": 200,
        "message": "run stopped",
        "data": run.to_dict()
    })
