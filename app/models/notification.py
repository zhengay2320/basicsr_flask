from app.extensions import db
from app.models.base import BaseModel


class Notification(BaseModel):
    __tablename__ = "sys_notification"

    user_id = db.Column(
        db.BigInteger,
        db.ForeignKey("sys_user.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    category = db.Column(db.String(64), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, nullable=False, default=False)
    related_run_id = db.Column(
        db.BigInteger,
        db.ForeignKey("task_run.id", ondelete="SET NULL"),
        nullable=True
    )
