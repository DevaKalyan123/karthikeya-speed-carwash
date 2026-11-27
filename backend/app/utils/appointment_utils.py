from datetime import datetime, timedelta, timezone

from flask import current_app
from sqlalchemy import text

from app.extensions import db
from app.models.service_request import ServiceRequest


IST = timezone(timedelta(hours=5, minutes=30))


# ==========================================
# VALIDATE APPOINTMENT SLOT
# ==========================================

def validate_slot(
    date_value,
    start_value,
    end_value,
    allow_past=False
):

    appointment_date = datetime.strptime(
        date_value,
        "%Y-%m-%d"
    ).date()

    start_time = datetime.strptime(
        start_value,
        "%H:%M"
    ).time()

    end_time = datetime.strptime(
        end_value,
        "%H:%M"
    ).time()

    if not allow_past:

        if datetime.combine(
            appointment_date,
            start_time,
            tzinfo=IST
        ) <= datetime.now(IST):

            raise ValueError(
                "Appointment must be in the future"
            )

    if end_time <= start_time:

        raise ValueError(
            "End time must be after start time"
        )

    return appointment_date, start_time, end_time


# ==========================================
# OPTIONAL APPOINTMENT DATE AND TIME
# ==========================================

def parse_optional_appointment(
    date_value,
    start_value
):

    date = None
    start = None
    end = None

    # Date is optional.
    # Past, present and future dates are allowed.

    if date_value:

        if not isinstance(date_value, str):

            raise ValueError(
                "Invalid appointment date"
            )

        date_value = date_value.strip()

        if date_value:

            try:

                date = datetime.strptime(
                    date_value,
                    "%Y-%m-%d"
                ).date()

            except ValueError:

                date = datetime.strptime(
                    date_value,
                    "%d/%m/%Y"
                ).date()

    # Time is independently optional.

    if start_value:

        if not isinstance(start_value, str):

            raise ValueError(
                "Invalid appointment time"
            )

        start_value = start_value.strip()

        if start_value:

            start = datetime.strptime(
                start_value,
                "%H:%M"
            ).time()

    # Calculate end time only when date and time exist.

    if date is not None and start is not None:

        duration = int(
            current_app.config.get(
                "APPOINTMENT_DURATION_MINUTES",
                60
            )
        )

        if not 1 <= duration <= 720:

            raise ValueError(
                "Invalid appointment duration configuration"
            )

        try:

            end_datetime = datetime.combine(
                date,
                start
            ) + timedelta(minutes=duration)

            if end_datetime.date() == date:

                end = end_datetime.time()

        except OverflowError:

            end = None

    return date, start, end


# ==========================================
# EXISTING PREFERRED START VALIDATION
# ==========================================

def validate_preferred_start(
    date_value,
    start_value
):

    return parse_optional_appointment(
        date_value,
        start_value
    )


# ==========================================
# LOCK APPOINTMENT DATE
# ==========================================

def lock_appointment_date(appointment_date):

    if appointment_date is None:

        return

    db.session.execute(

        text(
            "SELECT pg_advisory_xact_lock(:namespace, :day)"
        ),

        {
            "namespace": 83001,
            "day": appointment_date.toordinal()
        }
    )


# ==========================================
# CHECK APPOINTMENT AVAILABILITY
# ==========================================

def is_slot_available(
    appointment_date,
    start_time,
    end_time,
    exclude_request_id=None
):

    if (
        appointment_date is None
        or start_time is None
        or end_time is None
    ):

        return True

    query = ServiceRequest.query.filter(

        ServiceRequest.appointment_date == appointment_date,

        ServiceRequest.appointment_status == "Confirmed",

        ServiceRequest.status != "Cancelled",

        ServiceRequest.confirmed_start_time < end_time,

        ServiceRequest.confirmed_end_time > start_time,

    )

    if exclude_request_id is not None:

        query = query.filter(

            ServiceRequest.id != exclude_request_id

        )

    return query.first() is None


# ==========================================
# CANCEL SERVICE REQUEST
# ==========================================

def cancel_request(req, actor, reason):

    if req.status == "Cancelled":

        return

    if (
        req.status != "Pending"
        or req.invoice is not None
    ):

        raise ValueError(
            "Billed or completed requests cannot be cancelled"
        )

    if req.appointment_date:

        lock_appointment_date(
            req.appointment_date
        )

    req.status = "Cancelled"

    req.appointment_status = "Cancelled"

    req.cancelled_by = actor

    req.cancelled_at = datetime.now(
        timezone.utc
    )

    req.cancellation_reason = reason

    for slot in req.appointment_slots:

        if slot.status in (
            "Available",
            "Selected"
        ):

            slot.status = "Expired"


# ==========================================
# FORMAT TIME
# ==========================================

def format_time(value):

    return (
        value.strftime("%H:%M")
        if value
        else None
    )


# ==========================================
# SERIALIZE APPOINTMENT
# ==========================================

def serialize_appointment(req):

    return {

        "appointment_date": (

            req.appointment_date.isoformat()

            if req.appointment_date

            else None

        ),

        "preferred_start_time": format_time(
            req.preferred_start_time
        ),

        "preferred_end_time": format_time(
            req.preferred_end_time
        ),

        "confirmed_start_time": format_time(
            req.confirmed_start_time
        ),

        "confirmed_end_time": format_time(
            req.confirmed_end_time
        ),

        "appointment_status": (

            req.appointment_status

            or "Not Scheduled"

        ),

        "cancelled_by": req.cancelled_by,

        "cancelled_at": (

            req.cancelled_at.isoformat()

            if req.cancelled_at

            else None

        ),

        "cancellation_reason": (
            req.cancellation_reason
        ),

        "can_cancel": (

            req.status == "Pending"

            and req.invoice is None

        ),

        "appointment_slots": [

            {

                "id": slot.id,

                "appointment_date": (
                    slot.appointment_date.isoformat()
                ),

                "start_time": format_time(
                    slot.start_time
                ),

                "end_time": format_time(
                    slot.end_time
                ),

                "status": slot.status

            }

            for slot in sorted(

                req.appointment_slots,

                key=lambda s: (
                    s.appointment_date,
                    s.start_time
                )

            )

            if (
                slot.status == "Available"

                and req.status != "Cancelled"
            )

        ]

    }