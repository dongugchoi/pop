const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function verify() {
    const layoutSource = fs.readFileSync('src/services/layout.js', 'utf8');
    const { layoutGrid } = await import(`data:text/javascript;base64,${Buffer.from(layoutSource).toString('base64')}`);
    const sizeSource = fs.readFileSync('src/services/file-size.js', 'utf8');
    const { formatFileSize } = await import(`data:text/javascript;base64,${Buffer.from(sizeSource).toString('base64')}`);
    const app = fs.readFileSync('src/App.vue', 'utf8');
    const script = app.match(/<script>([\s\S]*?)<\/script>/)[1]
        .replace(/^import .*;\r?\n/gm, '')
        .replace('export default', 'module.exports =');
    const events = [];
    const context = {
        module: { exports: {} },
        TextEditor: {},
        layoutGrid,
        formatFileSize,
        document: { fonts: { ready: Promise.resolve() } },
        window: { print: () => events.push('print') }
    };
    vm.runInNewContext(script, context);
    const component = context.module.exports;
    for (const count of [4, 6, 8]) {
        const state = { selectedCount: count, selectedImages: Array.from({ length: count + 1 }, (_, id) => ({ id })) };
        const pages = component.computed.pages.call(state);
        assert.equal(pages.length, 2);
        assert.equal(pages[0].length, count);
        assert.equal(pages[1].length, 1);
        const grid = component.computed.printGridStyle.call(state);
        assert.equal(grid.gridTemplateColumns, 'repeat(2, minmax(0, 1fr))');
        assert.equal(grid.gridTemplateRows, `repeat(${count / 2}, minmax(0, 1fr))`);
    }
    const state = {
        busy: false,
        printing: false,
        totalImages: 2,
        $nextTick: async () => events.push('tick'),
        $refs: { printArea: { querySelectorAll: () => [
            { decode: async () => events.push('decoded 1') },
            { decode: async () => events.push('decoded 2') }
        ] } }
    };
    await component.methods.printImages.call(state);
    assert.equal(events.at(-1), 'print');
    assert(events.includes('decoded 1') && events.includes('decoded 2'));
    assert.equal(state.printing, false);
    assert.equal(state.error, '');
    state.$refs.printArea.querySelectorAll = () => [{ decode: async () => { throw new Error('bad image'); } }];
    const printsBefore = events.filter((event) => event === 'print').length;
    await component.methods.printImages.call(state);
    assert.equal(events.filter((event) => event === 'print').length, printsBefore);
    assert(state.error.includes('bad image'));
    const resetState = { images: [{ id: 1 }], status: 'uploaded', error: '', uploadIndex: 1, memoDialog: false, memoImage: null, resetDialog: false };
    resetState.endImageDrag = () => component.methods.endImageDrag.call(resetState);
    component.methods.clearImages.call(resetState);
    assert.equal(resetState.resetDialog, true);
    assert.equal(resetState.images.length, 1);
    resetState.resetDialog = false;
    assert.equal(resetState.images.length, 1);
    component.methods.confirmReset.call(resetState);
    assert.equal(resetState.images.length, 0);
    assert.equal(resetState.resetDialog, false);
    const dragState = {
        images: [{ id: '1' }, { id: '2', annotations: [{ text: '메모' }] }, { id: '3' }],
        dragImageId: '2', selectedCount: 4, pages: [[]],
        $set: (array, index, value) => { array[index] = value; }
    };
    dragState.endImageDrag = () => component.methods.endImageDrag.call(dragState);
    component.methods.dropImage.call(dragState, { preventDefault() {} }, 3);
    assert.deepEqual(dragState.images.map((image) => image && image.id), ['1', null, '3', '2']);
    assert.equal(dragState.images[3].annotations[0].text, '메모');
    console.log('PASS: 4/6/8 print grids, overflow pages, image loading before printing, failed-image handling.');
}

verify().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
