from app.extensions import db
from app.models.base import BaseModel


class TaskConfig(BaseModel):
    __tablename__ = "task_config"
    # id = db.Column(db.Integer, primary_key=True)

    task_id = db.Column(
        db.BigInteger,
        db.ForeignKey("dl_task.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    user_id = db.Column(
        db.BigInteger,
        db.ForeignKey("sys_user.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    version_no = db.Column(db.Integer, nullable=False, default=1)
    config_name = db.Column(db.String(128), nullable=False)
    yaml_path = db.Column(db.String(255), nullable=False)
    config_json = db.Column(db.JSON, nullable=False)
    config_hash = db.Column(db.String(64), nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    __table_args__ = (
        db.UniqueConstraint("task_id", "version_no", name="uk_task_version"),
    )
