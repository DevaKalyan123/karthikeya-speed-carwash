import re
import secrets
from datetime import datetime, timedelta, timezone

from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db
from app.models.user import User
from app.models.customer import Customer

auth_bp = Blueprint("auth", __name__)
MOBILE_PATTERN = r"[6-9][0-9]{9}"


def error(message, status=400):
    return jsonify({"success": False, "message": message}), status


def register_data():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def current_admin():
    user = db.session.get(User, int(get_jwt_identity()))
    return user if user and user.role == "admin" and user.is_active else None


@auth_bp.route("/register", methods=["POST"])
def register():
    data = register_data()
    name = str(data.get("name") or "").strip()
    mobile = str(data.get("mobile") or "").strip()
    village = str(data.get("village") or "").strip()
    password = data.get("password")
    if not name or not mobile or not village or not password:
        return error("All fields are required")
    if len(name) > 100 or len(village) > 150:
        return error("Name or village is too long")
    if not re.fullmatch(MOBILE_PATTERN, mobile):
        return error("Enter a valid mobile number")
    if not isinstance(password, str) or not 8 <= len(password) <= 128:
        return error("Password must contain 8 to 128 characters")
    if User.query.filter_by(mobile=mobile).first():
        return error("Mobile number already registered", 409)
    if Customer.query.filter_by(mobile=mobile).first():
        return error("Customer record already exists. Contact the administrator to activate your login account.", 409)
    try:
        user = User(name=name, mobile=mobile, role="customer")
        user.set_password(password)
        db.session.add(user)
        db.session.flush()
        customer = Customer(user_id=user.id, name=name, mobile=mobile, village=village, is_active=True)
        db.session.add(customer)
        db.session.commit()
        return jsonify({"success": True, "message": "Customer registered successfully", "customer_id": customer.id}), 201
    except IntegrityError:
        db.session.rollback()
        return error("Customer already exists", 409)


@auth_bp.route("/login", methods=["POST"])
def login():
    data = register_data()
    mobile = str(data.get("mobile") or "").strip()
    password = data.get("password")
    if not mobile or not isinstance(password, str):
        return error("Mobile number and password required")
    user = User.query.filter_by(mobile=mobile).first()
    if not user or not user.is_active or not user.check_password(password):
        return error("Invalid mobile number or password", 401)
    claims = {"role": user.role}
    if user.role == "management":
        claims["staff_token_version"] = user.staff_token_version
    token = create_access_token(identity=str(user.id), additional_claims=claims)
    return jsonify({"success": True, "message": "Login successful", "access_token": token,
                    "user": {"id": user.id, "name": user.name, "mobile": user.mobile, "role": user.role}}), 200


@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    mobile = str(register_data().get("mobile") or "").strip()
    if not re.fullmatch(MOBILE_PATTERN, mobile):
        return error("Enter a valid mobile number")
    response = {"success": True, "message": "If the registered customer exists, your request will be reviewed by the administrator"}
    user = User.query.filter_by(mobile=mobile, role="customer", is_active=True).with_for_update().first()
    if not user:
        return jsonify(response), 200
    now = datetime.now(timezone.utc)
    if user.reset_status == "Pending" and user.reset_otp_requested_at and now - user.reset_otp_requested_at < timedelta(hours=24):
        return jsonify(response), 200
    if user.reset_status == "Code Generated" and user.reset_otp_expires_at and user.reset_otp_expires_at > now:
        return jsonify(response), 200
    if user.reset_otp_requested_at and now - user.reset_otp_requested_at < timedelta(minutes=1):
        return jsonify(response), 200
    user.reset_status = "Pending"
    user.reset_otp_requested_at = now
    user.reset_otp_hash = None
    user.reset_otp_expires_at = None
    user.reset_otp_attempts = 0
    user.reset_approved_by = None
    user.reset_approved_at = None
    user.reset_completed_at = None
    db.session.commit()
    return jsonify(response), 200


