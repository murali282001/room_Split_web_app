"""Initial schema — all tables

Revision ID: 0001
Revises:
Create Date: 2026-03-19

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── ENUMS ──────────────────────────────────────────────────────────────────
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE cycletype_enum AS ENUM ('monthly', 'custom');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE cycle_status_enum AS ENUM ('draft', 'active', 'closed', 'cancelled');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE membership_status_enum AS ENUM ('active', 'suspended', 'left');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE split_type_enum AS ENUM ('equal', 'custom', 'percentage');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE payment_type_enum AS ENUM ('rent', 'expense', 'withdrawal');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE payment_status_enum AS ENUM ('pending', 'marked_paid', 'confirmed', 'rejected', 'expired');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE expense_split_type_enum AS ENUM ('equal', 'custom');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE expense_status_enum AS ENUM ('draft', 'active', 'settled');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE wallet_tx_type_enum AS ENUM ('credit', 'debit');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE withdrawal_status_enum AS ENUM ('pending', 'approved', 'rejected', 'completed');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)

    # ── USERS ──────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("phone", sa.String(15), nullable=False, unique=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("upi_id", sa.String(100), nullable=True),
        sa.Column("avatar_url", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_phone", "users", ["phone"], unique=True)

    # ── OTP TOKENS ─────────────────────────────────────────────────────────────
    op.create_table(
        "otp_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("phone", sa.String(15), nullable=False),
        sa.Column("otp_hash", sa.String(128), nullable=False),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_otp_tokens_phone", "otp_tokens", ["phone"])
    op.create_index("ix_otp_tokens_expires_at", "otp_tokens", ["expires_at"])

    # ── SESSIONS ───────────────────────────────────────────────────────────────
    op.create_table(
        "sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token_hash", sa.String(128), nullable=False, unique=True),
        sa.Column("device_info", postgresql.JSON, nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
    op.create_index("ix_sessions_token_hash", "sessions", ["token_hash"], unique=True)

    # ── GROUPS ─────────────────────────────────────────────────────────────────
    op.create_table(
        "groups",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("rent_collection_upi", sa.String(100), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("cycle_type", postgresql.ENUM(name="cycletype_enum", create_type=False), nullable=False, server_default="monthly"),
        sa.Column("cycle_day", sa.Integer, nullable=True),
        sa.Column("invite_code", sa.String(12), nullable=False, unique=True),
        sa.Column("invite_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("auto_confirm_payments", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_groups_invite_code", "groups", ["invite_code"], unique=True)
    op.create_index("ix_groups_created_by", "groups", ["created_by"])

    # ── ROLES ──────────────────────────────────────────────────────────────────
    op.create_table(
        "roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("groups.id"), nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("is_system", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("permissions", postgresql.JSON, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("group_id", "name", name="uq_role_group_name"),
    )
    op.create_index("ix_roles_group_id", "roles", ["group_id"])

    # ── MEMBERSHIPS ────────────────────────────────────────────────────────────
    op.create_table(
        "memberships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("groups.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("roles.id"), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("invited_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("status", postgresql.ENUM(name="membership_status_enum", create_type=False), nullable=False, server_default="active"),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("group_id", "user_id", name="uq_membership_group_user"),
    )
    op.create_index("ix_memberships_group_id", "memberships", ["group_id"])
    op.create_index("ix_memberships_user_id", "memberships", ["user_id"])
    op.create_index("ix_memberships_group_user", "memberships", ["group_id", "user_id"])

    # ── RENT CYCLES ────────────────────────────────────────────────────────────
    op.create_table(
        "rent_cycles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("groups.id"), nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("period_start", sa.Date, nullable=False),
        sa.Column("period_end", sa.Date, nullable=False),
        sa.Column("total_amount", sa.BigInteger, nullable=False),
        sa.Column("due_date", sa.Date, nullable=False),
        sa.Column("status", postgresql.ENUM(name="cycle_status_enum", create_type=False), nullable=False, server_default="draft"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("closed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_rent_cycles_group_id", "rent_cycles", ["group_id"])
    op.create_index("ix_rent_cycles_status", "rent_cycles", ["status"])
    op.create_index("ix_rent_cycles_group_status", "rent_cycles", ["group_id", "status"])

    # ── RENT ASSIGNMENTS ───────────────────────────────────────────────────────
    op.create_table(
        "rent_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("cycle_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rent_cycles.id"), nullable=False),
        sa.Column("member_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("assigned_amount", sa.BigInteger, nullable=False),
        sa.Column("split_type", postgresql.ENUM(name="split_type_enum", create_type=False), nullable=False, server_default="equal"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_rent_assignments_cycle_id", "rent_assignments", ["cycle_id"])
    op.create_index("ix_rent_assignments_member_id", "rent_assignments", ["member_id"])

    # ── PAYMENTS ───────────────────────────────────────────────────────────────
    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("groups.id"), nullable=False),
        sa.Column("cycle_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rent_cycles.id"), nullable=True),
        sa.Column("assignment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rent_assignments.id"), nullable=True),
        sa.Column("payer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("payee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("amount", sa.BigInteger, nullable=False),
        sa.Column("upi_ref", sa.String(100), nullable=True),
        sa.Column("payment_type", postgresql.ENUM(name="payment_type_enum", create_type=False), nullable=False, server_default="rent"),
        sa.Column("status", postgresql.ENUM(name="payment_status_enum", create_type=False), nullable=False, server_default="pending"),
        sa.Column("marked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirmed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejected_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("rejection_reason", sa.Text, nullable=True),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_payments_group_id", "payments", ["group_id"])
    op.create_index("ix_payments_cycle_id", "payments", ["cycle_id"])
    op.create_index("ix_payments_payer_id", "payments", ["payer_id"])
    op.create_index("ix_payments_status", "payments", ["status"])
    op.create_index("ix_payments_group_status", "payments", ["group_id", "status"])
    op.create_index("ix_payments_payer_status", "payments", ["payer_id", "status"])
    op.create_index("ix_payments_due_date", "payments", ["due_date"])

    # ── EXPENSES ───────────────────────────────────────────────────────────────
    op.create_table(
        "expenses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("groups.id"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("total_amount", sa.BigInteger, nullable=False),
        sa.Column("split_type", postgresql.ENUM(name="expense_split_type_enum", create_type=False), nullable=False, server_default="equal"),
        sa.Column("receipt_url", sa.Text, nullable=True),
        sa.Column("expense_date", sa.Date, nullable=False),
        sa.Column("status", postgresql.ENUM(name="expense_status_enum", create_type=False), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_expenses_group_id", "expenses", ["group_id"])
    op.create_index("ix_expenses_expense_date", "expenses", ["expense_date"])

    # ── EXPENSE SPLITS ─────────────────────────────────────────────────────────
    op.create_table(
        "expense_splits",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("expense_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("expenses.id"), nullable=False),
        sa.Column("member_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("owed_amount", sa.BigInteger, nullable=False),
        sa.Column("paid_amount", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("payment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("payments.id"), nullable=True),
        sa.Column("is_settled", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_expense_splits_expense_id", "expense_splits", ["expense_id"])
    op.create_index("ix_expense_splits_member_id", "expense_splits", ["member_id"])

    # ── GROUP WALLET ───────────────────────────────────────────────────────────
    op.create_table(
        "group_wallet",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("groups.id"), nullable=False, unique=True),
        sa.Column("balance", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("last_updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("version", sa.BigInteger, nullable=False, server_default="0"),
    )
    op.create_index("ix_group_wallet_group_id", "group_wallet", ["group_id"], unique=True)

    # ── WALLET TRANSACTIONS ────────────────────────────────────────────────────
    op.create_table(
        "wallet_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("groups.id"), nullable=False),
        sa.Column("payment_id", postgresql.UUID(as_uuid=True), nullable=True),   # denormalized
        sa.Column("withdrawal_id", postgresql.UUID(as_uuid=True), nullable=True), # denormalized
        sa.Column("transaction_type", postgresql.ENUM(name="wallet_tx_type_enum", create_type=False), nullable=False),
        sa.Column("amount", sa.BigInteger, nullable=False),
        sa.Column("balance_after", sa.BigInteger, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),  # denormalized
    )
    op.create_index("ix_wallet_transactions_group_id", "wallet_transactions", ["group_id"])
    op.create_index("ix_wallet_transactions_created_at", "wallet_transactions", ["created_at"])

    # ── WITHDRAWALS ────────────────────────────────────────────────────────────
    op.create_table(
        "withdrawals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("groups.id"), nullable=False),
        sa.Column("requested_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("amount", sa.BigInteger, nullable=False),
        sa.Column("destination_upi", sa.String(100), nullable=False),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("status", postgresql.ENUM(name="withdrawal_status_enum", create_type=False), nullable=False, server_default="pending"),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("upi_ref", sa.String(100), nullable=True),
        sa.Column("rejected_reason", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_withdrawals_group_id", "withdrawals", ["group_id"])
    op.create_index("ix_withdrawals_status", "withdrawals", ["status"])

    # ── NOTIFICATIONS ──────────────────────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=True),  # no FK intentionally
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("data", postgresql.JSON, nullable=False, server_default="{}"),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_is_read", "notifications", ["is_read"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])
    op.create_index("ix_notifications_user_unread", "notifications", ["user_id", "is_read"])

    # ── AUDIT LOGS ─────────────────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=True),    # no FK intentionally
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),    # no FK intentionally
        sa.Column("actor_phone", sa.String(15), nullable=True),
        sa.Column("actor_name", sa.String(100), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("before_state", postgresql.JSON, nullable=True),
        sa.Column("after_state", postgresql.JSON, nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.Text, nullable=True),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_audit_logs_group_id", "audit_logs", ["group_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_entity_type", "audit_logs", ["entity_type"])
    op.create_index("ix_audit_logs_entity_id", "audit_logs", ["entity_id"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])

    # PostgreSQL rules to make audit_logs immutable (no UPDATE or DELETE)
    op.execute(
        "CREATE RULE no_update_audit AS ON UPDATE TO audit_logs DO INSTEAD NOTHING"
    )
    op.execute(
        "CREATE RULE no_delete_audit AS ON DELETE TO audit_logs DO INSTEAD NOTHING"
    )


def downgrade() -> None:
    # Drop rules first
    op.execute("DROP RULE IF EXISTS no_update_audit ON audit_logs")
    op.execute("DROP RULE IF EXISTS no_delete_audit ON audit_logs")

    # Drop tables in reverse dependency order
    op.drop_table("audit_logs")
    op.drop_table("notifications")
    op.drop_table("withdrawals")
    op.drop_table("wallet_transactions")
    op.drop_table("group_wallet")
    op.drop_table("expense_splits")
    op.drop_table("expenses")
    op.drop_table("payments")
    op.drop_table("rent_assignments")
    op.drop_table("rent_cycles")
    op.drop_table("memberships")
    op.drop_table("roles")
    op.drop_table("groups")
    op.drop_table("sessions")
    op.drop_table("otp_tokens")
    op.drop_table("users")

    # Drop enums
    op.execute("DROP TYPE IF EXISTS withdrawal_status_enum")
    op.execute("DROP TYPE IF EXISTS wallet_tx_type_enum")
    op.execute("DROP TYPE IF EXISTS expense_status_enum")
    op.execute("DROP TYPE IF EXISTS expense_split_type_enum")
    op.execute("DROP TYPE IF EXISTS payment_status_enum")
    op.execute("DROP TYPE IF EXISTS payment_type_enum")
    op.execute("DROP TYPE IF EXISTS split_type_enum")
    op.execute("DROP TYPE IF EXISTS membership_status_enum")
    op.execute("DROP TYPE IF EXISTS cycle_status_enum")
    op.execute("DROP TYPE IF EXISTS cycletype_enum")
