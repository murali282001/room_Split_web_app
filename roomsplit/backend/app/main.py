from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.config import settings
from app.routers import (
    auth,
    groups,
    memberships,
    rent,
    payments,
    wallet,
    withdrawals,
    notifications,
    audit,
    analytics,
    expenses,
)

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="RoomSplit — Rent splitting and expense management for roommates",
    docs_url="/docs" if settings.APP_ENV != "production" else None,
    redoc_url="/redoc" if settings.APP_ENV != "production" else None,
    redirect_slashes=False,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Custom exception handlers for consistent error format
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # exc.errors() may include non-serializable objects (e.g. ValueError) in ctx.
    # Stringify ctx values so JSONResponse never crashes.
    clean_errors = []
    for error in exc.errors():
        clean = dict(error)
        if "ctx" in clean:
            clean["ctx"] = {k: str(v) for k, v in clean["ctx"].items()}
        clean_errors.append(clean)
    # Surface the first error message as the top-level detail for easy frontend display
    first_msg = clean_errors[0]["msg"] if clean_errors else "Validation error"
    return JSONResponse(
        status_code=422,
        content={"detail": first_msg, "errors": clean_errors, "code": "validation_error"},
    )


# Include all routers
app.include_router(auth.router)
app.include_router(groups.router)
app.include_router(memberships.router)
app.include_router(rent.router)
app.include_router(payments.router)
app.include_router(wallet.router)
app.include_router(withdrawals.router)
app.include_router(notifications.router)
app.include_router(audit.router)
app.include_router(analytics.router)
app.include_router(expenses.router)


@app.get("/health", tags=["Health"])
async def health():
    """Health check endpoint."""
    return {"status": "ok", "app": settings.APP_NAME, "version": "1.0.0"}


@app.get("/", tags=["Root"])
async def root():
    return {"message": f"Welcome to {settings.APP_NAME} API", "docs": "/docs"}
