let currentPath = '';
let currentView = 'grid';
let allFiles = [];
let trashFiles = []; // Global cache for trash items
let selectedItem = null;
let selectedPaths = []; // Track selected paths for batch mode
let selectedIds = []; // Track selected trash UUIDs for batch mode
let detailsOpen = window.innerWidth > 1024;
let currentSortField = 'name';
let currentSortOrder = 'asc';
let isTrashMode = false;

// Search states
let activeSearchQuery = '';
let activeSearchCategory = '';

// API endpoints
const ENDPOINTS = {
    list: '/api/files',
    upload: '/api/upload',
    download: '/api/download',
    preview: '/api/preview',
    createFolder: '/api/create-folder',
    delete: '/api/delete',
    rename: '/api/rename'
};

// File extensions lists
const EXT_IMAGE = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
const EXT_VIDEO = ['mp4', 'webm', 'ogg', 'mov', 'mkv'];
const EXT_AUDIO = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'];
const EXT_CODE = ['txt', 'md', 'js', 'py', 'html', 'css', 'json', 'xml', 'csv', 'log', 'sh', 'sql', 'yaml', 'yml', 'c', 'cpp', 'h', 'java', 'ts', 'go', 'rs'];
const EXT_PDF = ['pdf'];

function getPathFromHash() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#path=')) {
        return decodeURIComponent(hash.substring(6));
    }
    return '';
}

// Reset context menu states
function resetContextMenu() {
    const ctxOpen = document.getElementById('ctxOpen');
    const ctxDownload = document.getElementById('ctxDownload');
    const ctxRename = document.getElementById('ctxRename');
    const ctxDelete = document.getElementById('ctxDelete');
    const ctxRestore = document.getElementById('ctxRestore');
    
    if (ctxOpen) ctxOpen.style.display = 'flex';
    if (ctxDownload) ctxDownload.style.display = 'flex';
    if (ctxRename) ctxRename.style.display = 'flex';
    
    if (ctxDelete) {
        ctxDelete.style.display = 'flex';
        ctxDelete.querySelector('span').textContent = 'Delete';
        ctxDelete.onclick = () => {
            closeContextMenu();
            showDeleteConfirm();
        };
    }
    if (ctxRestore) ctxRestore.style.display = 'none';
}