@auth_bp.route("/admin/password-reset-requests", methods=["GET"])
@jwt_required()
def get_password_reset_requests():
    if not current_admin():
        return error("Admin access only", 403)
    users = User.query.filter(User.role == "customer", User.reset_status.isnot(None)).order_by(User.reset_otp_requested_at.desc()).all()
    now = datetime.now(timezone.utc)
    result = []
    for user in users:
        status = user.reset_status
        if status == "Code Generated" and user.reset_otp_expires_at and user.reset_otp_expires_at <= now:
            status = "Expired"
        if status == "Pending" and user.reset_otp_requested_at and now - user.reset_otp_requested_at >= timedelta(hours=24):
            status = "Expired"
        result.append({"user_id": user.id, "name": user.name, "mobile": user.mobile,
                       "village": user.customer.village if user.customer else None, "status": status,
                       "requested_at": user.reset_otp_requested_at.isoformat() if user.reset_otp_requested_at else None,
                       "approved_at": user.reset_approved_at.isoformat() if user.reset_approved_at else None,
                       "completed_at": user.reset_completed_at.isoformat() if user.reset_completed_at else None,
                       "expires_at": user.reset_otp_expires_at.isoformat() if user.reset_otp_expires_at else None})
    return jsonify({"success": True, "total": len(result), "data": result}), 200


@auth_bp.route("/admin/password-reset-requests/<int:user_id>/approve", methods=["POST"])
@jwt_required()
def approve_password_reset(user_id):
    admin = current_admin()
    if not admin:
        return error("Admin access only", 403)
    if register_data().get("identity_verified") is not True:
        return error("Verify the customer identity before approval")
    user = User.query.filter_by(id=user_id, role="customer", is_active=True).with_for_update().first()
    if not user:
        return error("Customer not found", 404)
    if user.reset_status != "Pending":
        return error("No pending password reset request", 409)
    now = datetime.now(timezone.utc)
    if not user.reset_otp_requested_at or now - user.reset_otp_requested_at >= timedelta(hours=24):
        return error("Request expired. Ask the customer to submit again.", 409)
    otp = f"{secrets.randbelow(1000000):06d}"
    user.reset_otp_hash = generate_password_hash(otp)
    user.reset_otp_expires_at = now + timedelta(minutes=5)
    user.reset_otp_attempts = 0
    user.reset_status = "Code Generated"
    user.reset_approved_by = admin.id
    user.reset_approved_at = now
    db.session.commit()
    response = jsonify({"success": True, "message": "Reset code generated successfully", "reset_code": otp, "expires_in_minutes": 5})
    response.headers["Cache-Control"] = "no-store"
    return response, 200


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = register_data()
    mobile = str(data.get("mobile") or "").strip()
    otp, password = data.get("otp"), data.get("new_password")
    if not re.fullmatch(MOBILE_PATTERN, mobile):
        return error("Enter a valid mobile number")
    if not isinstance(otp, str) or not re.fullmatch(r"[0-9]{6}", otp):
        return error("Enter a valid six-digit reset code")
    if not isinstance(password, str) or not 8 <= len(password) <= 128:
        return error("Password must contain 8 to 128 characters")
    user = User.query.filter_by(mobile=mobile, role="customer", is_active=True).with_for_update().first()
    now = datetime.now(timezone.utc)
    if not user or user.reset_status != "Code Generated" or not user.reset_approved_by or not user.reset_otp_hash or not user.reset_otp_expires_at or user.reset_otp_expires_at <= now or user.reset_otp_attempts >= 5:
        return error("Invalid or expired reset code")
    if not check_password_hash(user.reset_otp_hash, otp):
        user.reset_otp_attempts += 1
        if user.reset_otp_attempts >= 5:
            user.reset_status = "Expired"
            user.reset_otp_hash = None
            user.reset_otp_expires_at = None
        db.session.commit()
        return error("Invalid or expired reset code")
    user.set_password(password)
    user.reset_status = "Completed"
    user.reset_completed_at = now
    db.session.commit()
    return jsonify({"success": True, "message": "Password reset successfully. Please sign in."}), 200
