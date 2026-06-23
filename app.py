from flask import (
    Flask,
    render_template,
    send_file,
    request,
    jsonify,
    session,
    redirect,
    url_for,
)
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import os
import mimetypes
import json
from pathlib import Path
from datetime import datetime

app = Flask(__name__)
app.secret_key = (
    "2.0lajjjdta657321bksxa123f45EWQoksbi"  # Change this to a random secret key
)

# Configuration
SHARED_FOLDER = "/mnt/HDD/"  # Folder to share
PASSWORD_HASH = generate_password_hash(
    "newhope4NewLife"
)  # Default password: admin123 - change as needed
ALLOWED_EXTENSIONS = set(
    [
        "txt",
        "pdf",
        "png",
        "jpg",
        "jpeg",
        "gif",
        "doc",
        "docx",
        "xls",
        "xlsx",
        "zip",
        "mp4",
        "mp3",
    ]
)

# Create shared folder if it doesn't exist
os.makedirs(SHARED_FOLDER, exist_ok=True)

# Trash Configuration
TRASH_FOLDER = os.path.join(SHARED_FOLDER, ".trash")
os.makedirs(TRASH_FOLDER, exist_ok=True)
TRASH_METADATA_FILE = os.path.join(TRASH_FOLDER, ".metadata.json")

# Token-based active downloads storage
active_downloads = {}


def login_required(f):
    from functools import wraps

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("logged_in"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)

    return decorated_function