// Core File Lister
async function loadFiles(path = '', updateHash = true) {
    isTrashMode = false;
    document.getElementById('emptyTrashBtn').style.display = 'none';
    document.getElementById('driveNavLink').classList.add('active');
    document.getElementById('trashNavLink').classList.remove('active');
    resetContextMenu();
    showLoading(true);
    clearSelection();
    
    try {
        const url = `${ENDPOINTS.list}?path=${encodeURIComponent(path)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network error loading drive content');
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        currentPath = data.path;
        allFiles = data.files;

        if (updateHash) {
            window.location.hash = currentPath ? `path=${encodeURIComponent(cumulativeBackpath(currentPath))}` : '';
        }

        updateBreadcrumbs(currentPath);
        renderFiles(allFiles);
    } catch (error) {
        console.error(error);
        showToast(error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Helper helper
function cumulativeBackpath(p) {
    return p;
}

// Render Folder and Files sections
function renderFiles(items) {
    const folderGrid = document.getElementById('folderGrid');
    const fileGrid = document.getElementById('fileGrid');
    const fileListRows = document.getElementById('fileListRows');
    
    // Reset contents
    folderGrid.innerHTML = '';
    fileGrid.innerHTML = '';
    fileListRows.innerHTML = '';

    const folders = items.filter(i => i.is_dir);
    const files = items.filter(i => !i.is_dir);

    const field = currentSortField;
    const order = currentSortOrder === 'asc' ? 1 : -1;

    const sortFn = (a, b) => {
        if (field === 'name') {
            return a.name.localeCompare(b.name) * order;
        } else if (field === 'size') {
            const sizeA = a.is_dir ? 0 : (a.size || 0);
            const sizeB = b.is_dir ? 0 : (b.size || 0);
            return (sizeA - sizeB) * order;
        } else if (field === 'modified') {
            return (new Date(a.modified) - new Date(b.modified)) * order;
        }
        return 0;
    };

    const sortedFolders = [...folders].sort(sortFn);
    const sortedFiles = [...files].sort(sortFn);
    const sortedItems = [...sortedFolders, ...sortedFiles];

    // Toggle Titles
    document.getElementById('foldersTitle').classList.toggle('hidden', sortedFolders.length === 0 || currentView === 'list' || activeSearchQuery.length > 0);
    document.getElementById('filesTitle').classList.toggle('hidden', sortedFiles.length === 0 || currentView === 'list');
    document.getElementById('emptyState').classList.toggle('hidden', items.length > 0);

    if (currentView === 'grid') {
        document.getElementById('fileListContainer').classList.add('hidden');
        folderGrid.classList.remove('hidden');
        fileGrid.classList.remove('hidden');

        // Render folders
        sortedFolders.forEach(folder => {
            const card = createFolderCard(folder);
            folderGrid.appendChild(card);
        });

        // Render files
        sortedFiles.forEach(file => {
            const card = createFileCard(file);
            fileGrid.appendChild(card);
        });
    } else {
        document.getElementById('fileListContainer').classList.remove('hidden');
        folderGrid.classList.add('hidden');
        fileGrid.classList.add('hidden');

        // Render rows
        sortedItems.forEach(item => {
            const row = createListRow(item);
            fileListRows.appendChild(row);
        });
    }
}

// Create Folder Card UI
function createFolderCard(folder) {
    const card = document.createElement('div');
    card.className = 'folder-card';
    card.setAttribute('data-name', folder.name);
    const path = folder.path !== undefined ? folder.path : (currentPath ? `${currentPath}/${folder.name}` : folder.name);
    card.setAttribute('data-path', path);
    
    card.addEventListener('click', (e) => {
        if (e.target.closest('.select-trigger')) {
            e.stopPropagation();
            toggleSelect(folder, card);
        } else {
            // Navigate folder on main body click
            navigateTo(path);
        }
    });

    // Custom Context Menu Trigger
    card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectContextMenu(folder, card);
        showContextMenu(e, folder);
    });

    card.innerHTML = `
        <div class="select-trigger" title="Select item">
            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        </div>
        <svg class="folder-icon" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
        <div class="folder-info">
            <div class="folder-name" title="${folder.name}">${folder.name}</div>
            <div class="folder-count">${folder.modified.split(' ')[0]}</div>
            ${activeSearchQuery ? `<div style="font-size:10px; color:var(--text-dark); margin-top:2px;">/${folder.path}</div>` : ''}
        </div>
    `;
    return card;
}

// Create File Card UI
function createFileCard(file) {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.setAttribute('data-name', file.name);
    const path = file.path !== undefined ? file.path : (currentPath ? `${currentPath}/${file.name}` : file.name);
    card.setAttribute('data-path', path);

    card.addEventListener('click', (e) => {
        if (e.target.closest('.select-trigger')) {
            e.stopPropagation();
            toggleSelect(file, card);
        } else {
            // Open full preview modal
            openPreviewModal(file);
        }
    });

    // Custom Context Menu Trigger
    card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectContextMenu(file, card);
        showContextMenu(e, file);
    });

    card.innerHTML = `
        <div class="select-trigger" title="Select item">
            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        </div>
        <div class="file-thumbnail">
            ${getFileThumbnailMarkup(file)}
        </div>
        <div class="file-details">
            <div class="file-name" title="${file.name}">${file.name}</div>
            <div class="file-size">${formatBytes(file.size)}</div>
            ${activeSearchQuery ? `<div style="font-size:10px; color:var(--text-dark); margin-top:2px;">/${file.path}</div>` : ''}
        </div>
    `;
    return card;
}

// Create List Row UI
function createListRow(item) {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.setAttribute('data-name', item.name);
    const path = item.path !== undefined ? item.path : (currentPath ? `${currentPath}/${item.name}` : item.name);
    row.setAttribute('data-path', path);

    row.addEventListener('click', (e) => {
        if (e.target.closest('.select-trigger')) {
            e.stopPropagation();
            toggleSelect(item, row);
        } else {
            if (item.is_dir) {
                navigateTo(path);
            } else {
                openPreviewModal(item);
            }
        }
    });

    // Custom Context Menu Trigger
    row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectContextMenu(item, row);
        showContextMenu(e, item);
    });

    row.innerHTML = `
        <div class="select-trigger" title="Select item">
            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        </div>
        <div style="display: flex; align-items: center; gap: 14px; min-width: 0;">
            <div class="list-icon-wrapper">
                ${getFileIcon(item)}
            </div>
            <div class="list-name" title="${item.name}">${item.name}</div>
        </div>
        <div class="list-meta">${item.modified}</div>
        <div class="list-meta">${item.is_dir ? '--' : formatBytes(item.size)}</div>
    `;
    return row;
}

// Toggle Selection and Details Pane
function toggleSelect(item, domElement) {
    domElement.classList.toggle('selected');
    updateBatchSelection();
}

// Ensure context menu selection doesn't collapse but focuses details
function selectContextMenu(item, domElement) {
    clearSelection();
    domElement.classList.add('selected');
    selectedItem = item;
    updateBatchSelection();
}

function clearSelection() {
    document.querySelectorAll('.folder-card, .file-card, .list-row').forEach(el => {
        el.classList.remove('selected');
    });
    selectedItem = null;
    selectedPaths = [];
    selectedIds = [];
    const bar = document.getElementById('batchActionBar');
    if (bar) bar.classList.remove('active');
    renderDetailsEmpty();
}

function updateBatchSelection() {
    selectedPaths = [];
    selectedIds = [];
    
    const selectedEls = document.querySelectorAll('.folder-card.selected, .file-card.selected, .list-row.selected');
    selectedEls.forEach(el => {
        const p = el.getAttribute('data-path');
        if (p) selectedPaths.push(p);
        
        const id = el.getAttribute('data-id');
        if (id) selectedIds.push(id);
    });
    
    const bar = document.getElementById('batchActionBar');
    const countSpan = document.getElementById('batchSelectedCount');
    const dlBtn = bar.querySelector('.btn-action-primary');
    const delBtn = bar.querySelector('.btn-action-danger');
    
    const totalSelected = selectedEls.length;
    
    if (totalSelected > 0) {
        bar.classList.add('active');
        countSpan.textContent = `${totalSelected} item${totalSelected > 1 ? 's' : ''} selected`;
        
        if (isTrashMode) {
            dlBtn.innerHTML = '🔄 Restore Selected';
            delBtn.innerHTML = '🗑️ Delete Permanently';
        } else {
            dlBtn.innerHTML = '📥 Download ZIP';
            delBtn.innerHTML = '🗑️ Delete Selected';
        }
        
        // Render details based on selection count
        if (totalSelected === 1) {
            const item = findItemFromDom(selectedEls[0]);
            if (item) {
                selectedItem = item;
                if (isTrashMode) {
                    renderTrashDetails(item);
                } else {
                    renderDetails(item);
                }
                if (!detailsOpen && window.innerWidth > 768) toggleDetailsPane();
            }
        } else {
            renderMultiSelectDetails(totalSelected);
        }
    } else {
        bar.classList.remove('active');
        selectedItem = null;
        closeDetailsPane();
    }
}

function findItemFromDom(el) {
    const name = el.getAttribute('data-name');
    const id = el.getAttribute('data-id');
    if (isTrashMode) {
        return trashFiles.find(f => f.id === id);
    } else {
        return allFiles.find(f => f.name === name);
    }
}

function renderMultiSelectDetails(count) {
    const detailsContent = document.getElementById('detailsContent');
    detailsContent.innerHTML = `
        <div class="details-preview-container" style="display:flex; align-items:center; justify-content:center; height:120px; color:var(--accent);">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/></svg>
        </div>
        <div class="details-file-title">
            ${count} Items Selected
            <div>
                <span class="details-badge">Batch Mode</span>
            </div>
        </div>
        <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13.5px;">
            You have selected multiple items. Use the floating action bar below to download them as a ZIP archive or delete them collectively.
        </div>
    `;
}

// Thumbnail selector inside Card Grid
function getFileThumbnailMarkup(file) {
    const ext = getExtension(file.name);
    const path = file.path !== undefined ? file.path : (currentPath ? `${currentPath}/${file.name}` : file.name);
    const previewUrl = `${ENDPOINTS.preview}?path=${encodeURIComponent(path)}`;

    if (EXT_IMAGE.includes(ext)) {
        return `<img src="${previewUrl}" alt="${file.name}" loading="lazy">`;
    }
    return getFileIcon(file);
}

// SVG Icons provider based on extension/type
function getFileIcon(item) {
    if (item.is_dir) {
        return `<svg viewBox="0 0 24 24" fill="#FFA000"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;
    }

    const ext = getExtension(item.name);
    
    if (EXT_PDF.includes(ext)) {
        return `<svg viewBox="0 0 24 24" fill="#ef4444"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 10v-1.5H8.5V10H9zm5.5 2v-3.5H14v3.5h.5zM2 6v14c0 1.1.9 2 2 2h14v-1.5H4V6H2z"/></svg>`;
    }
    if (EXT_AUDIO.includes(ext)) {
        return `<svg viewBox="0 0 24 24" fill="#ec4899"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6zm-2 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>`;
    }
    if (EXT_VIDEO.includes(ext)) {
        return `<svg viewBox="0 0 24 24" fill="#6366f1"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4zM14 16H5V8h9v8z"/></svg>`;
    }
    if (EXT_IMAGE.includes(ext)) {
        return `<svg viewBox="0 0 24 24" fill="#38ff42"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`;
    }
    if (EXT_CODE.includes(ext)) {
        return `<svg viewBox="0 0 24 24" fill="#3b82f6"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>`;
    }
    if (['doc', 'docx'].includes(ext)) {
        return `<svg viewBox="0 0 24 24" fill="#2563eb"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`;
    }
    if (['xls', 'xlsx'].includes(ext)) {
        return `<svg viewBox="0 0 24 24" fill="#059669"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`;
    }
    if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
        return `<svg viewBox="0 0 24 24" fill="#8b5cf6"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 4h2v2h-2v-2zm0 4h2v2h-2v-2zm-4-4h2v2h-2v-2zm0 4h2v2h-2v-2z"/></svg>`;
    }

    return `<svg viewBox="0 0 24 24" fill="#71717a"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`;
}

