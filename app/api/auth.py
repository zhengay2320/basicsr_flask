from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

from app.extensions import db
from app.models.user import User

auth_bp = Blueprint("auth", __name__)


def json_error(code: int, message: str, http_status: int):
    return jsonify({
        "code": code,
        "message": message
    }), http_status


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
        "data": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "theme": user.theme
        }
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

    return jsonify({
        "code": 200,
        "message": "login success",
        "data": {
            "access_token": access_token,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "theme": user.theme,
                "status": user.status
            }
        }
    })


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
        "data": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "theme": user.theme,
            "status": user.status
        }
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
