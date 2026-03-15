from flask import Blueprint, render_template
# from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from flask_login import login_required, current_user

from app.models.task import Task
from app.models.task_run import TaskRun

task_page_bp = Blueprint("task_pages", __name__)
from flask import Blueprint, render_template




@task_page_bp.route("/dashboard")
def dashboard_page():
    return render_template("dashboard.html")



@task_page_bp.route("/tasks/create")
def task_create_page():
    return render_template("task_create.html")


@task_page_bp.route("/tasks/<int:task_id>")
def task_detail_page(task_id):
    return render_template("task_detail.html", task_id=task_id)


@task_page_bp.route("/runs/<int:run_id>/monitor")
def run_monitor_page(run_id):
    return render_template("run_monitor.html", run_id=run_id)


@task_page_bp.route("/tasks/<int:task_id>/config")
def task_config_page(task_id):
    return render_template("task_config.html", task_id=task_id)