// Render Details Pane content
function renderDetails(item) {
    const detailsContent = document.getElementById('detailsContent');
    const path = item.path !== undefined ? item.path : (currentPath ? `${currentPath}/${item.name}` : item.name);
    const sizeString = item.is_dir ? '--' : formatBytes(item.size);

    // Render details HTML
    detailsContent.innerHTML = `
        <div class="details-preview-container">
            ${getDetailsPreviewMarkup(item)}
        </div>
        <div class="details-file-title">
            ${item.name}
            <div>
                <span class="details-badge">${item.is_dir ? 'Folder' : getExtension(item.name)}</span>
            </div>
        </div>
        <table class="details-metadata">
            <tr class="details-row">
                <td class="details-label">Size</td>
                <td class="details-value">${sizeString}</td>
            </tr>
            <tr class="details-row">
                <td class="details-label">Type</td>
                <td class="details-value">${item.is_dir ? 'Directory' : item.type}</td>
            </tr>
            <tr class="details-row">
                <td class="details-label">Location</td>
                <td class="details-value" title="${path}">${path}</td>
            </tr>
            <tr class="details-row">
                <td class="details-label">Last Modified</td>
                <td class="details-value">${item.modified}</td>
            </tr>
        </table>
        <div class="details-actions">
            ${!item.is_dir ? `
                <button class="btn-action btn-action-primary" onclick="downloadFile('${item.name}')">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                    Download
                </button>
                <button class="btn-action btn-action-secondary" onclick="openPreviewModalByName('${item.name}')">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                    View Fullscreen
                </button>
            ` : `
                <button class="btn-action btn-action-primary" onclick="downloadFolder('${item.name}')" style="display:flex; align-items:center; gap:6px; justify-content:center;">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2zm-6 4h2v2h-2v-2zm0 4h2v2h-2v-2zm-4-4h2v2h-2v-2zm0 4h2v2h-2v-2z"/></svg>
                    Download Folder (ZIP)
                </button>
            `}
            <button class="btn-action btn-action-secondary" onclick="showRenameDialog()" style="display:flex; align-items:center; gap:6px; justify-content:center;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                Rename
            </button>
            <button class="btn-action btn-action-danger" onclick="showDeleteConfirm()" style="display:flex; align-items:center; gap:6px; justify-content:center;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                Delete
            </button>
        </div>
    `;
}

// Preview rendering inside Details Pane
function getDetailsPreviewMarkup(item) {
    if (item.is_dir) {
        return `<svg viewBox="0 0 24 24" fill="#FFA000"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;
    }

    const ext = getExtension(item.name);
    const path = item.path !== undefined ? item.path : (currentPath ? `${currentPath}/${item.name}` : item.name);
    const previewUrl = `${ENDPOINTS.preview}?path=${encodeURIComponent(path)}`;

    if (EXT_IMAGE.includes(ext)) {
        return `<img src="${previewUrl}" alt="${item.name}">`;
    }
    if (EXT_AUDIO.includes(ext)) {
        return `<svg viewBox="0 0 24 24" fill="#ec4899"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
    }
    if (EXT_VIDEO.includes(ext)) {
        return `<svg viewBox="0 0 24 24" fill="#6366f1"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`;
    }

    return getFileIcon(item);
}

function renderDetailsEmpty() {
    const detailsContent = document.getElementById('detailsContent');
    detailsContent.innerHTML = `
        <div class="details-empty">
            <svg viewBox="0 0 24 24"><path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/></svg>
            <p>Select an item's top-left info icon to view detailed specifications and actions.</p>
        </div>
    `;
}

// Full Screen Preview Modal Controller / In-Browser Text Code Editor
async function openPreviewModal(file) {
    const previewModal = document.getElementById('previewModal');
    const title = document.getElementById('previewModalTitle');
    const body = document.getElementById('previewModalBody');
    const downloadBtn = document.getElementById('previewDownloadBtn');

    title.textContent = file.name;
    downloadBtn.onclick = () => downloadFile(file.name);
    body.innerHTML = `<div class="spinner"></div>`;

    previewModal.classList.add('active');

    const path = file.path !== undefined ? file.path : (currentPath ? `${currentPath}/${file.name}` : file.name);
    const previewUrl = `${ENDPOINTS.preview}?path=${encodeURIComponent(path)}`;
    const ext = getExtension(file.name);

    try {
        if (EXT_IMAGE.includes(ext)) {
            body.innerHTML = `<img src="${previewUrl}" class="preview-image" alt="${file.name}">`;
        } else if (EXT_VIDEO.includes(ext)) {
            body.innerHTML = `<video controls autoplay class="preview-video"><source src="${previewUrl}" type="video/mp4"></video>`;
        } else if (EXT_AUDIO.includes(ext)) {
            body.innerHTML = `
                <div class="preview-audio-wrapper">
                    <div style="font-size: 48px;">🎵</div>
                    <div style="font-size: 15px; font-weight: 600; text-align: center;">${file.name}</div>
                    <audio controls autoplay src="${previewUrl}"></audio>
                </div>
            `;
        } else if (EXT_PDF.includes(ext)) {
            body.innerHTML = `<iframe src="${previewUrl}" class="preview-iframe"></iframe>`;
        } else if (EXT_CODE.includes(ext)) {
            // Render inside text code editor
            const response = await fetch(previewUrl);
            if (!response.ok) throw new Error('Could not fetch code preview');
            const text = await response.text();

            body.innerHTML = `
                <div class="editor-container">
                    <div class="editor-header">
                        <span class="editor-filename">${file.name} (Editable)</span>
                        <div class="editor-actions">
                            <button class="btn-action btn-action-primary" id="editorSaveBtn" onclick="saveFileContent('${escapeHtml(path)}')" style="width: auto; padding: 6px 16px; font-size: 13px; border-radius: 6px;">Save Changes</button>
                        </div>
                    </div>
                    <textarea class="editor-textarea" id="editorTextArea" spellcheck="false">${escapeHtml(text)}</textarea>
                </div>
            `;
        } else {
            // Fallback document card
            body.innerHTML = `
                <div class="fallback-preview-card">
                    <div class="list-icon-wrapper" style="width:64px; height:64px;">${getFileIcon(file)}</div>
                    <h3 style="font-size:16px; font-weight:600;">${file.name}</h3>
                    <p style="font-size:13px; color:var(--text-muted);">Preview not supported for this file type (${ext.toUpperCase()}). You can download it directly.</p>
                    <button class="btn-action btn-action-primary" onclick="downloadFile('${file.name}')">Download File</button>
                </div>
            `;
        }
    } catch (error) {
        console.error(error);
        body.innerHTML = `<div style="color:var(--danger)">Failed to load file preview.</div>`;
    }
}

