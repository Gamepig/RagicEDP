"""
星狀模型 API

提供 Mermaid 圖表和統計資訊
"""
from functools import lru_cache
from typing import Dict, Literal, Optional
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from ..services.schema_generator import StarSchemaGenerator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/schema", tags=["schema"])

# 使用 Literal 型別約束 level 參數
Level = Literal["overview", "detailed"]


@lru_cache(maxsize=1)
def get_generator() -> StarSchemaGenerator:
    """取得星狀模型生成器（使用 lru_cache 單例模式）"""
    return StarSchemaGenerator()


class MermaidResponse(BaseModel):
    """Mermaid 回應"""
    mermaid: str
    level: str


class TableStats(BaseModel):
    """表格統計"""
    name: str
    count: int
    error: Optional[str] = None


class SchemaStats(BaseModel):
    """星狀模型統計"""
    fact_tables: Dict[str, TableStats]
    dim_tables: Dict[str, TableStats]
    total_records: int
    total_tables: int


@router.get("/mermaid", response_model=MermaidResponse)
async def get_mermaid_code(
    level: Level = Query("overview", description="詳細程度: overview 或 detailed"),
    generator: StarSchemaGenerator = Depends(get_generator),
):
    """
    取得 Mermaid 程式碼

    - **level**: overview（概覽）或 detailed（詳細）
    """
    mermaid_code = generator.generate_mermaid(level)
    return MermaidResponse(mermaid=mermaid_code, level=level)


@router.get("/stats", response_model=SchemaStats)
async def get_schema_stats(
    generator: StarSchemaGenerator = Depends(get_generator),
):
    """取得星狀模型統計資訊"""
    try:
        stats = generator.generate_stats()
        # 轉換為 TableStats 型別
        return SchemaStats(
            fact_tables={k: TableStats(**v) for k, v in stats["fact_tables"].items()},
            dim_tables={k: TableStats(**v) for k, v in stats["dim_tables"].items()},
            total_records=stats["total_records"],
            total_tables=stats["total_tables"],
        )
    except Exception:
        logger.exception("取得統計失敗")
        # 返回 503 讓呼叫端知道是服務問題
        raise HTTPException(status_code=503, detail="BigQuery 統計服務暫時無法使用")


@router.get("/diagram", response_class=HTMLResponse)
async def get_diagram_html(
    level: Level = Query("overview", description="詳細程度"),
    generator: StarSchemaGenerator = Depends(get_generator),
):
    """
    取得互動式圖表 HTML 頁面

    可直接在瀏覽器中開啟查看星狀模型圖
    """
    html = generator.generate_html(level)
    return HTMLResponse(content=html)
