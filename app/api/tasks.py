from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models.task import Task

task_bp = Blueprint("tasks", __name__)


@task_bp.route("", methods=["POST"])
@jwt_required()
def create_task():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    task_name = (data.get("task_name") or "").strip()
    task_type = (data.get("task_type") or "train").strip()
    description = data.get("description")
    source_type = (data.get("source_type") or "custom").strip()
    template_path = data.get("template_path")

    if not task_name:
        return jsonify({
            "code": 400,
            "message": "task_name is required"
        }), 400

    if task_type not in ["train", "test"]:
        return jsonify({
            "code": 400,
            "message": "task_type must be train or test"
        }), 400

    if source_type not in ["template", "custom", "cloned"]:
        return jsonify({
            "code": 400,
            "message": "source_type must be template, custom or cloned"
        }), 400

    task = Task(
        user_id=user_id,
        task_name=task_name,
        task_type=task_type,
        status="draft",
        description=description,
        source_type=source_type,
        template_path=template_path,
        config_version=1
    )

    db.session.add(task)
    db.session.commit()

    return jsonify({
        "code": 201,
        "message": "task created",
        "data": task.to_dict()
    }), 201


@task_bp.route("", methods=["GET"])
@jwt_required()
def list_tasks():
    user_id = int(get_jwt_identity())

    query = Task.query.filter_by(user_id=user_id, is_deleted=False)

    task_type = request.args.get("task_type")
    status = request.args.get("status")

    if task_type:
        query = query.filter(Task.task_type == task_type)
    if status:
        query = query.filter(Task.status == status)

    tasks = query.order_by(Task.created_at.desc()).all()

    return jsonify({
        "code": 200,
        "message": "ok",
        "data": [task.to_dict() for task in tasks]
    })


@task_bp.route("/<int:task_id>", methods=["GET"])
@jwt_required()
def get_task(task_id):
    user_id = int(get_jwt_identity())

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

    return jsonify({
        "code": 200,
        "message": "ok",
        "data": task.to_dict()
    })


@task_bp.route("/<int:task_id>", methods=["PUT"])
@jwt_required()
def update_task(task_id):
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

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

    if "task_name" in data:
        task_name = (data.get("task_name") or "").strip()
        if not task_name:
            return jsonify({
                "code": 400,
                "message": "task_name cannot be empty"
            }), 400
        task.task_name = task_name

    if "description" in data:
        task.description = data.get("description")

    if "status" in data:
        new_status = data.get("status")
        if new_status not in ["draft", "ready", "archived"]:
            return jsonify({
                "code": 400,
                "message": "invalid task status"
            }), 400
        task.status = new_status

    if "template_path" in data:
        task.template_path = data.get("template_path")

    db.session.commit()

    return jsonify({
        "code": 200,
        "message": "task updated",
        "data": task.to_dict()
    })


@task_bp.route("/<int:task_id>", methods=["DELETE"])
@jwt_required()
def delete_task(task_id):
    user_id = int(get_jwt_identity())

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

    task.is_deleted = True
    db.session.commit()

    return jsonify({
        "code": 200,
        "message": "task deleted"
    })
