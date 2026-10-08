<template>
    <v-dialog :value="value" max-width="1000" :persistent="saving" @input="$emit('input', $event)">
        <v-card>
            <v-card-title>이미지에 텍스트 배치</v-card-title>
            <v-card-text>
                <v-row>
                    <v-col cols="12" md="4">
                        <v-btn block color="primary" class="mb-3" :disabled="saving" @click="addText">텍스트 추가</v-btn>
                        <v-select v-model="selectedId" :items="items" label="편집할 텍스트" outlined dense :disabled="saving" />
                        <template v-if="selected">
                            <v-textarea v-model="selected.text" label="내용" outlined rows="3" maxlength="200" counter :disabled="saving" />
                            <v-slider v-model="selected.size" label="글자 크기" min="1" max="12" step="0.5" thumb-label :disabled="saving" />
                            <v-select v-model="selected.color" :items="colors" label="글자 색상" outlined dense :disabled="saving" />
                            <v-checkbox v-model="selected.bold" label="굵게" :disabled="saving" />
                            <v-btn text color="error" :disabled="saving" @click="removeText">선택한 텍스트 삭제</v-btn>
                        </template>
                        <p class="mt-3">오른쪽 이미지의 글씨를 드래그하거나, 이미지의 원하는 위치를 클릭하세요.</p>
                        <v-alert v-if="error" type="error">{{ error }}</v-alert>
                    </v-col>
                    <v-col cols="12" md="8">
                        <div ref="surface" class="text-editor-surface" :style="surfaceStyle" @pointerdown="placeText">
                            <img v-if="image" :src="image.dataUrl" :alt="image.name" draggable="false">
                            <div v-for="item in texts" :key="item.id" class="editable-text" :class="{ 'editable-text-selected': item.id === selectedId }" :style="textStyle(item)" @pointerdown.stop="startDrag($event, item)" @pointermove="dragText" @pointerup="stopDrag" @pointercancel="stopDrag">
                                {{ item.text || '텍스트' }}
                            </div>
                        </div>
                    </v-col>
                </v-row>
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn text :disabled="saving" @click="$emit('input', false)">취소</v-btn>
                <v-btn color="primary" :loading="saving" @click="apply">배치 적용</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
import { renderAnnotations } from '../services/memo';

export default {
    name: 'TextEditor',
    props: {
        value: Boolean,
        image: { type: Object, default: null }
    },
    data() {
        return {
            texts: [],
            selectedId: null,
            drag: null,
            saving: false,
            error: '',
            colors: [
                { text: '검정', value: '#111111' },
                { text: '빨강', value: '#d32f2f' },
                { text: '파랑', value: '#1565c0' },
                { text: '흰색', value: '#ffffff' }
            ]
        };
    },
    computed: {
        selected() {
            return this.texts.find((item) => item.id === this.selectedId);
        },
        items() {
            return this.texts.map((item, index) => ({ text: `${index + 1}. ${item.text || '텍스트'}`, value: item.id }));
        },
        surfaceStyle() {
            const ratio = this.image ? this.image.width / this.image.height : 1;
            return { aspectRatio: String(ratio), width: `min(100%, ${55 * ratio}vh)` };
        }
    },
    watch: {
        value(open) {
            if (open) {
                this.texts = JSON.parse(JSON.stringify(this.image.annotations || []));
                this.selectedId = this.texts.length ? this.texts[0].id : null;
                this.error = '';
                this.drag = null;
            }
        }
    },
    methods: {
        textStyle(item) {
            return {
                left: `${item.x * 100}%`,
                top: `${item.y * 100}%`,
                fontSize: `${item.size}cqw`,
                color: item.color,
                fontWeight: item.bold ? 'bold' : 'normal'
            };
        },
        addText() {
            const item = { id: `${Date.now()}-${Math.random()}`, text: '텍스트', x: 0.1, y: 0.1, size: 6.5, color: '#111111', bold: true };
            this.texts.push(item);
            this.selectedId = item.id;
        },
        removeText() {
            this.texts = this.texts.filter((item) => item.id !== this.selectedId);
            this.selectedId = this.texts.length ? this.texts[0].id : null;
        },
        placeText(event) {
            if (this.saving || !this.selected) return;
            const rect = this.$refs.surface.getBoundingClientRect();
            this.selected.x = Math.max(0, Math.min(0.95, (event.clientX - rect.left) / rect.width));
            this.selected.y = Math.max(0, Math.min(0.95, (event.clientY - rect.top) / rect.height));
        },
        startDrag(event, item) {
            if (this.saving) return;
            event.preventDefault();
            this.selectedId = item.id;
            const rect = event.currentTarget.getBoundingClientRect();
            this.drag = { id: item.id, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
            event.currentTarget.setPointerCapture(event.pointerId);
        },
        dragText(event) {
            if (!this.drag) return;
            const rect = this.$refs.surface.getBoundingClientRect();
            const textRect = event.currentTarget.getBoundingClientRect();
            this.selected.x = Math.max(0, Math.min(Math.max(0, 1 - textRect.width / rect.width), (event.clientX - rect.left - this.drag.offsetX) / rect.width));
            this.selected.y = Math.max(0, Math.min(Math.max(0, 1 - textRect.height / rect.height), (event.clientY - rect.top - this.drag.offsetY) / rect.height));
        },
        stopDrag() {
            this.drag = null;
        },
        async apply() {
            this.saving = true;
            this.error = '';
            try {
                const annotations = this.texts.filter((item) => item.text.trim()).map((item) => ({ ...item }));
                const renderedDataUrl = await renderAnnotations(this.image, annotations);
                this.$emit('save', { image: this.image, annotations, renderedDataUrl });
                this.$emit('input', false);
            } catch (error) {
                this.error = error.message;
            } finally {
                this.saving = false;
            }
        }
    }
};
</script>
