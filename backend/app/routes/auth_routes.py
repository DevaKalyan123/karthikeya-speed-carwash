import re

from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.user import User
from app.models.customer import Customer

auth_bp = Blueprint("auth", __name__)


# Customer Registration
@auth_bp.route("/register", methods=["POST"])
def register():

    data = request.get_json(silent=True) or {}

    name = str(data.get("name") or "").strip()
    mobile = str(data.get("mobile") or "").strip()
    village = str(data.get("village") or "").strip()
    password = data.get("password")

    if not all([name, mobile, village, password]):
        return jsonify({
            "success": False,
            "message": "All fields are required"
        }), 400

    if not re.fullmatch(r"[6-9][0-9]{9}", mobile):
        return jsonify({
            "success": False,
            "message": "Enter a valid mobile number"
        }), 400

    if not isinstance(password, str) or len(password) < 8:
        return jsonify({
            "success": False,
            "message": "Password must contain at least 8 characters"
        }), 400

    existing_user = User.query.filter_by(mobile=mobile).first()

    if existing_user:
        return jsonify({
            "success": False,
            "message": "Mobile number already registered"
        }), 409

    try:
        user = User(
            name=name,
            mobile=mobile,
            role="customer"
        )

        user.set_password(password)

        db.session.add(user)
        db.session.flush()

        customer = Customer(
            user_id=user.id,
            name=name,
            mobile=mobile,
            village=village
        )

        db.session.add(customer)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Customer registered successfully",
            "customer_id": customer.id
        }), 201

    except IntegrityError:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Customer already exists"
        }), 409


# Common Login - Admin and Customer
@auth_bp.route("/login", methods=["POST"])
def login():

    data = request.get_json(silent=True) or {}

    mobile = str(data.get("mobile") or "").strip()
    password = data.get("password")

    if not mobile or not isinstance(password, str):
        return jsonify({
            "success": False,
            "message": "Mobile number and password required"
        }), 400

    user = User.query.filter_by(mobile=mobile).first()

    if not user or not user.check_password(password):
        return jsonify({
            "success": False,
            "message": "Invalid mobile number or password"
        }), 401

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role}
    )

    return jsonify({
        "success": True,
        "message": "Login successful",
        "access_token": access_token,
        "user": {
            "id": user.id,
            "name": user.name,
            "mobile": user.mobile,
            "role": user.role
        }
    }), 200