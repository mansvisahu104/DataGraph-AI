import pandas as pd
import numpy as np
from typing import Tuple, List, Dict, Any


def generate_profile(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Computes rigorous statistical profiling for a DataFrame using pure Pandas/NumPy.
    All outputs are explicitly converted to Python native primitives for JSON compliance.
    """
    total_rows = int(len(df))
    total_cols = int(len(df.columns))
    
    if total_rows == 0 or total_cols == 0:
        return {
            "overview": {
                "total_rows": 0,
                "total_columns": 0,
                "duplicate_rows": 0,
                "missing_cells": 0,
                "missing_percentage": 0.0,
                "memory_usage_kb": 0.0,
            },
            "numeric_summary": [],
            "categorical_summary": [],
            "missing_summary": []
        }

    duplicate_rows = int(df.duplicated().sum())
    missing_cells = int(df.isnull().sum().sum())
    total_cells = total_rows * total_cols
    missing_pct = round(float((missing_cells / total_cells) * 100), 2)
    mem_kb = round(float(df.memory_usage(deep=True).sum() / 1024), 2)

    overview = {
        "total_rows": total_rows,
        "total_columns": total_cols,
        "duplicate_rows": duplicate_rows,
        "missing_cells": missing_cells,
        "missing_percentage": missing_pct,
        "memory_usage_kb": mem_kb,
    }

    # Numeric summary
    numeric_summary = []
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    for col in num_cols:
        s = df[col].dropna()
        if not s.empty:
            q25 = float(s.quantile(0.25))
            q75 = float(s.quantile(0.75))
            numeric_summary.append({
                "column": str(col),
                "count": int(len(s)),
                "missing": int(df[col].isnull().sum()),
                "mean": round(float(s.mean()), 2),
                "median": round(float(s.median()), 2),
                "std": round(float(s.std()), 2) if len(s) > 1 else 0.0,
                "min": round(float(s.min()), 2),
                "max": round(float(s.max()), 2),
                "q25": round(q25, 2),
                "q75": round(q75, 2),
            })
        else:
            numeric_summary.append({
                "column": str(col),
                "count": 0,
                "missing": int(df[col].isnull().sum()),
                "mean": None,
                "median": None,
                "std": None,
                "min": None,
                "max": None,
                "q25": None,
                "q75": None,
            })

    # Categorical summary
    categorical_summary = []
    cat_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()
    for col in cat_cols:
        s = df[col].dropna()
        missing_count = int(df[col].isnull().sum())
        if not s.empty:
            mode_s = s.mode()
            top_val = str(mode_s.iloc[0]) if not mode_s.empty else None
            top_freq = int((s == mode_s.iloc[0]).sum()) if not mode_s.empty else 0
            categorical_summary.append({
                "column": str(col),
                "count": int(len(s)),
                "missing": missing_count,
                "unique": int(s.nunique()),
                "top_value": top_val,
                "top_frequency": top_freq,
            })
        else:
            categorical_summary.append({
                "column": str(col),
                "count": 0,
                "missing": missing_count,
                "unique": 0,
                "top_value": None,
                "top_frequency": 0,
            })

    # Missing summary breakdown
    missing_summary = []
    for col in df.columns:
        cnt = int(df[col].isnull().sum())
        if cnt > 0:
            missing_summary.append({
                "column": str(col),
                "missing_count": cnt,
                "missing_percentage": round(float((cnt / total_rows) * 100), 2)
            })

    return {
        "overview": overview,
        "numeric_summary": numeric_summary,
        "categorical_summary": categorical_summary,
        "missing_summary": missing_summary
    }


def clean_dataset(df: pd.DataFrame, operations: Dict[str, Any]) -> Tuple[pd.DataFrame, List[str]]:
    """
    Applies data cleaning and preprocessing actions sequentially.
    Returns (cleaned_df, changelog).
    """
    cleaned_df = df.copy()
    changelog = []

    # 1. Deduplication
    if operations.get("drop_duplicates", False):
        initial_len = len(cleaned_df)
        cleaned_df = cleaned_df.drop_duplicates()
        dropped = initial_len - len(cleaned_df)
        if dropped > 0:
            changelog.append(f"Removed {dropped} duplicate row(s)")
        else:
            changelog.append("No duplicate rows found")

    # 2. Drop Missing Rows
    if operations.get("drop_missing", False):
        initial_len = len(cleaned_df)
        subset = operations.get("drop_missing_columns")
        if subset and isinstance(subset, list) and len(subset) > 0:
            valid_cols = [c for c in subset if c in cleaned_df.columns]
            cleaned_df = cleaned_df.dropna(subset=valid_cols)
            dropped = initial_len - len(cleaned_df)
            changelog.append(f"Dropped {dropped} row(s) with missing values in {valid_cols}")
        else:
            cleaned_df = cleaned_df.dropna()
            dropped = initial_len - len(cleaned_df)
            changelog.append(f"Dropped {dropped} row(s) containing any missing values")

    # 3. Impute Missing Values
    impute_strategy = operations.get("impute_missing")
    if impute_strategy and impute_strategy in ["auto", "mean", "median", "mode", "custom"]:
        custom_num = operations.get("custom_numeric_fill", 0)
        custom_text = operations.get("custom_text_fill", "Unknown")

        for col in cleaned_df.columns:
            null_count = int(cleaned_df[col].isnull().sum())
            if null_count > 0:
                is_num = pd.api.types.is_numeric_dtype(cleaned_df[col])
                if is_num:
                    if impute_strategy == "mean":
                        fill_val = round(float(cleaned_df[col].mean()), 2)
                    elif impute_strategy in ["median", "auto"]:
                        fill_val = round(float(cleaned_df[col].median()), 2)
                    elif impute_strategy == "custom":
                        fill_val = float(custom_num)
                    else:
                        fill_val = round(float(cleaned_df[col].median()), 2)

                    cleaned_df[col] = cleaned_df[col].fillna(fill_val)
                    changelog.append(f"Filled {null_count} missing value(s) in numeric '{col}' with {fill_val}")
                else:
                    if impute_strategy in ["mode", "auto"]:
                        mode_s = cleaned_df[col].dropna().mode()
                        fill_val = str(mode_s.iloc[0]) if not mode_s.empty else custom_text
                    else:
                        fill_val = str(custom_text)

                    cleaned_df[col] = cleaned_df[col].fillna(fill_val)
                    changelog.append(f"Filled {null_count} missing value(s) in text '{col}' with '{fill_val}'")

    # 4. Standardize Column Headers
    if operations.get("standardize_headers", False):
        old_cols = list(cleaned_df.columns)
        new_cols = [str(c).strip().lower().replace(" ", "_") for c in old_cols]
        if new_cols != old_cols:
            cleaned_df.columns = new_cols
            changelog.append("Standardized column headers to lowercase snake_case")

    # 5. Drop Specified Columns
    columns_to_drop = operations.get("drop_columns", [])
    if columns_to_drop and isinstance(columns_to_drop, list):
        existing_to_drop = [c for c in columns_to_drop if c in cleaned_df.columns]
        if existing_to_drop:
            cleaned_df = cleaned_df.drop(columns=existing_to_drop)
            changelog.append(f"Dropped column(s): {', '.join(existing_to_drop)}")

    return cleaned_df, changelog
