import { useEffect, useRef } from 'react'
import Plotly from 'plotly.js-dist-min'

const THEME_PLOTLY_PALETTES = {
  oceanic: {
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#f8fafc',
    font: { family: 'Inter, system-ui, -apple-system, sans-serif', color: '#475569' },
    titleColor: '#0f172a',
    axisTitleColor: '#334155',
    gridcolor: '#e2e8f0',
    linecolor: '#cbd5e1',
    colorway: ['#0284c7', '#06b6d4', '#0ea5e9', '#38bdf8', '#0369a1', '#7dd3fc', '#bae6fd'],
    markerColor: '#0284c7',
  },
  emerald: {
    paper_bgcolor: '#082018',
    plot_bgcolor: '#041710',
    font: { family: 'Inter, system-ui, -apple-system, sans-serif', color: '#94a3b8' },
    titleColor: '#ecfdf5',
    axisTitleColor: '#6ee7b7',
    gridcolor: '#134e3a',
    linecolor: '#065f46',
    colorway: ['#10b981', '#34d399', '#059669', '#6ee7b7', '#047857', '#a7f3d0', '#064e3b'],
    markerColor: '#10b981',
  },
  sunset: {
    paper_bgcolor: '#151322',
    plot_bgcolor: '#0d0c14',
    font: { family: 'Inter, system-ui, -apple-system, sans-serif', color: '#a1a1aa' },
    titleColor: '#fdf2f8',
    axisTitleColor: '#fb923c',
    gridcolor: '#2e284a',
    linecolor: '#4a3f6b',
    colorway: ['#f97316', '#ec4899', '#8b5cf6', '#fb923c', '#f43f5e', '#c084fc', '#e879f9'],
    markerColor: '#f97316',
  },
  graphite: {
    paper_bgcolor: '#111317',
    plot_bgcolor: '#090a0d',
    font: { family: 'Inter, system-ui, -apple-system, sans-serif', color: '#94a3b8' },
    titleColor: '#f8fafc',
    axisTitleColor: '#cbd5e1',
    gridcolor: '#242832',
    linecolor: '#334155',
    colorway: ['#e2e8f0', '#94a3b8', '#cbd5e1', '#64748b', '#f1f5f9', '#475569', '#334155'],
    markerColor: '#e2e8f0',
  },
}

export default function PlotlyChart({ data, layout, style, theme = 'oceanic' }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || !data) return

    const themeCfg = THEME_PLOTLY_PALETTES[theme] || THEME_PLOTLY_PALETTES.oceanic

    // Merge layout with theme colors
    const themedLayout = {
      ...layout,
      autosize: true,
      paper_bgcolor: themeCfg.paper_bgcolor,
      plot_bgcolor: themeCfg.plot_bgcolor,
      font: {
        family: 'Inter, system-ui, -apple-system, sans-serif',
        color: themeCfg.font.color,
        ...layout?.font,
      },
      title: layout?.title ? {
        ...layout.title,
        font: {
          family: 'Inter, system-ui, -apple-system, sans-serif',
          color: themeCfg.titleColor,
          size: layout.title?.font?.size || 16,
          ...layout.title?.font,
        },
      } : undefined,
      xaxis: layout?.xaxis ? {
        ...layout.xaxis,
        gridcolor: themeCfg.gridcolor,
        linecolor: themeCfg.linecolor,
        tickfont: { color: themeCfg.font.color },
        title: layout.xaxis?.title ? {
          ...layout.xaxis.title,
          font: {
            color: themeCfg.axisTitleColor,
            size: 13,
            ...layout.xaxis.title?.font,
          },
        } : undefined,
      } : undefined,
      yaxis: layout?.yaxis ? {
        ...layout.yaxis,
        gridcolor: themeCfg.gridcolor,
        linecolor: themeCfg.linecolor,
        tickfont: { color: themeCfg.font.color },
        title: layout.yaxis?.title ? {
          ...layout.yaxis.title,
          font: {
            color: themeCfg.axisTitleColor,
            size: 13,
            ...layout.yaxis.title?.font,
          },
        } : undefined,
      } : undefined,
      colorway: themeCfg.colorway,
    }

    // Adapt trace marker colors dynamically according to theme
    const themedData = data.map((trace, idx) => {
      const traceColor = themeCfg.colorway[idx % themeCfg.colorway.length]
      if (trace.type === 'bar') {
        return {
          ...trace,
          marker: {
            ...trace.marker,
            color: themeCfg.markerColor || traceColor,
            line: {
              ...(trace.marker?.line || {}),
              color: themeCfg.linecolor,
            },
          },
        }
      }
      if (trace.type === 'scatter') {
        return {
          ...trace,
          line: {
            ...trace.line,
            color: trace.line?.color || traceColor,
          },
          marker: {
            ...trace.marker,
            color: trace.marker?.color || traceColor,
          },
        }
      }
      if (trace.type === 'pie') {
        return {
          ...trace,
          marker: {
            ...trace.marker,
            colors: themeCfg.colorway,
          },
        }
      }
      return trace
    })

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      toImageButtonOptions: {
        format: 'png',
        filename: 'datagraph_visualization',
        scale: 2,
      },
    }

    Plotly.newPlot(containerRef.current, themedData, themedLayout, config)

    const handleResize = () => {
      if (containerRef.current) {
        Plotly.Plots.resize(containerRef.current)
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (containerRef.current) {
        Plotly.purge(containerRef.current)
      }
    }
  }, [data, layout, theme])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        minHeight: '450px',
        ...style,
      }}
    />
  )
}
