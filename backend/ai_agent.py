import os
import re
import json
import pandas as pd
import numpy as np
from typing import Dict, Any, Optional, Tuple
from visualizations import generate_chart_spec


def execute_pandas_query(df: pd.DataFrame, code: str) -> Dict[str, Any]:
    """
    Safely executes a Pandas query against the active DataFrame `df`.
    Returns structured results: formatted text, markdown table, or scalar value.
    """
    # Clean code string
    cleaned_code = code.strip()
    # Strip markdown python code fences if present
    if cleaned_code.startswith("```python"):
        cleaned_code = cleaned_code[9:]
    elif cleaned_code.startswith("```"):
        cleaned_code = cleaned_code[3:]
    if cleaned_code.endswith("```"):
        cleaned_code = cleaned_code[:-3]
    cleaned_code = cleaned_code.strip()

    # Create safe local environment
    local_env = {
        "df": df.copy(),
        "pd": pd,
        "np": np,
    }

    try:
        # Check if code is a single expression or statement
        if "\n" not in cleaned_code and not cleaned_code.startswith("result ="):
            result = eval(cleaned_code, {"pd": pd, "np": np}, local_env)
        else:
            # Multi-line or assignment
            if "result =" not in cleaned_code:
                lines = cleaned_code.split("\n")
                lines[-1] = f"result = {lines[-1]}"
                exec_code = "\n".join(lines)
            else:
                exec_code = cleaned_code

            exec(exec_code, {"pd": pd, "np": np}, local_env)
            result = local_env.get("result", None)

        # Format result based on type
        if isinstance(result, pd.DataFrame):
            return {
                "type": "dataframe",
                "output_text": result.to_markdown(index=False),
                "data": json.loads(result.head(20).to_json(orient="records")),
                "shape": list(result.shape),
                "code": cleaned_code,
            }
        elif isinstance(result, pd.Series):
            df_res = result.reset_index()
            return {
                "type": "series",
                "output_text": df_res.to_markdown(index=False),
                "data": json.loads(df_res.to_json(orient="records")),
                "code": cleaned_code,
            }
        elif isinstance(result, (int, float, np.integer, np.floating)):
            formatted_val = f"{result:,.2f}" if isinstance(result, (float, np.floating)) else f"{result:,}"
            return {
                "type": "scalar",
                "output_text": str(formatted_val),
                "raw_value": float(result),
                "code": cleaned_code,
            }
        else:
            return {
                "type": "text",
                "output_text": str(result),
                "code": cleaned_code,
            }

    except Exception as exc:
        return {
            "type": "error",
            "output_text": f"Execution error: {str(exc)}",
            "code": cleaned_code,
        }


