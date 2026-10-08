import UTIF from 'utif';

function canvasImage(canvas, name, file, pageCount = 1) {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name,
        sourceBytes: file.size,
        sourcePageCount: pageCount,
        width: canvas.width,
        height: canvas.height,
        dataUrl: canvas.toDataURL('image/png')
    };
}

export async function readImages(file) {
    if (/\.tiff?$/i.test(file.name)) {
        const buffer = await file.arrayBuffer();
        const pages = UTIF.decode(buffer).filter((page) => page.t256 && page.t257);
        if (!pages.length) throw new Error('TIFF 페이지를 찾을 수 없습니다.');
        return pages.map((page, index) => {
            if (page.t256[0] * page.t257[0] > 40000000) throw new Error('4천만 픽셀 이하 이미지를 사용해주세요.');
            UTIF.decodeImage(buffer, page);
            const canvas = document.createElement('canvas');
            canvas.width = page.width;
            canvas.height = page.height;
            canvas.getContext('2d').putImageData(
                new ImageData(new Uint8ClampedArray(UTIF.toRGBA8(page)), page.width, page.height), 0, 0
            );
            return canvasImage(canvas, pages.length > 1 ? `${file.name} (${index + 1}페이지)` : file.name, file, pages.length);
        });
    }
    if (!/\.(png|jpe?g|webp)$/i.test(file.name)) throw new Error('TIFF, PNG, JPG, WEBP 파일을 선택해주세요.');
    const url = URL.createObjectURL(file);
    try {
        const image = new Image();
        image.src = url;
        await image.decode();
        if (image.naturalWidth * image.naturalHeight > 40000000) throw new Error('이미지 해상도가 너무 큽니다.');
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext('2d').drawImage(image, 0, 0);
        return [canvasImage(canvas, file.name, file)];
    } finally {
        URL.revokeObjectURL(url);
    }
}
