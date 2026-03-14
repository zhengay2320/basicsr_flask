from app.extensions import db
from app.models.base import BaseModel, SoftDeleteMixin


class Task(BaseModel, SoftDeleteMixin):
    __tablename__ = "dl_task"

    user_id = db.Column(
        db.BigInteger,
        db.ForeignKey("sys_user.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    task_name = db.Column(db.String(128), nullable=False)
    task_type = db.Column(db.String(32), nullable=False)  # train / test
    status = db.Column(db.String(32), nullable=False, default="draft")  # draft / ready / archived
    description = db.Column(db.Text, nullable=True)

    source_type = db.Column(db.String(32), nullable=False)  # template / custom / cloned
    template_path = db.Column(db.String(255), nullable=True)

    config_version = db.Column(db.Integer, nullable=False, default=1)
    current_config_id = db.Column(db.BigInteger, nullable=True)
    basicsr_code_version = db.Column(db.String(128), nullable=True)

    configs = db.relationship("TaskConfig", backref="task", lazy=True, cascade="all, delete-orphan")

    runs = db.relationship("TaskRun", backref="task", lazy=True, cascade="all, delete-orphan")
