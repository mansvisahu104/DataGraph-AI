from fastapi import FastAPI, UploadFile, File, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import pandas as pd
import json
import uuid
import io
import os

from parsers import parse_document
from cleaning import generate_profile, clean_dataset
from visualizations import get_recommended_charts, generate_chart_spec
from ai_agent import query_ai_agent

app = FastAPI(
    title="DataGraph AI API",
    description="Agentic data analytics backend for document-to-visualization, cleaning, and natural language querying",
    version="0.5.0"
)

# Robust CORS setup allowing Vite dev server and Google Cloud Run deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory Dataset Session Store
# dataset_id -> {"df": pd.DataFrame, "original_df": pd.DataFrame, "filename": str, "format": str, "metadata": dict}
DATASET_STORE: Dict[str, Dict[str, Any]] = {}


def get_column_type_mapping(df: pd.DataFrame) -> Dict[str, str]:
    """Maps dtypes to clean, user-facing labels."""
    type_mapping = {}
    for col, dtype in df.dtypes.items():
        dtype_str = str(dtype).lower()
        if "int" in dtype_str:
            type_mapping[str(col)] = "integer"
        elif "float" in dtype_str:
            type_mapping[str(col)] = "numeric"
        elif "date" in dtype_str or "time" in dtype_str:
            type_mapping[str(col)] = "datetime"
        elif "bool" in dtype_str:
            type_mapping[str(col)] = "boolean"
        else:
            type_mapping[str(col)] = "text"
    return type_mapping


class CleanRequest(BaseModel):
    dataset_id: str
    operations: Dict[str, Any]


class VisualizeRequest(BaseModel):
    dataset_id: str
    config: Dict[str, Any]


class ChatRequest(BaseModel):
    dataset_id: str
    message: str
    api_key: Optional[str] = None


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "message": "DataGraph AI Backend is running!",
        "version": "0.5.0",
        "supported_formats": [".csv", ".xlsx", ".xls", ".pdf", ".docx"],
        "active_datasets": len(DATASET_STORE)
    }


@app.get("/api/info")
def api_info():
    return {
        "status": "online",
        "message": "DataGraph AI Backend is running!",
        "version": "0.5.0",
        "supported_formats": [".csv", ".xlsx", ".xls", ".pdf", ".docx"],
        "active_datasets": len(DATASET_STORE)
    }


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    filename = file.filename
    lower_name = filename.lower()
    allowed_extensions = (".csv", ".xlsx", ".xls", ".pdf", ".docx", ".doc")

    if not lower_name.endswith(allowed_extensions):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file '{filename}'. "
                "Supported formats are: CSV (.csv), Excel (.xlsx, .xls), PDF (.pdf), Word (.docx)"
            )
        )

    try:
        contents = await file.read()
        if not contents or len(contents) == 0:
            raise HTTPException(
                status_code=400,
                detail=f"The uploaded file '{filename}' is empty (0 bytes)."
            )

        # Parse document into DataFrame using specialized format parsers
        df, meta = parse_document(filename, contents)

        if df.empty or len(df.columns) == 0:
            raise HTTPException(
                status_code=400,
                detail=f"No tabular data rows or columns could be extracted from '{filename}'."
            )

        # Generate unique session dataset ID
        dataset_id = str(uuid.uuid4())
        DATASET_STORE[dataset_id] = {
            "df": df.copy(),
            "original_df": df.copy(),
            "filename": filename,
            "format": meta.get("format", "unknown"),
            "metadata": meta,
        }

        # Safely convert NaN / Inf to null for standard JSON compliance
        preview_records = json.loads(df.head(100).to_json(orient="records"))
        type_mapping = get_column_type_mapping(df)
        profile = generate_profile(df)
        recommendations = get_recommended_charts(df)

        default_chart = None
        default_insight = ""
        if recommendations:
            try:
                default_chart, default_insight = generate_chart_spec(df, recommendations[0])
            except Exception:
                pass

        return {
            "dataset_id": dataset_id,
            "filename": filename,
            "format": meta.get("format", "unknown"),
            "rows": int(len(df)),
            "columns": [str(c) for c in df.columns],
            "column_types": type_mapping,
            "metadata": meta,
            "preview_count": len(preview_records),
            "data": preview_records,
            "profile": profile,
            "recommendations": recommendations,
            "current_chart": default_chart,
            "chart_insights": default_insight
        }

    except HTTPException:
        raise
    except ValueError as val_err:
        raise HTTPException(
            status_code=400,
            detail=str(val_err)
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Document parsing error for '{filename}': {str(exc)}"
        )


