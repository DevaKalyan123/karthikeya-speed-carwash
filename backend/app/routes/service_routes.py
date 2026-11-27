from decimal import Decimal, InvalidOperation

from flask import Blueprint, jsonify, request
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.service import Service
from app.routes.admin_routes import admin_required


service_bp = Blueprint("service", __name__)


def serialize_service(service):
    return {
        "id": service.id,
        "service_name": service.service_name,
        "description": service.description,
        "price": str(service.price)
        if service.price is not None else None,
        "is_active": service.is_active
    }


# Customer - Get Active Services
@service_bp.route("/", methods=["GET"])
def get_services():

    services = Service.query.filter_by(
        is_active=True
    ).order_by(Service.id).all()

    return jsonify({
        "success": True,
        "data": [
            serialize_service(service)
            for service in services
        ]
    }), 200


# Admin - Get All Services
@service_bp.route("/admin/all", methods=["GET"])
@admin_required
def get_all_services():

    services = Service.query.order_by(Service.id).all()

    return jsonify({
        "success": True,
        "data": [
            serialize_service(service)
            for service in services
        ]
    }), 200


# Validate Price
def validate_price(value):

    if value is None or value == "":
        return None

    price = Decimal(str(value))

    if (
        not price.is_finite()
        or price < 0
        or price > Decimal("9999999999.99")
        or price != price.quantize(Decimal("0.01"))
    ):
        raise ValueError("Invalid price")

    return price


# Admin - Add Service
@service_bp.route("/admin/add", methods=["POST"])
@admin_required
def add_service():

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "success": False,
            "message": "Invalid request"
        }), 400

    name = data.get("service_name")
    description = data.get("description")

    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 150:
        return jsonify({
            "success": False,
            "message": "Enter a valid service name"
        }), 400

    if description is not None and not isinstance(description, str):
        return jsonify({
            "success": False,
            "message": "Invalid description"
        }), 400

    name = name.strip()

    existing = Service.query.filter(
        func.lower(Service.service_name) == name.lower()
    ).first()

    if existing:
        return jsonify({
            "success": False,
            "message": "Service already exists"
        }), 409

    try:
        price = validate_price(data.get("price"))

        if price is None:
            raise ValueError()

    except (ValueError, InvalidOperation, TypeError):
        return jsonify({
            "success": False,
            "message": "Enter a valid service price"
        }), 400

    try:
        service = Service(
            service_name=name,
            description=description,
            price=price,
            is_active=True
        )

        db.session.add(service)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Service added successfully",
            "data": serialize_service(service)
        }), 201

    except IntegrityError:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to add service"
        }), 409


# Admin - Update Service
@service_bp.route("/admin/<int:service_id>", methods=["PUT"])
@admin_required
def update_service(service_id):

    service = db.session.get(Service, service_id)

    if not service:
        return jsonify({
            "success": False,
            "message": "Service not found"
        }), 404

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "success": False,
            "message": "Invalid request"
        }), 400

    name = data.get("service_name", service.service_name)
    description = data.get("description", service.description)
    is_active = data.get("is_active", service.is_active)

    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 150:
        return jsonify({
            "success": False,
            "message": "Invalid service name"
        }), 400

    if type(is_active) is not bool:
        return jsonify({
            "success": False,
            "message": "Invalid service status"
        }), 400

    if description is not None and not isinstance(description, str):
        return jsonify({
            "success": False,
            "message": "Invalid description"
        }), 400

    name = name.strip()

    existing = Service.query.filter(
        func.lower(Service.service_name) == name.lower(),
        Service.id != service_id
    ).first()

    if existing:
        return jsonify({
            "success": False,
            "message": "Service name already exists"
        }), 409

    try:
        price = validate_price(
            data.get("price", service.price)
        )

    except (ValueError, InvalidOperation, TypeError):
        return jsonify({
            "success": False,
            "message": "Invalid service price"
        }), 400

    try:
        service.service_name = name
        service.description = description
        service.price = price
        service.is_active = is_active

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Service updated successfully",
            "data": serialize_service(service)
        }), 200

    except IntegrityError:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to update service"
        }), 409