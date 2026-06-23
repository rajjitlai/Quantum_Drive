# File Server with Custom UI

A Python-based file server with a Google Drive-inspired interface, password protection, and file management features.

## Features

- 🔐 Password-protected access
- 🎨 Modern Google Drive-like UI
- 📁 Browse folders and files
- 📥 Download files
- 📤 Upload files
- 🔍 Search functionality
- 👁️ Grid and list view modes
- 📱 Responsive design
- 🌐 Network accessible

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure the server (optional):
   - Edit `app.py` to change:
     - `SHARED_FOLDER`: The folder you want to share (default: `shared_files`)
     - `PASSWORD_HASH`: Change the default password (default: `admin123`)
     - `app.secret_key`: Change to a random secret key for production

3. Create the shared folder:
   - The folder `shared_files` will be created automatically
   - Or set `SHARED_FOLDER` in `app.py` to an existing folder path

## Usage

1. Start the server:
```bash
python app.py
```

2. Access from any device on the same network:
   - From the same computer: http://localhost:8000
   - From other devices: http://YOUR_IP:8000 (e.g., http://192.168.1.100:8000)

3. Login with password (default: `admin123`)

4. Browse, upload, and download files

## Finding Your IP Address

### Windows (PowerShell):
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter

### Linux/Mac:
```bash
ip addr show
# or
ifconfig
```

## Security Notes

- Change the default password in `app.py`
- Change the `secret_key` in production
- Only use on trusted networks (home/office)
- For production use, consider adding HTTPS support

## Customization

### Change Password
Edit `app.py`:
```python
PASSWORD_HASH = generate_password_hash('your-new-password')
```

### Change Shared Folder
Edit `app.py`:
```python
SHARED_FOLDER = r"C:\path\to\your\folder"
```

### Change Port
Edit `app.py` (bottom of file):
```python
app.run(host='0.0.0.0', port=8080)  # Change 8080 to your desired port
```

## File Structure

```
.
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── README.md             # This file
├── templates/
│   ├── login.html        # Login page
│   └── index.html        # Main file browser UI
└── shared_files/         # Default shared folder (auto-created)
```

## Supported File Types

All file types are supported for upload/download. The UI shows appropriate icons for:
- Documents (PDF, DOC, DOCX, XLS, XLSX)
- Images (JPG, PNG, GIF)
- Videos (MP4)
- Audio (MP3)
- Archives (ZIP)
- And more...

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Any modern browser

## Troubleshooting

### Can't access from other devices
- Check your firewall settings
- Ensure both devices are on the same network
- Use your actual IP address, not localhost

### Upload not working
- Check folder permissions
- Ensure `shared_files` folder exists and is writable

### Port already in use
- Change the port in `app.py` to a different number (e.g., 8080, 5000)
