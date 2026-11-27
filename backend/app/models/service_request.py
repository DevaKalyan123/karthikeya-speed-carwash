from app.extensions import db


class ServiceRequest(db.Model):
    __tablename__ = "service_requests"
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=False)
    vehicle_id = db.Column(db.Integer, db.ForeignKey("vehicles.id"), nullable=False)
    status = db.Column(db.String(30), default="Pending", nullable=False)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    booking_source = db.Column(db.String(20), nullable=False, default="Customer", server_default="Customer")

    # Booking-specific contact and car make; never modify login credentials.
    booking_name = db.Column(db.String(100), nullable=True)
    booking_mobile = db.Column(db.String(15), nullable=True)
    booking_car_make = db.Column(db.String(100), nullable=True)
    appointment_date = db.Column(db.Date, nullable=True)
    preferred_start_time = db.Column(db.Time, nullable=True)
    preferred_end_time = db.Column(db.Time, nullable=True)
    confirmed_start_time = db.Column(db.Time, nullable=True)
    confirmed_end_time = db.Column(db.Time, nullable=True)
    appointment_status = db.Column(db.String(30), nullable=True)
    cancelled_at = db.Column(db.DateTime(timezone=True), nullable=True)
    cancelled_by = db.Column(db.String(20), nullable=True)
    cancellation_reason = db.Column(db.String(250), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    # Visibility for the owning customer only; do not remove service history.
    customer_hidden_at = db.Column(db.DateTime(timezone=True), nullable=True)

    customer = db.relationship("Customer", back_populates="requests")
    created_by_user = db.relationship("User", foreign_keys=[created_by_user_id])
    vehicle = db.relationship("Vehicle", back_populates="requests")
    items = db.relationship("RequestItem", back_populates="request")
    invoice = db.relationship("Invoice", back_populates="request", uselist=False)
    appointment_slots = db.relationship("AppointmentSlot", back_populates="request", cascade="all, delete-orphan")

    @property
    def contact_name(self):
        if self.booking_name is not None:
            return self.booking_name
        return self.customer.name or ""

    @property
    def contact_mobile(self):
        if self.booking_mobile is not None:
            return self.booking_mobile
        return self.customer.mobile or ""

    @property
    def car_make(self):
        return self.booking_car_make or self.vehicle.car_name
