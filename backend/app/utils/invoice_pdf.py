from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
    Image
)
from reportlab.lib.utils import ImageReader


def generate_invoice_pdf(invoice):

    buffer = BytesIO()

    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40
    )

    styles = getSampleStyleSheet()
    elements = []

    req = invoice.request

    logo_path = (
        Path(__file__).resolve().parent.parent
        / "assets" / "logo.png"
    )

    if logo_path.exists():
        width, height = ImageReader(str(logo_path)).getSize()

        logo = Image(
            str(logo_path),
            width=230,
            height=230 * height / width
        )

        elements.append(logo)

    elements.append(
        Paragraph("SERVICE INVOICE", styles["Title"])
    )

    elements.append(Spacer(1, 20))

    details = [
        ("Invoice Number", invoice.invoice_number),
        ("Date", invoice.created_at.strftime("%d-%m-%Y")),
        ("Customer Name", req.customer.name),
        ("Mobile Number", req.customer.mobile),
        ("Village", req.customer.village),
        ("Car Name", req.vehicle.car_name),
        ("Car Number", req.vehicle.car_number),
        ("Payment Status", invoice.payment_status)
    ]

    for label, value in details:

        elements.append(
            Paragraph(
                f"<b>{label}:</b> {escape(str(value))}",
                styles["Normal"]
            )
        )

        elements.append(Spacer(1, 6))

    elements.append(Spacer(1, 20))

    table_data = [
        ["S.No", "Service Name", "Amount (INR)"]
    ]

    for index, item in enumerate(req.items, start=1):

        table_data.append([
            index,
            Paragraph(
                escape(item.service.service_name),
                styles["Normal"]
            ),
            f"{item.amount:.2f}"
        ])

    table_data.append([
        "",
        "TOTAL",
        f"{invoice.total_amount:.2f}"
    ])

    table = Table(
        table_data,
        colWidths=[50, 330, 130],
        repeatRows=1
    )

    table.setStyle(TableStyle([

        ("BACKGROUND", (0, 0), (-1, 0),
         colors.HexColor("#0EA5E9")),

        ("TEXTCOLOR", (0, 0), (-1, 0),
         colors.white),

        ("FONTNAME", (0, 0), (-1, 0),
         "Helvetica-Bold"),

        ("ALIGN", (-1, 1), (-1, -1), "RIGHT"),

        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),

        ("GRID", (0, 0), (-1, -1), 0.5,
         colors.lightgrey),

        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),

        ("TOPPADDING", (0, 0), (-1, -1), 12),

        ("BACKGROUND", (0, -1), (-1, -1),
         colors.HexColor("#E0F2FE")),

        ("FONTNAME", (0, -1), (-1, -1),
         "Helvetica-Bold")
    ]))

    elements.append(table)

    elements.append(Spacer(1, 30))

    elements.append(
        Paragraph(
            "Thank you for choosing Karthikeya Speed Car Wash &amp; Detail!",
            styles["Normal"]
        )
    )

    document.build(elements)

    buffer.seek(0)

    return buffer