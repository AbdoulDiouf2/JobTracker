import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from config import settings

router = APIRouter(prefix="/contact", tags=["contact"])


class ContactForm(BaseModel):
    name: str
    email: EmailStr
    message: str


@router.post("/")
async def send_contact_email(form: ContactForm):
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[JobTracker Support] Message de {form.name}"
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = settings.SUPPORT_EMAIL
        msg["Reply-To"] = form.email

        html = f"""
        <html><body style="font-family: sans-serif; color: #333;">
          <h2 style="color: #c4a052;">Nouveau message de support</h2>
          <p><strong>Nom :</strong> {form.name}</p>
          <p><strong>Email :</strong> <a href="mailto:{form.email}">{form.email}</a></p>
          <hr style="border-color: #eee;" />
          <p><strong>Message :</strong></p>
          <blockquote style="border-left: 4px solid #c4a052; margin: 0; padding-left: 16px; color: #555;">
            {form.message.replace(chr(10), '<br>')}
          </blockquote>
          <hr style="border-color: #eee;" />
          <p style="font-size: 12px; color: #999;">Envoyé depuis le formulaire de support JobTracker</p>
        </body></html>
        """
        msg.attach(MIMEText(html, "html"))

        if settings.SMTP_SECURE:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, settings.SUPPORT_EMAIL, msg.as_string())
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, settings.SUPPORT_EMAIL, msg.as_string())

        return {"success": True}

    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=500, detail="SMTP authentication failed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
