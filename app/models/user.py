from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db
from app.models.base import BaseModel


class User(BaseModel):
    __tablename__ = "sys_user"

    username = db.Column(db.String(64), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(128), nullable=True, unique=True)
    role = db.Column(db.String(32), nullable=False, default="user")
    theme = db.Column(db.String(32), nullable=False, default="light")
    status = db.Column(db.SmallInteger, nullable=False, default=1)

    tasks = db.relationship("Task", backref="user", lazy=True)
    task_runs = db.relationship("TaskRun", backref="user", lazy=True)
    notifications = db.relationship("Notification", backref="user", lazy=True)

    def set_password(self, raw_password: str):
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password_hash(self.password_hash, raw_password)
