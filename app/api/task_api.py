
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db


from app.models.task import Task
from app.models.task_config import TaskConfig
from app.services.task_service import TaskService
from app.models.user import User
from app.models.task_run import TaskRun

task_api_bp = Blueprint("task_api", __name__)


def get_task_service():
    basicsr_root = current_app.config["BASICSR_ROOT"]
    storage_root = current_app.config["STORAGE_ROOT"]
    return TaskService(basicsr_root=basicsr_root, storage_root=storage_root)


@task_api_bp.route("", methods=["GET"])
@jwt_required()
def list_tasks():
    user_id = int(get_jwt_identity())

    tasks = Task.query.filter(
        Task.user_id == user_id,
        Task.is_deleted == False
    ).order_by(Task.created_at.desc()).all()

    result = []
    for task in tasks:
        result.append({
            "id": task.id,
            "task_name": task.task_name,
            "task_type": task.task_type,
            "status": task.status,
            "description": task.description,
            "template_path": task.template_path,
            "config_version": task.config_version,
            "created_at": task.created_at.isoformat() if task.created_at else None
        })

    return jsonify({"code": 200, "message": "ok", "data": result})


@task_api_bp.route("/templates", methods=["GET"])
@jwt_required()
def list_templates():
    scene_type = request.args.get("scene_type")
    service = get_task_service()
    data = service.list_templates(scene_type=scene_type)
    return jsonify({"code": 200, "message": "ok", "data": data})


@task_api_bp.route("/modules", methods=["GET"])
@jwt_required()
def list_modules():
    service = get_task_service()
    data = service.list_modules()
    return jsonify({"code": 200, "message": "ok", "data": data})


@task_api_bp.route("/template-detail", methods=["GET"])
@jwt_required()
def template_detail():
    relative_path = request.args.get("relative_path", "").strip()
    if not relative_path:
        return jsonify({"code": 400, "message": "relative_path is required"}), 400

    service = get_task_service()
    data = service.get_template_detail(relative_path)
    return jsonify({"code": 200, "message": "ok", "data": data})


@task_api_bp.route("/template-section", methods=["GET"])
@jwt_required()
def template_section():
    relative_path = request.args.get("relative_path", "").strip()
    section_path = request.args.get("section_path", "").strip()

    if not relative_path:
        return jsonify({"code": 400, "message": "relative_path is required"}), 400
    if not section_path:
        return jsonify({"code": 400, "message": "section_path is required"}), 400

    service = get_task_service()
    data = service.get_template_section(relative_path, section_path)
    return jsonify({"code": 200, "message": "ok", "data": data})


@task_api_bp.route("", methods=["POST"])
@jwt_required()
def create_task():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    task_name = (data.get("task_name") or "").strip()
    task_type = (data.get("task_type") or "train").strip()
    description = data.get("description") or ""
    template_relative_path = (data.get("template_relative_path") or "").strip()
    manual_patch_text = data.get("manual_patch_text") or ""

    section_overrides = data.get("section_overrides") or {}
    if not isinstance(section_overrides, dict):
        return jsonify({"code": 400, "message": "section_overrides must be an object"}), 400

    if not task_name:
        return jsonify({"code": 400, "message": "task_name is required"}), 400
    if task_type not in ["train", "test"]:
        return jsonify({"code": 400, "message": "task_type must be train or test"}), 400
    if not template_relative_path:
        return jsonify({"code": 400, "message": "template_relative_path is required"}), 400

    try:
        service = get_task_service()
        task, task_config = service.create_task_with_config(
            user_id=user_id,
            task_name=task_name,
            task_type=task_type,
            description=description,
            template_relative_path=template_relative_path,
            section_overrides=section_overrides,
            manual_patch_text=manual_patch_text
        )
    except Exception as e:
        return jsonify({"code": 500, "message": f"create task failed: {str(e)}"}), 500

    return jsonify({
        "code": 201,
        "message": "task created",
        "data": {
            "task_id": task.id,
            "task_name": task.task_name,
            "config_id": task_config.id,
            "yaml_path": task_config.yaml_path
        }
    }), 201


@task_api_bp.route("/<int:task_id>", methods=["GET"])
@jwt_required()
def get_task(task_id):
    user_id = int(get_jwt_identity())

    task = Task.query.filter(
        Task.id == task_id,
        Task.user_id == user_id,
        Task.is_deleted == False
    ).first()

    if not task:
        return jsonify({"code": 404, "message": "task not found"}), 404

    task_config = None
    if task.current_config_id:
        task_config = TaskConfig.query.filter_by(id=task.current_config_id).first()

    return jsonify({
        "code": 200,
        "message": "ok",
        "data": {
            "id": task.id,
            "task_name": task.task_name,
            "task_type": task.task_type,
            "status": task.status,
            "description": task.description,
            "template_path": task.template_path,
            "config_version": task.config_version,
            "current_config_id": task.current_config_id,
            "current_config": {
                "id": task_config.id,
                "yaml_path": task_config.yaml_path,
                "config_json": task_config.config_json
            } if task_config else None
        }
    })

@task_api_bp.route("/<int:task_id>", methods=["DELETE"])
@jwt_required()
def delete_task(task_id):
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    password = data.get("password") or ""
    if not password:
        return jsonify({"code": 400, "message": "password is required"}), 400

    user = User.query.filter_by(id=user_id).first()
    if not user:
        return jsonify({"code": 404, "message": "user not found"}), 404

    if not user.check_password(password):
        return jsonify({"code": 403, "message": "password is incorrect"}), 403

    task = Task.query.filter(
        Task.id == task_id,
        Task.user_id == user_id,
        Task.is_deleted == False
    ).first()

    if not task:
        return jsonify({"code": 404, "message": "task not found"}), 404

    running_run = TaskRun.query.filter(
        TaskRun.task_id == task.id,
        TaskRun.user_id == user_id,
        TaskRun.status == "running"
    ).first()

    if running_run:
        return jsonify({
            "code": 400,
            "message": "当前任务还有运行中的实验，请先停止运行后再删除"
        }), 400

    task.is_deleted = True
    db.session.add(task)
    db.session.commit()

    return jsonify({
        "code": 200,
        "message": "task deleted",
        "data": {
            "task_id": task.id,
            "is_deleted": task.is_deleted
        }
    })




@task_api_bp.route('/get_model_config', methods=['GET'])
def get_model_config():
    """根据模板加载并过滤符合条件的模型"""
    model_name = request.args.get('model_name')  # 获取前端传过来的模型名
    yaml_path = "path_to_your_model_template.yml"  # 你的模板文件路径

    # 加载模板
    yaml_data = load_yaml_config(yaml_path)

    # 获取符合条件的模型
    valid_models = filter_model_config(yaml_data, model_name)

    return jsonify({
        'success': True,
        'data': {
            'models': valid_models
        }
    })


@task_api_bp.route('/get_training_config', methods=['GET'])
def get_training_config():
    """加载并返回训练配置"""
    yaml_path = "path_to_your_model_template.yml"  # 你的模板文件路径
    yaml_data = load_yaml_config(yaml_path)  # 加载 YML 配置

    # 获取训练配置
    training_config = get_training_config(yaml_data)

    return jsonify({
        'success': True,
        'data': training_config
    })