@app.post("/clean")
async def clean_data(req: CleanRequest):
    """
    Applies data cleaning and preprocessing operations on the active dataset.
    """
    dataset_id = req.dataset_id
    if dataset_id not in DATASET_STORE:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found or session has expired. Please re-upload your document."
        )

    stored = DATASET_STORE[dataset_id]
    current_df = stored["df"]

    try:
        cleaned_df, changelog = clean_dataset(current_df, req.operations)
        stored["df"] = cleaned_df

        preview_records = json.loads(cleaned_df.head(100).to_json(orient="records"))
        type_mapping = get_column_type_mapping(cleaned_df)
        updated_profile = generate_profile(cleaned_df)
        recommendations = get_recommended_charts(cleaned_df)

        default_chart = None
        default_insight = ""
        if recommendations:
            try:
                default_chart, default_insight = generate_chart_spec(cleaned_df, recommendations[0])
            except Exception:
                pass

        return {
            "dataset_id": dataset_id,
            "filename": stored["filename"],
            "format": stored["format"],
            "rows": int(len(cleaned_df)),
            "columns": [str(c) for c in cleaned_df.columns],
            "column_types": type_mapping,
            "preview_count": len(preview_records),
            "data": preview_records,
            "profile": updated_profile,
            "recommendations": recommendations,
            "current_chart": default_chart,
            "chart_insights": default_insight,
            "changelog": changelog
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Data cleaning error: {str(exc)}"
        )


@app.post("/reset/{dataset_id}")
async def reset_data(dataset_id: str):
    """Restores the dataset back to its original uploaded state."""
    if dataset_id not in DATASET_STORE:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found. Please upload a file."
        )

    stored = DATASET_STORE[dataset_id]
    stored["df"] = stored["original_df"].copy()
    restored_df = stored["df"]

    preview_records = json.loads(restored_df.head(100).to_json(orient="records"))
    type_mapping = get_column_type_mapping(restored_df)
    profile = generate_profile(restored_df)
    recommendations = get_recommended_charts(restored_df)

    default_chart = None
    default_insight = ""
    if recommendations:
        try:
            default_chart, default_insight = generate_chart_spec(restored_df, recommendations[0])
        except Exception:
            pass

    return {
        "dataset_id": dataset_id,
        "filename": stored["filename"],
        "rows": int(len(restored_df)),
        "columns": [str(c) for c in restored_df.columns],
        "column_types": type_mapping,
        "preview_count": len(preview_records),
        "data": preview_records,
        "profile": profile,
        "recommendations": recommendations,
        "current_chart": default_chart,
        "chart_insights": default_insight,
        "message": "Dataset successfully reset to original state."
    }


@app.get("/download/{dataset_id}")
async def download_cleaned(dataset_id: str):
    """Streams the cleaned dataset as a CSV file attachment."""
    if dataset_id not in DATASET_STORE:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found or session has expired."
        )

    stored = DATASET_STORE[dataset_id]
    df = stored["df"]
    clean_filename = f"cleaned_{stored['filename'].rsplit('.', 1)[0]}.csv"

    stream = io.StringIO()
    df.to_csv(stream, index=False)
    stream.seek(0)

    response = StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv"
    )
    response.headers["Content-Disposition"] = f"attachment; filename={clean_filename}"
    return response


@app.get("/visualize/recommendations/{dataset_id}")
async def get_chart_recommendations(dataset_id: str):
    """Returns tailored chart recommendations for the current dataset."""
    if dataset_id not in DATASET_STORE:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    df = DATASET_STORE[dataset_id]["df"]
    return {
        "dataset_id": dataset_id,
        "recommendations": get_recommended_charts(df)
    }


@app.post("/visualize")
async def create_visualization(req: VisualizeRequest):
    """
    Renders an interactive Plotly specification with automated data insights.
    """
    dataset_id = req.dataset_id
    if dataset_id not in DATASET_STORE:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    df = DATASET_STORE[dataset_id]["df"]

    try:
        plotly_spec, insights = generate_chart_spec(df, req.config)
        return {
            "dataset_id": dataset_id,
            "plotly_spec": plotly_spec,
            "insights": insights
        }
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Visualization rendering error: {str(exc)}"
        )


@app.post("/chat")
async def chat_with_agent(req: ChatRequest):
    """
    Natural Language Query & AI Agent execution endpoint.
    Translates questions into Pandas operations and Plotly visualizations.
    """
    dataset_id = req.dataset_id
    if dataset_id not in DATASET_STORE:
        raise HTTPException(status_code=404, detail="Dataset not found or session expired.")

    df = DATASET_STORE[dataset_id]["df"]

    try:
        result = query_ai_agent(df, req.message, api_key=req.api_key)
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"AI Agent query error: {str(exc)}"
        )


# ========================================================
# PRODUCTION STATIC ASSETS & SPA ROUTING (Google Cloud Run)
# ========================================================
STATIC_DIR = os.environ.get("STATIC_DIR", os.path.join(os.path.dirname(__file__), "static"))
if not os.path.exists(STATIC_DIR):
    alt_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend-app", "dist"))
    if os.path.exists(alt_dist):
        STATIC_DIR = alt_dist

if os.path.exists(STATIC_DIR):
    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str = ""):
        # Pass-through for reserved API endpoints and docs
        first_segment = full_path.strip("/").split("/")[0] if full_path else ""
        if first_segment in ["upload", "clean", "visualize", "chat", "download", "reset", "health", "api", "docs", "openapi.json", "redoc"]:
            raise HTTPException(status_code=404, detail="API route not found")

        file_path = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)

        index_file = os.path.join(STATIC_DIR, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Frontend index not found")
else:
    @app.get("/")
    def home_fallback():
        return {
            "status": "online",
            "message": "DataGraph AI Backend is running!",
            "version": "0.5.0",
            "active_datasets": len(DATASET_STORE)
        }

