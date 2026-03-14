from app.extensions import db
from app.models.base import BaseModel


class ComputeNode(BaseModel):
    __tablename__ = "compute_node"

    node_name = db.Column(db.String(64), nullable=False, unique=True)
    host = db.Column(db.String(128), nullable=False)
    status = db.Column(db.String(32), nullable=False, default="online")

    total_gpus = db.Column(db.Integer, nullable=False, default=0)
    total_cpu_cores = db.Column(db.Integer, nullable=False, default=0)
    total_memory_gb = db.Column(db.Integer, nullable=False, default=0)

    gpus = db.relationship("GPUDevice", backref="node", lazy=True, cascade="all, delete-orphan")
