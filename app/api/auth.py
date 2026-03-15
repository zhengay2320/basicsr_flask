from flask import Blueprint, request, jsonify, session, current_app
from flask_login import login_user, logout_user, login_required, current_user
from flask_jwt_extended import unset_jwt_cookies

from app.extensions import db
from app.models.user import User

auth_bp = Blueprint("auth", __name__)


def json_error(code: int, message: str, http_status: int):
    return jsonify({
        "code": code,
        "message": message
    }), http_status


def build_user_data(user: User):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "theme": user.theme,
        "status": user.status
    }


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    email = (data.get("email") or "").strip()

    if not username or not password:
        return json_error(400, "username and password are required", 400)
    if len(username) < 3:
        return json_error(400, "username must be at least 3 characters", 400)
    if len(password) < 6:
        return json_error(400, "password must be at least 6 characters", 400)

    existing_user = User.query.filter_by(username=username).first()
    if existing_user:
        return json_error(409, "username already exists", 409)

    if email:
        existing_email = User.query.filter_by(email=email).first()
        if existing_email:
            return json_error(409, "email already exists", 409)

    user = User(
        username=username,
        email=email or None,
        role="user",
        theme="dark",
        status=1
    )
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    return jsonify({
        "code": 201,
        "message": "register success",
        "data": build_user_data(user)
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return json_error(400, "username and password are required", 400)

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return json_error(401, "invalid username or password", 401)

    if user.status != 1:
        return json_error(403, "user is disabled", 403)

    login_user(user, remember=True)
    session.permanent = True

    return jsonify({
        "code": 200,
        "message": "login success",
        "data": {
            "user": build_user_data(user)
        }
    })


@auth_bp.route("/logout", methods=["POST"])
def logout():
    try:
        logout_user()
    except Exception:
        pass

    try:
        session.clear()
    except Exception:
        pass

    resp = jsonify({
        "code": 200,
        "message": "logout success"
    })

    # 清 Flask session cookie
    session_cookie_name = current_app.config.get("SESSION_COOKIE_NAME", "session")
    resp.delete_cookie(session_cookie_name, path="/")

    # 清 Flask-Login remember cookie
    resp.delete_cookie("remember_token", path="/")

    # 清 JWT cookies（兼容你项目里历史残留的 JWT 登录）
    try:
        unset_jwt_cookies(resp)
    except Exception:
        pass

    # 再兜底删除一轮常见 JWT cookie 名
    resp.delete_cookie("access_token_cookie", path="/")
    resp.delete_cookie("refresh_token_cookie", path="/")

    return resp


@auth_bp.route("/me", methods=["GET"])
@login_required
def me():
    return jsonify({
        "code": 200,
        "message": "ok",
        "data": build_user_data(current_user)
    })


@auth_bp.route("/theme", methods=["PUT"])
@login_required
def update_theme():
    data = request.get_json(silent=True) or {}
    theme = (data.get("theme") or "").strip()

    allow_themes = {"light", "dark", "green", "purple", "ocean"}
    if theme not in allow_themes:
        return json_error(400, "invalid theme", 400)

    current_user.theme = theme
    db.session.commit()

    return jsonify({
        "code": 200,
        "message": "theme updated",
        "data": {
            "theme": current_user.theme
        }
    })