def built_in_semantic_agent(df: pd.DataFrame, question: str) -> Dict[str, Any]:
    """
    Intelligent built-in rule and semantic engine that operates directly on any dataset
    without requiring external API keys.
    """
    q = question.lower().strip()
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()

    # Find referenced columns in query
    matched_cols = [c for c in df.columns if str(c).lower() in q]

    # 1. CHART INTENT (e.g. "plot revenue by department", "bar chart of sales")
    if any(k in q for k in ["plot", "chart", "graph", "visualize", "show me a bar", "pie chart"]):
        chart_type = "bar"
        if "pie" in q or "donut" in q:
            chart_type = "pie"
        elif "line" in q:
            chart_type = "line"
        elif "scatter" in q:
            chart_type = "scatter"
        elif "histogram" in q:
            chart_type = "histogram"
        elif "box" in q:
            chart_type = "box"

        x_col = cat_cols[0] if cat_cols else df.columns[0]
        y_col = num_cols[0] if num_cols else None

        for c in matched_cols:
            if c in cat_cols:
                x_col = c
            elif c in num_cols:
                y_col = c

        chart_config = {
            "chart_type": chart_type,
            "x_column": x_col,
            "y_column": y_col,
            "aggregation": "sum" if chart_type in ["bar", "pie", "line"] and y_col else "none",
            "title": f"{y_col or 'Count'} by {x_col}" if y_col else f"{x_col} Analysis",
        }

        spec, insights = generate_chart_spec(df, chart_config)
        return {
            "answer": f"Here is the interactive **{chart_type.capitalize()} Chart** for **{chart_config['title']}** based on your uploaded data.\n\n{insights}",
            "pandas_code": f"df.groupby('{x_col}')['{y_col}'].sum().reset_index()" if y_col else f"df['{x_col}'].value_counts()",
            "chart": spec,
        }

    # 2. HIGHEST / MAXIMUM / TOP
    if any(k in q for k in ["highest", "maximum", "max", "top", "best", "most"]):
        target_num = num_cols[0] if num_cols else None
        for c in matched_cols:
            if c in num_cols:
                target_num = c

        target_cat = cat_cols[0] if cat_cols else df.columns[0]
        for c in matched_cols:
            if c in cat_cols:
                target_cat = c

        if target_num:
            if "department" in q and "department" in [c.lower() for c in df.columns]:
                dept_col = [c for c in df.columns if c.lower() == "department"][0]
                code = f"df.groupby('{dept_col}')['{target_num}'].sum().idxmax()"
                res = execute_pandas_query(df, code)
                top_group = res["output_text"]
                tot_val = float(df.groupby(dept_col)[target_num].sum().max())
                
                # Also generate small chart
                spec, _ = generate_chart_spec(df, {
                    "chart_type": "bar",
                    "x_column": dept_col,
                    "y_column": target_num,
                    "aggregation": "sum"
                })

                return {
                    "answer": f"The department with the highest total **{target_num}** is **{top_group}** with **{tot_val:,.2f}**.",
                    "pandas_code": f"df.groupby('{dept_col}')['{target_num}'].sum().sort_values(ascending=False)",
                    "chart": spec
                }
            else:
                top_idx = df[target_num].idxmax()
                top_row = df.loc[top_idx]
                id_name = str(top_row[target_cat]) if target_cat else f"Row #{top_idx+1}"
                max_val = float(top_row[target_num])
                return {
                    "answer": f"The highest **{target_num}** is **{max_val:,.2f}**, achieved by **{id_name}**.",
                    "pandas_code": f"df.loc[df['{target_num}'].idxmax()][['{target_cat}', '{target_num}']]",
                    "chart": None
                }

    # 3. LOWEST / MINIMUM / LEAST
    if any(k in q for k in ["lowest", "minimum", "min", "bottom", "least", "worst"]):
        target_num = num_cols[0] if num_cols else None
        for c in matched_cols:
            if c in num_cols:
                target_num = c

        target_cat = cat_cols[0] if cat_cols else df.columns[0]
        for c in matched_cols:
            if c in cat_cols:
                target_cat = c

        if target_num:
            min_idx = df[target_num].idxmin()
            min_row = df.loc[min_idx]
            id_name = str(min_row[target_cat]) if target_cat else f"Row #{min_idx+1}"
            min_val = float(min_row[target_num])
            return {
                "answer": f"The lowest **{target_num}** is **{min_val:,.2f}**, associated with **{id_name}**.",
                "pandas_code": f"df.loc[df['{target_num}'].idxmin()][['{target_cat}', '{target_num}']]",
                "chart": None
            }

    # 4. AVERAGE / MEAN / TOTAL / SUM
    if any(k in q for k in ["average", "mean", "avg"]):
        target_num = num_cols[0] if num_cols else None
        for c in matched_cols:
            if c in num_cols:
                target_num = c
        if target_num:
            avg_val = float(df[target_num].mean())
            return {
                "answer": f"The average (mean) **{target_num}** across all {len(df)} records is **{avg_val:,.2f}**.",
                "pandas_code": f"df['{target_num}'].mean()",
                "chart": None
            }

    if any(k in q for k in ["total", "sum", "cumulative"]):
        target_num = num_cols[0] if num_cols else None
        for c in matched_cols:
            if c in num_cols:
                target_num = c
        if target_num:
            sum_val = float(df[target_num].sum())
            return {
                "answer": f"The total cumulative **{target_num}** across the dataset is **{sum_val:,.2f}**.",
                "pandas_code": f"df['{target_num}'].sum()",
                "chart": None
            }

    # 5. GENERAL SUMMARY / FALLBACK
    summary_text = (
        f"The active dataset contains **{len(df)} records** across **{len(df.columns)} columns** "
        f"({', '.join(df.columns)}). "
    )
    if num_cols:
        summary_text += f"Numeric metrics include **{', '.join(num_cols)}**."
    
    return {
        "answer": (
            f"{summary_text}\n\n"
            f"You can ask me to compute specific metrics (e.g. *'Which department has highest sales?'*, "
            f"*'Average revenue per employee'*) or ask me to generate interactive charts (*'Plot a bar chart of revenue by department'*).\n\n"
            f"> 💡 *Tip: Provide a Gemini API key in the header to ask open-ended questions!*"
        ),
        "pandas_code": "df.describe()",
        "chart": None,
    }


