"""
pytest fixtures for RoomSplit backend tests.

Uses an in-memory SQLite async session for speed.
For integration tests requiring PostgreSQL-specific features (UUID native type,
advisory locks, JSONB), set TEST_DATABASE_URL to a real postgres instance.
"""
import asyncio
import uuid
import secrets
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
)

from app.database import Base, get_db
from app.models import (  # noqa: F401 — ensures all models are registered
    User,
    OTPToken,
    Session,
    Group,
    Role,
    Membership,
    RentCycle,
    RentAssignment,
    Payment,
    Expense,
    ExpenseSplit,
    GroupWallet,
    WalletTransaction,
    Withdrawal,
    Notification,
    AuditLog,
)
from app.main import app
from app.utils.security import create_access_token, hash_token, create_refresh_token
from datetime import datetime, timezone, timedelta

# Use in-memory SQLite for tests (no PostgreSQL needed for unit tests)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_test_tables():
    """Create all tables once per test session using the test engine."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def test_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield a transactional test AsyncSession that rolls back after each test."""
    async with TestSessionLocal() as session:
        try:
            yield session
        finally:
            await session.rollback()
            await session.close()


@pytest_asyncio.fixture
async def client(test_db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """FastAPI TestClient using ASGI transport, with DB dependency overridden."""

    async def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_user(test_db: AsyncSession) -> User:
    """A pre-created active User fixture."""
    user = User(
        id=uuid.uuid4(),
        phone="+919876543210",
        name="Test User",
        upi_id="testuser@upi",
        is_active=True,
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_group(test_db: AsyncSession, test_user: User) -> Group:
    """
    A pre-created Group fixture with test_user as admin.
    Also creates system roles, membership, and wallet.
    """
    from app.services.rbac_service import seed_system_roles

    group = Group(
        id=uuid.uuid4(),
        name="Test Group",
        description="Test group for unit tests",
        created_by=test_user.id,
        rent_collection_upi="testgroup@upi",
        currency="INR",
        cycle_type="monthly",
        invite_code=secrets.token_urlsafe(8)[:12],
    )
    test_db.add(group)
    await test_db.flush()

    role_ids = await seed_system_roles(group.id, test_db)

    membership = Membership(
        group_id=group.id,
        user_id=test_user.id,
        role_id=role_ids["admin"],
        status="active",
    )
    test_db.add(membership)

    wallet = GroupWallet(
        group_id=group.id,
        balance=0,
        last_updated_at=datetime.now(timezone.utc),
        version=0,
    )
    test_db.add(wallet)

    await test_db.commit()
    await test_db.refresh(group)
    return group


@pytest_asyncio.fixture
async def auth_headers(test_user: User) -> dict:
    """Authorization headers with a valid access token for test_user."""
    token = create_access_token(str(test_user.id))
    return {"Authorization": f"Bearer {token}"}
