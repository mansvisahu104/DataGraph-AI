import pandas as pd
import numpy as np
import plotly.graph_objects as go
from typing import Dict, Any, List, Tuple, Optional

THEME_COLORS = [
    "#635bff",
    "#00d4ff",
    "#ff805d",
    "#16a34a",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
]


def get_recommended_charts(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Intelligently analyzes DataFrame columns and recommends optimal chart types.
    """
    recommendations = []
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()

    # Rule 1: Categorical + Numeric -> Aggregated Bar Chart
    if cat_cols and num_cols:
        cat_col = cat_cols[0]
        # Prefer low-cardinality categorical for primary grouping if available
        for c in cat_cols:
            if 1 < df[c].nunique() <= 15:
                cat_col = c
                break

        num_col = num_cols[0]
        # Prefer 'revenue' or 'sales' or large magnitude column if present
        for n in num_cols:
            if any(k in str(n).lower() for k in ["revenue", "sales", "total", "amount", "price"]):
                num_col = n
                break

        recommendations.append({
            "id": "rec_bar_agg",
            "title": f"{num_col} by {cat_col} (Total)",
            "description": f"Compare cumulative {num_col} across distinct {cat_col} groups.",
            "chart_type": "bar",
            "x_column": str(cat_col),
            "y_column": str(num_col),
            "aggregation": "sum",
            "color_column": None,
        })

        # Rule 2: Categorical + Numeric -> Donut/Pie Chart
        if df[cat_col].nunique() <= 8:
            recommendations.append({
                "id": "rec_pie_share",
                "title": f"{num_col} Distribution by {cat_col}",
                "description": f"Proportional share of total {num_col} segmented by {cat_col}.",
                "chart_type": "pie",
                "x_column": str(cat_col),
                "y_column": str(num_col),
                "aggregation": "sum",
                "color_column": None,
            })

    # Rule 3: Numeric + Numeric -> Scatter Plot (Correlation)
    if len(num_cols) >= 2:
        x_col = num_cols[1] if len(num_cols) > 1 else num_cols[0]
        y_col = num_cols[0]
        hover_col = cat_cols[0] if cat_cols else None

        recommendations.append({
            "id": "rec_scatter",
            "title": f"{x_col} vs {y_col}",
            "description": f"Analyze correlation and distribution patterns between {x_col} and {y_col}.",
            "chart_type": "scatter",
            "x_column": str(x_col),
            "y_column": str(y_col),
            "aggregation": "none",
            "color_column": str(cat_cols[0]) if cat_cols else None,
        })

    # Rule 4: Primary Numeric -> Distribution Histogram / Box
    if num_cols:
        primary_num = num_cols[0]
        recommendations.append({
            "id": "rec_histogram",
            "title": f"{primary_num} Distribution",
            "description": f"Spread and frequency density of {primary_num}.",
            "chart_type": "histogram",
            "x_column": str(primary_num),
            "y_column": None,
            "aggregation": "none",
            "color_column": None,
        })

    # Rule 5: Individual Record Comparison
    if cat_cols and num_cols and len(df) <= 30:
        first_cat = cat_cols[0]
        first_num = num_cols[0]
        recommendations.append({
            "id": "rec_bar_records",
            "title": f"{first_num} per {first_cat}",
            "description": f"Direct breakdown of each {first_cat} record.",
            "chart_type": "bar",
            "x_column": str(first_cat),
            "y_column": str(first_num),
            "aggregation": "none",
            "color_column": None,
        })

    return recommendations[:4]


def generate_chart_spec(df: pd.DataFrame, config: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """
    Renders an interactive Plotly specification using pure Python native lists
    to prevent binary compression and ensure 100% web browser compatibility.
    """
    chart_type = config.get("chart_type", "bar")
    x_col = config.get("x_column")
    y_col = config.get("y_column")
    aggregation = config.get("aggregation", "none")
    color_col = config.get("color_column")
    custom_title = config.get("title")

    if not x_col or x_col not in df.columns:
        raise ValueError(f"X-Axis column '{x_col}' not found in dataset.")

    # Apply Aggregation if specified
    if aggregation and aggregation != "none" and y_col and y_col in df.columns:
        if chart_type in ["bar", "line", "pie"]:
            agg_funcs = {
                "sum": "sum",
                "mean": "mean",
                "count": "count",
                "min": "min",
                "max": "max",
            }
            func = agg_funcs.get(aggregation, "sum")
            agg_df = df.groupby(x_col)[y_col].agg(func).reset_index()
            # Sort descending for cleaner presentation
            agg_df = agg_df.sort_values(by=y_col, ascending=False)
            plot_df = agg_df
        else:
            plot_df = df
    else:
        plot_df = df

    title = custom_title or (
        f"{y_col} by {x_col}" if y_col else f"Distribution of {x_col}"
    )

    data_traces = []
    insights = []

    # Common layout options
    layout = {
        "title": {
            "text": f"<b>{title}</b>",
            "font": {"size": 18, "color": "#172033", "family": "Inter, system-ui, sans-serif"},
            "x": 0.05,
        },
        "plot_bgcolor": "#ffffff",
        "paper_bgcolor": "#ffffff",
        "font": {"family": "Inter, system-ui, sans-serif", "color": "#475467"},
        "margin": {"l": 60, "r": 40, "t": 60, "b": 60},
        "hovermode": "closest",
        "xaxis": {
            "title": {"text": f"<b>{x_col}</b>", "font": {"size": 13, "color": "#344054"}},
            "gridcolor": "#f2f4f7",
            "linecolor": "#eaecf0",
        },
        "yaxis": {
            "title": {"text": f"<b>{y_col or 'Count'}</b>", "font": {"size": 13, "color": "#344054"}},
            "gridcolor": "#f2f4f7",
            "linecolor": "#eaecf0",
        },
    }

    # 1. BAR CHART
    if chart_type == "bar":
        x_vals = [str(v) if v is not None else "null" for v in plot_df[x_col].tolist()]
        y_vals = [float(v) if pd.notnull(v) else 0.0 for v in plot_df[y_col].tolist()] if y_col else [1.0] * len(plot_df)
        
        data_traces.append({
            "type": "bar",
            "x": x_vals,
            "y": y_vals,
            "marker": {
                "color": THEME_COLORS[0],
                "opacity": 0.9,
                "line": {"color": "#4f46e5", "width": 1.5}
            },
            "text": [f"{v:,.2f}" if isinstance(v, (int, float)) else str(v) for v in y_vals],
            "textposition": "auto",
            "hoverinfo": "x+y",
        })

        if y_vals:
            max_idx = int(np.argmax(y_vals))
            min_idx = int(np.argmin(y_vals))
            top_cat = x_vals[max_idx]
            top_val = y_vals[max_idx]
            total_sum = sum(y_vals)
            pct = (top_val / total_sum * 100) if total_sum > 0 else 0
            insights.append(
                f"Top Performer: '{top_cat}' leads with {top_val:,.2f} ({pct:.1f}% of total {title.lower()})."
            )
            if len(x_vals) > 1:
                insights.append(
                    f"Lowest: '{x_vals[min_idx]}' accounts for {y_vals[min_idx]:,.2f}."
                )

    # 2. LINE CHART
    elif chart_type == "line":
        x_vals = plot_df[x_col].tolist()
        y_vals = [float(v) if pd.notnull(v) else None for v in plot_df[y_col].tolist()] if y_col else []
        
        data_traces.append({
            "type": "scatter",
            "mode": "lines+markers",
            "x": x_vals,
            "y": y_vals,
            "line": {"color": THEME_COLORS[0], "width": 3, "shape": "spline"},
            "marker": {"size": 8, "color": THEME_COLORS[1]},
            "hoverinfo": "x+y",
        })
        if y_vals:
            clean_y = [v for v in y_vals if v is not None]
            if clean_y:
                insights.append(
                    f"Trend Overview: Values range from {min(clean_y):,.2f} to {max(clean_y):,.2f} with an average of {np.mean(clean_y):,.2f}."
                )

    # 3. SCATTER PLOT
    elif chart_type == "scatter":
        x_vals = [float(v) if pd.notnull(v) else None for v in plot_df[x_col].tolist()]
        y_vals = [float(v) if pd.notnull(v) else None for v in plot_df[y_col].tolist()] if y_col else []
        hover_text = [
            str(plot_df[color_col].iloc[i]) if color_col and color_col in plot_df.columns else f"Record #{i+1}"
            for i in range(len(plot_df))
        ]

        data_traces.append({
            "type": "scatter",
            "mode": "markers",
            "x": x_vals,
            "y": y_vals,
            "text": hover_text,
            "marker": {
                "size": 12,
                "color": THEME_COLORS[0],
                "opacity": 0.8,
                "line": {"color": "#ffffff", "width": 1.5}
            },
            "hoverinfo": "text+x+y",
        })

        # Calculate Pearson correlation if both columns are numeric
        valid_mask = pd.notnull(plot_df[x_col]) & pd.notnull(plot_df[y_col])
        if valid_mask.sum() > 2:
            corr = float(plot_df.loc[valid_mask, x_col].corr(plot_df.loc[valid_mask, y_col]))
            corr_strength = "strong positive" if corr > 0.7 else (
                "moderate positive" if corr > 0.3 else (
                    "strong negative" if corr < -0.7 else (
                        "moderate negative" if corr < -0.3 else "weak / neutral"
                    )
                )
            )
            insights.append(f"Correlation: {x_col} and {y_col} show a {corr_strength} correlation (r = {corr:.2f}).")

    # 4. PIE / DONUT CHART
    elif chart_type == "pie":
        labels = [str(v) if v is not None else "null" for v in plot_df[x_col].tolist()]
        values = [float(v) if pd.notnull(v) else 0.0 for v in plot_df[y_col].tolist()] if y_col else [1.0] * len(plot_df)

        data_traces.append({
            "type": "pie",
            "labels": labels,
            "values": values,
            "hole": 0.4,  # Modern Donut style
            "marker": {"colors": THEME_COLORS[:len(labels)]},
            "textinfo": "label+percent",
            "hoverinfo": "label+value+percent",
        })
        layout["xaxis"] = {"visible": False}
        layout["yaxis"] = {"visible": False}

        if values:
            top_i = int(np.argmax(values))
            tot = sum(values)
            share = (values[top_i] / tot * 100) if tot > 0 else 0
            insights.append(f"Dominant Share: '{labels[top_i]}' comprises {share:.1f}% ({values[top_i]:,.2f}) of the total distribution.")

    # 5. HISTOGRAM
    elif chart_type == "histogram":
        x_vals = [float(v) if pd.notnull(v) else None for v in plot_df[x_col].tolist()]
        data_traces.append({
            "type": "histogram",
            "x": x_vals,
            "marker": {"color": THEME_COLORS[0], "opacity": 0.8},
        })
        layout["yaxis"]["title"] = {"text": "<b>Frequency</b>", "font": {"size": 13, "color": "#344054"}}
        clean_vals = [v for v in x_vals if v is not None]
        if clean_vals:
            insights.append(
                f"Distribution Spread: Median value is {np.median(clean_vals):,.2f} with interquartile range between {np.percentile(clean_vals, 25):,.2f} and {np.percentile(clean_vals, 75):,.2f}."
            )

    # 6. BOX PLOT
    elif chart_type == "box":
        y_vals = [float(v) if pd.notnull(v) else None for v in plot_df[y_col or x_col].tolist()]
        x_group = [str(v) for v in plot_df[x_col].tolist()] if y_col else None

        data_traces.append({
            "type": "box",
            "y": y_vals,
            "x": x_group,
            "marker": {"color": THEME_COLORS[0]},
            "boxpoints": "outliers",
        })
        insights.append(f"Box Plot: Highlights quartile boundaries, median spread, and outlier detections for {y_col or x_col}.")

    else:
        raise ValueError(f"Unsupported chart type '{chart_type}'. Supported: bar, line, scatter, pie, histogram, box.")

    plotly_spec = {
        "data": data_traces,
        "layout": layout,
    }

    insight_text = " ".join(insights) if insights else f"Generated interactive {chart_type} chart for {title}."
    return plotly_spec, insight_text