def load_trash_metadata():
    if not os.path.exists(TRASH_METADATA_FILE):
        return {}
    try:
        with open(TRASH_METADATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_trash_metadata(meta):
    try:
        with open(TRASH_METADATA_FILE, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=4)
    except Exception as e:
        print("Error saving trash metadata:", e)


def get_file_info(filepath):
    """Get file metadata with relative path for global searches"""
    stat = os.stat(filepath)
    rel_path = os.path.relpath(filepath, SHARED_FOLDER)
    if rel_path == ".":
        rel_path = ""
    return {
        "name": os.path.basename(filepath),
        "path": rel_path,
        "size": stat.st_size,
        "modified": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
        "type": (
            "folder"
            if os.path.isdir(filepath)
            else mimetypes.guess_type(filepath)[0] or "unknown"
        ),
        "is_dir": os.path.isdir(filepath),
    }


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        password = request.form.get("password")
        if check_password_hash(PASSWORD_HASH, password):
            session["logged_in"] = True
            return redirect(url_for("index"))
        return render_template("login.html", error="Invalid password")
    return render_template("login.html")


@app.route("/logout")
def logout():
    session.pop("logged_in", None)
    return redirect(url_for("login"))


@app.route("/")
@login_required
def index():
    return render_template("index.html")


@app.route("/api/files")
@login_required
def list_files():
    """API endpoint to list files"""
    path = request.args.get("path", "")
    full_path = os.path.join(SHARED_FOLDER, path)

    # Security check: prevent directory traversal
    if not os.path.abspath(full_path).startswith(os.path.abspath(SHARED_FOLDER)):
        return jsonify({"error": "Invalid path"}), 403

    if not os.path.exists(full_path):
        return jsonify({"error": "Path not found"}), 404

    files = []
    try:
        for item in os.listdir(full_path):
            if item.startswith(".") or item == ".trash":
                continue
            item_path = os.path.join(full_path, item)
            files.append(get_file_info(item_path))
    except PermissionError:
        return jsonify({"error": "Permission denied"}), 403

    return jsonify(
        {
            "path": path,
            "files": sorted(files, key=lambda x: (not x["is_dir"], x["name"].lower())),
        }
    )


@app.route("/api/download")
@login_required
def download_file():
    """Download a file"""
    path = request.args.get("path", "")
    full_path = os.path.join(SHARED_FOLDER, path)

    # Security check
    if not os.path.abspath(full_path).startswith(os.path.abspath(SHARED_FOLDER)):
        return jsonify({"error": "Invalid path"}), 403

    if not os.path.isfile(full_path):
        return jsonify({"error": "File not found"}), 404

    return send_file(full_path, as_attachment=True)


@app.route("/api/upload", methods=["POST"])
@login_required
def upload_file():
    """Upload a file"""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    path = request.form.get("path", "")

    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    filename = secure_filename(file.filename)
    full_path = os.path.join(SHARED_FOLDER, path, filename)

    # Security check
    if not os.path.abspath(full_path).startswith(os.path.abspath(SHARED_FOLDER)):
        return jsonify({"error": "Invalid path"}), 403

    file.save(full_path)
    return jsonify({"success": True, "filename": filename})


@app.route("/api/preview")
@login_required
def preview_file():
    """Preview a file (for images, videos, etc.)"""
    path = request.args.get("path", "")
    full_path = os.path.join(SHARED_FOLDER, path)

    # Security check
    if not os.path.abspath(full_path).startswith(os.path.abspath(SHARED_FOLDER)):
        return jsonify({"error": "Invalid path"}), 403

    if not os.path.isfile(full_path):
        return jsonify({"error": "File not found"}), 404

    return send_file(full_path)


@app.route("/api/create-folder", methods=["POST"])
@login_required
def create_folder():
    """Create a new folder"""
    data = request.get_json() or {}
    path = data.get("path", "")
    folder_name = secure_filename(data.get("name", ""))
    
    if not folder_name:
        return jsonify({"error": "Invalid folder name"}), 400
        
    full_path = os.path.join(SHARED_FOLDER, path, folder_name)
    
    # Security check
    if not os.path.abspath(full_path).startswith(os.path.abspath(SHARED_FOLDER)):
        return jsonify({"error": "Invalid path"}), 403
        
    try:
        os.makedirs(full_path, exist_ok=False)
        return jsonify({"success": True})
    except FileExistsError:
        return jsonify({"error": "Folder already exists"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/delete", methods=["POST"])
@login_required
def delete_item():
    """Move a file or folder to trash (or delete permanently if already in trash)"""
    data = request.get_json() or {}
    path = data.get("path", "")
    full_path = os.path.join(SHARED_FOLDER, path)
    
    # Security check
    if not os.path.abspath(full_path).startswith(os.path.abspath(SHARED_FOLDER)):
        return jsonify({"error": "Invalid path"}), 403
        
    if not os.path.exists(full_path):
        return jsonify({"error": "Item not found"}), 404
        
    # Check if deleting inside trash folder (permanent delete)
    if os.path.abspath(full_path).startswith(os.path.abspath(TRASH_FOLDER)):
        try:
            if os.path.isdir(full_path):
                import shutil
                shutil.rmtree(full_path)
            else:
                os.remove(full_path)
            
            # Remove from metadata
            trash_id = os.path.basename(full_path)
            meta = load_trash_metadata()
            if trash_id in meta:
                del meta[trash_id]
                save_trash_metadata(meta)
            return jsonify({"success": True, "permanent": True})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # Otherwise, move to trash folder
    try:
        import uuid
        trash_id = str(uuid.uuid4())
        trash_path = os.path.join(TRASH_FOLDER, trash_id)
        
        import shutil
        shutil.move(full_path, trash_path)
        
        meta = load_trash_metadata()
        meta[trash_id] = {
            "name": os.path.basename(full_path),
            "original_path": path,
            "deleted_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        save_trash_metadata(meta)
        return jsonify({"success": True, "trash": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/rename", methods=["POST"])
@login_required
def rename_item():
    """Rename a file or folder"""
    data = request.get_json() or {}
    path = data.get("path", "")
    new_name = secure_filename(data.get("new_name", ""))
    
    if not new_name:
        return jsonify({"error": "Invalid name"}), 400
        
    full_path = os.path.join(SHARED_FOLDER, path)
    parent_dir = os.path.dirname(full_path)
    new_full_path = os.path.join(parent_dir, new_name)
    
    # Security check
    if not os.path.abspath(full_path).startswith(os.path.abspath(SHARED_FOLDER)) or \
       not os.path.abspath(new_full_path).startswith(os.path.abspath(SHARED_FOLDER)):
        return jsonify({"error": "Invalid path"}), 403
        
    if not os.path.exists(full_path):
        return jsonify({"error": "Item not found"}), 404
        
    try:
        os.rename(full_path, new_full_path)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# NEW STORAGE statistics
@app.route("/api/storage-info")
@login_required
def storage_info():
    """Calculate and return disk storage pools dynamically"""
    import shutil
    try:
        total, used, free = shutil.disk_usage(SHARED_FOLDER)
        return jsonify({
            "total": total,
            "used": used,
            "free": free,
            "percent": round((used / total) * 100, 1) if total > 0 else 0
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# NEW TRASH management
@app.route("/api/trash/list")
@login_required
def list_trash():
    """List all elements in the Trash bin"""
    meta = load_trash_metadata()
    updated_meta = {}
    list_items = []
    
    for trash_id, info in meta.items():
        trash_path = os.path.join(TRASH_FOLDER, trash_id)
        if os.path.exists(trash_path):
            updated_meta[trash_id] = info
            stat = os.stat(trash_path)
            list_items.append({
                "id": trash_id,
                "name": info["name"],
                "original_path": info["original_path"],
                "deleted_at": info.get("deleted_at", ""),
                "size": stat.st_size if os.path.isfile(trash_path) else 0,
                "is_dir": os.path.isdir(trash_path)
            })
            
    if len(meta) != len(updated_meta):
        save_trash_metadata(updated_meta)
        
    return jsonify(list_items)


@app.route("/api/trash/restore", methods=["POST"])
@login_required
def restore_trash_item():
    """Restore a trashed item back to its original location"""
    data = request.get_json() or {}
    trash_id = data.get("id", "")
    
    meta = load_trash_metadata()
    if trash_id not in meta:
        return jsonify({"error": "Item not found in trash"}), 404
        
    info = meta[trash_id]
    original_path = info["original_path"]
    trash_path = os.path.join(TRASH_FOLDER, trash_id)
    dest_path = os.path.join(SHARED_FOLDER, original_path)
    
    if not os.path.exists(trash_path):
        del meta[trash_id]
        save_trash_metadata(meta)
        return jsonify({"error": "File no longer exists in trash"}), 404
        
    # Ensure destination parent directory exists
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    
    # Handle name collisions at destination path
    if os.path.exists(dest_path):
        base, ext = os.path.splitext(dest_path)
        dest_path = f"{base}_restored_{int(datetime.now().timestamp())}{ext}"
        
    try:
        import shutil
        shutil.move(trash_path, dest_path)
        del meta[trash_id]
        save_trash_metadata(meta)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/trash/empty", methods=["POST"])
@login_required
def empty_trash():
    """Empty the Trash bin permanently"""
    meta = load_trash_metadata()
    errors = []
    
    for trash_id in list(meta.keys()):
        trash_path = os.path.join(TRASH_FOLDER, trash_id)
        try:
            if os.path.exists(trash_path):
                if os.path.isdir(trash_path):
                    import shutil
                    shutil.rmtree(trash_path)
                else:
                    os.remove(trash_path)
            del meta[trash_id]
        except Exception as e:
            errors.append(str(e))
            
    save_trash_metadata(meta)
    if errors:
        return jsonify({"success": False, "errors": errors}), 500
    return jsonify({"success": True})


# NEW FOLDER ZIP streaming download
@app.route("/api/download-folder")
@login_required
def download_folder():
    """Recursively zip a directory and stream it for download"""
    path = request.args.get("path", "")
    full_path = os.path.join(SHARED_FOLDER, path)
    
    if not os.path.abspath(full_path).startswith(os.path.abspath(SHARED_FOLDER)):
        return jsonify({"error": "Invalid path"}), 403
        
    if not os.path.isdir(full_path):
        return jsonify({"error": "Folder not found"}), 404
        
    import tempfile
    import shutil
    
    temp_dir = tempfile.mkdtemp()
    zip_base = os.path.join(temp_dir, os.path.basename(full_path) or "archive")
    
    try:
        archive_path = shutil.make_archive(zip_base, 'zip', full_path)
        
        def generate():
            with open(archive_path, 'rb') as f:
                while True:
                    chunk = f.read(8192)
                    if not chunk:
                        break
                    yield chunk
            try:
                shutil.rmtree(temp_dir)
            except Exception:
                pass
                
        from flask import Response
        filename = os.path.basename(archive_path)
        return Response(
            generate(),
            mimetype="application/zip",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# NEW FILE edit & creation
@app.route("/api/save-file", methods=["POST"])
@login_required
def save_file():
    """Save updated text content of an editable document"""
    data = request.get_json() or {}
    path = data.get("path", "")
    content = data.get("content", "")
    
    full_path = os.path.join(SHARED_FOLDER, path)
    
    if not os.path.abspath(full_path).startswith(os.path.abspath(SHARED_FOLDER)):
        return jsonify({"error": "Invalid path"}), 403
        
    if not os.path.isfile(full_path):
        return jsonify({"error": "File not found"}), 404
        
    try:
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/create-file", methods=["POST"])
@login_required
def create_file():
    """Create a new empty text file in the path"""
    data = request.get_json() or {}
    path = data.get("path", "")
    filename = secure_filename(data.get("name", ""))
    
    if not filename:
        return jsonify({"error": "Invalid filename"}), 400
        
    full_path = os.path.join(SHARED_FOLDER, path, filename)
    
    if not os.path.abspath(full_path).startswith(os.path.abspath(SHARED_FOLDER)):
        return jsonify({"error": "Invalid path"}), 403
        
    try:
        with open(full_path, "w", encoding="utf-8") as f:
            f.write("")
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# NEW RECURSIVE search
@app.route("/api/search")
@login_required
def search_files():
    """Global recursive query across subdirectories with extension filters"""
    query = request.args.get("query", "").lower()
    category = request.args.get("category", "")
    
    results = []
    cat_extensions = {
        "image": ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"],
        "video": ["mp4", "webm", "ogg", "mov", "mkv"],
        "audio": ["mp3", "wav", "ogg", "m4a", "flac", "aac"],
        "document": ["pdf", "doc", "docx", "xls", "xlsx", "txt", "md"],
        "code": ["txt", "md", "js", "py", "html", "css", "json", "xml", "csv", "log", "sh", "sql", "yaml", "yml", "c", "cpp", "h", "java", "ts", "go", "rs"]
    }
    
    for root, dirs, files in os.walk(SHARED_FOLDER):
        if ".trash" in root.split(os.sep):
            continue
            
        # Match folders
        for d in dirs:
            if d.startswith(".") or d == ".trash":
                continue
            if query in d.lower():
                full_dir_path = os.path.join(root, d)
                if not category:
                    results.append(get_file_info(full_dir_path))
                    
        # Match files
        for f in files:
            if f.startswith("."):
                continue
            ext = f.split(".")[-1].lower() if "." in f else ""
            
            if category and category in cat_extensions:
                if ext not in cat_extensions[category]:
                    continue
                    
            if query in f.lower():
                full_file_path = os.path.join(root, f)
                results.append(get_file_info(full_file_path))
                
    results = results[:100]  # Cap results for safety
    results.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
    return jsonify(results)


# NEW BATCH actions
@app.route("/api/batch-delete", methods=["POST"])
@login_required
def batch_delete():
    """Move multiple selected items to the trash bin"""
    data = request.get_json() or {}
    paths = data.get("paths", [])
    
    meta = load_trash_metadata()
    import uuid
    success_count = 0
    errors = []
    
    for path in paths:
        full_path = os.path.join(SHARED_FOLDER, path)
        if not os.path.abspath(full_path).startswith(os.path.abspath(SHARED_FOLDER)):
            errors.append(f"Invalid path: {path}")
            continue
        if not os.path.exists(full_path):
            errors.append(f"Not found: {path}")
            continue
            
        try:
            trash_id = str(uuid.uuid4())
            trash_path = os.path.join(TRASH_FOLDER, trash_id)
            import shutil
            shutil.move(full_path, trash_path)
            
            meta[trash_id] = {
                "name": os.path.basename(full_path),
                "original_path": path,
                "deleted_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            success_count += 1
        except Exception as e:
            errors.append(f"Error deleting {path}: {str(e)}")
            
    save_trash_metadata(meta)
    return jsonify({
        "success": len(errors) == 0,
        "success_count": success_count,
        "errors": errors
    })


@app.route("/api/batch-zip", methods=["POST"])
@login_required
def batch_zip():
    """Archive multiple files/folders into a single temporary ZIP for tokenized download"""
    data = request.get_json() or {}
    paths = data.get("paths", [])
    
    if not paths:
        return jsonify({"error": "No paths selected"}), 400
        
    import tempfile
    import zipfile
    import uuid
    
    temp_dir = tempfile.mkdtemp()
    zip_name = f"batch_download_{int(datetime.now().timestamp())}.zip"
    zip_path = os.path.join(temp_dir, zip_name)
    
    try:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for path in paths:
                full_path = os.path.join(SHARED_FOLDER, path)
                
                if not os.path.abspath(full_path).startswith(os.path.abspath(SHARED_FOLDER)):
                    continue
                if not os.path.exists(full_path):
                    continue
                    
                if os.path.isdir(full_path):
                    for root, dirs, files in os.walk(full_path):
                        for file in files:
                            file_full_path = os.path.join(root, file)
                            arcname = os.path.relpath(file_full_path, os.path.dirname(full_path))
                            zipf.write(file_full_path, arcname)
                else:
                    zipf.write(full_path, os.path.basename(full_path))
                    
        token = str(uuid.uuid4())
        active_downloads[token] = {
            "path": zip_path,
            "temp_dir": temp_dir,
            "name": zip_name
        }
        return jsonify({"success": True, "download_url": f"/api/download-zip?token={token}"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/download-zip")
@login_required
def download_zip():
    """Serve a tokenized ZIP archive and clear temp files immediately after stream"""
    token = request.args.get("token", "")
    if token not in active_downloads:
        return jsonify({"error": "Invalid or expired token"}), 400
        
    download_info = active_downloads[token]
    zip_path = download_info["path"]
    temp_dir = download_info["temp_dir"]
    zip_name = download_info["name"]
    
    if not os.path.exists(zip_path):
        return jsonify({"error": "Archive file not found"}), 404
        
    def generate():
        with open(zip_path, 'rb') as f:
            while True:
                chunk = f.read(8192)
                if not chunk:
                    break
                yield chunk
        try:
            import shutil
            shutil.rmtree(temp_dir)
        except Exception:
            pass
        active_downloads.pop(token, None)
        
    from flask import Response
    return Response(
        generate(),
        mimetype="application/zip",
        headers={"Content-Disposition": f"attachment; filename={zip_name}"}
    )


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8765))
    debug = os.getenv("FLASK_ENV", "production") == "development"
    print(f"Sharing folder: {SHARED_FOLDER}")
    print(f"Default password: admin123")
    print(f"Server starting on http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
