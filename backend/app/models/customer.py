from app.extensions import db


class Customer(db.Model):
    __tablename__ = "customers"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)

    name = db.Column(db.String(100), nullable=False)
    mobile = db.Column(db.String(15), unique=True, nullable=False)
    village = db.Column(db.String(150), nullable=False)

    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    user = db.relationship("User", back_populates="customer")
    vehicles = db.relationship("Vehicle", back_populates="customer")
    requests = db.relationship("ServiceRequest", back_populates="customer")