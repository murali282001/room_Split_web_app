"""
Seed script: creates test data for development.

Creates:
  - 3 users: Alice (+919876543210), Bob (+919876543211), Charlie (+919876543212)
  - 1 group: "Sunrise Apartments" with Alice as admin, Bob and Charlie as members
  - 1 active rent cycle for current month (₹30,000 total = ₹10,000 each)
  - Pending payments for Bob and Charlie (Alice pays too, for completeness)

Run with:
    cd backend
    python -m scripts.seed_dev_data
"""
import asyncio
import secrets
import uuid
from datetime import datetime, timezone, date
from calendar import monthrange

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.config import settings
from app.database import Base
from app.models import (  # noqa: F401
    User, Group, Role, Membership, GroupWallet,
    RentCycle, RentAssignment, Payment
)
from app.services.rbac_service import seed_system_roles, SYSTEM_PERMISSIONS
from app.models.role import Role as RoleModel
from app.models.membership import Membership as MembershipModel


engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSession = async_sessionmaker(engine, expire_on_commit=False)


def current_month_range():
    today = date.today()
    first = today.replace(day=1)
    last_day = monthrange(today.year, today.month)[1]
    last = today.replace(day=last_day)
    return first, last


async def seed():
    async with AsyncSession() as db:
        print("=" * 60)
        print("RoomSplit Dev Seed Script")
        print("=" * 60)

        # ── Create Users ────────────────────────────────────────────
        alice = User(
            id=uuid.uuid4(),
            phone="+919876543210",
            name="Alice",
            upi_id="alice@upi",
            is_active=True,
        )
        bob = User(
            id=uuid.uuid4(),
            phone="+919876543211",
            name="Bob",
            upi_id="bob@upi",
            is_active=True,
        )
        charlie = User(
            id=uuid.uuid4(),
            phone="+919876543212",
            name="Charlie",
            upi_id="charlie@upi",
            is_active=True,
        )

        db.add_all([alice, bob, charlie])
        await db.flush()

        print(f"\nUsers created:")
        print(f"  Alice   — ID: {alice.id}   Phone: {alice.phone}")
        print(f"  Bob     — ID: {bob.id}   Phone: {bob.phone}")
        print(f"  Charlie — ID: {charlie.id}   Phone: {charlie.phone}")

        # ── Create Group ────────────────────────────────────────────
        invite_code = secrets.token_urlsafe(8)[:12]
        group = Group(
            id=uuid.uuid4(),
            name="Sunrise Apartments",
            description="Our cozy apartment in the heart of the city",
            created_by=alice.id,
            rent_collection_upi="sunriseapts@upi",
            currency="INR",
            cycle_type="monthly",
            cycle_day=1,
            invite_code=invite_code,
            is_active=True,
            auto_confirm_payments=False,
        )
        db.add(group)
        await db.flush()

        print(f"\nGroup created:")
        print(f"  Name:        {group.name}")
        print(f"  ID:          {group.id}")
        print(f"  Invite Code: {group.invite_code}")

        # ── Seed Roles ──────────────────────────────────────────────
        role_ids = await seed_system_roles(group.id, db)
        print(f"\nSystem roles created:")
        for role_name, role_id in role_ids.items():
            print(f"  {role_name:10s} — ID: {role_id}")

        # ── Create Memberships ──────────────────────────────────────
        alice_membership = MembershipModel(
            group_id=group.id,
            user_id=alice.id,
            role_id=role_ids["admin"],
            status="active",
        )
        bob_membership = MembershipModel(
            group_id=group.id,
            user_id=bob.id,
            role_id=role_ids["member"],
            status="active",
        )
        charlie_membership = MembershipModel(
            group_id=group.id,
            user_id=charlie.id,
            role_id=role_ids["member"],
            status="active",
        )
        db.add_all([alice_membership, bob_membership, charlie_membership])

        # ── Create Group Wallet ─────────────────────────────────────
        wallet = GroupWallet(
            group_id=group.id,
            balance=0,
            last_updated_at=datetime.now(timezone.utc),
            version=0,
        )
        db.add(wallet)
        await db.flush()

        print(f"\nMemberships created:")
        print(f"  Alice   → admin")
        print(f"  Bob     → member")
        print(f"  Charlie → member")

        # ── Create Rent Cycle ────────────────────────────────────────
        period_start, period_end = current_month_range()
        today = date.today()
        due_date = period_end  # Due at month end

        total_paise = 3_000_000  # ₹30,000 in paise
        per_person_paise = 1_000_000  # ₹10,000 each

        cycle = RentCycle(
            id=uuid.uuid4(),
            group_id=group.id,
            label=f"Rent — {period_start.strftime('%B %Y')}",
            period_start=period_start,
            period_end=period_end,
            total_amount=total_paise,
            due_date=due_date,
            status="active",
            created_by=alice.id,
            notes="Monthly apartment rent",
        )
        db.add(cycle)
        await db.flush()

        print(f"\nRent cycle created:")
        print(f"  ID:           {cycle.id}")
        print(f"  Label:        {cycle.label}")
        print(f"  Period:       {period_start} to {period_end}")
        print(f"  Total:        ₹{total_paise/100:,.2f}")
        print(f"  Due date:     {due_date}")
        print(f"  Status:       {cycle.status}")

        # ── Create Rent Assignments ──────────────────────────────────
        assignments = []
        for member in [alice, bob, charlie]:
            assignment = RentAssignment(
                id=uuid.uuid4(),
                cycle_id=cycle.id,
                member_id=member.id,
                assigned_amount=per_person_paise,
                split_type="equal",
            )
            db.add(assignment)
            await db.flush()
            assignments.append((member, assignment))

        # ── Create Payments ──────────────────────────────────────────
        print(f"\nPayments created:")
        payment_ids = {}
        for member, assignment in assignments:
            payment = Payment(
                id=uuid.uuid4(),
                group_id=group.id,
                cycle_id=cycle.id,
                assignment_id=assignment.id,
                payer_id=member.id,
                payee_id=alice.id,
                amount=per_person_paise,
                payment_type="rent",
                status="pending",
                due_date=due_date,
            )
            db.add(payment)
            payment_ids[member.name] = payment.id
            print(f"  {member.name:10s} — ID: {payment.id} | Amount: ₹{per_person_paise/100:,.2f} | Status: pending")

        await db.commit()

        # ── Summary ──────────────────────────────────────────────────
        print("\n" + "=" * 60)
        print("SEED COMPLETE — Reference IDs")
        print("=" * 60)
        print(f"\nUSERS:")
        print(f"  alice_id   = \"{alice.id}\"")
        print(f"  bob_id     = \"{bob.id}\"")
        print(f"  charlie_id = \"{charlie.id}\"")
        print(f"\nGROUP:")
        print(f"  group_id   = \"{group.id}\"")
        print(f"  invite_code = \"{group.invite_code}\"")
        print(f"\nRENT CYCLE:")
        print(f"  cycle_id   = \"{cycle.id}\"")
        print(f"\nPAYMENTS:")
        for name, pid in payment_ids.items():
            print(f"  {name.lower()}_payment_id = \"{pid}\"")
        print("\nDone! Run 'alembic upgrade head' before seeding if tables don't exist.")


if __name__ == "__main__":
    asyncio.run(seed())
