from app.extensions import db


class AppointmentSlot(db.Model):
    __tablename__ = "appointment_slots"
    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.Integer, db.ForeignKey("service_requests.id"), nullable=False)
    appointment_date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    status = db.Column(db.String(20), default="Available", nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    request = db.relationship("ServiceRequest", back_populates="appointment_slots")
    __table_args__ = (db.CheckConstraint("end_time > start_time", name="check_appointment_slot_time"),)
