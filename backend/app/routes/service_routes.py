from flask import Blueprint, jsonify
from app.models.service import Service

service_bp = Blueprint("service", __name__)


@service_bp.route("/", methods=["GET"])
def get_services():

    services = Service.query.filter_by(
        is_active=True
    ).order_by(Service.id).all()

    return jsonify({
        "success": True,
        "data": [
            {
                "id": service.id,
                "service_name": service.service_name,
                "description": service.description
            }
            for service in services
        ]
    }), 200