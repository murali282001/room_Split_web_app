import qrcode
import base64
from io import BytesIO


def generate_upi_link(
    upi_id: str,
    payee_name: str,
    amount_paise: int,
    payment_id: str,
) -> str:
    """Generate a UPI deep link for payment."""
    amount_rupees = amount_paise / 100
    tn = f"RoomSplit-{payment_id[:8]}"  # transaction note (max 50 chars)
    return (
        f"upi://pay"
        f"?pa={upi_id}"
        f"&pn={payee_name}"
        f"&am={amount_rupees:.2f}"
        f"&cu=INR"
        f"&tn={tn}"
        f"&tr={payment_id}"
    )


def generate_qr_base64(upi_link: str) -> str:
    """Generate a base64-encoded PNG QR code image for the UPI link."""
    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(upi_link)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode()