async function saveFileContent(path) {
    const textarea = document.getElementById('editorTextArea');
    const content = textarea.value;
    const saveBtn = document.getElementById('editorSaveBtn');
    
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
        const response = await fetch('/api/save-file', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ path: path, content: content })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        showToast('File modifications saved successfully');
        loadStorageInfo();
    } catch (error) {
        showToast('Error saving file: ' + error.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
    }
}

function openPreviewModalByName(filename) {
    const file = allFiles.find(f => f.name === filename);
    if (file) openPreviewModal(file);
}

function closePreviewModal() {
    const previewModal = document.getElementById('previewModal');
    const body = document.getElementById('previewModalBody');
    body.innerHTML = '';
    previewModal.classList.remove('active');
}

// Folder Creator API
async function submitCreateFolder() {
    const input = document.getElementById('folderNameInput');
    const name = input.value.trim();
    if (!name) {
        showToast('Folder name cannot be empty', 'error');
        return;
    }

    try {
        const response = await fetch(ENDPOINTS.createFolder, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: currentPath, name: name })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        showToast(`Folder "${name}" created successfully`);
        closeModal('createFolderModal');
        input.value = '';
        loadFiles(currentPath);
        loadStorageInfo();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Text File Creator API
async function submitCreateFile() {
    const input = document.getElementById('fileNameInput');
    let name = input.value.trim();
    if (!name) {
        showToast('File name cannot be empty', 'error');
        return;
    }
    if (!name.includes('.')) {
        name += '.txt';
    }

    try {
        const response = await fetch('/api/create-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: currentPath, name: name })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        showToast(`Text file "${name}" created successfully`);
        closeModal('createFileModal');
        input.value = '';
        loadFiles(currentPath);
        loadStorageInfo();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Rename Item API
async function submitRename() {
    if (!selectedItem) return;
    const input = document.getElementById('renameInput');
    const newName = input.value.trim();
    if (!newName) {
        showToast('Name cannot be empty', 'error');
        return;
    }

    const oldPath = selectedItem.path !== undefined ? selectedItem.path : (currentPath ? `${currentPath}/${selectedItem.name}` : selectedItem.name);

    try {
        const response = await fetch(ENDPOINTS.rename, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: oldPath, new_name: newName })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        showToast('Item renamed successfully');
        closeModal('renameModal');
        loadFiles(currentPath);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Delete Item API (Move to Trash)
async function submitDelete() {
    if (!selectedItem) return;
    const targetPath = selectedItem.path !== undefined ? selectedItem.path : (currentPath ? `${currentPath}/${selectedItem.name}` : selectedItem.name);

    try {
        const response = await fetch(ENDPOINTS.delete, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: targetPath })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        showToast(`"${selectedItem.name}" moved to Trash Bin`);
        closeModal('deleteConfirmModal');
        clearSelection();
        loadFiles(currentPath);
        loadStorageInfo();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Upload files API with XHR progress reporting
function uploadFiles(files) {
    if (files.length === 0) return;
    
    const panel = document.getElementById('uploadProgressPanel');
    const list = document.getElementById('progressItemsList');
    
    panel.style.display = 'flex';
    panel.classList.remove('collapsed');
    document.getElementById('progressPanelToggleBtn').textContent = '▼';
    
    let activeUploads = files.length;
    
    Array.from(files).forEach(file => {
        const itemId = 'upload-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        const progressItem = document.createElement('div');
        progressItem.className = 'progress-item';
        progressItem.id = itemId;
        progressItem.innerHTML = `
            <div class="progress-item-info">
                <span class="progress-item-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
                <span class="progress-item-percent" id="${itemId}-percent">0%</span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar-fill" id="${itemId}-bar" style="width: 0%;"></div>
            </div>
            <div class="progress-item-status" id="${itemId}-status">Uploading...</div>
        `;
        list.appendChild(progressItem);
        
        const xhr = new XMLHttpRequest();
        xhr.open('POST', ENDPOINTS.upload, true);
        
        // Track progress
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                document.getElementById(`${itemId}-percent`).textContent = percentComplete + '%';
                document.getElementById(`${itemId}-bar`).style.width = percentComplete + '%';
                document.getElementById(`${itemId}-status`).textContent = `Uploading... (${formatBytes(e.loaded)} of ${formatBytes(e.total)})`;
            }
        });
        
        xhr.onload = () => {
            activeUploads--;
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.error) {
                        document.getElementById(`${itemId}-status`).textContent = 'Failed: ' + response.error;
                        document.getElementById(`${itemId}-status`).style.color = 'var(--danger)';
                        document.getElementById(`${itemId}-percent`).style.color = 'var(--danger)';
                        showToast(`Failed to upload ${file.name}: ${response.error}`, 'error');
                    } else {
                        document.getElementById(`${itemId}-status`).textContent = 'Completed';
                        document.getElementById(`${itemId}-status`).style.color = 'var(--accent)';
                        document.getElementById(`${itemId}-percent`).textContent = '100%';
                        document.getElementById(`${itemId}-bar`).style.width = '100%';
                        showToast(`Uploaded ${file.name}`);
                    }
                } catch (err) {
                    document.getElementById(`${itemId}-status`).textContent = 'Failed parsing response';
                    document.getElementById(`${itemId}-status`).style.color = 'var(--danger)';
                    showToast(`Failed to upload ${file.name}`, 'error');
                }
            } else {
                document.getElementById(`${itemId}-status`).textContent = 'Upload failed';
                document.getElementById(`${itemId}-status`).style.color = 'var(--danger)';
                showToast(`Failed to upload ${file.name}: Server error`, 'error');
            }
            
            if (activeUploads === 0) {
                loadFiles(currentPath);
                loadStorageInfo();
            }
        };
        
        xhr.onerror = () => {
            activeUploads--;
            document.getElementById(`${itemId}-status`).textContent = 'Connection error';
            document.getElementById(`${itemId}-status`).style.color = 'var(--danger)';
            showToast(`Connection error uploading ${file.name}`, 'error');
            if (activeUploads === 0) {
                loadFiles(currentPath);
            }
        };
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', currentPath);
        
        xhr.send(formData);
    });
}

