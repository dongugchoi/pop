<template>
    <v-app>
        <v-app-bar app color="primary" dark>
            <v-spacer />
            <v-btn outlined class="mr-2" :disabled="busy || printing || exporting || !totalImages" @click="clearImages">
                <v-icon left>mdi-refresh</v-icon>이미지 초기화
            </v-btn>
            <v-btn outlined class="mr-2" :loading="exporting" :disabled="busy || printing || exporting || !totalImages" @click="exportExcel">
                <v-icon left>mdi-download</v-icon>엑셀 다운로드
            </v-btn>
            <v-btn outlined :loading="printing" :disabled="busy || exporting || !totalImages" @click="printImages">
                <v-icon left>mdi-printer</v-icon>{{ selectedCount }}칸 인쇄
            </v-btn>
        </v-app-bar>

        <v-main class="grey lighten-4">
            <v-container fluid class="workspace pa-3">
                <v-card outlined class="workspace-header mb-3">
                    <v-tabs v-model="tab" background-color="transparent">
                        <v-tab v-for="count in layouts" :key="count" :disabled="busy || printing || exporting">
                            {{ count }}칸
                            <v-chip v-if="totalImages" x-small class="ml-2">{{ totalImages }}</v-chip>
                        </v-tab>
                    </v-tabs>
                </v-card>
                <v-alert v-if="error" type="error" dismissible @input="error = ''">{{ error }}</v-alert>
                <v-row class="workspace-panels">
                    <v-col cols="12" md="4" class="workspace-column sidebar-column">
                        <v-card outlined class="workspace-card">
                            <v-card-title>{{ selectedCount }}칸 시트</v-card-title>
                            <v-card-text class="sidebar-scroll">
                                <v-btn block color="primary" :loading="busy" :disabled="printing || exporting" @click="openUpload()">
                                    <v-icon left>mdi-upload</v-icon>이미지 업로드
                                </v-btn>
                                <input ref="upload" class="d-none" type="file" multiple accept=".tif,.tiff,.png,.jpg,.jpeg,.webp" @change="uploadImages">
                                <v-progress-linear v-if="busy" indeterminate color="primary" />
                                <p aria-live="polite">{{ status }}</p>
                                <v-list dense>
                                    <v-list-item v-for="(image, index) in selectedImages" v-if="image" :key="image.id" :draggable="!busy && !printing && !exporting" :class="{ 'image-drop-target': dragOverIndex === index }" @dragstart="startImageDrag($event, index)" @dragover="overImage($event, index)" @drop="dropImage($event, index)" @dragend="endImageDrag">
                                        <v-list-item-content>
                                            <v-list-item-title><v-icon small class="mr-1">mdi-drag</v-icon>{{ index + 1 }}. {{ image.name }}</v-list-item-title>
                                            <v-list-item-subtitle>
                                                {{ image.sourcePageCount > 1 ? '원본 TIFF 파일 용량' : '원본 파일 용량' }}: {{ formatFileSize(image.sourceBytes) }}
                                                · {{ image.width }} × {{ image.height }} px
                                            </v-list-item-subtitle>
                                            <v-list-item-subtitle>{{ Math.floor(index / selectedCount) + 1 }}페이지 · {{ index % selectedCount + 1 }}번 칸</v-list-item-subtitle>
                                            <v-list-item-subtitle v-if="image.annotations && image.annotations.length">텍스트 {{ image.annotations.length }}개</v-list-item-subtitle>
                                            <v-btn small text color="primary" class="align-self-start" :disabled="busy || printing || exporting" @click="openMemo(image)">
                                                <v-icon small left>mdi-pencil</v-icon>텍스트 배치
                                            </v-btn>
                                        </v-list-item-content>
                                        <v-list-item-action class="d-flex flex-row">
                                            <v-btn icon small :disabled="busy || printing || exporting || index === 0" aria-label="앞 순서로 이동" @click="moveImage(index)"><v-icon small>mdi-arrow-up</v-icon></v-btn>
                                            <v-btn icon small :disabled="busy || printing || exporting" aria-label="이미지 삭제" @click="$set(images, index, null)"><v-icon small>mdi-close</v-icon></v-btn>
                                        </v-list-item-action>
                                    </v-list-item>
                                </v-list>
                            </v-card-text>
                        </v-card>
                    </v-col>
                    <v-col cols="12" md="8" class="workspace-column preview-column">
                        <v-card outlined class="workspace-card">
                            <v-card-title class="preview-title">배치 미리보기<v-spacer /><span class="text-body-2">A4 · {{ pages.length }}페이지</span></v-card-title>
                            <v-card-text class="grey lighten-3 preview-area">
                                <div v-for="(page, index) in pages" :key="index" class="preview-page">
                                    <div class="scan-sheet" :style="gridStyle">
                                        <button v-for="slot in selectedCount" :key="slot" type="button" class="scan-slot" :class="{ 'image-drop-target': dragOverIndex === index * selectedCount + slot - 1 }" :draggable="!!page[slot - 1] && !busy && !printing && !exporting" :disabled="busy || printing || exporting" :aria-label="`${index * selectedCount + slot}번 이미지 업로드 또는 교체`" @dragstart="startImageDrag($event, index * selectedCount + slot - 1)" @dragover="overImage($event, index * selectedCount + slot - 1)" @drop="dropImage($event, index * selectedCount + slot - 1)" @dragend="endImageDrag" @click="openUpload(index * selectedCount + slot - 1)">
                                            <img v-if="page[slot - 1]" :src="page[slot - 1].renderedDataUrl || page[slot - 1].dataUrl" :alt="page[slot - 1].name" draggable="false">
                                            <span v-else class="grey--text">{{ slot }}번 칸</span>
                                        </button>
                                    </div>
                                </div>
                            </v-card-text>
                        </v-card>
                    </v-col>
                </v-row>
                <text-editor v-model="memoDialog" :image="memoImage" @save="saveAnnotations" />
                <v-dialog v-model="resetDialog" max-width="420">
                    <v-card>
                        <v-card-title>이미지를 초기화할까요?</v-card-title>
                        <v-card-text>모든 이미지와 배치한 텍스트가 삭제됩니다.</v-card-text>
                        <v-card-actions>
                            <v-spacer />
                            <v-btn text @click="resetDialog = false">취소</v-btn>
                            <v-btn color="error" @click="confirmReset">초기화</v-btn>
                        </v-card-actions>
                    </v-card>
                </v-dialog>
            </v-container>
        </v-main>
        <div ref="printArea" class="print-area" aria-hidden="true">
            <section v-for="(page, index) in pages" :key="index" class="print-page" :style="printGridStyle">
                <div v-for="slot in selectedCount" :key="slot" class="print-slot">
                    <img v-if="page[slot - 1]" :src="page[slot - 1].renderedDataUrl || page[slot - 1].dataUrl" alt="">
                </div>
            </section>
        </div>
    </v-app>
