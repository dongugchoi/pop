const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ExcelJS = require('exceljs');

async function verify() {
    const root = path.resolve(__dirname, '..');
    const loadModule = (source) => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const layout = await loadModule(fs.readFileSync(path.join(root, 'src/services/layout.js'), 'utf8'));
    globalThis.__layout = layout;
    globalThis.__ExcelJS = ExcelJS;
    const dividerCalls = [];
    globalThis.document = {
        createElement: () => ({
            getContext: () => ({ fillRect: (...args) => dividerCalls.push(args) }),
            toDataURL: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
        })
    };
    const dividerSource = fs.readFileSync(path.join(root, 'src/services/dividers.js'), 'utf8')
        .replace("import { layoutGrid } from './layout';", 'const { layoutGrid } = globalThis.__layout;');
    globalThis.__dividers = await loadModule(dividerSource);
    for (const count of layout.LAYOUTS) {
        dividerCalls.length = 0;
        globalThis.__dividers.createDividerImage(count);
        assert.equal(dividerCalls.length, count / 2);
        assert(dividerCalls.every(([x, y, width, height]) => width === 1 || height === 1));
        assert(dividerCalls.every(([x, y]) => x > 0 || y > 0));
    }
    globalThis.fetch = async () => ({
        ok: true,
        arrayBuffer: async () => {
            const buffer = fs.readFileSync(path.join(root, 'public/templates/inspection.xlsx'));
            return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        }
    });
    const source = fs.readFileSync(path.join(root, 'src/services/workbook.js'), 'utf8')
        .replace("import ExcelJS from 'exceljs';", 'const ExcelJS = globalThis.__ExcelJS;')
        .replace("import { LAYOUTS, imagePlacement } from './layout';", 'const { LAYOUTS, layoutGrid, imagePlacement } = globalThis.__layout;')
        .replace("import { createDividerImage } from './dividers';", 'const { createDividerImage } = globalThis.__dividers;');
    const { createWorkbook } = await loadModule(source);
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII=';
    const byLayout = {};
    for (const count of layout.LAYOUTS) {
        byLayout[count] = Array.from({ length: count + 1 }, () => ({ dataUrl, width: 1654, height: 2340 }));
        let coveredArea = 0;
        for (let index = 0; index < count; index += 1) {
            const position = layout.imagePlacement(count, index);
            assert(position.col >= 0 && position.endCol <= 10);
            assert(position.row >= 0 && position.endRow <= 48);
            coveredArea += (position.endCol - position.col) * (position.endRow - position.row);
            for (let previous = 0; previous < index; previous += 1) {
                const other = layout.imagePlacement(count, previous);
                assert(position.endCol <= other.col || position.col >= other.endCol || position.endRow <= other.row || position.row >= other.endRow);
            }
        }
        assert.equal(coveredArea, 480);
    }
    const workbook = await createWorkbook(byLayout);
    const restored = new ExcelJS.Workbook();
    await restored.xlsx.load(await workbook.xlsx.writeBuffer());
    assert.equal(restored.worksheets.length, 6);
    const template = new ExcelJS.Workbook();
    await template.xlsx.readFile(path.join(root, 'public/templates/inspection.xlsx'));
    for (const count of layout.LAYOUTS) {
        const sheet = restored.getWorksheet(`${count}칸`);
        {
            for (const target of [sheet, restored.getWorksheet(`${count}칸_2`)]) {
                for (let row = 1; row <= 48; row += 1) {
                    assert.equal(target.getRow(row).height, template.getWorksheet(`${count}칸`).getRow(row).height);
                    for (let col = 1; col <= 10; col += 1) {
                        assert.deepEqual(target.getCell(row, col).border || {}, {});
                    }
                }
            }
        }
        assert.equal(sheet.getImages().length, count + 1);
        assert.equal(restored.getWorksheet(`${count}칸_2`).getImages().length, 2);
        const divider = sheet.getImages().at(-1);
        assert.equal(divider.range.tl.nativeCol, 0);
        assert.equal(divider.range.tl.nativeRow, 0);
        assert.equal(divider.range.br.nativeCol, 10);
        assert.equal(divider.range.br.nativeRow, 48);
        assert.equal(sheet.pageSetup.printArea, 'A1:J48');
        assert.equal(sheet.pageSetup.paperSize, 9);
        assert.equal(sheet.pageSetup.fitToPage, true);
        assert.equal(sheet.pageSetup.fitToWidth, 1);
        assert.equal(sheet.pageSetup.fitToHeight, 1);
        for (const [index, image] of sheet.getImages().slice(0, -1).entries()) {
            const expected = layout.imagePlacement(count, index, 1654, 2340);
            const anchor = image.range.tl;
            assert(Math.abs(anchor.nativeCol * 64 + anchor.nativeColOff / 9525 - expected.col * 64) < 0.001);
            assert(Math.abs(anchor.nativeRow * 22 + anchor.nativeRowOff / 9525 - expected.row * 22) < 0.001);
            assert.equal(image.range.br.nativeCol, expected.endCol);
            assert.equal(image.range.br.nativeRow, expected.endRow);
            assert.equal(image.range.br.nativeColOff, 0);
            assert.equal(image.range.br.nativeRowOff, 0);
        }
    }
    for (const count of [1, 2, 3]) {
        assert.equal(restored.getWorksheet(String(count) + '칸'), undefined);
    }
    const sharedImages = byLayout[8];
    const sharedWorkbook = await createWorkbook(Object.fromEntries(layout.LAYOUTS.map((count) => [count, sharedImages])));
    const sharedRestored = new ExcelJS.Workbook();
    await sharedRestored.xlsx.load(await sharedWorkbook.xlsx.writeBuffer());
    for (const count of layout.LAYOUTS) {
        const sheets = sharedRestored.worksheets.filter((sheet) => sheet.name === `${count}칸` || sheet.name.startsWith(`${count}칸_`));
        assert.equal(sheets.reduce((sum, sheet) => sum + sheet.getImages().length - 1, 0), sharedImages.length);
        const firstImage = sheets[0].getImages()[0];
        assert.equal(sharedRestored.getImage(firstImage.imageId).buffer.toString('base64'), dataUrl.split(',')[1]);
    }
    const memoDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const memoImages = [{ dataUrl, renderedDataUrl: memoDataUrl, memo: '검수 완료', width: 1654, height: 2340 }];
    const memoWorkbook = await createWorkbook(Object.fromEntries(layout.LAYOUTS.map((count) => [count, memoImages])));
    const memoRestored = new ExcelJS.Workbook();
    await memoRestored.xlsx.load(await memoWorkbook.xlsx.writeBuffer());
    for (const count of layout.LAYOUTS) {
        const image = memoRestored.getWorksheet(`${count}칸`).getImages()[0];
        assert.equal(memoRestored.getImage(image.imageId).buffer.toString('base64'), memoDataUrl.split(',')[1]);
    }
    const { renderAnnotations } = await loadModule(fs.readFileSync(path.join(root, 'src/services/memo.js'), 'utf8'));
    const calls = [];
    globalThis.Image = class {
        async decode() {}
    };
    globalThis.document = {
        createElement: () => ({
            getContext: () => ({
                drawImage: (...args) => calls.push(['image', ...args]),
                measureText: (text) => ({ width: Array.from(text).length * 30 }),
                fillRect: (...args) => calls.push(['background', ...args]),
                fillText: (...args) => calls.push(['text', ...args])
            }),
            toDataURL: () => memoDataUrl
        })
    };
    assert.equal(await renderAnnotations(memoImages[0], []), dataUrl);
    const annotations = [{ text: '검수 완료\n담당자 확인', x: 0.25, y: 0.4, size: 4, bold: true, color: '#d32f2f' }];
    assert.equal(await renderAnnotations(memoImages[0], annotations), memoDataUrl);
    assert.equal(calls.filter((call) => call[0] === 'text').length, 2);
    assert.equal(calls[0][1].src, dataUrl);
    assert(!calls.some((call) => call[0] === 'background'));
    const firstText = calls.find((call) => call[0] === 'text');
    assert.equal(firstText[2], 1654 * 0.25);
    assert.equal(firstText[3], 2340 * 0.4);
    await assert.rejects(renderAnnotations(memoImages[0], [{ ...annotations[0], x: 0.99 }]), /이미지 밖/);
    console.log('PASS: 4/6/8 layouts, exact boundaries, overflow pages, shared images, positioned text rendering/removal and annotated XLSX images.');
}

verify().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
