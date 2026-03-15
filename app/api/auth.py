from datetime import datetime, timedelta, timezone

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
    set_access_cookies,
    set_refresh_cookies,
    unset_jwt_cookies,
)
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

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    resp = jsonify({
        "code": 200,
        "message": "login success",
        "data": {
            "user": build_user_data(user)
        }
    })

    set_access_cookies(resp, access_token)
    set_refresh_cookies(resp, refresh_token)
    return resp


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        resp = jsonify({
            "code": 404,
            "message": "user not found"
        })
        unset_jwt_cookies(resp)
        return resp, 404

    if user.status != 1:
        resp = jsonify({
            "code": 403,
            "message": "user is disabled"
        })
        unset_jwt_cookies(resp)
        return resp, 403

    new_access_token = create_access_token(identity=str(user.id))
    resp = jsonify({
        "code": 200,
        "message": "refresh success",
        "data": {
            "user": build_user_data(user)
        }
    })
    set_access_cookies(resp, new_access_token)
    return resp


@auth_bp.route("/logout", methods=["POST"])
def logout():
    resp = jsonify({
        "code": 200,
        "message": "logout success"
    })
    unset_jwt_cookies(resp)
    return resp


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return json_error(404, "user not found", 404)

    return jsonify({
        "code": 200,
        "message": "ok",
        "data": build_user_data(user)
    })


@auth_bp.route("/theme", methods=["PUT"])
@jwt_required()
def update_theme():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return json_error(404, "user not found", 404)

    data = request.get_json(silent=True) or {}
    theme = (data.get("theme") or "").strip()
    allow_themes = {"light", "dark", "green", "purple", "ocean"}

    if theme not in allow_themes:
        return json_error(400, "invalid theme", 400)

    user.theme = theme
    db.session.commit()

    return jsonify({
        "code": 200,
        "message": "theme updated",
        "data": {
            "theme": user.theme
        }
    })


@auth_bp.after_app_request
def refresh_expiring_jwts(response):
    """
    对“仍然有效但快过期”的 access token 自动续签，
    让活跃用户几乎感知不到登录过期。
    """
    try:
        jwt_data = get_jwt()
        exp_timestamp = jwt_data.get("exp")
        if not exp_timestamp:
            return response

        now = datetime.now(timezone.utc)
        # 如果 access token 剩余不到 10 分钟，就自动续一个新的
        target_timestamp = datetime.timestamp(now + timedelta(minutes=10))

        if target_timestamp > exp_timestamp:
            identity = get_jwt_identity()
            new_access_token = create_access_token(identity=identity)
            set_access_cookies(response, new_access_token)

        return response
    except Exception:
        # 没有 JWT 或不是受保护接口时，直接跳过
        return response
