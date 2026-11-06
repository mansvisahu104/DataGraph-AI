import io
import pandas as pd
import pdfplumber
from docx import Document
from typing import Tuple, Dict, Any


def try_convert_numeric(df: pd.DataFrame) -> pd.DataFrame:
    """Safely infer numeric columns without crashing on Pandas 3.0+."""
    for col in df.columns:
        try:
            df[col] = pd.to_numeric(df[col])
        except (ValueError, TypeError):
            pass
    return df


def parse_csv(contents: bytes) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """Parse CSV with automatic encoding detection (utf-8, utf-8-sig, latin-1)."""
    encodings = ["utf-8", "utf-8-sig", "latin-1", "cp1252"]
    last_err = None

    for enc in encodings:
        try:
            df = pd.read_csv(io.BytesIO(contents), encoding=enc)
            return df, {"format": "csv", "encoding": enc}
        except Exception as e:
            last_err = e

    raise ValueError(f"Failed to parse CSV with supported encodings: {last_err}")


def parse_excel(contents: bytes) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """Parse Excel (.xlsx, .xls) workbook, extracting the first sheet and listing all sheets."""
    excel_file = pd.ExcelFile(io.BytesIO(contents))
    sheet_names = excel_file.sheet_names

    if not sheet_names:
        raise ValueError("Excel file contains no visible worksheets.")

    # Read the active/first sheet
    df = excel_file.parse(sheet_names[0])
    
    # Clean whitespace in column names if string
    df.columns = [str(c).strip() for c in df.columns]

    return df, {
        "format": "excel",
        "active_sheet": sheet_names[0],
        "available_sheets": sheet_names,
    }


def parse_pdf(contents: bytes) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Extract structured tabular data from PDF pages using pdfplumber.
    Concatenates tables across pages with matching header schemas.
    """
    with pdfplumber.open(io.BytesIO(contents)) as pdf:
        all_tables = []
        page_count = len(pdf.pages)

        for page in pdf.pages:
            extracted_tables = page.extract_tables()
            for t in extracted_tables:
                if t and len(t) > 1:  # Table must have at least a header row + 1 data row
                    all_tables.append(t)

        if not all_tables:
            raise ValueError(
                "No structured tabular data found in PDF. "
                "Ensure the PDF contains identifiable table borders or columnar data."
            )

        # Primary table header
        first_table = all_tables[0]
        headers = [
            str(c).replace("\n", " ").strip() if c is not None else f"col_{idx+1}"
            for idx, c in enumerate(first_table[0])
        ]
        
        # Deduplicate empty or duplicate header names
        seen = {}
        unique_headers = []
        for h in headers:
            base = h if h else "Column"
            if base in seen:
                seen[base] += 1
                unique_headers.append(f"{base}_{seen[base]}")
            else:
                seen[base] = 0
                unique_headers.append(base)

        combined_rows = []
        for t in all_tables:
            # First row of first table is header; subsequent tables might repeat header or continue data
            start_row = 1 if t == first_table else (
                1 if [str(c).replace("\n", " ").strip() for c in t[0]] == headers else 0
            )
            for row in t[start_row:]:
                # Normalize row length to header length
                row_cleaned = [
                    str(c).replace("\n", " ").strip() if c is not None else None
                    for c in row
                ]
                if len(row_cleaned) < len(unique_headers):
                    row_cleaned += [None] * (len(unique_headers) - len(row_cleaned))
                elif len(row_cleaned) > len(unique_headers):
                    row_cleaned = row_cleaned[:len(unique_headers)]
                
                # Filter out entirely empty rows
                if any(cell not in (None, "") for cell in row_cleaned):
                    combined_rows.append(row_cleaned)

        if not combined_rows:
            raise ValueError("Found table outline in PDF but no data rows were present.")

        df = pd.DataFrame(combined_rows, columns=unique_headers)
        df = try_convert_numeric(df)

        return df, {
            "format": "pdf",
            "page_count": page_count,
            "tables_extracted": len(all_tables),
        }


def parse_docx(contents: bytes) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """Extract tabular data from Word (.docx) documents."""
    doc = Document(io.BytesIO(contents))
    tables = doc.tables

    if not tables:
        raise ValueError("No tables found in this Word (.docx) document.")

    # Target first table with data
    target_table = None
    for t in tables:
        if len(t.rows) >= 2:
            target_table = t
            break

    if not target_table:
        raise ValueError("Tables exist in the document, but none contain header and row records.")

    # Extract header from first row
    headers = [cell.text.strip() for cell in target_table.rows[0].cells]
    
    # Deduplicate headers
    seen = {}
    unique_headers = []
    for idx, h in enumerate(headers):
        base = h if h else f"Column_{idx+1}"
        if base in seen:
            seen[base] += 1
            unique_headers.append(f"{base}_{seen[base]}")
        else:
            seen[base] = 0
            unique_headers.append(base)

    records = []
    for row in target_table.rows[1:]:
        row_vals = [cell.text.strip() for cell in row.cells]
        # Align lengths
        if len(row_vals) < len(unique_headers):
            row_vals += [None] * (len(unique_headers) - len(row_vals))
        else:
            row_vals = row_vals[:len(unique_headers)]
            
        if any(v not in (None, "") for v in row_vals):
            records.append(row_vals)

    if not records:
        raise ValueError("Word table header found, but there are no data rows.")

    df = pd.DataFrame(records, columns=unique_headers)
    df = try_convert_numeric(df)

    return df, {
        "format": "docx",
        "total_tables_in_doc": len(tables),
    }


def parse_document(filename: str, contents: bytes) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Unified entrypoint for document parsing.
    Dispatches to appropriate parser based on file extension.
    """
    lower_name = filename.lower()

    if lower_name.endswith(".csv"):
        return parse_csv(contents)
    elif lower_name.endswith((".xlsx", ".xls")):
        return parse_excel(contents)
    elif lower_name.endswith(".pdf"):
        return parse_pdf(contents)
    elif lower_name.endswith((".docx", ".doc")):
        return parse_docx(contents)
    else:
        raise ValueError(
            f"Unsupported file extension for '{filename}'. "
            "Supported formats: CSV (.csv), Excel (.xlsx, .xls), PDF (.pdf), Word (.docx)"
        )
