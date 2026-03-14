from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.services.run_control_service import RunControlService


run_control_api_bp = Blueprint("run_control_api", __name__)


def get_run_control_service():
    basicsr_root = current_app.config["BASICSR_ROOT"]
    storage_root = current_app.config["STORAGE_ROOT"]
    python_exec = current_app.config.get("PYTHON_EXEC", "python")
    return RunControlService(
        basicsr_root=basicsr_root,
        storage_root=storage_root,
        python_exec=python_exec
    )


@run_control_api_bp.route("/<int:run_id>/stop", methods=["POST"])
@jwt_required()
def stop_run(run_id):
    user_id = int(get_jwt_identity())
    service = get_run_control_service()

    try:
        run = service.stop_run(run_id, user_id)
    except Exception as e:
        return jsonify({"code": 500, "message": f"stop failed: {str(e)}"}), 500

    return jsonify({
        "code": 200,
        "message": "run stopped",
        "data": {
            "run_id": run.id,
            "status": run.status
        }
    })


@run_control_api_bp.route("/run/<int:run_id>/resume", methods=["POST"])
@jwt_required()
def resume_run(run_id):
    user_id = int(get_jwt_identity())
    service = get_run_control_service()
    data = request.get_json(silent=True) or {}

    gpu_mode = (data.get("gpu_mode") or "single").strip()
    gpu_devices = (data.get("gpu_devices") or "").strip()
    run_name = (data.get("run_name") or "").strip() or None

    if gpu_mode not in ["single", "multi", "cpu"]:
        return jsonify({"code": 400, "message": "invalid gpu_mode"}), 400

    try:
        run = service.resume_run_from_run(
            run_id=run_id,
            user_id=user_id,
            gpu_mode=gpu_mode,
            gpu_devices=gpu_devices,
            run_name=run_name
        )
    except Exception as e:
        return jsonify({"code": 500, "message": f"resume failed: {str(e)}"}), 500

    return jsonify({
        "code": 201,
        "message": "run resumed",
        "data": {
            "run_id": run.id,
            "status": run.status,
            "resume_from": run.resume_from,
            "parent_run_id": run.parent_run_id,
            "pid": run.process_pid
        }
    }), 201
