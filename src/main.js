import { UI } from './ui.js';
import { Processor } from './processor.js';

document.addEventListener('DOMContentLoaded', () => {
    const ui = new UI();
    const processor = new Processor();

    // Link UI and Processor
    ui.setProcessor(processor);
    processor.setUI(ui);

    console.log('Pixel Snapper Remake Initialized');
});