</template>

<script>
import { LAYOUTS, layoutGrid } from './services/layout';
import { readImages } from './services/images';
import { formatFileSize } from './services/file-size';
import { downloadWorkbook } from './services/workbook';
import TextEditor from './components/TextEditor.vue';

export default {
    name: 'App',
    components: { TextEditor },
    data() {
        return {
            layouts: LAYOUTS,
            tab: 0,
            images: [],
            uploadIndex: null,
            busy: false,
            printing: false,
            exporting: false,
            error: '',
            status: '',
            resetDialog: false,
            memoDialog: false,
            memoImage: null,
            dragImageId: null,
            dragOverIndex: null
        };
    },
    computed: {
        selectedCount() {
            return this.layouts[this.tab];
        },
        selectedImages() {
            return this.images;
        },
        imagesByLayout() {
            return Object.fromEntries(this.layouts.map((count) => [count, this.images]));
        },
        totalImages() {
            return this.images.filter(Boolean).length;
        },
        pages() {
            const pages = [];
            for (let index = 0; index < this.selectedImages.length; index += this.selectedCount) {
                pages.push(this.selectedImages.slice(index, index + this.selectedCount));
            }
            return pages.length ? pages : [[]];
        },
        gridStyle() {
            const { columns, rows } = layoutGrid(this.selectedCount);
            return {
                aspectRatio: '204 / 289',
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
            };
        },
        printGridStyle() {
            const { columns, rows } = layoutGrid(this.selectedCount);
            return {
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
            };
        }
    },
    methods: {
        startImageDrag(event, index) {
            if (this.busy || this.printing || this.exporting || !this.images[index]) {
                event.preventDefault();
                return;
            }
            this.dragImageId = this.images[index].id;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', this.dragImageId);
        },
        overImage(event, index) {
            if (!this.dragImageId || this.busy || this.printing || this.exporting || index >= this.pages.length * this.selectedCount) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            this.dragOverIndex = index;
        },
        dropImage(event, index) {
            if (!this.dragImageId || this.busy || this.printing || this.exporting) return;
            event.preventDefault();
            const source = this.images.findIndex((image) => image && image.id === this.dragImageId);
            if (source >= 0 && index >= 0 && index < this.pages.length * this.selectedCount && source !== index) {
                const image = this.images[source];
                const target = this.images[index] || null;
                while (this.images.length <= index) this.images.push(null);
                this.$set(this.images, source, target);
                this.$set(this.images, index, image);
                this.status = '이미지 순서를 모든 시트에 반영했습니다.';
            }
            this.endImageDrag();
        },
        endImageDrag() {
            this.dragImageId = null;
            this.dragOverIndex = null;
        },
        formatFileSize,
        openMemo(image) {
            this.memoImage = image;


            this.memoDialog = true;
        },
        saveAnnotations({ image, annotations, renderedDataUrl }) {
            this.$set(image, 'annotations', annotations);
            this.$set(image, 'renderedDataUrl', renderedDataUrl);
        },
        openUpload(index = null) {
            this.uploadIndex = index;
            this.$refs.upload.click();
        },
        async uploadImages(event) {
            const files = Array.from(event.target.files || []);
            if (!files.length) return;
            let target = this.uploadIndex;
            this.busy = true;
            this.error = '';
            const errors = [];
            let added = 0;
            try {
                for (const [index, file] of files.entries()) {
                    this.status = `${index + 1}/${files.length} 처리 중: ${file.name}`;
                    await new Promise((resolve) => setTimeout(resolve, 0));
                    try {
                        const images = await readImages(file);
                        if (target === null) {
                            this.images.push(...images);
                        } else {
                            while (this.images.length < target) this.images.push(null);
                            this.images.splice(target, images.length, ...images);
                            target += images.length;
                        }
                        added += images.length;
                    } catch (error) {
                        errors.push(`${file.name}: ${error.message}`);
                    }
                }
                this.status = `이미지 ${added}개를 모든 시트의 같은 순번에 반영했습니다.`;
                this.error = errors.join(' / ');
            } finally {
                this.busy = false;
                event.target.value = '';
            }
        },
        moveImage(index) {
            const image = this.images[index];
            this.$set(this.images, index, this.images[index - 1] || null);
            this.$set(this.images, index - 1, image);
        },
        clearImages() {
            this.resetDialog = true;
        },
        confirmReset() {
            this.endImageDrag();
            this.resetDialog = false;
            this.images = [];
            this.status = '';
            this.error = '';
            this.uploadIndex = null;
            this.memoDialog = false;
            this.memoImage = null;
        },
        async exportExcel() {
            if (this.busy || this.printing || this.exporting || !this.totalImages) return;
            this.exporting = true;
            this.error = '';
            try {
                await downloadWorkbook(this.imagesByLayout);
            } catch (error) {
                this.error = `엑셀 저장에 실패했습니다: ${error.message}`;
            } finally {
                this.exporting = false;
            }
        },
        async printImages() {
            if (this.busy || this.printing || this.exporting || !this.totalImages) return;
            this.printing = true;
            this.error = '';
            try {
                await this.$nextTick();
                const images = Array.from(this.$refs.printArea.querySelectorAll('img'));
                await Promise.all(images.map((image) => image.decode()));
                if (document.fonts) await document.fonts.ready;
                window.print();
            } catch (error) {
                this.error = `인쇄 준비에 실패했습니다: ${error.message}`;
            } finally {
                this.printing = false;
            }
        }
    }
};
</script>
