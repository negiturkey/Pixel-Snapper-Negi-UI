export class UI {
    constructor() {
        this.elements = {
            dropZone: document.getElementById('dropZone'),
            fileInput: document.getElementById('fileInput'),
            gridSizeInput: document.getElementById('gridSize'),
            gridSizeVal: document.getElementById('gridSizeVal'),
            colorCountInput: document.getElementById('colorCount'),
            colorCountVal: document.getElementById('colorCountVal'),
            snapBtn: document.getElementById('snapBtn'),
            downloadBtn: document.getElementById('downloadBtn'),
            statusBar: document.getElementById('statusBar'),
            mainCanvas: document.getElementById('mainCanvas'),
            canvasContainer: document.getElementById('canvasContainer'),
            compareSlider: document.getElementById('compareSlider'),
            zoomIn: document.getElementById('zoomIn'),
            zoomOut: document.getElementById('zoomOut'),
            zoomLevel: document.getElementById('zoomLevel'),
        };

        this.state = {
            zoom: 1.0,
            sliderPos: 0.5,
            isDraggingSlider: false,
            showGrid: false,
        };

        this.currentOriginal = null;
        this.currentProcessed = null;

        this.ctx = this.elements.mainCanvas.getContext('2d');
        this.processor = null; // Injected later

        this.bindEvents();
    }

    setProcessor(processor) {
        this.processor = processor;
    }

    bindEvents() {
        // File Upload
        this.elements.dropZone.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.elements.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); this.elements.dropZone.style.borderColor = 'var(--accent)'; });
        this.elements.dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); this.elements.dropZone.style.borderColor = 'var(--border)'; });
        this.elements.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.elements.dropZone.style.borderColor = 'var(--border)';
            if (e.dataTransfer.files.length) this.handleFile(e.dataTransfer.files[0]);
        });

        // Inputs
        this.elements.gridSizeInput.addEventListener('input', (e) => {
            this.elements.gridSizeVal.textContent = `${e.target.value}px`;
        });
        this.elements.colorCountInput.addEventListener('input', (e) => {
            this.elements.colorCountVal.textContent = e.target.value;
        });

        // Actions
        this.elements.snapBtn.addEventListener('click', () => {
            if (this.processor) {
                this.processor.process({
                    gridSize: parseInt(this.elements.gridSizeInput.value, 10),
                    colorCount: parseInt(this.elements.colorCountInput.value, 10)
                });
            }
        });

        this.elements.downloadBtn.addEventListener('click', () => this.downloadResult());

        // Slider Interaction
        this.elements.canvasContainer.addEventListener('pointerdown', (e) => this.startSlide(e));
        window.addEventListener('pointermove', (e) => this.moveSlide(e));
        window.addEventListener('pointerup', () => this.endSlide());

        // Zoom
        this.elements.zoomIn.addEventListener('click', () => this.changeZoom(0.1));
        this.elements.zoomOut.addEventListener('click', () => this.changeZoom(-0.1));

        // Window Resize
        window.addEventListener('resize', () => {
            this.updateSliderUI();
        });

        // Offsets
        this.elements.offX = document.getElementById('offX');
        this.elements.offY = document.getElementById('offY');
        this.elements.offXVal = document.getElementById('offXVal');
        this.elements.offYVal = document.getElementById('offYVal');

        if (this.elements.offX) {
            this.elements.offX.addEventListener('input', (e) => {
                this.elements.offXVal.textContent = e.target.value;
                this.triggerProcess();
            });
            this.elements.offY.addEventListener('input', (e) => {
                this.elements.offYVal.textContent = e.target.value;
                this.triggerProcess();
            });

            // Reset Button
            const resetBtn = document.getElementById('resetOffsetsBtn');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    this.elements.offX.value = 0;
                    this.elements.offY.value = 0;
                    this.elements.offXVal.textContent = '0';
                    this.elements.offYVal.textContent = '0';
                    this.triggerProcess();
                });
            }
        }

        // Pre-processing
        this.elements.contrast = document.getElementById('contrast');
        this.elements.saturation = document.getElementById('saturation');
        this.elements.contrastVal = document.getElementById('contrastVal');
        this.elements.saturationVal = document.getElementById('saturationVal');

        if (this.elements.contrast) {
            this.elements.contrast.addEventListener('input', (e) => {
                this.elements.contrastVal.textContent = `${e.target.value}%`;
            });
            this.elements.contrast.addEventListener('change', () => {
                if (this.processor) {
                    this.processor.updateSourceCanvas();
                    this.triggerProcess();
                }
            });
        }
        if (this.elements.saturation) {
            this.elements.saturation.addEventListener('input', (e) => {
                this.elements.saturationVal.textContent = `${e.target.value}%`;
            });
            this.elements.saturation.addEventListener('change', () => {
                if (this.processor) {
                    this.processor.updateSourceCanvas();
                    this.triggerProcess();
                }
            });
        }

        // Input Scale
        this.elements.inputScale = document.getElementById('inputScale');
        this.elements.inputScaleVal = document.getElementById('inputScaleVal');
        this.elements.resDisplay = document.getElementById('resDisplay');

        if (this.elements.inputScale) {
            this.elements.inputScale.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                this.elements.inputScaleVal.textContent = `${val}%`;
                if (this.processor) {
                    this.processor.setScale(val / 100.0);
                    this.triggerProcess();
                }
            });
        }



        // View Options
        this.elements.showGrid = document.getElementById('showGrid');
        if (this.elements.showGrid) {
            this.elements.showGrid.addEventListener('change', (e) => {
                this.state.showGrid = e.target.checked;
                this.renderComposition(this.currentOriginal, this.currentProcessed);
            });
        }


        // Export Scale
        this.elements.exportScale = document.getElementById('exportScale');
        this.elements.exportScaleVal = document.getElementById('exportScaleVal');
        if (this.elements.exportScale) {
            this.elements.exportScale.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                this.elements.exportScaleVal.textContent = `${val}x`;
                if (this.processor) {
                    this.processor.setExportScale(val);
                }
            });
        }




        // Magnifier (Lens)
        this.elements.magnifier = document.getElementById('magnifier');

        // Show magnifier on hover if canvas is present
        this.elements.canvasContainer.addEventListener('pointerenter', () => {
            if (this.elements.magnifier) this.elements.magnifier.style.display = 'block';
        });
        this.elements.canvasContainer.addEventListener('pointerleave', () => {
            if (this.elements.magnifier) this.elements.magnifier.style.display = 'none';
        });

        this.elements.canvasContainer.addEventListener('pointermove', (e) => this.updateMagnifier(e));
    }

    // ... existing startSlide ...

    // Helper for Triggering Process with current UI values
    triggerProcess() {
        if (this.processor) {
            this.processor.process({
                gridSize: parseInt(this.elements.gridSizeInput.value, 10),
                colorCount: parseInt(this.elements.colorCountInput.value, 10),
                offsetX: parseInt(this.elements.offX.value, 10),
                offsetY: parseInt(this.elements.offY.value, 10),
                contrast: this.elements.contrast ? parseInt(this.elements.contrast.value, 10) : 100,
                saturation: this.elements.saturation ? parseInt(this.elements.saturation.value, 10) : 100,
                sensitivity: 50
            });
        }
    }

    updateMagnifier(e) {
        if (!this.elements.magnifier || this.elements.magnifier.style.display === 'none') return;

        // Don't show if dragging slider
        if (this.state.isDraggingSlider) {
            this.elements.magnifier.style.display = 'none';
            return;
        }

        const rect = this.elements.mainCanvas.getBoundingClientRect();

        // Mouse relative to canvas
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        if (mx < 0 || my < 0 || mx > rect.width || my > rect.height) {
            this.elements.magnifier.style.display = 'none';
            return;
        }
        this.elements.magnifier.style.display = 'block';

        const magSize = 200; // Larger loupe
        const zoom = 4;      // Mag factor relative to *screen* pixels

        // Move loupe to cursor
        // Position relative to container
        const contRect = this.elements.canvasContainer.getBoundingClientRect();
        const lx = e.clientX - contRect.left;
        const ly = e.clientY - contRect.top;

        this.elements.magnifier.style.left = `${lx - magSize / 2}px`;
        this.elements.magnifier.style.top = `${ly - magSize / 2}px`;

        // Background image: We need the Current Canvas image?
        // Actually, mainCanvas has the composition drawn on it.
        // So we can use mainCanvas as background image?
        // toDataURL is heavy to call every frame.
        // CSS element() is limited.
        // Alternative: Draw into a small canvas inside magnifier?

        // Optimization: Use `ctx.drawImage` from mainCanvas to magnifier canvas.

        // Let's assume magnifier has a canvas inside, or is a canvas.
        // Wait, simple CSS border-radius div with background-image is valid if we set dataURL once? No, canvas changes.
        // Best approach for real-time canvas loupe:
        // The Magnifier is a <canvas> element.

        const magCtx = this.elements.magnifier.getContext('2d');
        if (magCtx) {
            // Clear
            magCtx.clearRect(0, 0, magSize, magSize);

            // Source coords (scaled by current zoom of main canvas)
            // mainCanvas.width is integer resolution.
            // displayed width is rect.width.
            // Mouse is at mx, my (display pixels).
            // Map to internal resolution?

            const r = this.elements.mainCanvas.width / rect.width; // Resolution ratio

            const sx = mx * r;
            const sy = my * r;
            const sw = (magSize / zoom) * r;
            const sh = (magSize / zoom) * r;

            // Draw from mainCanvas
            magCtx.imageSmoothingEnabled = false; // Pixelated
            magCtx.drawImage(this.elements.mainCanvas,
                sx - sw / 2, sy - sh / 2, sw, sh,
                0, 0, magSize, magSize
            );

            // Optional: Draw crosshair
            magCtx.strokeStyle = 'rgba(255,0,0,0.5)';
            magCtx.lineWidth = 1;
            magCtx.beginPath();
            magCtx.moveTo(magSize / 2, 0); magCtx.lineTo(magSize / 2, magSize);
            magCtx.moveTo(0, magSize / 2); magCtx.lineTo(magSize, magSize / 2);
            magCtx.stroke();
        }
    }

    handleFileSelect(e) {
        if (e.target.files.length) this.handleFile(e.target.files[0]);
    }

    handleFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.processor.loadImage(img);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // Draw Logic
    updateCanvas(originalImage, processedImage) {
        if (!originalImage) return;

        this.currentOriginal = originalImage;
        this.currentProcessed = processedImage;

        // Resize canvas to fit image
        this.elements.mainCanvas.width = originalImage.width;
        this.elements.mainCanvas.height = originalImage.height;

        // Auto-fit on new image (when processedImage is NOT set)
        if (!processedImage) {
            this.fitToScreen();
        } else {
            this.updateZoomDisplay();
        }

        this.renderComposition(originalImage, processedImage);
    }

    renderComposition(original, processed) {
        const w = this.elements.mainCanvas.width;
        const h = this.elements.mainCanvas.height;

        this.ctx.clearRect(0, 0, w, h);

        // Force Nearest Neighbor for sharp display
        this.ctx.imageSmoothingEnabled = false;

        // If no processed image, show original full
        if (!processed) {
            this.ctx.drawImage(original, 0, 0, w, h);
            this.elements.compareSlider.style.display = 'none';
            return;
        }

        this.elements.compareSlider.style.display = 'block';

        // Draw Original (Left side)
        const splitX = w * this.state.sliderPos;

        // Save context to clip
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(0, 0, splitX, h);
        this.ctx.clip();
        this.ctx.drawImage(original, 0, 0, w, h);
        this.ctx.restore();

        // Draw Processed (Right side)
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(splitX, 0, w - splitX, h);
        this.ctx.clip();

        // Paranoid: Ensure smoothing is OFF here
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
        this.ctx.msImageSmoothingEnabled = false;

        this.ctx.drawImage(processed, 0, 0, w, h);

        // Draw Pixel Grid Overlay
        if (this.state.showGrid && processed && processed.width > 0 && processed.height > 0) {
            const pw = processed.width;
            const ph = processed.height;
            const scaleX = w / pw;
            const scaleY = h / ph;

            // Only draw if grid is visible (scale > 3px presumably, but user asked for it so draw anyway)
            // But if scale is 1, grid clears the image. Optimize?
            // Prevent messy display when zoomed out (pixels too small)
            if (scaleX < 4) return;

            // Draw grid lines
            this.ctx.beginPath();
            this.ctx.strokeStyle = 'rgba(200, 200, 200, 0.4)'; // Use red for visibility test
            this.ctx.lineWidth = 1;

            // Vertical lines
            for (let i = 1; i < pw; i++) {
                const x = Math.floor(i * scaleX) + 0.5; // +0.5 for sharp lines
                if (x > splitX) { // optimization
                    this.ctx.moveTo(x, 0);
                    this.ctx.lineTo(x, h);
                }
            }
            // Horizontal lines
            for (let j = 1; j < ph; j++) {
                const y = Math.floor(j * scaleY) + 0.5;
                this.ctx.moveTo(splitX, y); // start from split
                this.ctx.lineTo(w, y);
            }
            this.ctx.stroke();
        }

        this.ctx.restore();

        this.updateSliderUI();
    }

    startSlide(e) {
        if (this.elements.compareSlider.style.display === 'none') return;
        this.state.isDraggingSlider = true;
        this.elements.canvasContainer.setPointerCapture(e.pointerId);
        this.moveSlide(e);
    }

    moveSlide(e) {
        if (!this.state.isDraggingSlider) return;

        const canvasRect = this.elements.mainCanvas.getBoundingClientRect();
        const x = e.clientX - canvasRect.left;
        let pos = x / canvasRect.width;
        pos = Math.max(0, Math.min(1, pos));

        this.state.sliderPos = pos;
        this.renderComposition(this.currentOriginal, this.currentProcessed);
    }

    endSlide() {
        this.state.isDraggingSlider = false;
    }

    changeZoom(delta) {
        this.state.zoom = Math.max(0.1, this.state.zoom + delta);
        this.updateZoomDisplay();
    }

    fitToScreen() {
        if (!this.elements.mainCanvas.width) return;

        const container = this.elements.canvasContainer.parentElement; // main-content
        if (!container) return;

        // Use padding awareness if needed, e.g. -40
        const availW = container.clientWidth - 40;
        const availH = container.clientHeight - 40;

        const imgW = this.elements.mainCanvas.width;
        const imgH = this.elements.mainCanvas.height;

        if (imgW === 0 || imgH === 0) return;

        const scaleW = availW / imgW;
        const scaleH = availH / imgH;

        let scale = Math.min(scaleW, scaleH);
        if (scale > 1) scale = 1; // Don't zoom in automatically past 100%

        this.state.zoom = scale;
        this.updateZoomDisplay();
    }

    updateZoomDisplay() {
        const w = this.elements.mainCanvas.width * this.state.zoom;
        const h = this.elements.mainCanvas.height * this.state.zoom;

        this.elements.mainCanvas.style.width = `${w}px`;
        this.elements.mainCanvas.style.height = `${h}px`;
        // Remove transform if we use width/height
        this.elements.mainCanvas.style.transform = 'none';

        this.elements.zoomLevel.innerText = `${Math.round(this.state.zoom * 100)}%`;
        this.updateSliderUI();
    }

    updateSliderUI() {
        if (this.elements.compareSlider.style.display === 'none') return;

        const canvasRect = this.elements.mainCanvas.getBoundingClientRect();
        const containerRect = this.elements.canvasContainer.getBoundingClientRect();

        const splitRatio = this.state.sliderPos;
        const relativeLeft = (canvasRect.left - containerRect.left) + (canvasRect.width * splitRatio);

        this.elements.compareSlider.style.height = `${canvasRect.height}px`;
        this.elements.compareSlider.style.top = `${canvasRect.top - containerRect.top}px`;
        this.elements.compareSlider.style.left = `${relativeLeft}px`;
    }

    setInfo(text) {
        this.elements.statusBar.textContent = text;
    }

    downloadResult() {
        if (this.processor && this.processor.processedImage) {
            const link = document.createElement('a');
            link.download = 'pixel-snapped.png';
            link.href = this.processor.getProcessedDataURL();
            link.click();
        }
    }

    setAutoGridSize(size) {
        this.elements.gridSizeInput.value = size;
        this.elements.gridSizeVal.textContent = `${size}px`;
        this.setInfo(`Detected Grid Size: ${size}px`);
    }

    updateResDisplay(ow, oh, sw, sh) {
        if (this.elements.resDisplay) {
            this.elements.resDisplay.innerText = `Original: ${ow}x${oh} \nTarget: ${sw}x${sh}`;
        }
    }
}
