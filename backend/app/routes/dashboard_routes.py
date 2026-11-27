from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request
from sqlalchemy import func, case
from collections import Counter

from app.extensions import db
from app.models.customer import Customer
from app.models.service_request import ServiceRequest
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.request_item import RequestItem
from app.models.service import Service
from app.models.manual_visit import ManualVisit
from app.routes.admin_routes import admin_required

dashboard_bp = Blueprint("dashboard", __name__)
IST = timezone(timedelta(hours=5, minutes=30))


def customer_count(start_date, end_date):
    online = db.session.query(ServiceRequest.customer_id).filter(
        ServiceRequest.created_at >= start_date,
        ServiceRequest.created_at < end_date
    )
    manual = db.session.query(ManualVisit.customer_id).filter(
        ManualVisit.service_date >= start_date.date(),
        ManualVisit.service_date < end_date.date()
    )
    combined = online.union(manual).subquery()
    return db.session.query(func.count()).select_from(combined).scalar() or 0


def manual_revenue(start_date=None, end_date=None):
    query = db.session.query(func.coalesce(func.sum(ManualVisit.amount), 0))
    if start_date is not None:
        query = query.filter(ManualVisit.service_date >= start_date.date(),
                             ManualVisit.service_date < end_date.date())
    return query.scalar()


def revenue_count(start_date, end_date):
    return db.session.query(
        func.coalesce(func.sum(Payment.amount), 0)
    ).select_from(Payment).join(
        Invoice, Invoice.id == Payment.invoice_id
    ).filter(
        Invoice.deleted_at.is_(None),
        Payment.paid_at >= start_date,
        Payment.paid_at < end_date
    ).scalar()


def received_tips(start_date=None, end_date=None):
    # Aggregate once per paid invoice, not once per payment row.
    final_payments = db.session.query(
        Payment.invoice_id.label("invoice_id"),
        func.max(Payment.paid_at).label("paid_at")
    ).group_by(Payment.invoice_id).subquery()
    query = db.session.query(func.coalesce(func.sum(Invoice.tip_amount), 0)).select_from(Invoice).join(
        final_payments, final_payments.c.invoice_id == Invoice.id
    ).filter(Invoice.payment_status == "Paid", Invoice.deleted_at.is_(None))
    if start_date is not None:
        query = query.filter(final_payments.c.paid_at >= start_date, final_payments.c.paid_at < end_date)
    return query.scalar()


def get_date_range(period):
    today = datetime.now(IST).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    if period == "daily":
        return today, today + timedelta(days=1)
    if period == "weekly":
        start = today - timedelta(days=today.weekday())
        return start, start + timedelta(days=7)
    if period == "monthly":
        start = today.replace(day=1)
        end = (start + timedelta(days=32)).replace(day=1)
        return start, end
    return None, None


