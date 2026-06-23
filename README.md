# Quantum Drive - Secure File Server

A Python-based file server with a clean, Google Drive-inspired dark interface, password protection, and rich file management features.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub Repository](https://img.shields.io/badge/GitHub-rajjitlai%2FQuantum__Drive-green.svg)](https://github.com/rajjitlai/Quantum_Drive)

---

## 🎨 Features

- 🔐 **Password-Protected Access:** Secure login gateway using secure cryptographic hashes.
- 🎨 **Modern Dark UI:** Premium Outfit typography, glassmorphic styles, and interactive micro-animations.
- 📁 **File & Directory Management:** Create directories, rename items, and edit text documents directly in the browser.
- 📥 **Batch & Folder Downloader:** Zip whole folders or selected items dynamically and stream downloads with temporary security tokens.
- 🔍 **Recursive Search:** Search folders instantly with extension type categories (Images, Documents, Code, Video, Audio).
- 👁️ **Grid & List Views:** Toggle dynamic layout grids with customized desktop-like right-click context menus.
- 📤 **Drag-and-Drop Uploads:** Easily drag and drop folders/files into the browser view.
- 📊 **Disk Storage Widget:** Displays real-time disk storage allocation metrics dynamically using host metrics.
- 🐳 **Docker Containerization:** Seamless deployment via Docker Compose with CPU/memory limits, auto-start, and container healthchecks.

---

## ⚙️ Security Measures

- **Traversal Hardening:** All pathways are sanitized against directory traversal attacks (`../` sequences).
- **Hidden Resource Filtering:** Hidden files and folders (e.g. `.env`, `.git`, or custom database indexes) are automatically filtered out and blocked from API access.
- **Dynamic Secret Keys:** Generates cryptographically secure session signatures dynamically on startup if no key is configured.
- **Environment Isolation:** Credentials and sharing directories are entirely separated from the code, preventing accidental leaks.

---

## 🚀 Setup & Run

### 📦 Option 1: Native Installation

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/rajjitlai/Quantum_Drive.git
   cd Quantum_Drive
   ```

2. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment:**
   Copy the example environment file and configure your credentials:
   ```bash
   cp .env.example .env
   # Edit .env and change the ACCESS_PASSWORD immediately!
   ```

4. **Start the Server:**
   ```bash
   python app.py
   ```
   Access at `http://localhost:8765` (or your local IP address).

### 🐳 Option 2: Docker Compose (Recommended)

Start the container instantly in background detached mode:
```bash
docker-compose up -d
```
Docker Compose will automatically:
- Bind to the unique port `8765`.
- Mount `/mnt/HDD/` (or your configured `SHARED_FOLDER` from `.env`) as a volume.
- Restart automatically if it crashes or the server boots up.
- Enforce CPU and memory constraints.

See [DOCKER_SETUP.md](DOCKER_SETUP.md) for more details.

---

## 📁 Configuration File (`.env`)

You can customize server properties by editing the `.env` file:

- `SHARED_FOLDER`: The directory path on the host machine to share (default: `/mnt/HDD/`).
- `ACCESS_PASSWORD`: Plain text login password.
- `SECRET_KEY`: Custom string used for session cookie encryption. If left blank, a random one is generated on launch.

---

## 📜 License

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this project except in compliance with the License. You may obtain a copy of the License in the [LICENSE](LICENSE) file or at:

[http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)
