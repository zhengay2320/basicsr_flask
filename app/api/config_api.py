from flask import Blueprint, jsonify, request, current_app
# from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_login import login_required, current_user

import yaml

from app.services.config_service import ConfigService


config_api_bp = Blueprint("config_api", __name__)


def get_config_service():
    basicsr_root = current_app.config["BASICSR_ROOT"]
    storage_root = current_app.config["STORAGE_ROOT"]
    return ConfigService(basicsr_root=basicsr_root, storage_root=storage_root)


@config_api_bp.route("/task/<int:task_id>/current", methods=["GET"])
@login_required
def get_current_task_config(task_id):
    user_id = int(get_jwt_identity())
    service = get_config_service()

    try:
        task, config = service.get_current_config(task_id, user_id)
    except Exception as e:
        return jsonify({"code": 404, "message": str(e)}), 404

    yaml_text = yaml.safe_dump(config.config_json, allow_unicode=True, sort_keys=False)

    return jsonify({
        "code": 200,
        "message": "ok",
        "data": {
            "task_id": task.id,
            "task_name": task.task_name,
            "current_config_id": config.id,
            "version_no": config.version_no,
            "config_name": config.config_name,
            "yaml_path": config.yaml_path,
            "config_json": config.config_json,
            "config_text": yaml_text
        }
    })


@config_api_bp.route("/task/<int:task_id>/versions", methods=["GET"])
@login_required
def list_task_config_versions(task_id):
    user_id = int(get_jwt_identity())
    service = get_config_service()

    try:
        task, configs = service.list_versions(task_id, user_id)
    except Exception as e:
        return jsonify({"code": 404, "message": str(e)}), 404

    data = []
    for config in configs:
        data.append({
            "id": config.id,
            "version_no": config.version_no,
            "config_name": config.config_name,
            "yaml_path": config.yaml_path,
            "is_active": config.is_active,
            "created_at": config.created_at.isoformat() if config.created_at else None,
            "is_current": config.id == task.current_config_id
        })

    return jsonify({
        "code": 200,
        "message": "ok",
        "data": data
    })


@config_api_bp.route("/task/<int:task_id>/save-version", methods=["POST"])
@login_required
def save_new_task_config_version(task_id):
    user_id = int(get_jwt_identity())
    service = get_config_service()
    data = request.get_json(silent=True) or {}

    config_text = data.get("config_text", "")
    config_name = data.get("config_name")

    if not config_text.strip():
        return jsonify({"code": 400, "message": "config_text is required"}), 400

    try:
        task, config = service.create_new_version_from_text(
            task_id=task_id,
            user_id=user_id,
            config_text=config_text,
            config_name=config_name
        )
    except Exception as e:
        return jsonify({"code": 500, "message": f"save config failed: {str(e)}"}), 500

    return jsonify({
        "code": 201,
        "message": "new config version saved",
        "data": {
            "task_id": task.id,
            "current_config_id": task.current_config_id,
            "version_no": config.version_no,
            "config_id": config.id,
            "yaml_path": config.yaml_path
        }
    })


@config_api_bp.route("/task/<int:task_id>/rollback", methods=["POST"])
@login_required
def rollback_task_config(task_id):
    user_id = int(current_user.id)

    service = get_config_service()
    data = request.get_json(silent=True) or {}

    version_no = data.get("version_no")
    if version_no is None:
        return jsonify({"code": 400, "message": "version_no is required"}), 400

    try:
        task, config = service.rollback_to_version(
            task_id=task_id,
            user_id=user_id,
            version_no=int(version_no)
        )
    except Exception as e:
        return jsonify({"code": 500, "message": f"rollback failed: {str(e)}"}), 500

    return jsonify({
        "code": 200,
        "message": "rollback success",
        "data": {
            "task_id": task.id,
            "current_config_id": task.current_config_id,
            "version_no": config.version_no,
            "config_id": config.id
        }
    })
