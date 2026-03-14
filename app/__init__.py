from flask import Flask
from app.config.default import DefaultConfig
from app.extensions import db, migrate, jwt, cors


def create_app(config_object=DefaultConfig):
    app = Flask(__name__)
    app.config.from_object(config_object)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app)

    register_blueprints(app)

    return app


def register_blueprints(app):
    from app.api.auth import auth_bp
    # from app.api.tasks import task_bp
    # from app.api.runs import run_bp
    from app.api.monitor import monitor_bp
    from app.web import web_bp


    from app.api.task_pages import task_page_bp
    from app.api.task_api import task_api_bp
    from app.api.run_api import run_api_bp

    from app.api.config_api import config_api_bp
    from app.api.run_control_api import run_control_api_bp
    from app.api.task_export_api import task_export_api_bp
    app.register_blueprint(task_export_api_bp, url_prefix="/api/export")

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    # app.register_blueprint(task_bp, url_prefix="/api/tasks")
    # app.register_blueprint(run_bp, url_prefix="/api/runs")
    app.register_blueprint(monitor_bp, url_prefix="/api/monitor")
    app.register_blueprint(web_bp)



    app.register_blueprint(task_api_bp, url_prefix="/api/tasks")
    app.register_blueprint(run_api_bp, url_prefix="/api/runs")

    app.register_blueprint(config_api_bp, url_prefix="/api/configs")
    app.register_blueprint(run_control_api_bp, url_prefix="/api/run-control")

    app.register_blueprint(task_page_bp)