// Navigation
function navigateTo(path) {
    loadFiles(path);
}

function downloadFile(filename) {
    const path = currentPath ? `${currentPath}/${filename}` : filename;
    window.location.href = `${ENDPOINTS.download}?path=${encodeURIComponent(path)}`;
}

// NEW FOLDER ZIP Download trigger
function downloadFolder(foldername) {
    const path = currentPath ? `${currentPath}/${foldername}` : foldername;
    showToast('Zipping folder on server... please wait.');
    window.location.href = `/api/download-folder?path=${encodeURIComponent(path)}`;
}

// Helper Utilities
function getExtension(filename) {
    return filename.split('.').pop().toLowerCase();
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// UI state management helpers using shimmer skeleton logic
function showLoading(visible) {
    const loadingEl = document.getElementById('loading');
    if (!visible) {
        loadingEl.classList.add('hidden');
        loadingEl.innerHTML = '';
        return;
    }
    
    loadingEl.classList.remove('hidden');
    
    document.getElementById('foldersTitle').classList.add('hidden');
    document.getElementById('folderGrid').classList.add('hidden');
    document.getElementById('filesTitle').classList.add('hidden');
    document.getElementById('fileGrid').classList.add('hidden');
    document.getElementById('fileListContainer').classList.add('hidden');
    document.getElementById('emptyState').classList.add('hidden');

    if (currentView === 'grid') {
        loadingEl.style.display = 'block';
        loadingEl.style.padding = '0';
        loadingEl.innerHTML = `
            <div class="section-header">
                <div class="skeleton-shimmer" style="width: 100px; height: 16px; border-radius: 4px;"></div>
            </div>
            <div class="folder-grid" style="margin-bottom: 32px;">
                ${Array(3).fill().map(() => `
                    <div class="folder-card" style="pointer-events: none; border-color: var(--border);">
                        <div class="skeleton-shimmer" style="width: 36px; height: 36px; border-radius: 8px;"></div>
                        <div class="folder-info" style="width: 100%; margin-left: 12px;">
                            <div class="skeleton-text skeleton-shimmer" style="width: 70%; height: 14px; border-radius: 4px; background-color: var(--border);"></div>
                            <div class="skeleton-text skeleton-shimmer" style="width: 40%; height: 10px; border-radius: 4px; margin-top: 6px; background-color: var(--border);"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="section-header">
                <div class="skeleton-shimmer" style="width: 80px; height: 16px; border-radius: 4px;"></div>
            </div>
            <div class="file-grid">
                ${Array(4).fill().map(() => `
                    <div class="file-card" style="pointer-events: none; border-color: var(--border);">
                        <div class="skeleton-shimmer" style="width: 100%; height: 130px; border-radius: 8px;"></div>
                        <div class="file-details" style="width: 100%; margin-top: 12px; padding: 0;">
                            <div class="skeleton-text skeleton-shimmer" style="width: 80%; height: 14px; border-radius: 4px; background-color: var(--border);"></div>
                            <div class="skeleton-text skeleton-shimmer" style="width: 30%; height: 10px; border-radius: 4px; margin-top: 6px; background-color: var(--border);"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        loadingEl.style.display = 'block';
        loadingEl.style.padding = '0';
        loadingEl.innerHTML = `
            <div class="file-list-view" style="display: block;">
                <div class="list-header" style="pointer-events: none;">
                    <div></div>
                    <div>Name</div>
                    <div>Modified</div>
                    <div>Size</div>
                </div>
                <div>
                    ${Array(6).fill().map(() => `
                        <div class="list-row" style="pointer-events: none; border-bottom: 1px solid var(--border);">
                            <div></div>
                            <div style="display: flex; align-items: center; gap: 14px;">
                                <div class="skeleton-shimmer" style="width: 24px; height: 24px; border-radius: 6px;"></div>
                                <div class="skeleton-text skeleton-shimmer" style="width: 180px; height: 14px; border-radius: 4px; background-color: var(--border);"></div>
                            </div>
                            <div class="skeleton-text skeleton-shimmer" style="width: 120px; height: 12px; border-radius: 4px; background-color: var(--border);"></div>
                            <div class="skeleton-text skeleton-shimmer" style="width: 60px; height: 12px; border-radius: 4px; background-color: var(--border);"></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
}

function setView(view) {
    currentView = view;
    document.getElementById('gridViewBtn').classList.toggle('active', view === 'grid');
    document.getElementById('listViewBtn').classList.toggle('active', view === 'list');
    
    if (isTrashMode) {
        renderTrashFiles(trashFiles);
    } else {
        renderFiles(allFiles);
    }
}

function toggleDetailsPane() {
    const layout = document.getElementById('appLayout');
    const toggleBtn = document.getElementById('detailsToggleBtn');
    detailsOpen = !detailsOpen;

    layout.classList.toggle('details-open', detailsOpen);
    toggleBtn.classList.toggle('active', detailsOpen);
}

function closeDetailsPane() {
    const layout = document.getElementById('appLayout');
    const toggleBtn = document.getElementById('detailsToggleBtn');
    detailsOpen = false;
    layout.classList.remove('details-open');
    toggleBtn.classList.remove('active');
}

function toggleSidebar() {
    document.body.classList.toggle('sidebar-open');
}

// Dropdowns & Dialogs Modals handlers
function toggleDropdown() {
    document.getElementById('dropdownMenu').classList.toggle('active');
}

// Collapsible Upload Progress Drawer
function toggleProgressPanelCollapse() {
    const panel = document.getElementById('uploadProgressPanel');
    const btn = document.getElementById('progressPanelToggleBtn');
    panel.classList.toggle('collapsed');
    if (panel.classList.contains('collapsed')) {
        btn.textContent = '▲';
    } else {
        btn.textContent = '▼';
    }
}

// Custom Context Menu Controllers
function showContextMenu(e, item) {
    resetContextMenu();
    const menu = document.getElementById('contextMenu');
    const downloadItem = document.getElementById('ctxDownload');
    
    if (item.is_dir) {
        downloadItem.style.display = 'none';
    } else {
        downloadItem.style.display = 'flex';
    }
    
    let x = e.clientX;
    let y = e.clientY;
    
    menu.style.display = 'block';
    menu.classList.add('active');
    
    const menuWidth = menu.offsetWidth || 160;
    const menuHeight = menu.offsetHeight || 160;
    
    if (x + menuWidth > window.innerWidth) {
        x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
        y = window.innerHeight - menuHeight - 10;
    }
    
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
}

function closeContextMenu() {
    const menu = document.getElementById('contextMenu');
    if (menu) {
        menu.classList.remove('active');
        menu.style.display = 'none';
    }
}

// NEW TRASH NAVIGATOR
function navigateToTrash() {
    isTrashMode = true;
    clearSelection();
    clearBatchSelection();
    
    document.getElementById('driveNavLink').classList.remove('active');
    document.getElementById('trashNavLink').classList.add('active');
    document.getElementById('emptyTrashBtn').style.display = 'flex';
    
    document.getElementById('foldersTitle').classList.add('hidden');
    document.getElementById('folderGrid').classList.add('hidden');
    document.getElementById('searchFilters').style.display = 'none';
    
    loadTrashFiles();
}

async function loadTrashFiles() {
    showLoading(true);
    try {
        const response = await fetch('/api/trash/list');
        if (!response.ok) throw new Error('Failed to load trash list');
        const items = await response.json();
        trashFiles = items;
        renderTrashFiles(items);
    } catch(err) {
        showToast(err.message, 'error');
    } finally {
        showLoading(false);
    }
}

function renderTrashFiles(items) {
    const fileGrid = document.getElementById('fileGrid');
    const fileListRows = document.getElementById('fileListRows');
    const folderGrid = document.getElementById('folderGrid');
    
    folderGrid.innerHTML = '';
    fileGrid.innerHTML = '';
    fileListRows.innerHTML = '';
    
    document.getElementById('foldersTitle').classList.add('hidden');
    document.getElementById('filesTitle').classList.toggle('hidden', items.length === 0 || currentView === 'list');
    document.getElementById('emptyState').classList.toggle('hidden', items.length > 0);
    
    document.getElementById('breadcrumb').innerHTML = `<span class="breadcrumb-segment active">Trash Bin</span>`;
    
    if (currentView === 'grid') {
        document.getElementById('fileListContainer').classList.add('hidden');
        fileGrid.classList.remove('hidden');
        items.forEach(item => {
            const card = createTrashCard(item);
            fileGrid.appendChild(card);
        });
    } else {
        document.getElementById('fileListContainer').classList.remove('hidden');
        fileGrid.classList.add('hidden');
        items.forEach(item => {
            const row = createTrashListRow(item);
            fileListRows.appendChild(row);
        });
    }
}

function createTrashCard(item) {
    const card = document.createElement('div');
    card.className = 'file-card trash-card';
    card.setAttribute('data-id', item.id);
    card.setAttribute('data-name', item.name);
    
    card.addEventListener('click', () => {
        toggleSelect(item, card);
    });
    
    card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectContextMenu(item, card);
        showTrashContextMenu(e, item);
    });
    
    card.innerHTML = `
        <div class="select-trigger" title="Select item">
            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        </div>
        <div class="file-thumbnail" style="display:flex; align-items:center; justify-content:center; font-size:40px; color:var(--text-dark);">
            ${item.is_dir ? 
                `<svg viewBox="0 0 24 24" fill="#FFA000" style="width:48px; height:48px;"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/></svg>` : 
                getFileIcon(item)
            }
        </div>
        <div class="file-details">
            <div class="file-name" title="${item.name}">${item.name}</div>
            <div class="file-size" style="font-size:11px; color:var(--danger); white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">Deleted: ${item.deleted_at.split(' ')[0]}</div>
        </div>
    `;
    return card;
}

function createTrashListRow(item) {
    const row = document.createElement('div');
    row.className = 'list-row trash-row';
    row.setAttribute('data-id', item.id);
    row.setAttribute('data-name', item.name);
    
    row.addEventListener('click', () => {
        toggleSelect(item, row);
    });
    
    row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectContextMenu(item, row);
        showTrashContextMenu(e, item);
    });
    
    row.innerHTML = `
        <div class="select-trigger" title="Select item">
            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        </div>
        <div style="display: flex; align-items: center; gap: 14px; min-width: 0;">
            <div class="list-icon-wrapper">
                ${item.is_dir ? 
                    `<svg viewBox="0 0 24 24" fill="#FFA000" style="width:20px; height:20px;"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/></svg>` : 
                    getFileIcon(item)
                }
            </div>
            <div class="list-name" title="${item.name}">${item.name}</div>
        </div>
        <div class="list-meta" style="color:var(--text-dark); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:200px;">Was at: ${item.original_path}</div>
        <div class="list-meta" style="color:var(--danger); font-size:11.5px;">Deleted: ${item.deleted_at}</div>
    `;
    return row;
}

function renderTrashDetails(item) {
    const detailsContent = document.getElementById('detailsContent');
    detailsContent.innerHTML = `
        <div class="details-preview-container" style="display:flex; align-items:center; justify-content:center; height:120px; color:var(--danger);">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </div>
        <div class="details-file-title">
            ${item.name}
            <div>
                <span class="details-badge" style="background:var(--danger-glow); color:var(--danger);">Deleted</span>
            </div>
        </div>
        <table class="details-metadata">
            <tr class="details-row">
                <td class="details-label">Original Location</td>
                <td class="details-value" title="${item.original_path}">${item.original_path}</td>
            </tr>
            <tr class="details-row">
                <td class="details-label">Deleted Date</td>
                <td class="details-value">${item.deleted_at}</td>
            </tr>
        </table>
        <div class="details-actions">
            <button class="btn-action btn-action-primary" onclick="restoreTrashItem('${item.id}')" style="border-radius: 8px; display:flex; align-items:center; gap:6px; justify-content:center;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
                Restore Item
            </button>
            <button class="btn-action btn-action-danger" onclick="deleteTrashItemPermanently('${item.id}', '${escapeHtml(item.name)}')" style="border-radius: 8px; display:flex; align-items:center; gap:6px; justify-content:center;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                Delete Permanently
            </button>
        </div>
    `;
}

function showTrashContextMenu(e, item) {
    closeContextMenu();
    const menu = document.getElementById('contextMenu');
    const ctxOpen = document.getElementById('ctxOpen');
    const ctxDownload = document.getElementById('ctxDownload');
    const ctxRename = document.getElementById('ctxRename');
    const ctxDelete = document.getElementById('ctxDelete');
    const ctxRestore = document.getElementById('ctxRestore');
    
    if (ctxOpen) ctxOpen.style.display = 'none';
    if (ctxDownload) ctxDownload.style.display = 'none';
    if (ctxRename) ctxRename.style.display = 'none';
    
    if (ctxDelete) {
        ctxDelete.style.display = 'flex';
        ctxDelete.querySelector('span').textContent = 'Delete Permanently';
        ctxDelete.onclick = () => {
            closeContextMenu();
            deleteTrashItemPermanently(item.id, item.name);
        };
    }
    if (ctxRestore) {
        ctxRestore.style.display = 'flex';
        ctxRestore.onclick = () => {
            closeContextMenu();
            restoreTrashItem(item.id);
        };
    }
    
    let x = e.clientX;
    let y = e.clientY;
    menu.style.display = 'block';
    menu.classList.add('active');
    
    const menuWidth = menu.offsetWidth || 160;
    const menuHeight = menu.offsetHeight || 160;
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;
    
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
}

async function restoreTrashItem(id) {
    try {
        const response = await fetch('/api/trash/restore', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id: id })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        showToast('Item restored successfully');
        clearSelection();
        loadTrashFiles();
        loadStorageInfo();
    } catch(err) {
        showToast(err.message, 'error');
    }
}

let itemToDeleteId = null;
function deleteTrashItemPermanently(id, name) {
    itemToDeleteId = id;
    document.getElementById('deleteTargetName').textContent = name + " permanently";
    
    const deleteBtn = document.querySelector('#deleteConfirmModal .btn-action-danger');
    deleteBtn.onclick = submitPermanentDelete;
    
    showModal('deleteConfirmModal');
}

async function submitPermanentDelete() {
    if (!itemToDeleteId) return;
    try {
        const response = await fetch('/api/delete', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ path: `.trash/${itemToDeleteId}` })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        showToast('Item deleted permanently');
        closeModal('deleteConfirmModal');
        clearSelection();
        loadTrashFiles();
        loadStorageInfo();
    } catch(err) {
        showToast(err.message, 'error');
    } finally {
        itemToDeleteId = null;
        document.querySelector('#deleteConfirmModal .btn-action-danger').onclick = submitDelete;
    }
}

function showEmptyTrashDialog() {
    showModal('emptyTrashConfirmModal');
}

async function submitEmptyTrash() {
    try {
        const response = await fetch('/api/trash/empty', {
            method: 'POST'
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        showToast('Trash bin emptied');
        closeModal('emptyTrashConfirmModal');
        clearSelection();
        loadTrashFiles();
        loadStorageInfo();
    } catch(err) {
        showToast(err.message, 'error');
    }
}

// NEW RECURSIVE SEARCH
let searchTimeout = null;
document.getElementById('searchInput').addEventListener('input', (e) => {
    const query = e.target.value.trim();
    activeSearchQuery = query;
    
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        if (!query) {
            document.getElementById('searchFilters').style.display = 'none';
            if (isTrashMode) {
                loadTrashFiles();
            } else {
                loadFiles(currentPath, false);
            }
            return;
        }
        
        if (!isTrashMode) {
            document.getElementById('searchFilters').style.display = 'flex';
            performSearch();
        } else {
            // Local filter for trash search
            const filtered = trashFiles.filter(item => item.name.toLowerCase().includes(query.toLowerCase()));
            renderTrashFiles(filtered);
        }
    }, 350);
});

async function performSearch() {
    showLoading(true);
    try {
        const url = `/api/search?query=${encodeURIComponent(activeSearchQuery)}&category=${activeSearchCategory}`;
        const response = await fetch(url);
        const results = await response.json();
        
        const bar = document.getElementById('breadcrumb');
        bar.innerHTML = `<span class="breadcrumb-segment active">Search results for "${escapeHtml(activeSearchQuery)}"</span>`;
        
        renderFiles(results);
    } catch(err) {
        showToast(err.message, 'error');
    } finally {
        showLoading(false);
    }
}

function setSearchCategory(category, element) {
    activeSearchCategory = category;
    document.querySelectorAll('.filter-pill').forEach(pill => pill.classList.remove('active'));
    element.classList.add('active');
    performSearch();
}

// NEW BATCH ACTIONS
async function submitBatchDelete() {
    if (isTrashMode) {
        if (selectedIds.length === 0) return;
        document.getElementById('deleteTargetName').textContent = `${selectedIds.length} items permanently`;
        
        const deleteBtn = document.querySelector('#deleteConfirmModal .btn-action-danger');
        deleteBtn.onclick = submitBatchPermanentDelete;
        
        showModal('deleteConfirmModal');
    } else {
        if (selectedPaths.length === 0) return;
        try {
            const response = await fetch('/api/batch-delete', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ paths: selectedPaths })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            
            showToast(`${selectedPaths.length} items moved to Trash Bin`);
            clearSelection();
            loadFiles(currentPath);
            loadStorageInfo();
        } catch(err) {
            showToast(err.message, 'error');
        }
    }
}

async function submitBatchPermanentDelete() {
    try {
        let deleted = 0;
        for (let id of selectedIds) {
            await fetch('/api/delete', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ path: `.trash/${id}` })
            });
            deleted++;
        }
        showToast(`${deleted} items deleted permanently`);
        closeModal('deleteConfirmModal');
        clearSelection();
        loadTrashFiles();
        loadStorageInfo();
    } catch(err) {
        showToast(err.message, 'error');
    } finally {
        document.querySelector('#deleteConfirmModal .btn-action-danger').onclick = submitDelete;
    }
}

async function submitBatchDownload() {
    if (isTrashMode) {
        if (selectedIds.length === 0) return;
        try {
            let restored = 0;
            for (let id of selectedIds) {
                await fetch('/api/trash/restore', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ id: id })
                });
                restored++;
            }
            showToast(`${restored} items restored successfully`);
            clearSelection();
            loadTrashFiles();
            loadStorageInfo();
        } catch(err) {
            showToast(err.message, 'error');
        }
    } else {
        if (selectedPaths.length === 0) return;
        showToast('Archiving selection... please wait.');
        try {
            const response = await fetch('/api/batch-zip', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ paths: selectedPaths })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            
            // Redirect to token download zip endpoint
            window.location.href = data.download_url;
            clearSelection();
        } catch(err) {
            showToast(err.message, 'error');
        }
    }
}

function clearBatchSelection() {
    clearSelection();
}

// NEW STORAGE STATS
async function loadStorageInfo() {
    try {
        const response = await fetch('/api/storage-info');
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        document.getElementById('storagePercent').textContent = data.percent + '%';
        document.getElementById('storageBarFill').style.width = data.percent + '%';
        document.getElementById('storageText').textContent = `${formatBytes(data.used)} of ${formatBytes(data.total)} used`;
    } catch(err) {
        console.error('Error fetching storage pool stats:', err);
    }
}

function handleOpenItem(item) {
    if (item.is_dir) {
        navigateTo(item.path !== undefined ? item.path : (currentPath ? `${currentPath}/${item.name}` : item.name));
    } else {
        openPreviewModal(item);
    }
}

// Wire up context menu click listeners
document.addEventListener('DOMContentLoaded', () => {
    const ctxOpen = document.getElementById('ctxOpen');
    const ctxDownload = document.getElementById('ctxDownload');
    const ctxRename = document.getElementById('ctxRename');
    const ctxDelete = document.getElementById('ctxDelete');

    if (ctxOpen) {
        ctxOpen.addEventListener('click', () => {
            closeContextMenu();
            if (selectedItem) handleOpenItem(selectedItem);
        });
    }
    if (ctxDownload) {
        ctxDownload.addEventListener('click', () => {
            closeContextMenu();
            if (selectedItem && !selectedItem.is_dir) downloadFile(selectedItem.name);
        });
    }
    if (ctxRename) {
        ctxRename.addEventListener('click', () => {
            closeContextMenu();
            showRenameDialog();
        });
    }
    if (ctxDelete) {
        ctxDelete.addEventListener('click', () => {
            closeContextMenu();
            showDeleteConfirm();
        });
    }
});

// Close custom menus/dropdowns on click outside
window.addEventListener('click', (e) => {
    if (!e.target.closest('.new-btn-container')) {
        document.getElementById('dropdownMenu').classList.remove('active');
    }
    if (!e.target.closest('.sort-container')) {
        const sortDropdown = document.getElementById('sortDropdown');
        if (sortDropdown) sortDropdown.classList.remove('active');
    }
    if (!e.target.closest('.context-menu')) {
        closeContextMenu();
    }
    // Mobile click outside details panel to close it
    if (window.innerWidth <= 1024 && detailsOpen) {
        if (!e.target.closest('#detailsPane') && !e.target.closest('#detailsToggleBtn') && !e.target.closest('.select-trigger')) {
            closeDetailsPane();
        }
    }
});

window.addEventListener('scroll', closeContextMenu, true);
window.addEventListener('resize', () => {
    closeContextMenu();
    // Auto-close details pane if resizing down to tablet/mobile viewports to prevent layout coverage
    if (window.innerWidth <= 1024 && detailsOpen) {
        closeDetailsPane();
    }
});

// Sorting Logic
function toggleSortDropdown() {
    document.getElementById('sortDropdown').classList.toggle('active');
}

function changeSort(field) {
    if (currentSortField === field) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortField = field;
        currentSortOrder = 'asc';
    }
    updateSortUI();
    if (isTrashMode) {
        renderTrashFiles(trashFiles);
    } else {
        renderFiles(allFiles);
    }
}

function toggleSortOrder() {
    currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    updateSortUI();
    if (isTrashMode) {
        renderTrashFiles(trashFiles);
    } else {
        renderFiles(allFiles);
    }
}

function updateSortUI() {
    document.getElementById('sortNameCheck').textContent = currentSortField === 'name' ? ' ✓' : '';
    document.getElementById('sortDateCheck').textContent = currentSortField === 'modified' ? ' ✓' : '';
    document.getElementById('sortSizeCheck').textContent = currentSortField === 'size' ? ' ✓' : '';
    
    document.getElementById('sortOrderText').textContent = currentSortOrder === 'asc' ? 'Ascending ↑' : 'Descending ↓';

    const nameDir = document.getElementById('listSortNameDir');
    const dateDir = document.getElementById('listSortDateDir');
    const sizeDir = document.getElementById('listSortSizeDir');
    
    if (nameDir && dateDir && sizeDir) {
        nameDir.textContent = currentSortField === 'name' ? (currentSortOrder === 'asc' ? ' ↑' : ' ↓') : '';
        dateDir.textContent = currentSortField === 'modified' ? (currentSortOrder === 'asc' ? ' ↑' : ' ↓') : '';
        sizeDir.textContent = currentSortField === 'size' ? (currentSortOrder === 'asc' ? ' ↑' : ' ↓') : '';
    }
}

function showModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function showCreateFolderDialog() {
    showModal('createFolderModal');
    document.getElementById('folderNameInput').focus();
}

function showCreateFileDialog() {
    showModal('createFileModal');
    document.getElementById('fileNameInput').focus();
}

function showRenameDialog() {
    if (!selectedItem) return;
    const input = document.getElementById('renameInput');
    input.value = selectedItem.name;
    showModal('renameModal');
    input.focus();
}

function showDeleteConfirm() {
    if (!selectedItem) return;
    document.getElementById('deleteTargetName').textContent = selectedItem.name;
    showModal('deleteConfirmModal');
}

// Click proxy trigger
function triggerFileUpload() {
    document.getElementById('fileInput').click();
}

// Toast Notification System
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error' : ''}`;
    toast.innerHTML = `
        <span>${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'none'; // reset animation for fade out
        toast.offsetHeight; // trigger reflow
        toast.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 500);
    }, 3500);
}

// Update Breadcrumb UI component
function updateBreadcrumbs(path) {
    const bar = document.getElementById('breadcrumb');
    bar.innerHTML = `<span class="breadcrumb-segment" onclick="navigateTo('')">My Drive</span>`;
    
    if (path) {
        const parts = path.split('/');
        let cumulativePath = '';
        
        parts.forEach((part, index) => {
            cumulativePath = cumulativePath ? `${cumulativePath}/${part}` : part;
            const isLast = index === parts.length - 1;
            const pathCopy = cumulativePath;
            
            bar.innerHTML += `
                <span class="breadcrumb-sep">›</span>
                <span class="breadcrumb-segment ${isLast ? 'active' : ''}" ${!isLast ? `onclick="navigateTo('${pathCopy}')"` : ''}>${part}</span>
            `;
        });
    }
}

// Event Listeners for File uploads & inputs
document.getElementById('fileInput').addEventListener('change', (e) => {
    uploadFiles(e.target.files);
    e.target.value = '';
});

// Drag & drop file uploads on browserContent
const browserContent = document.getElementById('browserContent');

browserContent.addEventListener('dragover', (e) => {
    e.preventDefault();
    browserContent.classList.add('dragover');
});

browserContent.addEventListener('dragleave', (e) => {
    e.preventDefault();
    browserContent.classList.remove('dragover');
});

browserContent.addEventListener('drop', (e) => {
    e.preventDefault();
    browserContent.classList.remove('dragover');
    uploadFiles(e.dataTransfer.files);
});

// Close dialog modals on overlay clicks
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal(overlay.id);
        }
    });
});

// Close preview modal on ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closePreviewModal();
        document.querySelectorAll('.modal-overlay').forEach(o => o.classList.remove('active'));
    }
});

// Unified sidebar toggle (desktop slim collapse or mobile slide drawer)
function handleSidebarToggle() {
    if (window.innerWidth <= 768) {
        toggleSidebar();
    } else {
        toggleSidebarCollapse();
    }
}

function toggleSidebarCollapse() {
    const layout = document.getElementById('appLayout');
    layout.classList.toggle('sidebar-collapsed');
}

// Logout
function logout() {
    window.location.href = '/logout';
}

// Hash change event listener to track browser history
window.addEventListener('hashchange', () => {
    if (isTrashMode) return;
    const path = getPathFromHash();
    if (path !== currentPath) {
        loadFiles(path, false);
    }
});

// Initialize explorer on page load
detailsOpen = window.innerWidth > 1024;
const layout = document.getElementById('appLayout');
const toggleBtn = document.getElementById('detailsToggleBtn');
if (layout && toggleBtn) {
    layout.classList.toggle('details-open', detailsOpen);
    toggleBtn.classList.toggle('active', detailsOpen);
}
updateSortUI();
loadStorageInfo();
const initialPath = getPathFromHash();
loadFiles(initialPath, false);
