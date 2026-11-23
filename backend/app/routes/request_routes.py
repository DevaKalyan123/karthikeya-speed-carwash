from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.customer import Customer
from app.models.vehicle import Vehicle
from app.models.service import Service
from app.models.service_request import ServiceRequest
from app.models.request_item import RequestItem
from app.models.user import User

request_bp = Blueprint("service_request", __name__)


@request_bp.route("/", methods=["POST"])
@jwt_required()
def create_request():

    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)

    if not user or user.role != "customer":
        return jsonify({
            "success": False,
            "message": "Customer access only"
        }), 403

    customer = Customer.query.filter_by(user_id=user_id).first()

    if not customer:
        return jsonify({
            "success": False,
            "message": "Customer not found"
        }), 404

    data = request.get_json(silent=True) or {}

    car_name = str(data.get("car_name") or "").strip()
    car_number = str(data.get("car_number") or "").strip().upper().replace(" ", "")
    service_ids = data.get("service_ids", [])

    if not car_name or not car_number or not service_ids:
        return jsonify({
            "success": False,
            "message": "All fields are required"
        }), 400

    if len(car_name) > 100 or len(car_number) > 20:
        return jsonify({
            "success": False,
            "message": "Invalid vehicle details"
        }), 400

    if not isinstance(service_ids, list) or any(
        type(service_id) is not int for service_id in service_ids
    ):
        return jsonify({
            "success": False,
            "message": "Invalid service IDs"
        }), 400

    service_ids = list(set(service_ids))

    services = Service.query.filter(
        Service.id.in_(service_ids),
        Service.is_active.is_(True)
    ).all()

    if len(services) != len(service_ids):
        return jsonify({
            "success": False,
            "message": "Invalid or inactive services"
        }), 400

    try:

        vehicle = Vehicle.query.filter_by(
            car_number=car_number
        ).first()

        if vehicle and vehicle.customer_id != customer.id:
            return jsonify({
                "success": False,
                "message": "Vehicle is registered to another customer"
            }), 409

        if not vehicle:
            vehicle = Vehicle(
                customer_id=customer.id,
                car_name=car_name,
                car_number=car_number
            )

            db.session.add(vehicle)
            db.session.flush()

        service_request = ServiceRequest(
            customer_id=customer.id,
            vehicle_id=vehicle.id,
            status="Pending"
        )

        db.session.add(service_request)
        db.session.flush()

        for service_id in service_ids:

            item = RequestItem(
                request_id=service_request.id,
                service_id=service_id
            )

            db.session.add(item)

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Service request submitted successfully",
            "request_id": service_request.id,
            "status": service_request.status
        }), 201

    except IntegrityError:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to save service request"
        }), 409


# Customer Previous Requests
@request_bp.route("/my-requests", methods=["GET"])
@jwt_required()
def my_requests():

    user_id = int(get_jwt_identity())

    customer = Customer.query.filter_by(
        user_id=user_id
    ).first()

    if not customer:
        return jsonify({
            "success": False,
            "message": "Customer not found"
        }), 404

    requests = ServiceRequest.query.filter_by(
        customer_id=customer.id
    ).order_by(ServiceRequest.id.desc()).all()

    result = []

    for req in requests:

        result.append({
            "request_id": req.id,
            "customer_name": customer.name,
            "mobile": customer.mobile,
            "village": customer.village,
            "car_name": req.vehicle.car_name,
            "car_number": req.vehicle.car_number,
            "status": req.status,
            "created_at": req.created_at.isoformat(),
            "services": [
                {
                    "service_id": item.service_id,
                    "service_name": item.service.service_name,
                    "amount": str(item.amount) if item.amount is not None else None
                }
                for item in req.items
            ]
        })

    return jsonify({
        "success": True,
        "data": result
    }), 200