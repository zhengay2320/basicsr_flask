from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

from app.extensions import db
from app.models.user import User

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    email = (data.get("email") or "").strip()

    if not username or not password:
        return jsonify({
            "code": 400,
            "message": "username and password are required"
        }), 400

    if len(username) < 3:
        return jsonify({
            "code": 400,
            "message": "username must be at least 3 characters"
        }), 400

    if len(password) < 6:
        return jsonify({
            "code": 400,
            "message": "password must be at least 6 characters"
        }), 400

    existing_user = User.query.filter_by(username=username).first()
    if existing_user:
        return jsonify({
            "code": 409,
            "message": "username already exists"
        }), 409

    if email:
        existing_email = User.query.filter_by(email=email).first()
        if existing_email:
            return jsonify({
                "code": 409,
                "message": "email already exists"
            }), 409

    user = User(
        username=username,
        email=email or None,
        role="user",
        theme="light",
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
            "role": user.role
        }
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({
            "code": 400,
            "message": "username and password are required"
        }), 400

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({
            "code": 401,
            "message": "invalid username or password"
        }), 401

    if user.status != 1:
        return jsonify({
            "code": 403,
            "message": "user is disabled"
        }), 403

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
                "theme": user.theme
            }
        }
    })


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({
            "code": 404,
            "message": "user not found"
        }), 404

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
