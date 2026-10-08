export const LAYOUTS = [4, 6, 8];

export function layoutGrid(count) {
    if (!LAYOUTS.includes(count)) throw new Error('지원하지 않는 칸 수입니다.');
    return {
        columns: 2,
        rows: count / 2
    };
}

export function imagePlacement(count, index) {
    const { columns, rows } = layoutGrid(count);
    const col = (index % columns) * 10 / columns;
    const row = Math.floor(index / columns) * 48 / rows;
    const endCol = col + 10 / columns;
    const endRow = row + 48 / rows;
    return {
        col,
        row,
        endCol,
        endRow
    };
}
