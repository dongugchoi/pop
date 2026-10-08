import ExcelJS from 'exceljs';
import { LAYOUTS, imagePlacement } from './layout';
import { createDividerImage } from './dividers';

export async function createWorkbook(imagesByLayout) {
    const response = await fetch(`${process.env.BASE_URL}templates/inspection.xlsx`);
    if (!response.ok) throw new Error('엑셀 양식을 불러오지 못했습니다.');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());
    for (const count of LAYOUTS) {
        const dividerId = workbook.addImage({ base64: createDividerImage(count), extension: 'png' });
        const original = workbook.getWorksheet(`${count}칸`);
        const images = imagesByLayout[count] || [];
        const pageCount = Math.max(1, Math.ceil(images.length / count));
        for (let page = 0; page < pageCount; page += 1) {
            const name = page === 0 ? `${count}칸` : `${count}칸_${page + 1}`;
            const sheet = workbook.getWorksheet(name) || workbook.addWorksheet(name);
            if (page > 0) {
                for (let col = 1; col <= 10; col += 1) {
                    sheet.getColumn(col).width = original.getColumn(col).width;
                }
                sheet.properties.defaultRowHeight = original.properties.defaultRowHeight;
                for (let row = 1; row <= 48; row += 1) {
                    sheet.getRow(row).height = original.getRow(row).height;
                    for (let col = 1; col <= 10; col += 1) {
                        sheet.getCell(row, col).style = JSON.parse(JSON.stringify(original.getCell(row, col).style));
                    }
                }
            }
            sheet.views = [{ showGridLines: false }];
            for (let row = 1; row <= 48; row += 1) {
                for (let col = 1; col <= 10; col += 1) {
                    sheet.getCell(row, col).border = {};
                }
            }
            sheet.pageSetup = {
                paperSize: 9,
                orientation: 'portrait',
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 1,
                printArea: 'A1:J48',
                horizontalCentered: true,
                verticalCentered: true,
                margins: { left: 0.11811, right: 0.11811, top: 0.15748, bottom: 0.15748, header: 0, footer: 0 }
            };
            images.slice(page * count, (page + 1) * count).forEach((image, index) => {
                if (!image) return;
                const id = workbook.addImage({ base64: image.renderedDataUrl || image.dataUrl, extension: 'png' });
                const placement = imagePlacement(count, index, image.width, image.height);
                sheet.addImage(id, {
                    tl: {
                        nativeCol: Math.floor(placement.col),
                        nativeColOff: Math.round((placement.col % 1) * 64 * 9525),
                        nativeRow: Math.floor(placement.row),
                        nativeRowOff: Math.round((placement.row % 1) * 22 * 9525)
                    },
                    br: { col: placement.endCol, row: placement.endRow },
                    editAs: 'twoCell'
                });
            });
            // Added last so transparent divider lines sit above all uploaded images.
            sheet.addImage(dividerId, {
                tl: { col: 0, row: 0 },
                br: { col: 10, row: 48 },
                editAs: 'twoCell'
            });
        }
    }
    workbook.worksheets.slice().sort((a, b) => {
        const [left, leftPage = '1'] = a.name.replace('칸', '').split('_');
        const [right, rightPage = '1'] = b.name.replace('칸', '').split('_');
        return Number(left) - Number(right) || Number(leftPage) - Number(rightPage);
    }).forEach((sheet, index) => { sheet.orderNo = index; });
    return workbook;
}

export async function downloadWorkbook(imagesByLayout) {
    const workbook = await createWorkbook(imagesByLayout);
    const buffer = await workbook.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }));
    const link = document.createElement('a');
    link.href = url;
    link.download = '공병검수스캔_배치.xlsx';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}
