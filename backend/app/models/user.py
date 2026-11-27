from app.extensions import db
from werkzeug.security import generate_password_hash, check_password_hash


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    mobile = db.Column(db.String(15), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="customer")
    is_active = db.Column(db.Boolean, nullable=False, default=True, server_default=db.true())
    staff_token_version = db.Column(db.Integer, nullable=False, default=0, server_default="0")
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    # Short-lived, single-use password reset challenge.
    reset_otp_hash = db.Column(db.String(255), nullable=True)
    reset_otp_expires_at = db.Column(db.DateTime(timezone=True), nullable=True)
    reset_otp_requested_at = db.Column(db.DateTime(timezone=True), nullable=True)
    reset_otp_attempts = db.Column(db.Integer, nullable=False, default=0, server_default="0")
    reset_status = db.Column(db.String(30), nullable=True)
    reset_approved_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    reset_approved_at = db.Column(db.DateTime(timezone=True), nullable=True)
    reset_completed_at = db.Column(db.DateTime(timezone=True), nullable=True)

    customer = db.relationship("Customer", back_populates="user", uselist=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
        self.reset_otp_hash = None
        self.reset_otp_expires_at = None
        self.reset_otp_attempts = 0
        if self.reset_status in ("Pending", "Code Generated"):
            self.reset_status = "Completed"

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
