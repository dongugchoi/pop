import { layoutGrid } from './layout';

export function createDividerImage(count) {
    const { columns, rows } = layoutGrid(count);
    const canvas = document.createElement('canvas');
    canvas.width = 772;
    canvas.height = 1092;
    const context = canvas.getContext('2d');
    context.fillStyle = '#000000';
    for (let column = 1; column < columns; column += 1) {
        context.fillRect(Math.round(canvas.width * column / columns) - 1, 0, 1, canvas.height);
    }
    for (let row = 1; row < rows; row += 1) {
        context.fillRect(0, Math.round(canvas.height * row / rows) - 1, canvas.width, 1);
    }
    return canvas.toDataURL('image/png');
}
