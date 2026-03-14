from flask import Blueprint, render_template, request

web_bp = Blueprint("web", __name__)


@web_bp.route("/")
def index():
    return render_template("login.html")


@web_bp.route("/login")
def login_page():
    return render_template("login.html")


@web_bp.route("/register")
def register_page():
    return render_template("register.html")


@web_bp.route("/dashboard")
def dashboard_page():
    return render_template("dashboard.html")


@web_bp.route("/profile")
def profile_page():
    return render_template("profile.html")


@web_bp.route("/tasks/create")
def task_create_page():
    return render_template("task_create.html")


@web_bp.route("/tasks/detail")
def task_detail_page():
    task_id = request.args.get("task_id") or request.args.get("id") or ""
    return render_template("task_detail.html", task_id=task_id)


@web_bp.route("/tasks/detail/<int:task_id>")
def task_detail_page_with_id(task_id):
    return render_template("task_detail.html", task_id=task_id)


@web_bp.route("/tasks/<int:task_id>")
def task_detail_page_legacy(task_id):
    return render_template("task_detail.html", task_id=task_id)
