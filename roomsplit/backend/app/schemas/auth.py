import re
from pydantic import BaseModel, field_validator


class OTPRequest(BaseModel):
    phone: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        pattern = r"^\+91[6-9]\d{9}$"
        if not re.match(pattern, v):
            raise ValueError(
                "Phone must be in E.164 format: +91 followed by a 10-digit Indian mobile number "
                "(starting with 6-9)"
            )
        return v


class OTPVerify(BaseModel):
    phone: str
    otp: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        pattern = r"^\+91[6-9]\d{9}$"
        if not re.match(pattern, v):
            raise ValueError("Phone must be in E.164 format: +91 followed by a 10-digit number")
        return v

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, v: str) -> str:
        if not re.match(r"^\d{6}$", v):
            raise ValueError("OTP must be a 6-digit number")
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    """Refresh token is read from httpOnly cookie — no body needed."""
    pass
