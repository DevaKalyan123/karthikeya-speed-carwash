from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape
from datetime import timedelta, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.utils import ImageReader

IST = timezone(timedelta(hours=5, minutes=30))


def generate_invoice_pdf(invoice):
    buffer = BytesIO()
    document = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=32, rightMargin=32,
                                 topMargin=28, bottomMargin=28)
    styles = getSampleStyleSheet()
    normal = ParagraphStyle("Compact", parent=styles["Normal"], fontSize=9, leading=12)
    title = ParagraphStyle("CompactTitle", parent=styles["Title"], fontSize=15, leading=19,
                           spaceBefore=0, spaceAfter=0)
    blue = colors.HexColor("#0EA5E9")
    req = invoice.request
    payment = max(invoice.payments, key=lambda item: item.id, default=None)
    elements = []

    logo_path = Path(__file__).resolve().parent.parent / "assets" / "logo.png"
    logo = Paragraph("<b>Karthikeya Speed<br/>Car Wash &amp; Detail</b>", normal)
    if logo_path.exists():
        width, height = ImageReader(str(logo_path)).getSize()
        scale = min(145 / width, 72 / height)
        logo = Image(str(logo_path), width=width * scale, height=height * scale)
    address = Paragraph(
        "<b>Karthikeya Speed Car Wash &amp; Detail</b><br/>"
        "59-12-12/1, Pinnamaneni, Polyclinic Rd,<br/>"
        "Gayatri Nagar, Krishna Nagar, Vijayawada,<br/>"
        "Andhra Pradesh - 520008<br/>"
        "<b>Phone:</b> 092679 23927",
        normal,
    )
    header = Table([[logo, address]], colWidths=[170, document.width - 170])
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, -1), 0.8, blue),
    ]))
    elements.extend([header, Spacer(1, 12), Paragraph("SERVICE INVOICE", title), Spacer(1, 10)])

    def field(label, value):
        return Paragraph(f"<b>{escape(label)}:</b> {escape(str(value if value is not None else ''))}", normal)

    time_value = req.confirmed_start_time or req.preferred_start_time
    details = [
        [field("Invoice No.", invoice.invoice_number), field("Date", invoice.created_at.astimezone(IST).strftime("%d/%m/%Y"))],
        [field("Customer Name", req.contact_name), field("Mobile Number", req.contact_mobile)],
        [field("Village", req.customer.village), field("Car Make", req.car_make)],
        [field("Car Number", req.vehicle.car_number), field("Payment Status", invoice.payment_status)],
        [field("Appointment Date", req.appointment_date.strftime("%d/%m/%Y") if req.appointment_date else ""),
         field("Appointment Time", time_value.strftime("%I:%M %p") if time_value else "")],
    ]
    if payment:
        details.append([field("Payment Method", payment.payment_method), field("Payment Date", payment.paid_at.astimezone(IST).strftime("%d/%m/%Y") if payment.paid_at else "")])
        if payment.transaction_id:
            details.append([field("Transaction ID", payment.transaction_id), ""])
    elif invoice.payment_status == "Paid" and invoice.total_amount == 0:
        details.append([field("Payment Method", "No Payment Required"), ""])

    info = Table(details, colWidths=[document.width / 2, document.width / 2])
    info.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.extend([info, Spacer(1, 12)])

    table_data = [["S.No", "Service Name", "Amount (INR)"]]
    for index, item in enumerate(req.items, start=1):
        table_data.append([index, Paragraph(escape(item.service.service_name), normal),
                           f"{item.amount:.2f}" if item.amount is not None else "-"])
    table_data.extend([
        ["", "SUBTOTAL", f"{invoice.effective_subtotal:.2f}"],
        ["", "DISCOUNT", f"- {invoice.discount_amount:.2f}" if invoice.discount_amount > 0 else "No Discount"],
        ["", "NET SERVICE AMOUNT", f"{invoice.service_amount:.2f}"],
        ["", "TIPS", f"{invoice.tip_amount:.2f}"],
        ["", "FINAL PAID AMOUNT" if invoice.payment_status == "Paid" else "FINAL PAYABLE AMOUNT", f"{invoice.total_amount:.2f}"],
    ])
    table = Table(table_data, colWidths=[42, document.width - 42 - 112, 112], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), blue),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (-1, 1), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.lightgrey),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TEXTCOLOR", (1, -4), (-1, -4), colors.HexColor("#15803D")),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#E0F2FE")),
        ("FONTNAME", (0, -5), (-1, -1), "Helvetica-Bold"),
    ]))
    elements.extend([table, Spacer(1, 16), Paragraph("Thank you for choosing Karthikeya Speed Car Wash &amp; Detail!", normal)])
    document.build(elements)
    buffer.seek(0)
    return buffer