def query_ai_agent(df: pd.DataFrame, question: str, api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Primary Agent Entrypoint.
    If Gemini API key is provided, invokes Gemini LLM with tool-based code execution.
    Otherwise, executes via the built-in semantic analytics engine.
    """
    key = api_key or os.environ.get("GEMINI_API_KEY")

    if not key:
        return built_in_semantic_agent(df, question)

    try:
        from google import genai

        client = genai.Client(api_key=key)

        # Contextual metadata for Gemini
        schema_info = {str(col): str(dtype) for col, dtype in df.dtypes.items()}
        sample_records = df.head(5).to_dict(orient="records")

        system_instruction = f"""
You are "DataGraph AI", an elite senior data analyst and visualization engineer.
You are assisting a user querying their active dataset.
Dataset Metadata:
- Total Rows: {len(df)}
- Columns and Types: {json.dumps(schema_info)}
- First 5 Sample Rows: {json.dumps(sample_records)}

Instructions:
1. Always base calculations strictly on the dataset schema and data. Never invent outputs.
2. Formulate the exact Python Pandas code needed to compute the answer using variable `df`.
3. If the user asks for a chart, or if a visual comparison greatly enhances the answer, specify `chart_config`.
4. Output strictly valid JSON with this exact schema:
{{
  "answer": "Detailed markdown explanation of the answer and findings",
  "pandas_code": "df code string",
  "chart_config": {{
      "chart_type": "bar | line | scatter | pie | histogram | box",
      "x_column": "exact_column_name",
      "y_column": "exact_column_name or null",
      "aggregation": "sum | mean | count | min | max | none",
      "title": "Clean Chart Title"
  }} or null
}}
"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=question,
            config={"system_instruction": system_instruction, "response_mime_type": "application/json"}
        )

        raw_json = json.loads(response.text)
        answer = raw_json.get("answer", "Here are the query results.")
        code = raw_json.get("pandas_code", "")
        chart_config = raw_json.get("chart_config")

        # Execute the pandas code to get verified calculation results
        exec_res = None
        if code:
            exec_res = execute_pandas_query(df, code)

        # Generate chart if specified
        chart_spec = None
        if chart_config and isinstance(chart_config, dict):
            try:
                chart_spec, _ = generate_chart_spec(df, chart_config)
            except Exception:
                pass

        return {
            "answer": answer,
            "pandas_code": code,
            "execution_result": exec_res,
            "chart": chart_spec,
        }

    except Exception as exc:
        # Fall back gracefully to built-in semantic engine if Gemini fails or rate limits
        fallback = built_in_semantic_agent(df, question)
        fallback["answer"] = f"*(Gemini Notice: {str(exc)}. Falling back to local Pandas Engine)*\n\n" + fallback["answer"]
        return fallback