@dashboard_bp.route("/summary", methods=["GET"])
@admin_required
def dashboard_summary():
    total_customers = Customer.query.count()
    total_requests = ServiceRequest.query.count()
    pending_requests = ServiceRequest.query.filter_by(status="Pending").count()
    billed_requests = ServiceRequest.query.filter(ServiceRequest.status == "Billed", ServiceRequest.invoice.has(Invoice.deleted_at.is_(None))).count()
    active_invoices = Invoice.query.filter(Invoice.deleted_at.is_(None))
    paid_invoices = active_invoices.filter_by(payment_status="Paid").count()

    # All outstanding bills, including customer payment requests.
    unpaid_invoices = active_invoices.filter(
        Invoice.payment_status.in_(["Unpaid", "Awaiting Confirmation"])
    ).count()
    awaiting_payment_selection = active_invoices.filter_by(payment_status="Unpaid").count()
    pending_payment_requests = active_invoices.filter_by(
        payment_status="Awaiting Confirmation"
    ).count()
    pending_cash_payments = active_invoices.filter_by(
        payment_status="Awaiting Confirmation", requested_payment_method="Cash"
    ).count()
    pending_upi_payments = active_invoices.filter_by(
        payment_status="Awaiting Confirmation", requested_payment_method="UPI"
    ).count()

    # Confirmed invoices and manual received amounts each contribute once.
    total_manual_revenue = manual_revenue()
    total_revenue = db.session.query(
        func.coalesce(func.sum(Payment.amount), 0)
    ).select_from(Payment).join(Invoice, Invoice.id == Payment.invoice_id).filter(
        Invoice.deleted_at.is_(None)
    ).scalar() + total_manual_revenue
    total_tips = received_tips()

    periods = {}
    for period in ["daily", "weekly", "monthly"]:
        start, end = get_date_range(period)
        manual = manual_revenue(start, end)
        revenue = revenue_count(start, end) + manual
        tips = received_tips(start, end)
        periods[period] = {
            "customers": customer_count(start, end),
            "revenue": str(revenue),
            "manual_revenue": str(manual),
            "tips": str(tips),
            "service_revenue": str(revenue - tips)
        }

    return jsonify({
        "success": True,
        "data": {
            "total_customers": total_customers,
            "total_requests": total_requests,
            "pending_requests": pending_requests,
            "billed_requests": billed_requests,
            "paid_invoices": paid_invoices,
            "unpaid_invoices": unpaid_invoices,
            "awaiting_payment_selection": awaiting_payment_selection,
            "pending_payment_requests": pending_payment_requests,
            "pending_cash_payments": pending_cash_payments,
            "pending_upi_payments": pending_upi_payments,
            "total_revenue": str(total_revenue),
            "total_manual_revenue": str(total_manual_revenue),
            "total_manual_visits": ManualVisit.query.count(),
            "total_tips": str(total_tips),
            "total_service_revenue": str(total_revenue - total_tips),
            "daily": periods["daily"],
            "weekly": periods["weekly"],
            "monthly": periods["monthly"]
        }
    }), 200


@dashboard_bp.route("/charts", methods=["GET"])
@admin_required
def dashboard_charts():
    period = request.args.get("period", "daily")
    start, end = get_date_range(period)
    if start is None:
        return jsonify({"success": False, "message": "Invalid period"}), 400

    service_data = db.session.query(
        Service.service_name, func.count(RequestItem.id)
    ).join(
        RequestItem, RequestItem.service_id == Service.id
    ).join(
        ServiceRequest, ServiceRequest.id == RequestItem.request_id
    ).filter(
        ServiceRequest.created_at >= start,
        ServiceRequest.created_at < end
    ).group_by(Service.id, Service.service_name).all()

    display_status = case((Invoice.deleted_at.isnot(None), "Bill Deleted"), else_=ServiceRequest.status)
    status_data = db.session.query(
        display_status, func.count(ServiceRequest.id)
    ).select_from(ServiceRequest).outerjoin(Invoice, Invoice.request_id == ServiceRequest.id).filter(
        ServiceRequest.created_at >= start,
        ServiceRequest.created_at < end
    ).group_by(display_status).all()

    payment_data = db.session.query(
        Invoice.payment_status, func.count(Invoice.id)
    ).filter(
        Invoice.deleted_at.is_(None),
        Invoice.created_at >= start,
        Invoice.created_at < end
    ).group_by(Invoice.payment_status).all()

    revenue_data = db.session.query(
        Payment.payment_method, func.sum(Payment.amount)
    ).select_from(Payment).join(
        Invoice, Invoice.id == Payment.invoice_id
    ).filter(
        Invoice.deleted_at.is_(None),
        Payment.paid_at >= start,
        Payment.paid_at < end
    ).group_by(Payment.payment_method).all()

    manual_records = ManualVisit.query.filter(
        ManualVisit.service_date >= start.date(),
        ManualVisit.service_date < end.date()
    ).all()
    service_counts = Counter()
    for name, count in service_data:
        service_counts[name] += count
    for visit in manual_records:
        for service in visit.services:
            service_counts[service["service_name"]] += 1
    method_totals = [{"name": method, "value": float(amount)} for method, amount in revenue_data]
    manual_amount = manual_revenue(start, end)
    if manual_amount:
        method_totals.append({"name": "Manual (method unspecified)", "value": float(manual_amount)})

    return jsonify({
        "success": True,
        "period": period,
        "total_customers": customer_count(start, end),
        "services": [
            {"name": name, "value": count} for name, count in service_counts.items()
        ],
        "request_status": [
            {"name": status, "value": count} for status, count in status_data
        ],
        "payment_status": [
            {"name": status, "value": count} for status, count in payment_data
        ],
        "payment_methods": method_totals
    }), 200
