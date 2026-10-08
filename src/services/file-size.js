export function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return '용량 정보 없음';
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let size = bytes / 1024;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit += 1;
    }
    return `${size.toFixed(2)} ${units[unit]}`;
}
