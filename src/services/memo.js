export async function renderAnnotations(image, annotations) {
    if (!annotations.length) return image.dataUrl;
    const source = new Image();
    source.src = image.dataUrl;
    await source.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(800, image.width);
    canvas.height = Math.round(canvas.width * image.height / image.width);
    const context = canvas.getContext('2d');
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    context.textBaseline = 'top';
    for (const item of annotations) {
        const fontSize = canvas.width * item.size / 100;
        const lineHeight = fontSize * 1.2;
        context.font = `${item.bold ? 'bold' : 'normal'} ${fontSize}px "Malgun Gothic", sans-serif`;
        context.fillStyle = item.color;
        const lines = item.text.split('\n');
        const width = Math.max(...lines.map((line) => context.measureText(line).width));
        const height = lines.length * lineHeight;
        const x = item.x * canvas.width;
        const y = item.y * canvas.height;
        if (x + width > canvas.width + 1 || y + height > canvas.height + 1) {
            throw new Error('텍스트가 이미지 밖으로 나갑니다. 위치를 옮기거나 글자 크기를 줄여주세요.');
        }
        lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
    }
    return canvas.toDataURL('image/png');
}
