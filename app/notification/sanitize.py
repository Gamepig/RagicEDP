"""
敏感資訊遮罩

防止 token、password、API key 等敏感資訊外洩到通知管道
"""
from typing import Any, Mapping, Optional, Sequence, Union
import re

# 敏感關鍵字（精確比對，避免過度遮罩）
SENSITIVE_KEYWORDS = frozenset({
    "password",
    "passwd",
    "secret",
    "token",
    "api_key",
    "apikey",
    "access_token",
    "refresh_token",
    "client_secret",
    "authorization",
    "auth_token",
    "credential",
    "private_key",
    "api_secret",
})

# 編譯正則表達式（效能優化）
_SENSITIVE_PATTERN = re.compile(
    r'(password|passwd|secret|token|api_key|apikey|auth|credential|bearer)[=:\s]+[^\s,;"\'\]]+',
    re.IGNORECASE
)
_JWT_PATTERN = re.compile(r'eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+')
_URL_AUTH_PATTERN = re.compile(r'://[^:]+:[^@]+@')


def _is_sensitive_key(key: str) -> bool:
    """檢查是否為敏感欄位名稱"""
    key_lower = key.lower().replace("-", "_").replace(" ", "_")
    return key_lower in SENSITIVE_KEYWORDS


def redact_value(value: Any, keep_chars: int = 2) -> str:
    """
    遮罩敏感值

    Args:
        value: 要遮罩的值
        keep_chars: 保留前後字元數

    Returns:
        遮罩後的字串
    """
    if value is None:
        return "***"

    s = str(value)
    if len(s) <= keep_chars * 2:
        return "***"

    return s[:keep_chars] + "***" + s[-keep_chars:]


def redact_mapping(data: Optional[Union[Mapping[str, Any], Any]]) -> Union[dict, list, Any]:
    """
    遮罩資料結構中的敏感欄位

    支援遞迴處理 dict、list、tuple

    Args:
        data: 要遮罩的資料

    Returns:
        遮罩後的資料
    """
    if data is None:
        return {}

    # 處理 Mapping（dict）
    if isinstance(data, Mapping):
        out: dict[str, Any] = {}
        for k, v in data.items():
            if _is_sensitive_key(str(k)):
                out[k] = redact_value(v)
            else:
                out[k] = redact_mapping(v)
        return out

    # 處理 Sequence（list/tuple），排除 str/bytes
    if isinstance(data, (list, tuple)) and not isinstance(data, (str, bytes)):
        return [redact_mapping(item) for item in data]

    # 其他型別直接返回
    return data


def redact_error_message(message: str, max_length: int = 200) -> str:
    """
    遮罩錯誤訊息中的敏感資訊

    Args:
        message: 錯誤訊息
        max_length: 最大長度

    Returns:
        遮罩後的訊息
    """
    if not message:
        return ""

    # [P0 Fix] 先遮罩，再截斷（避免截斷邊界殘留敏感資訊）
    result = message

    # 遮罩敏感模式
    result = _SENSITIVE_PATTERN.sub(r'\1=***', result)

    # 遮罩 JWT Token
    result = _JWT_PATTERN.sub('***JWT***', result)

    # 遮罩 URL 中的認證資訊
    result = _URL_AUTH_PATTERN.sub('://***:***@', result)

    # [P0 Fix] 遮罩長字串（可能是未被上述模式捕捉到的 token）
    # 長度 > 32 且不含空白的連續字串，可能是 API key 或 token
    result = _LONG_TOKEN_PATTERN.sub(_redact_long_token, result)

    # 最後才截斷
    if len(result) > max_length:
        result = result[:max_length] + "..."

    return result


# [P0 Fix] 長 token 模式（連續 32+ 字元的字母數字字串）
_LONG_TOKEN_PATTERN = re.compile(r'[A-Za-z0-9_\-]{32,}')


def _redact_long_token(match: re.Match) -> str:
    """遮罩長 token，保留前後各 4 字元"""
    token = match.group(0)
    if len(token) > 8:
        return token[:4] + "***" + token[-4:]
    return "***"
