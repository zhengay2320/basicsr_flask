import csv
import io
import math
from flask import Blueprint, current_app, jsonify, Response
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.models.task import Task
from app.models.task_run import TaskRun


task_export_api_bp = Blueprint("task_export_api", __name__)


def safe_mean(values):
    if not values:
        return None
    return sum(values) / len(values)


def safe_variance(values):
    if len(values) <= 1:
        return None
    mean = safe_mean(values)
    return sum((x - mean) ** 2 for x in values) / len(values)


@task_export_api_bp.route("/task/<int:task_id>/results.csv", methods=["GET"])
@jwt_required()
def export_task_results_csv(task_id):
    user_id = int(get_jwt_identity())

    task = Task.query.filter_by(id=task_id, user_id=user_id, is_deleted=False).first()
    if not task:
        return jsonify({"code": 404, "message": "task not found"}), 404

    runs = TaskRun.query.filter_by(task_id=task.id, user_id=user_id).order_by(TaskRun.created_at.asc()).all()

    # 收集所有指标名
    metric_names = set()
    for run in runs:
        if isinstance(run.best_metric_max_json, dict):
            metric_names.update(run.best_metric_max_json.keys())
        if isinstance(run.best_metric_min_json, dict):
            metric_names.update(run.best_metric_min_json.keys())

    metric_names = sorted(metric_names)

    output = io.StringIO()
    writer = csv.writer(output)

    header = [
        "run_id", "run_name", "status", "run_type",
        "started_at", "ended_at"
    ]
    for m in metric_names:
        header.append(f"{m}_max")
        header.append(f"{m}_min")

    writer.writerow(header)

    for run in runs:
        row = [
            run.id,
            run.run_name,
            run.status,
            run.run_type,
            run.started_at.isoformat() if run.started_at else "",
            run.ended_at.isoformat() if run.ended_at else ""
        ]

        best_max = run.best_metric_max_json or {}
        best_min = run.best_metric_min_json or {}

        for m in metric_names:
            row.append(best_max.get(m, ""))
            row.append(best_min.get(m, ""))

        writer.writerow(row)

    # 统计区
    writer.writerow([])
    writer.writerow(["统计汇总"])

    for m in metric_names:
        max_values = []
        min_values = []

        for run in runs:
            best_max = run.best_metric_max_json or {}
            best_min = run.best_metric_min_json or {}

            if m in best_max and isinstance(best_max[m], (int, float)):
                max_values.append(float(best_max[m]))
            if m in best_min and isinstance(best_min[m], (int, float)):
                min_values.append(float(best_min[m]))

        writer.writerow([f"{m}_max_mean", safe_mean(max_values)])
        writer.writerow([f"{m}_max_var", safe_variance(max_values)])
        writer.writerow([f"{m}_min_mean", safe_mean(min_values)])
        writer.writerow([f"{m}_min_var", safe_variance(min_values)])

    csv_data = output.getvalue()
    output.close()

    filename = f"task_{task.id}_results.csv"
    return Response(
        csv_data,
        mimetype="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )
