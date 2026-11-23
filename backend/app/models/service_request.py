from app.extensions import db


class ServiceRequest(db.Model):
    __tablename__ = "service_requests"

    id = db.Column(db.Integer, primary_key=True)

    customer_id = db.Column(
        db.Integer, db.ForeignKey("customers.id"), nullable=False
    )

    vehicle_id = db.Column(
        db.Integer, db.ForeignKey("vehicles.id"), nullable=False
    )

    status = db.Column(db.String(30), default="Pending", nullable=False)

    created_at = db.Column(
        db.DateTime(timezone=True), server_default=db.func.now()
    )

    customer = db.relationship("Customer", back_populates="requests")
    vehicle = db.relationship("Vehicle", back_populates="requests")

    items = db.relationship("RequestItem", back_populates="request")
    invoice = db.relationship("Invoice", back_populates="request", uselist=False)