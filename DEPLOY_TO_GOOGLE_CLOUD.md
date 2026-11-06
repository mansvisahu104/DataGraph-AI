# 🚀 Deploying DataGraph AI to Google Cloud (Cloud Run)

This guide walks you through deploying **DataGraph AI** (FastAPI backend + React 19 Plotly frontend + Agentic AI Engine) to **Google Cloud Run**.

Google Cloud Run is a fully-managed serverless platform that gives you:
- **Automatic HTTPS / SSL certificate**
- **Automatic scaling** (scales to 0 when idle to save money)
- **Generous Free Tier**: 2,000,000 requests/month free
- **Single Unified URL**: Both the React frontend UI and FastAPI backend run from one clean domain (e.g. `https://datagraph-ai-xyz-uc.a.run.app`) with zero CORS complications.

---

## 🌟 Choose Your Deployment Method

### **Method 1: 1-Click Continuous Deployment via GitHub (Easiest — No CLI / No Docker needed on your PC)**

This is the recommended approach if you do not want to install Docker or the Google Cloud CLI locally.

1. **Create a GitHub Repository**:
   - Go to [github.com/new](https://github.com/new) and create a repository named `DataGraph-AI`.
   - In your PowerShell terminal, link your repository and push:
     ```powershell
     cd "C:\Users\mansv\OneDrive\Desktop\Ai DataGraph\DataGraph-AI"
     git remote add origin https://github.com/YOUR_GITHUB_USERNAME/DataGraph-AI.git
     git push -u origin main
     ```

2. **Open Google Cloud Run Console**:
   - Navigate to [Google Cloud Run Console](https://console.cloud.google.com/run).
   - If you don't have a Google Cloud project yet, create one (e.g. `datagraph-ai-prod`).
   - Enable billing (Google Cloud provides \$300 in free trial credits).

3. **Create the Cloud Run Service**:
   - Click **"Create Service"** at the top.
   - Choose **"Continuously deploy from a repository"**.
   - Click **"Set up with Cloud Build"**.
   - Select **GitHub** as your repository provider and authorize Google Cloud.
   - Select your repository (`DataGraph-AI`) and branch (`^main$`).
   - For **Build Type**, select **Dockerfile** (the path is already set to `/Dockerfile`).
   - Click **Save**.

4. **Configure Service Settings**:
   - **Service Name**: `datagraph-ai`
   - **Region**: Choose a region near you (e.g., `asia-south1` for Mumbai, `us-central1` for US, or `europe-west1` for Europe).
   - **CPU allocation**: Select *"CPU is only allocated during request processing"* (Free Tier friendly).
   - **Authentication**: Choose **"Allow unauthenticated invocations"** (public access so anyone can visit the dashboard).
   - *(Optional)* In **Container, Networking, Security** -> **Variables**, add:
     - `GEMINI_API_KEY`: *(Your Google Gemini API key)*
   - Click **Create**.

5. **Deployment Complete**:
   - In about 2-3 minutes, Google Cloud Build finishes compiling your React app and Python container.
   - Click the generated URL (e.g., `https://datagraph-ai-xxxx-uc.a.run.app`) to open your live dashboard!

---

### **Method 2: Google Cloud Shell (Free In-Browser Terminal)**

Google Cloud includes a free, Linux terminal right inside your web browser with `gcloud`, `git`, and `docker` pre-installed.

1. Open [Google Cloud Shell](https://shell.cloud.google.com/).
2. Clone your repository:
   ```bash
   git clone https://github.com/YOUR_GITHUB_USERNAME/DataGraph-AI.git
   cd DataGraph-AI
   ```
3. Run the 1-line deployment command:
   ```bash
   gcloud run deploy datagraph-ai \
     --source . \
     --region us-central1 \
     --allow-unauthenticated
   ```
4. Confirm any prompts to enable Cloud Build and Artifact Registry APIs.
5. In ~2 minutes, Google Cloud Shell prints your live HTTPS URL!

---

### **Method 3: Google Cloud CLI (`gcloud`) on your PC**

If you prefer to deploy directly from your Windows PowerShell:

1. Download and run the **[Google Cloud SDK Installer](https://cloud.google.com/sdk/docs/install)**.
2. In PowerShell, authenticate and set your project:
   ```powershell
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```
3. Deploy directly from the folder:
   ```powershell
   cd "C:\Users\mansv\OneDrive\Desktop\Ai DataGraph\DataGraph-AI"
   gcloud run deploy datagraph-ai --source . --region us-central1 --allow-unauthenticated
   ```

---

## 🛠️ Architecture Overview

```
Google Cloud Run (Serverless Container)
│
├── Port 8080 (HTTPS Managed by Google)
│
├── FastAPI Unified Router (backend/main.py)
│    ├── /upload          -> Multi-format parser (CSV, Excel, Word, PDF)
│    ├── /clean           -> Automated profiling & cleaning studio
│    ├── /visualize       -> Plotly chart generator & recommendation engine
│    ├── /chat            -> Gemini AI agent + Pandas query executor
│    ├── /health          -> Cloud health probe
│    └── / (Catch-all)    -> React 19 Frontend SPA (from /app/static)
```
