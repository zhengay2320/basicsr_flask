from app.extensions import db
from app.models.base import BaseModel


class RunEvent(BaseModel):
    __tablename__ = "run_event"

    run_id = db.Column(
        db.BigInteger,
        db.ForeignKey("task_run.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    event_type = db.Column(db.String(64), nullable=False, index=True)
    event_level = db.Column(db.String(16), nullable=False)  # info / warning / error
    message = db.Column(db.Text, nullable=False)
    event_time = db.Column(db.DateTime, nullable=False)
