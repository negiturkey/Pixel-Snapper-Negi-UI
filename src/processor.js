export class Processor {
    constructor() {
        this.ui = null;
        this.originalImage = null;
        this.processedImage = null;
        this.originalCanvas = document.createElement('canvas'); // Offscreen
        this.processedCanvas = document.createElement('canvas');
        this.sourceCanvas = document.createElement('canvas'); // Scaled input
        this.scale = 1.0;
        this.exportScale = 1.0;
    }

    setUI(ui) {
        this.ui = ui;
    }

    async loadImage(img) {
        this.originalImage = img;
        this.processedImage = null;
        this.scale = 1.0;

        this.originalCanvas.width = img.width;
        this.originalCanvas.height = img.height;
        const ctx = this.originalCanvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);

        // Init Source (Scaled)
        this.updateSourceCanvas();

        this.ui.updateCanvas(this.sourceCanvas, null);
        this.ui.setInfo(`Loaded image: ${img.width}x${img.height}`);
        this.ui.updateResDisplay(img.width, img.height, this.sourceCanvas.width, this.sourceCanvas.height);
        this.ui.elements.downloadBtn.disabled = true;

        // Init Engine
        await this.initWasm();

        // Auto-Process
        const currentColorCount = parseInt(this.ui.elements.colorCountInput.value, 10);
        this.process({
            colorCount: currentColorCount
        });
    }

    updateSourceCanvas() {
        if (!this.originalImage) return;

        // 1. Apply Pre-processing Filters to Internal Original Canvas
        // This ensures both 'Smart' sampling AND standard resizing inherit the filters.
        const contrast = (this.ui && this.ui.elements.contrast) ? this.ui.elements.contrast.value : 100;
        const saturation = (this.ui && this.ui.elements.saturation) ? this.ui.elements.saturation.value : 100;

        const oCtx = this.originalCanvas.getContext('2d', { willReadFrequently: true });
        oCtx.globalCompositeOperation = 'copy'; // Ensure clean overwrite
        oCtx.filter = `contrast(${contrast}%) saturate(${saturation}%)`;
        oCtx.drawImage(this.originalImage, 0, 0);
        oCtx.filter = 'none'; // Reset
        oCtx.globalCompositeOperation = 'source-over';

        // 2. Prepare Source (Scaled) Canvas
        const w = Math.max(1, Math.floor(this.originalImage.width * this.scale));
        const h = Math.max(1, Math.floor(this.originalImage.height * this.scale));

        this.sourceCanvas.width = w;
        this.sourceCanvas.height = h;
        const ctx = this.sourceCanvas.getContext('2d', { willReadFrequently: true });

        // Default resizing: Use Smart Downscale (Histogram-based) for best pixel art retention
        // Or fallback to smooth if performance is an issue, but for now we enforce Smart.
        // Actually, let's stick to a robust standard: Sharp (Nearest) if scaling up, Smart if scaling down?
        // Let's just use Smart Downscale as the fixed engine.
        this.smartDownscale(ctx, w, h);
    }

    smartDownscale(targetCtx, targetW, targetH) {
        // Prepare Source Data
        const srcW = this.originalCanvas.width;
        const srcH = this.originalCanvas.height;
        const srcCtx = this.originalCanvas.getContext('2d');
        const srcData = srcCtx.getImageData(0, 0, srcW, srcH).data;

        const targetImgData = targetCtx.createImageData(targetW, targetH);
        const tgtData = targetImgData.data;

        // Ratios
        const ratioX = srcW / targetW;
        const ratioY = srcH / targetH;

        for (let y = 0; y < targetH; y++) {
            for (let x = 0; x < targetW; x++) {
                // Define sample area in source
                const startX = Math.floor(x * ratioX);
                const startY = Math.floor(y * ratioY);
                const endX = Math.min(srcW, Math.ceil((x + 1) * ratioX));
                const endY = Math.min(srcH, Math.ceil((y + 1) * ratioY));

                // Histogram in this block
                const colors = {};
                let maxCount = -1;
                let bestColor = [0, 0, 0, 0]; // default

                // Optimization: Sample strided if block is huge (performance)
                let step = 1;
                if ((endX - startX) > 10) step = 2; // skip pixels for speed on huge reduction

                for (let sy = startY; sy < endY; sy += step) {
                    for (let sx = startX; sx < endX; sx += step) {
                        const idx = (sy * srcW + sx) * 4;
                        // Ignore fully transparent
                        if (srcData[idx + 3] < 50) continue;

                        // Safe string concatenation to avoid template literal issues
                        const key = srcData[idx] + ',' + srcData[idx + 1] + ',' + srcData[idx + 2];
                        colors[key] = (colors[key] || 0) + 1;

                        if (colors[key] > maxCount) {
                            maxCount = colors[key];
                            bestColor = [srcData[idx], srcData[idx + 1], srcData[idx + 2], 255];
                        }
                    }
                }

                if (maxCount === -1) {
                    // Transparent
                    const tidx = (y * targetW + x) * 4;
                    tgtData[tidx + 3] = 0;
                } else {
                    const tidx = (y * targetW + x) * 4;
                    tgtData[tidx] = bestColor[0];
                    tgtData[tidx + 1] = bestColor[1];
                    tgtData[tidx + 2] = bestColor[2];
                    tgtData[tidx + 3] = 255;
                }
            }
        }
        targetCtx.putImageData(targetImgData, 0, 0);
    }

    setScale(s) {
        if (s === this.scale) return;
        this.scale = s;
        this.updateSourceCanvas();
        // Update UI
        this.ui.updateResDisplay(this.originalImage.width, this.originalImage.height, this.sourceCanvas.width, this.sourceCanvas.height);
    }

    async initWasm() {
        if (this.wasm) return;
        try {
            // Cache busting
            const timestamp = new Date().getTime();
            const module = await import(`../pkg/spritefusion_pixel_snapper.js?v=${timestamp}`);
            await module.default();
            this.wasm = module;
            this.ui.setInfo('Engine Loaded');
        } catch (e) {
            console.error('WASM Load Failed', e);
            this.ui.setInfo('Error: Engine load failed');
        }
    }

    async process(options) {
        if (!this.sourceCanvas) return;

        if (!this.wasm) {
            await this.initWasm();
        }

        if (!this.wasm) return;

        this.ui.setInfo('Processing with Core Engine...');

        // 1. Get Blob from Source Canvas (Resized Image)
        const blob = await new Promise(resolve => this.sourceCanvas.toBlob(resolve, 'image/png'));
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        const { colorCount, sensitivity } = options;

        try {
            // 2. Call WASM
            console.log('JS calling WASM with sensitivity:', sensitivity || 50);
            const outBytes = this.wasm.process_image(bytes, colorCount, sensitivity || 50);

            // 3. Convert Output Bytes to Image
            const outBlob = new Blob([outBytes], { type: 'image/png' });

            // Clean up previous URL
            if (this.currentProcessedUrl) {
                URL.revokeObjectURL(this.currentProcessedUrl);
            }

            const url = URL.createObjectURL(outBlob);
            this.currentProcessedUrl = url;

            const processedImg = new Image();
            processedImg.onload = () => {
                this.processedImage = processedImg;

                // Update UI: Source is our resized canvas, Processed is the WASM result
                this.ui.updateCanvas(this.sourceCanvas, this.processedImage);
                this.ui.setInfo(`Processed! (Color: ${colorCount})`);
                this.ui.elements.downloadBtn.disabled = false;
            };
            processedImg.src = url;

        } catch (e) {
            console.error('Core Engine Error:', e);
            this.ui.setInfo('Error in Core Engine');
        }
    }

    setExportScale(s) {
        this.exportScale = s;
    }

    getProcessedDataURL() {
        if (!this.processedImage) return null;

        const w = this.processedImage.width;
        const h = this.processedImage.height;
        // Ensure exportScale is initialized, default to 1 if not set
        const scale = this.exportScale !== undefined ? this.exportScale : 1;

        const canvas = document.createElement('canvas');
        canvas.width = w * scale;
        canvas.height = h * scale;
        const ctx = canvas.getContext('2d');

        ctx.imageSmoothingEnabled = false; // Pixel Art Sharpness
        ctx.drawImage(this.processedImage, 0, 0, canvas.width, canvas.height);

        return canvas.toDataURL('image/png');
    }
}
