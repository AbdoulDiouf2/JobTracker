"""
Utilitaire d'envoi d'emails pour JobTracker.
"""
import smtplib
import ssl
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from config import settings

logger = logging.getLogger(__name__)


def _send_email(to: str, subject: str, html: str) -> bool:
    """Envoie un email HTML. Retourne True si succès."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = to
        msg.attach(MIMEText(html, "html"))

        if settings.SMTP_SECURE:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD_APP)
                server.sendmail(settings.SMTP_FROM_EMAIL, to, msg.as_string())
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD_APP)
                server.sendmail(settings.SMTP_FROM_EMAIL, to, msg.as_string())

        return True
    except Exception as e:
        logger.error(f"Erreur envoi email à {to}: {e}")
        return False


def send_password_reset_email(to: str, full_name: str, reset_url: str) -> bool:
    subject = "Réinitialisation de votre mot de passe JobTracker"
    html = f"""
    <html><body style="font-family: 'Plus Jakarta Sans', sans-serif; background: #020817; color: #e2e8f0; padding: 32px;">
      <div style="max-width: 520px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 40px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #c4a052; font-size: 24px; margin: 0;">JobTracker</h1>
        </div>
        <h2 style="color: #f1f5f9; font-size: 20px; margin-bottom: 8px;">Réinitialisation du mot de passe</h2>
        <p style="color: #94a3b8; margin-bottom: 24px;">Bonjour {full_name},</p>
        <p style="color: #94a3b8; margin-bottom: 24px;">
          Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous.
          Ce lien expire dans <strong style="color: #f1f5f9;">1 heure</strong>.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="{reset_url}"
             style="background: #c4a052; color: #020817; padding: 14px 32px; border-radius: 10px;
                    text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block;">
            Réinitialiser mon mot de passe
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
          Si vous n'avez pas fait cette demande, ignorez cet email. Votre mot de passe ne sera pas modifié.
        </p>
        <hr style="border-color: #1e293b; margin: 24px 0;" />
        <p style="color: #475569; font-size: 12px; text-align: center;">
          JobTracker — Votre agent de carrière personnel
        </p>
      </div>
    </body></html>
    """
    return _send_email(to, subject, html)


def send_email_verification(to: str, full_name: str, verify_url: str) -> bool:
    subject = "Vérifiez votre adresse email — JobTracker"
    html = f"""
    <html><body style="font-family: 'Plus Jakarta Sans', sans-serif; background: #020817; color: #e2e8f0; padding: 32px;">
      <div style="max-width: 520px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 40px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #c4a052; font-size: 24px; margin: 0;">JobTracker</h1>
        </div>
        <h2 style="color: #f1f5f9; font-size: 20px; margin-bottom: 8px;">Confirmez votre email</h2>
        <p style="color: #94a3b8; margin-bottom: 24px;">Bienvenue, {full_name} !</p>
        <p style="color: #94a3b8; margin-bottom: 24px;">
          Pour activer votre compte, veuillez confirmer votre adresse email en cliquant ci-dessous.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="{verify_url}"
             style="background: #c4a052; color: #020817; padding: 14px 32px; border-radius: 10px;
                    text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block;">
            Vérifier mon email
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
          Ce lien expire dans 24 heures. Si vous n'avez pas créé de compte, ignorez cet email.
        </p>
        <hr style="border-color: #1e293b; margin: 24px 0;" />
        <p style="color: #475569; font-size: 12px; text-align: center;">
          JobTracker — Votre agent de carrière personnel
        </p>
      </div>
    </body></html>
    """
    return _send_email(to, subject, html)
