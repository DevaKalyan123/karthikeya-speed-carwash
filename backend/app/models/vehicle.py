from app.extensions import db


class Vehicle(db.Model):
    __tablename__ = "vehicles"
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=False)
    # Keep the existing physical column for backward compatibility.
    car_name = db.Column(db.String(100), nullable=True)
    car_number = db.Column(db.String(20), unique=True, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    customer = db.relationship("Customer", back_populates="vehicles")
    requests = db.relationship("ServiceRequest", back_populates="vehicle")
