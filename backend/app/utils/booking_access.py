from flask_jwt_extended import get_jwt_identity, get_jwt
from app.extensions import db
from app.models.user import User
from app.models.customer import Customer
from app.models.service_request import ServiceRequest


def booking_actor():
    user = db.session.get(User, int(get_jwt_identity()))
    if not user or not user.is_active or user.role not in ("customer", "management"):
        return None
    if user.role == "management" and get_jwt().get("staff_token_version") != user.staff_token_version:
        return None
    return user


def owned_requests(user):
    if user.role == "management":
        return ServiceRequest.query.filter_by(created_by_user_id=user.id, booking_source="Management")
    customer = Customer.query.filter_by(user_id=user.id).first()
    if not customer:
        return ServiceRequest.query.filter(db.false())
    return ServiceRequest.query.filter_by(customer_id=customer.id)


def can_access_booking(user, req):
    if user.role == "management":
        return req.booking_source == "Management" and req.created_by_user_id == user.id
    return user.role == "customer" and req.customer.user_id == user.id
