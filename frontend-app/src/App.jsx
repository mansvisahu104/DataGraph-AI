import { useState, useEffect, useRef } from 'react'
import PlotlyChart from './PlotlyChart'
import './App.css'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL !== undefined
    ? import.meta.env.VITE_API_BASE_URL
    : typeof window !== 'undefined' && (window.location.port === '5173' || window.location.port === '5174')
    ? 'http://127.0.0.1:8000'
    : ''

const FORMAT_CONFIG = {
  csv: { label: 'CSV', color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
  excel: { label: 'Excel', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  pdf: { label: 'PDF Document', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
  docx: { label: 'Word Document', color: '#4338ca', bg: '#eef2ff', border: '#c7d2fe' },
}

const SAMPLE_QUESTIONS = [
  'Which department generated the highest revenue?',
  'Plot a bar chart of Revenue by Department',
  'Who is the top employee by Sales?',
  'What is the average revenue per employee?',
  'Show a pie chart of Department distribution',
]

const THEMES = [
  {
    id: 'oceanic',
    name: 'Oceanic Analytics',
    tagline: 'Clean & Vibrant Blue',
    vibe: 'Modern, Trustworthy, Corporate',
    emoji: '🌊',
    swatches: ['#0284c7', '#06b6d4', '#ffffff', '#0f172a'],
    badge: 'Light Theme',
  },
  {
    id: 'emerald',
    name: 'Emerald Growth',
    tagline: 'Dark Mode Green',
    vibe: 'Eco-friendly, Sales & Growth',
    emoji: '🌲',
    swatches: ['#10b981', '#34d399', '#082018', '#03140e'],
    badge: 'Dark Mode',
  },
  {
    id: 'sunset',
    name: 'Sunset Metrics',
    tagline: 'Warm & Dynamic',
    vibe: 'Energetic, High-Octane Live',
    emoji: '🌅',
    swatches: ['#f97316', '#ec4899', '#151322', '#0d0c14'],
    badge: 'Dark Mode',
  },
  {
    id: 'graphite',
    name: 'Graphite Insights',
    tagline: 'Minimalist Dark',
    vibe: 'Professional, Deep-Dive Analytics',
    emoji: '🖤',
    swatches: ['#e2e8f0', '#94a3b8', '#111317', '#090a0d'],
    badge: 'Monochrome',
  },
]

function App() {
  const [currentTheme, setCurrentTheme] = useState(
    () => localStorage.getItem('datagraph_theme') || 'oceanic'
  )
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const themeMenuRef = useRef(null)

  const activeThemeObj = THEMES.find((t) => t.id === currentTheme) || THEMES[0]

  const handleSelectTheme = (themeId) => {
    setCurrentTheme(themeId)
    localStorage.setItem('datagraph_theme', themeId)
    setShowThemeMenu(false)
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target)) {
        setShowThemeMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const [file, setFile] = useState(null)
  const [uploadedData, setUploadedData] = useState(null)
  const [activeTab, setActiveTab] = useState('preview') // 'preview' | 'profile' | 'cleaning' | 'visualize' | 'chat'
  const [backendStatus, setBackendStatus] = useState('checking') // 'online' | 'offline' | 'checking'
  const [backendMessage, setBackendMessage] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isCleaning, setIsCleaning] = useState(false)
  const [isRenderingChart, setIsRenderingChart] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [changelog, setChangelog] = useState([])
  const [isDragging, setIsDragging] = useState(false)

  // Chart Builder State
  const [currentChart, setCurrentChart] = useState(null)
  const [chartInsights, setChartInsights] = useState('')
  const [chartType, setChartType] = useState('bar')
  const [xAxisCol, setXAxisCol] = useState('')
  const [yAxisCol, setYAxisCol] = useState('')
  const [aggregation, setAggregation] = useState('sum')
  const [colorCol, setColorCol] = useState('')

  // AI Chat Agent State
  const [geminiApiKey, setGeminiApiKey] = useState(
    () => localStorage.getItem('datagraph_gemini_key') || ''
  )
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'assistant',
      text: 'Hello! I am **DataGraph AI**, your dedicated data analyst & visualization engineer. Ask me any question about your dataset, request statistical insights, or ask me to generate interactive charts!',
      code: null,
      chart: null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [chatInput, setChatInput] = useState('')
  const [isAgentThinking, setIsAgentThinking] = useState(false)
  const chatBottomRef = useRef(null)

  useEffect(() => {
    checkBackendHealth()
  }, [])

  useEffect(() => {
    if (activeTab === 'chat' && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, activeTab])

  const checkBackendHealth = async () => {
    setBackendStatus('checking')
    setErrorMsg('')
    try {
      const response = await fetch(`${API_BASE_URL}/health`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setBackendStatus('online')
      setBackendMessage(`Connected (${API_BASE_URL})`)
    } catch (err) {
      setBackendStatus('offline')
      setBackendMessage(`Unable to connect to backend at ${API_BASE_URL}`)
      console.error('Backend connection check failed:', err)
    }
  }

  const handleTestConnection = async () => {
    setErrorMsg('')
    try {
      const response = await fetch(`${API_BASE_URL}/health`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      setBackendStatus('online')
      setBackendMessage(data.message || 'DataGraph AI Backend is running!')
    } catch (err) {
      setBackendStatus('offline')
      setErrorMsg(`Connection failed: Make sure FastAPI is running on ${API_BASE_URL || 'current server'}`)
      console.error(err)
    }
  }

  const processFile = async (selectedFile) => {
    if (!selectedFile) return

    setFile(selectedFile)
    setErrorMsg('')
    setSuccessMsg('')
    setChangelog([])
    setIsUploading(true)

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Upload failed')
      }

      setUploadedData(data)
      setActiveTab('preview')
      setCurrentChart(data.current_chart)
      setChartInsights(data.chart_insights || '')

      setChatMessages([
        {
          sender: 'assistant',
          text: `Loaded **${data.filename}** (${data.rows} rows, ${data.columns.length} columns). I'm ready to query, analyze, and visualize this data!`,
          code: null,
          chart: data.current_chart,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])

      if (data.columns && data.columns.length > 0) {
        const numCols = Object.keys(data.column_types || {}).filter(
          (c) => data.column_types[c] === 'integer' || data.column_types[c] === 'numeric'
        )
        const catCols = Object.keys(data.column_types || {}).filter(
          (c) => data.column_types[c] !== 'integer' && data.column_types[c] !== 'numeric'
        )
        setXAxisCol(catCols[0] || data.columns[0])
        setYAxisCol(numCols[0] || data.columns[1] || '')
        setChartType('bar')
        setAggregation('sum')
      }

      setSuccessMsg(
        `Loaded "${data.filename}" [${data.format?.toUpperCase()}] — ${data.rows} rows, ${data.columns.length} columns.`
      )
    } catch (err) {
      console.error('Upload error:', err)
      setErrorMsg(err.message || 'File processing failed. Please verify that the backend is running.')
      setUploadedData(null)
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0]
    processFile(selectedFile)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0])
    }
  }

  const executeClean = async (operations) => {
    if (!uploadedData?.dataset_id) return
    setIsCleaning(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const response = await fetch(`${API_BASE_URL}/clean`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_id: uploadedData.dataset_id,
          operations: operations,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail || 'Cleaning action failed')
      }

      setUploadedData((prev) => ({
        ...prev,
        rows: data.rows,
        columns: data.columns,
        column_types: data.column_types,
        preview_count: data.preview_count,
        data: data.data,
        profile: data.profile,
        recommendations: data.recommendations,
      }))

      if (data.current_chart) {
        setCurrentChart(data.current_chart)
        setChartInsights(data.chart_insights || '')
      }

      if (data.changelog && data.changelog.length > 0) {
        setChangelog((prev) => [...data.changelog, ...prev])
        setSuccessMsg(`Cleaning applied: ${data.changelog.join('; ')}`)
      } else {
        setSuccessMsg('Cleaning check completed. Dataset is already clean.')
      }
    } catch (err) {
      console.error('Clean error:', err)
      setErrorMsg(err.message || 'Failed to apply cleaning operations.')
    } finally {
      setIsCleaning(false)
    }
  }

  const handleResetData = async () => {
    if (!uploadedData?.dataset_id) return
    setIsCleaning(true)
    setErrorMsg('')

    try {
      const response = await fetch(`${API_BASE_URL}/reset/${uploadedData.dataset_id}`, {
        method: 'POST',
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Reset failed')

      setUploadedData((prev) => ({
        ...prev,
        rows: data.rows,
        columns: data.columns,
        column_types: data.column_types,
        preview_count: data.preview_count,
        data: data.data,
        profile: data.profile,
        recommendations: data.recommendations,
      }))
      setCurrentChart(data.current_chart)
      setChartInsights(data.chart_insights || '')
      setChangelog([])
      setSuccessMsg('Dataset restored back to original uploaded state.')
    } catch (err) {
      console.error('Reset error:', err)
      setErrorMsg(err.message || 'Failed to reset dataset.')
    } finally {
      setIsCleaning(false)
    }
  }

  const handleDownload = () => {
    if (!uploadedData?.dataset_id) return
    window.open(`${API_BASE_URL}/download/${uploadedData.dataset_id}`, '_blank')
  }

  const handleGenerateChart = async (customConfig = null) => {
    if (!uploadedData?.dataset_id) return
    setIsRenderingChart(true)
    setErrorMsg('')

    const config = customConfig || {
      chart_type: chartType,
      x_column: xAxisCol,
      y_column: yAxisCol || null,
      aggregation: aggregation,
      color_column: colorCol || null,
    }

    try {
      const response = await fetch(`${API_BASE_URL}/visualize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_id: uploadedData.dataset_id,
          config: config,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Failed to render chart.')

      setCurrentChart(data.plotly_spec)
      setChartInsights(data.insights || '')
      setActiveTab('visualize')
    } catch (err) {
      console.error('Chart generation error:', err)
      setErrorMsg(err.message || 'Failed to generate chart.')
    } finally {
      setIsRenderingChart(false)
    }
  }

  const applyRecommendation = (rec) => {
    setChartType(rec.chart_type)
    setXAxisCol(rec.x_column)
    setYAxisCol(rec.y_column || '')
    setAggregation(rec.aggregation || 'none')
    setColorCol(rec.color_column || '')
    handleGenerateChart({
      chart_type: rec.chart_type,
      x_column: rec.x_column,
      y_column: rec.y_column,
      aggregation: rec.aggregation,
      color_column: rec.color_column,
      title: rec.title,
    })
  }

  const handleSendChatMessage = async (customQuery = null) => {
    const question = (customQuery || chatInput).trim()
    if (!question || !uploadedData?.dataset_id) return

    setChatInput('')
    setIsAgentThinking(true)

    const userMsg = {
      sender: 'user',
      text: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setChatMessages((prev) => [...prev, userMsg])

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_id: uploadedData.dataset_id,
          message: question,
          api_key: geminiApiKey || null,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail || 'AI query processing failed.')
      }

      const botMsg = {
        sender: 'assistant',
        text: data.answer,
        code: data.pandas_code,
        chart: data.chart,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setChatMessages((prev) => [...prev, botMsg])
    } catch (err) {
      console.error('Chat error:', err)
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: `⚠️ Query Error: ${err.message || 'Unable to process query.'}`,
          code: null,
          chart: null,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      setIsAgentThinking(false)
    }
  }

  const handleSaveApiKey = (key) => {
    setGeminiApiKey(key)
    localStorage.setItem('datagraph_gemini_key', key)
    setShowKeyInput(false)
  }

  const currentFormatStyle = uploadedData?.format
    ? FORMAT_CONFIG[uploadedData.format] || FORMAT_CONFIG.csv
    : FORMAT_CONFIG.csv

  const profile = uploadedData?.profile

  return (
    <div className={`app theme-${currentTheme}`}>
      {/* Aesthetic Navbar */}
      <nav className="navbar">
        <div className="logo">
          <span className="logo-badge">&#9650;</span>
          DataGraph <span>AI</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {/* Multi-Theme Palette Selector */}
          <div className="theme-selector-wrapper" ref={themeMenuRef}>
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="theme-pill-btn"
              title="Switch Dashboard Aesthetic Theme"
            >
              <span style={{ fontSize: '15px' }}>{activeThemeObj.emoji}</span>
              <span>{activeThemeObj.name}</span>
              <div className="theme-swatch-dots">
                {activeThemeObj.swatches.map((color, idx) => (
                  <span
                    key={idx}
                    className="theme-swatch-dot"
                    style={{ background: color, border: '1px solid rgba(120,120,120,0.3)' }}
                  />
                ))}
              </div>
              <span style={{ fontSize: '9px', opacity: 0.6, marginLeft: '3px' }}>▼</span>
            </button>

            {showThemeMenu && (
              <div className="theme-dropdown-menu">
                <div style={{ padding: '6px 10px 8px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Aesthetic Theme Presets
                  </span>
                </div>
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTheme(t.id)}
                    className={`theme-card-item ${currentTheme === t.id ? 'selected' : ''}`}
                  >
                    <div className="theme-card-left">
                      <span style={{ fontSize: '20px' }}>{t.emoji}</span>
                      <div className="theme-card-info">
                        <h5>{t.name}</h5>
                        <p>{t.tagline}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <div className="theme-swatch-dots">
                        {t.swatches.map((color, idx) => (
                          <span
                            key={idx}
                            className="theme-swatch-dot"
                            style={{ background: color, border: '1px solid rgba(120,120,120,0.3)' }}
                          />
                        ))}
                      </div>
                      <span style={{ fontSize: '9.5px', padding: '2px 5px', borderRadius: '4px', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {t.badge}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Gemini Key Config Pill */}
          <button
            onClick={() => setShowKeyInput(!showKeyInput)}
            style={{
              padding: '7px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              borderRadius: '20px',
              border: '1px solid var(--border)',
              background: geminiApiKey ? 'var(--badge-bg)' : 'var(--bg-card)',
              color: geminiApiKey ? 'var(--badge-text)' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <span>&#10024;</span>
            {geminiApiKey ? 'Gemini Pro Active' : 'Configure Gemini Key'}
          </button>

          {/* Backend Health Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '6px 13px',
              borderRadius: '20px',
              fontSize: '12.5px',
              fontWeight: 600,
              background:
                backendStatus === 'online'
                  ? 'var(--badge-bg)'
                  : backendStatus === 'offline'
                  ? '#fef2f2'
                  : 'var(--bg-subtle)',
              color:
                backendStatus === 'online'
                  ? 'var(--badge-text)'
                  : backendStatus === 'offline'
                  ? '#dc2626'
                  : 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor:
                  backendStatus === 'online'
                    ? '#10b981'
                    : backendStatus === 'offline'
                    ? '#ef4444'
                    : '#94a3b8',
              }}
            />
            {backendStatus === 'online'
              ? 'Backend Live'
              : backendStatus === 'offline'
              ? 'Backend Offline'
              : 'Connecting...'}
          </div>

          <button onClick={handleTestConnection} className="demo-btn">
            Ping Server
          </button>
        </div>
      </nav>

      {/* Optional Gemini API Key Drawer */}
      {showKeyInput && (
        <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '16px clamp(20px, 6vw, 80px)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', boxShadow: 'var(--shadow-sm)' }}>
          <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>Gemini API Key:</strong>
          <input
            type="password"
            placeholder="Paste your Gemini AI Studio API key (AIzaSy...)"
            value={geminiApiKey}
            onChange={(e) => setGeminiApiKey(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', minWidth: '340px', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-main)' }}
          />
          <button
            onClick={() => handleSaveApiKey(geminiApiKey)}
            className="upload-btn"
            style={{ padding: '8px 18px', fontSize: '13px' }}
          >
            Save Key
          </button>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Stored securely in your local browser storage.
          </span>
        </div>
      )}

      {/* Hero / Header Section */}
      <section className="hero-section">
        <span className="badge">
          <span>&#10024;</span> AGENTIC DATA ANALYTICS & VISUALIZATION PLATFORM
        </span>
        <h1>
          Intelligent Document-to-Visualization <span>Studio</span>
        </h1>
        <p>
          Upload spreadsheets, PDF reports, or tabular documents to profile data distributions, apply automated cleaning, generate interactive Plotly charts, and query your data using natural language.
        </p>

        {/* Supported Format Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', alignSelf: 'center', marginRight: '4px' }}>Supported:</span>
          <span style={{ background: 'var(--bg-card)', color: 'var(--primary)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>CSV (.csv)</span>
          <span style={{ background: 'var(--bg-card)', color: 'var(--primary)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>Excel (.xlsx, .xls)</span>
          <span style={{ background: 'var(--bg-card)', color: 'var(--primary)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>PDF (.pdf)</span>
          <span style={{ background: 'var(--bg-card)', color: 'var(--primary)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>Word (.docx)</span>
        </div>

        {/* Aesthetic Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`dropzone ${isDragging ? 'dragging' : ''}`}
        >
          <div>
            <p style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '15px', marginBottom: '4px' }}>
              Drag & drop your file here, or click to browse
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              Automatically parsed into high-performance Pandas DataFrames with type inference.
            </p>
          </div>

          <label className="upload-btn">
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.pdf,.docx,.doc"
              onChange={handleFileChange}
              disabled={isUploading}
              style={{ display: 'none' }}
            />
            <span>&#128196;</span> {isUploading ? 'Parsing Dataset...' : 'Select Document'}
          </label>
        </div>

        {file && (
          <div style={{ marginTop: '12px', fontSize: '13.5px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Active Document: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
          </div>
        )}

        {/* Feedback Alerts */}
        {errorMsg && (
          <div style={{ marginTop: '16px', padding: '12px 18px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', fontSize: '13.5px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚠️</span> <strong>Error:</strong> {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{ marginTop: '16px', padding: '12px 18px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', fontSize: '13.5px', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✓</span> <strong>Success:</strong> {successMsg}
          </div>
        )}
      </section>

      {/* Main Workspace */}
      <main style={{ padding: '36px clamp(20px, 6vw, 80px)', flex: 1 }}>
        {uploadedData ? (
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border)', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
            {/* Header: File Info & Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '18px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                  <h2 style={{ fontSize: '22px', margin: 0, color: 'var(--text-main)', fontWeight: 700 }}>
                    {uploadedData.filename}
                  </h2>
                  <span
                    style={{
                      background: currentFormatStyle.bg,
                      color: currentFormatStyle.color,
                      border: `1px solid ${currentFormatStyle.border}`,
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {currentFormatStyle.label}
                  </span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                  Previewing first {uploadedData.preview_count || uploadedData.data.length} records &bull; {uploadedData.rows} total records across {uploadedData.columns.length} columns
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleDownload} className="demo-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>&#128190;</span> Export Clean CSV
                </button>
                <button
                  onClick={handleResetData}
                  disabled={isCleaning}
                  className="demo-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>&#8634;</span> Reset
                </button>
              </div>
            </div>

            {/* Segmented Tab Navigation */}
            <div className="tab-container">
              <button
                onClick={() => setActiveTab('preview')}
                className={`tab-button ${activeTab === 'preview' ? 'active' : ''}`}
              >
                <span>&#128203;</span> Data Preview
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
              >
                <span>&#128202;</span> Statistical Profiling
              </button>
              <button
                onClick={() => setActiveTab('cleaning')}
                className={`tab-button ${activeTab === 'cleaning' ? 'active' : ''}`}
              >
                <span>&#9881;</span> Cleaning Studio
              </button>
              <button
                onClick={() => setActiveTab('visualize')}
                className={`tab-button ${activeTab === 'visualize' ? 'active' : ''}`}
              >
                <span>&#128200;</span> Visualizations
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
                style={{
                  color: activeTab === 'chat' ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: activeTab === 'chat' ? 700 : 600,
                }}
              >
                <span>&#129302;</span> AI Assistant
              </button>
            </div>

            {/* TAB 1: DATA PREVIEW */}
            {activeTab === 'preview' && (
              <div>
                {/* Schema Badges */}
                <div style={{ marginBottom: '18px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginRight: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Detected Schema & Inferred Data Types:
                  </span>
                  <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                    {uploadedData.columns.map((col) => {
                      const typeLabel = uploadedData.column_types?.[col] || 'text'
                      return (
                        <span
                          key={col}
                          style={{
                            background: 'var(--bg-subtle)',
                            color: 'var(--text-main)',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            border: '1px solid var(--border)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          {col}
                          <span
                            style={{
                              fontSize: '10px',
                              color: typeLabel === 'integer' || typeLabel === 'numeric' ? 'var(--badge-text)' : 'var(--text-secondary)',
                              background: typeLabel === 'integer' || typeLabel === 'numeric' ? 'var(--badge-bg)' : 'var(--bg-card)',
                              border: '1px solid var(--border)',
                              padding: '1px 5px',
                              borderRadius: '4px',
                            }}
                          >
                            {typeLabel}
                          </span>
                        </span>
                      )
                    })}
                  </div>
                </div>

                {/* Table */}
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '50px' }}>#</th>
                        {uploadedData.columns.map((col) => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {uploadedData.data.map((row, idx) => (
                        <tr key={idx}>
                          <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{idx + 1}</td>
                          {uploadedData.columns.map((col) => (
                            <td key={col}>
                              {row[col] !== null && row[col] !== undefined ? (
                                String(row[col])
                              ) : (
                                <span style={{ color: '#ef4444', fontStyle: 'italic', background: '#fef2f2', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>
                                  null
                                </span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: STATISTICAL PROFILING */}
            {activeTab === 'profile' && profile && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                  <div className="kpi-card">
                    <small style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Dimensions</small>
                    <strong style={{ fontSize: '24px', color: 'var(--text-main)', display: 'block', marginTop: '4px' }}>
                      {profile.overview.total_rows} &times; {profile.overview.total_columns}
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Rows &bull; Columns</span>
                  </div>

                  <div className="kpi-card">
                    <small style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Duplicate Rows</small>
                    <strong style={{ fontSize: '24px', color: profile.overview.duplicate_rows > 0 ? '#ef4444' : '#10b981', display: 'block', marginTop: '4px' }}>
                      {profile.overview.duplicate_rows}
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {profile.overview.duplicate_rows > 0 ? 'Duplicates detected' : '0 Duplicates (Clean)'}
                    </span>
                  </div>

                  <div className="kpi-card">
                    <small style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Missing Values</small>
                    <strong style={{ fontSize: '24px', color: profile.overview.missing_cells > 0 ? '#f59e0b' : '#10b981', display: 'block', marginTop: '4px' }}>
                      {profile.overview.missing_cells}
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {profile.overview.missing_percentage}% of dataset cells
                    </span>
                  </div>

                  <div className="kpi-card">
                    <small style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Memory Footprint</small>
                    <strong style={{ fontSize: '24px', color: 'var(--text-main)', display: 'block', marginTop: '4px' }}>
                      {profile.overview.memory_usage_kb} KB
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Pandas RAM footprint</span>
                  </div>
                </div>

                {/* Numeric Summary Table */}
                {profile.numeric_summary.length > 0 && (
                  <div style={{ marginBottom: '28px' }}>
                    <h3 style={{ fontSize: '16px', color: 'var(--text-main)', marginBottom: '12px', fontWeight: 700 }}>
                      Numeric Metric Distributions
                    </h3>
                    <div className="table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Column</th>
                            <th>Count</th>
                            <th>Missing</th>
                            <th>Mean</th>
                            <th>Median</th>
                            <th>Std Dev</th>
                            <th>Min</th>
                            <th>Max</th>
                            <th>25%</th>
                            <th>75%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.numeric_summary.map((col, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600 }}>{col.column}</td>
                              <td>{col.count}</td>
                              <td style={{ color: col.missing > 0 ? '#ef4444' : '#10b981' }}>{col.missing}</td>
                              <td>{col.mean?.toLocaleString()}</td>
                              <td>{col.median?.toLocaleString()}</td>
                              <td>{col.std?.toLocaleString()}</td>
                              <td>{col.min?.toLocaleString()}</td>
                              <td>{col.max?.toLocaleString()}</td>
                              <td>{col.q25?.toLocaleString()}</td>
                              <td>{col.q75?.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Categorical Summary Table */}
                {profile.categorical_summary.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '16px', color: 'var(--text-main)', marginBottom: '12px', fontWeight: 700 }}>
                      Categorical & Text Metrics
                    </h3>
                    <div className="table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Column</th>
                            <th>Count</th>
                            <th>Missing</th>
                            <th>Unique Values</th>
                            <th>Top Value (Mode)</th>
                            <th>Top Frequency</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.categorical_summary.map((col, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600 }}>{col.column}</td>
                              <td>{col.count}</td>
                              <td style={{ color: col.missing > 0 ? '#ef4444' : '#10b981' }}>{col.missing}</td>
                              <td>{col.unique}</td>
                              <td>{col.top_value || 'None'}</td>
                              <td>{col.top_frequency}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: CLEANING STUDIO */}
            {activeTab === 'cleaning' && (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '17px', color: 'var(--text-main)', marginBottom: '4px', fontWeight: 700 }}>
                    Data Cleaning & Transformation Studio
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
                    Execute verified cleaning routines to prepare your dataset for high-precision analytical modeling.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                  <div className="kpi-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '18px' }}>&#128465;</span>
                      <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--text-main)', fontWeight: 700 }}>Deduplication</h4>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5, marginBottom: '16px' }}>
                      Purge exact duplicate records across all dataset rows.
                    </p>
                    <button
                      onClick={() => executeClean({ drop_duplicates: true })}
                      disabled={isCleaning}
                      className="upload-btn"
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      {isCleaning ? 'Processing...' : 'Remove Duplicates'}
                    </button>
                  </div>

                  <div className="kpi-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '18px' }}>&#128394;</span>
                      <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--text-main)', fontWeight: 700 }}>Auto Imputation</h4>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5, marginBottom: '16px' }}>
                      Imputes numeric nulls with median and categorical with mode.
                    </p>
                    <button
                      onClick={() => executeClean({ impute_missing: 'auto' })}
                      disabled={isCleaning}
                      className="upload-btn"
                      style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' }}
                    >
                      {isCleaning ? 'Processing...' : 'Impute Missing Values'}
                    </button>
                  </div>

                  <div className="kpi-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '18px' }}>&#10060;</span>
                      <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--text-main)', fontWeight: 700 }}>Drop Incomplete Rows</h4>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5, marginBottom: '16px' }}>
                      Permanently drops any row containing empty cells.
                    </p>
                    <button
                      onClick={() => executeClean({ drop_missing: true })}
                      disabled={isCleaning}
                      className="upload-btn"
                      style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
                    >
                      {isCleaning ? 'Processing...' : 'Drop Missing Rows'}
                    </button>
                  </div>

                  <div className="kpi-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '18px' }}>&#9998;</span>
                      <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--text-main)', fontWeight: 700 }}>Standardize Headers</h4>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5, marginBottom: '16px' }}>
                      Converts column headers to trimmed lowercase snake_case.
                    </p>
                    <button
                      onClick={() => executeClean({ standardize_headers: true })}
                      disabled={isCleaning}
                      className="upload-btn"
                      style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                    >
                      {isCleaning ? 'Processing...' : 'Standardize Headers'}
                    </button>
                  </div>
                </div>

                {/* Audit Changelog */}
                <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                  <h4 style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <span>&#128221;</span> Cleaning Audit Trail
                  </h4>
                  {changelog.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.8 }}>
                      {changelog.map((log, idx) => (
                        <li key={idx}>
                          <strong style={{ color: 'var(--primary)' }}>✓</strong> {log}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                      No modifications applied yet. Select an operation above to clean the active dataset.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: VISUALIZATIONS STUDIO */}
            {activeTab === 'visualize' && (
              <div>
                {/* Recommended Charts Quick Bar */}
                {uploadedData.recommendations && uploadedData.recommendations.length > 0 && (
                  <div style={{ marginBottom: '24px', background: 'var(--bg-subtle)', padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '16px' }}>&#10024;</span>
                      <strong style={{ color: 'var(--text-main)', fontSize: '13.5px' }}>Smart Recommended Visualizations:</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {uploadedData.recommendations.map((rec) => (
                        <button
                          key={rec.id}
                          onClick={() => applyRecommendation(rec)}
                          style={{
                            padding: '7px 14px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            color: 'var(--text-main)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: 'var(--shadow-sm)',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--primary)'
                            e.currentTarget.style.color = 'var(--primary)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border)'
                            e.currentTarget.style.color = 'var(--text-main)'
                          }}
                        >
                          <span style={{ fontSize: '10px', textTransform: 'uppercase', background: 'var(--badge-bg)', color: 'var(--badge-text)', padding: '2px 5px', borderRadius: '4px' }}>
                            {rec.chart_type}
                          </span>
                          {rec.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chart Controls */}
                <div
                  style={{
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '24px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '16px',
                    alignItems: 'end',
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Chart Type
                    </label>
                    <select
                      value={chartType}
                      onChange={(e) => setChartType(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                    >
                      <option value="bar">Bar Chart</option>
                      <option value="line">Line Chart</option>
                      <option value="scatter">Scatter Plot</option>
                      <option value="pie">Pie / Donut Chart</option>
                      <option value="histogram">Histogram</option>
                      <option value="box">Box Plot</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      X-Axis / Category
                    </label>
                    <select
                      value={xAxisCol}
                      onChange={(e) => setXAxisCol(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                    >
                      {uploadedData.columns.map((col) => (
                        <option key={col} value={col}>
                          {col} ({uploadedData.column_types?.[col] || 'text'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {chartType !== 'histogram' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Y-Axis / Metric
                      </label>
                      <select
                        value={yAxisCol}
                        onChange={(e) => setYAxisCol(e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                      >
                        <option value="">None / Frequency</option>
                        {uploadedData.columns.map((col) => (
                          <option key={col} value={col}>
                            {col} ({uploadedData.column_types?.[col] || 'text'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {chartType !== 'scatter' && chartType !== 'histogram' && chartType !== 'box' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Aggregation
                      </label>
                      <select
                        value={aggregation}
                        onChange={(e) => setAggregation(e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                      >
                        <option value="sum">Sum</option>
                        <option value="mean">Mean</option>
                        <option value="count">Count</option>
                        <option value="min">Min</option>
                        <option value="max">Max</option>
                        <option value="none">None (Raw values)</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <button
                      onClick={() => handleGenerateChart()}
                      disabled={isRenderingChart}
                      className="upload-btn"
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      {isRenderingChart ? 'Rendering...' : 'Plot Chart'}
                    </button>
                  </div>
                </div>

                {/* Plotly Canvas Container */}
                {currentChart ? (
                  <div style={{ border: '1px solid var(--border)', borderRadius: '14px', padding: '20px', background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
                    <PlotlyChart data={currentChart.data} layout={currentChart.layout} theme={currentTheme} />

                    {chartInsights && (
                      <div style={{ marginTop: '20px', padding: '14px 18px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: '10px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <span style={{ fontSize: '18px' }}>&#128161;</span>
                        <div>
                          <strong style={{ fontSize: '13px', color: 'var(--primary)', display: 'block', marginBottom: '2px' }}>
                            Statistical Data Insights:
                          </strong>
                          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            {chartInsights}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '12px' }}>
                    <p>Select chart parameters above and click "Plot Chart" to render.</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: AI DATA BOT */}
            {activeTab === 'chat' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '17px', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                      <span>&#129302;</span> DataGraph AI Assistant
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '3px' }}>
                      Query your dataset in natural English. Powered by verified Pandas execution & auto-visualization.
                    </p>
                  </div>

                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: geminiApiKey ? 'var(--badge-bg)' : 'var(--bg-subtle)',
                      color: geminiApiKey ? 'var(--badge-text)' : 'var(--text-muted)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {geminiApiKey ? '✨ Gemini Live Active' : '⚙️ Built-in Engine Active'}
                  </span>
                </div>

                {/* Suggested Prompts */}
                <div style={{ marginBottom: '16px' }}>
                  <small style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700, display: 'block', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Suggested Prompts:
                  </small>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {SAMPLE_QUESTIONS.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendChatMessage(q)}
                        disabled={isAgentThinking}
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          borderRadius: '20px',
                          padding: '6px 14px',
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: 'var(--shadow-sm)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--primary)'
                          e.currentTarget.style.color = 'var(--primary)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border)'
                          e.currentTarget.style.color = 'var(--text-secondary)'
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message Feed */}
                <div
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: '14px',
                    padding: '20px',
                    minHeight: '380px',
                    maxHeight: '520px',
                    overflowY: 'auto',
                    background: 'var(--bg-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    marginBottom: '16px',
                  }}
                >
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          maxWidth: msg.sender === 'user' ? '70%' : '88%',
                          background: msg.sender === 'user' ? 'var(--primary-gradient)' : 'var(--bg-card)',
                          color: msg.sender === 'user' ? (currentTheme === 'graphite' ? '#090a0d' : '#ffffff') : 'var(--text-main)',
                          padding: '14px 18px',
                          borderRadius: msg.sender === 'user' ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                          border: msg.sender === 'user' ? 'none' : '1px solid var(--border)',
                          boxShadow: msg.sender === 'user' ? 'var(--shadow-sm)' : 'var(--shadow-sm)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '12px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', opacity: 0.8 }}>
                            {msg.sender === 'user' ? 'You' : 'DataGraph AI Agent'}
                          </span>
                          <span style={{ fontSize: '10px', opacity: 0.6 }}>{msg.timestamp}</span>
                        </div>

                        <div style={{ fontSize: '13.5px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {msg.text}
                        </div>

                        {msg.code && (
                          <div style={{ marginTop: '12px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', padding: '10px 14px', borderRadius: '8px', color: 'var(--primary)', fontSize: '12px', fontFamily: 'monospace' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}>
                              Pandas Code Executed:
                            </div>
                            <code>{msg.code}</code>
                          </div>
                        )}

                        {msg.chart && (
                          <div style={{ marginTop: '14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px' }}>
                            <PlotlyChart data={msg.chart.data} layout={msg.chart.layout} theme={currentTheme} style={{ minHeight: '340px' }} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {isAgentThinking && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontSize: '13px', fontStyle: 'italic', padding: '8px' }}>
                      <span className="logo-badge" style={{ width: '20px', height: '20px', fontSize: '11px' }}>&#9650;</span>
                      Computing Pandas operations & reasoning...
                    </div>
                  )}

                  <div ref={chatBottomRef} />
                </div>

                {/* Input Bar */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleSendChatMessage()
                  }}
                  style={{ display: 'flex', gap: '10px' }}
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask a question about your data or request a chart (e.g. 'Plot revenue by department')..."
                    disabled={isAgentThinking}
                    style={{
                      flex: 1,
                      padding: '12px 18px',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      fontSize: '13.5px',
                      outline: 'none',
                      background: 'var(--bg-card)',
                      color: 'var(--text-main)',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isAgentThinking || !chatInput.trim()}
                    className="upload-btn"
                    style={{ padding: '12px 24px', opacity: isAgentThinking || !chatInput.trim() ? 0.6 : 1 }}
                  >
                    {isAgentThinking ? 'Thinking...' : 'Send'}
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              background: 'var(--bg-card)',
              border: '2px dashed var(--border)',
              borderRadius: '16px',
              padding: '60px 20px',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ fontSize: '42px', marginBottom: '14px' }}>&#128202;</div>
            <h3 style={{ fontSize: '18px', color: 'var(--text-main)', marginBottom: '8px', fontWeight: 700 }}>
              Ready for Document Analysis & AI Agent Querying
            </h3>
            <p style={{ maxWidth: '480px', margin: '0 auto 20px', fontSize: '14px', lineHeight: 1.5 }}>
              Upload any dataset or choose <code style={{ background: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>data/employees.csv</code> to query the AI Data Analyst agent.
            </p>
          </div>
        )}
      </main>

      {/* Modern Footer */}
      <footer>
        <div className="logo">
          <span className="logo-badge" style={{ width: '24px', height: '24px', fontSize: '12px' }}>&#9650;</span>
          DataGraph <span>AI</span>
        </div>
        <p>DataGraph AI &bull; Cloud-Based Agentic Data Analytics Platform</p>
      </footer>
    </div>
  )
}

export default App
