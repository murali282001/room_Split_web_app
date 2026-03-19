# Import all models here so Alembic can detect them during autogenerate
from app.models.user import User
from app.models.otp_token import OTPToken
from app.models.session import Session
from app.models.group import Group
from app.models.role import Role
from app.models.membership import Membership
from app.models.rent_cycle import RentCycle
from app.models.rent_assignment import RentAssignment
from app.models.payment import Payment
from app.models.expense import Expense
from app.models.expense_split import ExpenseSplit
from app.models.wallet import GroupWallet
from app.models.wallet_transaction import WalletTransaction
from app.models.withdrawal import Withdrawal
from app.models.notification import Notification
from app.models.audit_log import AuditLog

__all__ = [
    "User",
    "OTPToken",
    "Session",
    "Group",
    "Role",
    "Membership",
    "RentCycle",
    "RentAssignment",
    "Payment",
    "Expense",
    "ExpenseSplit",
    "GroupWallet",
    "WalletTransaction",
    "Withdrawal",
    "Notification",
    "AuditLog",
]
