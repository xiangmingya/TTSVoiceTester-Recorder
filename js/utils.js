function updateStatus(message, type = "info") {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = '';
    status.classList.add(`status-${type}`);
    console.log(`[状态更新][${type}]: ${message}`);
}

function formatDate(date) {
    const pad = (num) => num.toString().padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function getExtension(mimeType) {
    if (!mimeType) return 'webm';
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('ogg')) return 'ogg';
    if (mimeType.includes('mp4')) return 'mp4';
    if (mimeType.includes('mpeg')) return 'mp3';
    return 'wav';
}