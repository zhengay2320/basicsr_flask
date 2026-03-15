from flask import Blueprint, render_template, redirect, url_for
from flask_login import login_required, current_user

web_bp = Blueprint("web", __name__)

@web_bp.route("/")
def index():
    if current_user.is_authenticated:
        return redirect(url_for("web.dashboard_page"))
    return redirect(url_for("web.login_page"))

@web_bp.route("/login")
def login_page():
    if current_user.is_authenticated:
        return redirect(url_for("web.dashboard_page"))
    return render_template("login.html")

@web_bp.route("/register")
def register_page():
    if current_user.is_authenticated:
        return redirect(url_for("web.dashboard_page"))
    return render_template("register.html")

@web_bp.route("/dashboard")
@login_required
def dashboard_page():
    return render_template("dashboard.html")

@web_bp.route("/profile")
@login_required
def profile_page():
    return render_template("profile.html")

@web_bp.route("/tasks/create")
@login_required
def task_create_page():
    return render_template("task_create.html")

@web_bp.route("/tasks/<int:task_id>")
@login_required
def task_detail_page(task_id):
    return render_template("task_detail.html", task_id=task_id)

@web_bp.route("/tasks/<int:task_id>/config")
@login_required
def task_config_page(task_id):
    return render_template("task_config.html", task_id=task_id)

@web_bp.route("/running-tasks")
@login_required
def running_tasks_page():
    return render_template("running_tasks.html")
