from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_login import LoginManager

db = SQLAlchemy()
migrate = Migrate()
cors = CORS()
login_manager = LoginManager()
login_manager.login_view = "web.login_page"
login_manager.login_message = "请先登录"
login_manager.login_message_category = "warning"
