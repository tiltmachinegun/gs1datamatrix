// ==UserScript==
// @name         DataMatrix Scanner
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Скриншотер и сканер DataMatrix/QR кодов. Отправляет изображение на локальный сервер для распознавания.
// @author       t.me/tiltmachinegun
// @downloadUrl  https://raw.githubusercontent.com/tiltmachinegun/gs1datamatrix/refs/heads/main/gs1datamatrix.js
// @updateUrl    https://raw.githubusercontent.com/tiltmachinegun/gs1datamatrix/refs/heads/main/gs1datamatrix.js
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      localhost
// @connect      127.0.0.1
// @connect      *
// @require      https://cdn.jsdelivr.net/npm/bwip-js@4.3.0/dist/bwip-js-min.min.js
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        serverUrl: GM_getValue('serverUrl', 'https://93.88.203.166:5005'),
        forceHttp: GM_getValue('forceHttp', true),
        autoCopy: GM_getValue('autoCopy', true),
        showNotifications: GM_getValue('showNotifications', true),
        hotkeys: GM_getValue('hotkeys', {
            screenshot: { type: 'key', key: 'S', code: 'KeyS', ctrl: true, shift: true, alt: false },
            file: { type: 'key', key: 'O', code: 'KeyO', ctrl: true, shift: true, alt: false },
            paste: { type: 'key', key: 'V', code: 'KeyV', ctrl: true, shift: true, alt: false }
        })
    };

    const MOUSE_BUTTON_NAMES = {
        0: 'ЛКМ',
        1: 'СКМ',
        2: 'ПКМ',
        3: 'Назад',
        4: 'Вперёд'
    };

    const STYLES = `
        .dm-panel, .dm-panel *, .dm-overlay, .dm-toast, .dm-hint {
            all: revert !important;
            box-sizing: border-box !important;
        }
        
        .dm-overlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.3) !important;
            z-index: 999999 !important;
            cursor: crosshair !important;
            margin: 0 !important;
            padding: 0 !important;
        }
        .dm-selection {
            position: absolute !important;
            border: 2px dashed #00ff00 !important;
            background: rgba(0, 255, 0, 0.1) !important;
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5) !important;
        }
        .dm-hint {
            position: fixed !important;
            top: 20px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            background: rgba(0, 0, 0, 0.8) !important;
            color: white !important;
            padding: 12px 24px !important;
            border-radius: 8px !important;
            font-size: 14px !important;
            z-index: 1000000 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }
        .dm-panel {
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            left: auto !important;
            bottom: auto !important;
            width: 380px !important;
            max-height: 80vh !important;
            background: #ffffff !important;
            border-radius: 12px !important;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
            z-index: 1000000 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            color: #333 !important;
            font-size: 14px !important;
            line-height: 1.4 !important;
            text-align: left !important;
        }
        .dm-panel-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            color: white !important;
            padding: 16px 20px !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin: 0 !important;
            border: none !important;
        }
        .dm-panel-title {
            font-size: 16px !important;
            font-weight: 600 !important;
            margin: 0 !important;
            padding: 0 !important;
            color: white !important;
            background: none !important;
            border: none !important;
        }
        .dm-panel-close {
            background: none !important;
            border: none !important;
            color: white !important;
            font-size: 24px !important;
            cursor: pointer !important;
            padding: 4px 8px !important;
            line-height: 1 !important;
            opacity: 0.8 !important;
            transition: opacity 0.2s !important;
            margin: 0 !important;
            border-radius: 4px !important;
        }
        .dm-panel-close:hover {
            opacity: 1 !important;
        }
        .dm-panel-close:focus {
            opacity: 1 !important;
            outline: 2px solid rgba(255,255,255,0.5) !important;
            outline-offset: 2px !important;
        }
        .dm-panel-body {
            padding: 20px !important;
            max-height: 60vh !important;
            overflow-y: auto !important;
            background: #ffffff !important;
            margin: 0 !important;
        }
        .dm-btn {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 8px !important;
            padding: 12px 20px !important;
            border: none !important;
            border-radius: 8px !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            cursor: pointer !important;
            transition: all 0.2s !important;
            width: 100% !important;
            margin-bottom: 10px !important;
            text-decoration: none !important;
            text-transform: none !important;
            letter-spacing: normal !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }
        .dm-btn:focus {
            outline: 2px solid #667eea !important;
            outline-offset: 2px !important;
        }
        .dm-btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            color: white !important;
        }
        .dm-btn-primary:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4) !important;
        }
        .dm-btn-secondary {
            background: #f0f0f0 !important;
            color: #333 !important;
        }
        .dm-btn-secondary:hover {
            background: #e0e0e0 !important;
        }
        .dm-btn-small {
            padding: 8px 12px !important;
            font-size: 12px !important;
            width: auto !important;
            margin: 0 !important;
        }
        .dm-result {
            background: #f8f9fa !important;
            border-radius: 8px !important;
            padding: 16px !important;
            margin-top: 16px !important;
            border: none !important;
        }
        .dm-result-label {
            font-size: 12px !important;
            color: #666 !important;
            margin-bottom: 8px !important;
            text-transform: uppercase !important;
            letter-spacing: 0.5px !important;
            font-weight: normal !important;
        }
        .dm-result-value {
            font-family: 'Monaco', 'Menlo', 'Consolas', monospace !important;
            font-size: 13px !important;
            color: #333 !important;
            word-break: break-all !important;
            white-space: pre-wrap !important;
            background: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
        }
        .dm-gs1-item {
            display: flex !important;
            padding: 8px 0 !important;
            border-bottom: 1px solid #eee !important;
            margin: 0 !important;
            background: none !important;
        }
        .dm-gs1-item:last-child {
            border-bottom: none !important;
        }
        .dm-gs1-ai {
            background: #667eea !important;
            color: white !important;
            padding: 2px 8px !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            font-weight: 600 !important;
            margin-right: 12px !important;
            white-space: nowrap !important;
            border: none !important;
        }
        .dm-gs1-value {
            flex: 1 !important;
            font-family: 'Monaco', 'Menlo', 'Consolas', monospace !important;
            font-size: 13px !important;
            color: #333 !important;
        }
        .dm-gs1-name {
            color: #888 !important;
            font-size: 11px !important;
        }
        .dm-loading {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            padding: 40px !important;
            background: none !important;
        }
        .dm-spinner {
            width: 40px !important;
            height: 40px !important;
            border: 3px solid #f0f0f0 !important;
            border-top-color: #667eea !important;
            border-radius: 50% !important;
            animation: dm-spin 0.8s linear infinite !important;
            background: none !important;
        }
        @keyframes dm-spin {
            to { transform: rotate(360deg); }
        }
        .dm-error {
            background: #fee !important;
            color: #c00 !important;
            padding: 16px !important;
            border-radius: 8px !important;
            margin-top: 16px !important;
            border: none !important;
        }
        .dm-barcode-container {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            margin-top: 16px !important;
            padding: 16px !important;
            background: #f8f8f8 !important;
            border-radius: 8px !important;
            border: 1px solid #eee !important;
        }
        .dm-barcode-label {
            font-size: 12px !important;
            color: #666 !important;
            margin-bottom: 8px !important;
        }
        .dm-barcode-canvas {
            background: white !important;
            border: 1px solid #ddd !important;
            border-radius: 4px !important;
        }
        .dm-toast {
            position: fixed !important;
            bottom: 20px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            background: #333 !important;
            color: white !important;
            padding: 12px 24px !important;
            border-radius: 8px !important;
            z-index: 1000001 !important;
            animation: dm-fadeInUp 0.3s !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            font-size: 14px !important;
            border: none !important;
            margin: 0 !important;
        }
        @keyframes dm-fadeInUp {
            from {
                opacity: 0;
                transform: translate(-50%, 20px);
            }
            to {
                opacity: 1;
                transform: translate(-50%, 0);
            }
        }
        .dm-hidden-input {
            position: fixed !important;
            top: -1000px !important;
            left: -1000px !important;
        }
        .dm-settings {
            margin-top: 16px !important;
            padding-top: 16px !important;
            border-top: 1px solid #eee !important;
            background: none !important;
        }
        .dm-settings-title {
            font-size: 14px !important;
            font-weight: 600 !important;
            margin-bottom: 12px !important;
            color: #333 !important;
            background: none !important;
            border: none !important;
            padding: 0 !important;
        }
        .dm-hotkey-row {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 8px 0 !important;
            margin: 0 !important;
            background: none !important;
            border: none !important;
        }
        .dm-hotkey-label {
            font-size: 13px !important;
            color: #666 !important;
            background: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
        }
        .dm-hotkey-btn {
            padding: 6px 12px !important;
            background: #f0f0f0 !important;
            border: 1px solid #ddd !important;
            border-radius: 4px !important;
            font-family: 'Monaco', 'Menlo', 'Consolas', monospace !important;
            font-size: 12px !important;
            cursor: pointer !important;
            min-width: 120px !important;
            text-align: center !important;
            color: #333 !important;
        }
        .dm-hotkey-btn:hover {
            background: #e8e8e8 !important;
        }
        .dm-hotkey-btn:focus {
            outline: 2px solid #667eea !important;
            outline-offset: 2px !important;
        }
        .dm-hotkey-btn.recording {
            background: #667eea !important;
            color: white !important;
            border-color: #667eea !important;
        }
        .dm-drop-zone {
            border: 2px dashed #ccc !important;
            border-radius: 8px !important;
            padding: 30px !important;
            text-align: center !important;
            color: #888 !important;
            margin-top: 10px !important;
            transition: all 0.2s !important;
            background: none !important;
        }
        }
        .dm-drop-zone.dragover {
            border-color: #667eea !important;
            background: rgba(102, 126, 234, 0.1) !important;
            color: #667eea !important;
        }
        .dm-drop-zone:focus {
            outline: 2px solid #667eea !important;
            outline-offset: 2px !important;
        }
    `;

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = STYLES;
        document.head.appendChild(style);
    }

    function showToast(message, duration = 3000) {
        const existing = document.querySelector('.dm-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'dm-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
    }

    function showNotification(title, text) {
        if (CONFIG.showNotifications && typeof GM_notification !== 'undefined') {
            GM_notification({ title, text, timeout: 5000 });
        }
    }

    function formatHotkey(hotkey) {
        if (!hotkey) return '---';
        
        const parts = [];
        if (hotkey.ctrl) parts.push('Ctrl');
        if (hotkey.shift) parts.push('Shift');
        if (hotkey.alt) parts.push('Alt');
        
        if (hotkey.type === 'mouse') {
            parts.push('🖱️' + (MOUSE_BUTTON_NAMES[hotkey.button] || `Кнопка ${hotkey.button}`));
        } else {
            parts.push(getKeyLabel(hotkey));
        }
        return parts.join('+');
    }

    function getKeyLabel(hotkey) {
        if (hotkey?.code) {
            if (hotkey.code.startsWith('Key')) return hotkey.code.substring(3);
            if (hotkey.code.startsWith('Digit')) return hotkey.code.substring(5);
            return hotkey.code;
        }
        return hotkey?.key?.toUpperCase() || '?';
    }

    function copyToClipboard(text) {
        if (typeof GM_setClipboard !== 'undefined') {
            GM_setClipboard(text);
        } else {
            navigator.clipboard.writeText(text);
        }
    }

    async function generateDataMatrix(data, size = 256) {
        if (typeof bwipjs === 'undefined') {
            log('WARN', 'bwip-js не загружен, генерация DataMatrix невозможна');
            return null;
        }

        try {
            const canvas = document.createElement('canvas');
            
            const rawText = data?.rawText || '';
            const formattedText = data?.formattedText || '';
            const hasGsSeparator = rawText.includes('\u001D');
            const isGs1 = hasGsSeparator;

            log('DEBUG', `Генерация DataMatrix: isGs1=${isGs1}`);
            log('DEBUG', `Raw hex (до обработки): ${Array.from(rawText.substring(0, 50)).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ')}`);

            if (isGs1) {
                let gs1Raw = rawText || '';
                if (gs1Raw.charCodeAt(0) === 0x1D) {
                    gs1Raw = gs1Raw.substring(1);
                    log('DEBUG', 'Убран начальный GS (артефакт распознавания GS1)');
                }
                gs1Raw = gs1Raw.replace(/\x1D/g, '^029');
                const bwippText = '^FNC1' + gs1Raw;

                log('DEBUG', `GS1 raw для генерации (parsefnc): ${bwippText}`);

                try {
                    bwipjs.toCanvas(canvas, {
                        bcid: 'datamatrix',
                        text: bwippText,
                        parse: true,
                        parsefnc: true,
                        scale: 3,
                        padding: 10,
                        backgroundcolor: 'ffffff'
                    });
                } catch (e) {
                    let gs1Text = '';
                    if (formattedText) {
                        gs1Text = formattedText.replace(/\s+/g, '');
                    } else if (data?.gs1Elements && data.gs1Elements.length > 0) {
                        gs1Text = data.gs1Elements.map(el => `(${el.ai})${el.value}`).join('');
                    }

                    log('WARN', 'GS1 raw вариант не удался, fallback на AI-формат', e);
                    log('DEBUG', `GS1 text для генерации: ${gs1Text}`);

                    bwipjs.toCanvas(canvas, {
                        bcid: 'gs1datamatrix',
                        text: gs1Text,
                        parse: false,
                        scale: 3,
                        padding: 10,
                        backgroundcolor: 'ffffff'
                    });
                }
            } else {
                const barcodeData = rawText;
                log('DEBUG', `DataMatrix text для генерации: ${barcodeData}`);

                bwipjs.toCanvas(canvas, {
                    bcid: 'datamatrix',
                    text: barcodeData,
                    parse: false,
                    binarytext: true,
                    scale: 3,
                    padding: 10,
                    backgroundcolor: 'ffffff'
                });
            }

            const scaledCanvas = document.createElement('canvas');
            scaledCanvas.width = size;
            scaledCanvas.height = size;
            const ctx = scaledCanvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, size, size);
            
            const srcSize = Math.max(canvas.width, canvas.height);
            const scale = (size - 20) / srcSize;
            const scaledW = canvas.width * scale;
            const scaledH = canvas.height * scale;
            const offsetX = (size - scaledW) / 2;
            const offsetY = (size - scaledH) / 2;
            
            ctx.drawImage(canvas, offsetX, offsetY, scaledW, scaledH);

            return scaledCanvas;
        } catch (e) {
            log('ERROR', 'Ошибка генерации DataMatrix', e);
            return null;
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    class ResultPanel {
        constructor() {
            this.element = null;
        }

        show(showSettings = false) {
            this.hide();
            this.element = document.createElement('div');
            this.element.className = 'dm-panel';
            this.element.innerHTML = `
                <div class="dm-panel-header">
                    <h3 class="dm-panel-title">📷 DataMatrix Scanner</h3>
                    <button class="dm-panel-close">&times;</button>
                </div>
                <div class="dm-panel-body">
                    <button class="dm-btn dm-btn-primary" id="dm-screenshot">
                        📸 Выделить область (${formatHotkey(CONFIG.hotkeys.screenshot)})
                    </button>
                    <button class="dm-btn dm-btn-secondary" id="dm-paste">
                        📋 Вставить из буфера (${formatHotkey(CONFIG.hotkeys.paste)})
                    </button>
                    <button class="dm-btn dm-btn-secondary" id="dm-upload">
                        📁 Загрузить файл (${formatHotkey(CONFIG.hotkeys.file)})
                    </button>
                    <div class="dm-drop-zone" id="dm-dropzone">
                        Перетащите изображение сюда
                    </div>
                    <div id="dm-content"></div>
                    <div class="dm-settings" id="dm-settings" style="display: ${showSettings ? 'block' : 'none'}">
                        <div class="dm-settings-title">⚙️ Настройки горячих клавиш</div>
                        <div class="dm-hotkey-row">
                            <span class="dm-hotkey-label">Скриншот:</span>
                            <button class="dm-hotkey-btn" data-action="screenshot">${formatHotkey(CONFIG.hotkeys.screenshot)}</button>
                        </div>
                        <div class="dm-hotkey-row">
                            <span class="dm-hotkey-label">Загрузить файл:</span>
                            <button class="dm-hotkey-btn" data-action="file">${formatHotkey(CONFIG.hotkeys.file)}</button>
                        </div>
                        <div class="dm-hotkey-row">
                            <span class="dm-hotkey-label">Вставить:</span>
                            <button class="dm-hotkey-btn" data-action="paste">${formatHotkey(CONFIG.hotkeys.paste)}</button>
                        </div>
                        <div class="dm-hotkey-row" style="margin-top: 12px;">
                            <span class="dm-hotkey-label">URL сервера:</span>
                            <input type="text" id="dm-server-url" value="${CONFIG.serverUrl}" 
                                   style="flex:1; margin-left:10px; padding:6px; border:1px solid #ddd; border-radius:4px;">
                        </div>
                        <button class="dm-btn dm-btn-primary" id="dm-save-settings" style="margin-top: 12px;">
                            💾 Сохранить настройки
                        </button>
                    </div>
                    <button class="dm-btn dm-btn-secondary dm-btn-small" id="dm-toggle-settings" style="margin-top: 10px;">
                        ⚙️ ${showSettings ? 'Скрыть' : 'Показать'} настройки
                    </button>
                </div>
            `;
            document.body.appendChild(this.element);

            this.element.querySelector('.dm-panel-close').onclick = () => this.hide();
            this.element.querySelector('#dm-screenshot').onclick = () => { this.hide(); startScreenshot(); };
            this.element.querySelector('#dm-paste').onclick = () => pasteFromClipboard();
            this.element.querySelector('#dm-upload').onclick = () => openFilePicker();
            this.element.querySelector('#dm-toggle-settings').onclick = () => this.toggleSettings();
            this.element.querySelector('#dm-save-settings').onclick = () => this.saveSettings();

            this.element.querySelectorAll('.dm-hotkey-btn').forEach(btn => {
                btn.onclick = (e) => this.startHotkeyRecording(e.target);
            });

            const dropzone = this.element.querySelector('#dm-dropzone');
            dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add('dragover'); };
            dropzone.ondragleave = () => dropzone.classList.remove('dragover');
            dropzone.ondrop = (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    readFileAsBase64(file);
                }
            };
        }

        hide() {
            if (this.element) {
                this.element.remove();
                this.element = null;
            }
        }

        toggleSettings() {
            const settings = this.element?.querySelector('#dm-settings');
            const btn = this.element?.querySelector('#dm-toggle-settings');
            if (settings && btn) {
                const isHidden = settings.style.display === 'none';
                settings.style.display = isHidden ? 'block' : 'none';
                btn.textContent = `⚙️ ${isHidden ? 'Скрыть' : 'Показать'} настройки`;
            }
        }

        startHotkeyRecording(btn) {
            if (btn.classList.contains('recording')) return;

            btn.classList.add('recording');
            btn.textContent = 'Нажмите клавишу или кнопку мыши...';

            const action = btn.dataset.action;
            
            const cleanup = () => {
                btn.classList.remove('recording');
                document.removeEventListener('keydown', keyHandler, true);
                document.removeEventListener('mousedown', mouseHandler, true);
            };

            const keyHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

                CONFIG.hotkeys[action] = {
                    type: 'key',
                    key: e.key.toUpperCase(),
                    code: e.code,
                    ctrl: e.ctrlKey,
                    shift: e.shiftKey,
                    alt: e.altKey
                };

                btn.textContent = formatHotkey(CONFIG.hotkeys[action]);
                cleanup();
            };

            const mouseHandler = (e) => {
                if (e.button === 0 && !e.ctrlKey && !e.shiftKey && !e.altKey) return;
                
                e.preventDefault();
                e.stopPropagation();

                CONFIG.hotkeys[action] = {
                    type: 'mouse',
                    button: e.button,
                    ctrl: e.ctrlKey,
                    shift: e.shiftKey,
                    alt: e.altKey
                };

                btn.textContent = formatHotkey(CONFIG.hotkeys[action]);
                cleanup();
            };

            document.addEventListener('keydown', keyHandler, true);
            document.addEventListener('mousedown', mouseHandler, true);
            
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    btn.textContent = formatHotkey(CONFIG.hotkeys[action]);
                    cleanup();
                    document.removeEventListener('keydown', escHandler, true);
                }
            };
            document.addEventListener('keydown', escHandler, true);
        }

        saveSettings() {
            const urlInput = this.element?.querySelector('#dm-server-url');
            if (urlInput) {
                CONFIG.serverUrl = urlInput.value;
                GM_setValue('serverUrl', CONFIG.serverUrl);
            }
            GM_setValue('hotkeys', CONFIG.hotkeys);
            showToast('Настройки сохранены!');
        }

        showLoading() {
            const content = this.element?.querySelector('#dm-content');
            if (content) {
                content.innerHTML = `
                    <div class="dm-loading">
                        <div class="dm-spinner"></div>
                        <p style="margin-top: 16px; color: #666;">Распознавание...</p>
                    </div>
                `;
            }
        }

        showResult(data) {
            const content = this.element?.querySelector('#dm-content');
            if (!content) return;

            if (!data.success) {
                content.innerHTML = `<div class="dm-error">❌ ${data.error || 'Не удалось распознать'}</div>`;
                return;
            }

            const rawText = data.rawText || '';
            const hasGsSeparator = rawText.includes('\u001D');
            let gs1Html = '';
            if (hasGsSeparator && data.gs1Elements && data.gs1Elements.length > 0) {
                gs1Html = `
                    <div class="dm-result">
                        <div class="dm-result-label">GS1 Элементы</div>
                        ${data.gs1Elements.map(el => `
                            <div class="dm-gs1-item">
                                <span class="dm-gs1-ai">${el.ai}</span>
                                <div>
                                    <div class="dm-gs1-value">${escapeHtml(el.value)}</div>
                                    <div class="dm-gs1-name">${escapeHtml(el.name || '')}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            const isDataMatrix = (data.barcodeFormat || '').toUpperCase().includes('DATAMATRIX') ||
                                 (data.barcodeFormat || '').toUpperCase().includes('DATA_MATRIX');

            content.innerHTML = `
                <div class="dm-result">
                    <div class="dm-result-label">Тип: ${data.barcodeFormat || 'Неизвестно'}</div>
                    <div class="dm-result-value">${escapeHtml(data.formattedText || data.rawText)}</div>
                </div>
                ${gs1Html}
                ${isDataMatrix ? '<div class="dm-barcode-container" id="dm-barcode-container"><div class="dm-barcode-label">Пересозданная марка:</div><div class="dm-spinner" style="width:24px;height:24px;"></div></div>' : ''}
                <button class="dm-btn dm-btn-secondary" id="dm-copy" style="margin-top: 16px;">
                    📋 Скопировать
                </button>
            `;

            content.querySelector('#dm-copy').onclick = () => {
                copyToClipboard(data.rawText || data.formattedText);
                showToast('Скопировано в буфер обмена!');
            };

            if (CONFIG.autoCopy) {
                copyToClipboard(data.rawText || data.formattedText);
                showToast('Результат скопирован в буфер обмена!');
            }

            if (isDataMatrix) {
                this.generateAndShowBarcode(data);
            }
        }

        async generateAndShowBarcode(data) {
            const container = this.element?.querySelector('#dm-barcode-container');
            if (!container) return;

            const canvas = await generateDataMatrix(data, 256);
            
            if (canvas) {
                canvas.className = 'dm-barcode-canvas';
                const rawText = data?.rawText || '';
                const isGs1 = rawText.includes('\u001D') || (data?.gs1Elements && data.gs1Elements.length > 0);
                container.innerHTML = `<div class="dm-barcode-label">${isGs1 ? 'GS1 DataMatrix (с FNC1)' : 'DataMatrix'}:</div>`;
                container.appendChild(canvas);
                
                const downloadBtn = document.createElement('button');
                downloadBtn.className = 'dm-btn dm-btn-secondary dm-btn-small';
                downloadBtn.style.marginTop = '8px';
                downloadBtn.textContent = '💾 Скачать PNG';
                downloadBtn.onclick = () => {
                    const link = document.createElement('a');
                    link.download = 'datamatrix.png';
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                };
                container.appendChild(downloadBtn);
            } else {
                container.innerHTML = '<div class="dm-barcode-label" style="color:#999;">Не удалось сгенерировать марку</div>';
            }
        }

        showError(message) {
            const content = this.element?.querySelector('#dm-content');
            if (content) {
                content.innerHTML = `<div class="dm-error">❌ ${escapeHtml(message)}</div>`;
            }
        }
    }

    let panel = new ResultPanel();
    let isSelecting = false;
    let selectionStart = null;
    let overlay = null;
    let selectionBox = null;
    let hint = null;

    function startScreenshot() {
        if (isSelecting) return;
        isSelecting = true;

        overlay = document.createElement('div');
        overlay.className = 'dm-overlay';
        document.body.appendChild(overlay);

        hint = document.createElement('div');
        hint.className = 'dm-hint';
        hint.textContent = 'Выделите область со штрих-кодом. ESC для отмены.';
        document.body.appendChild(hint);

        selectionBox = document.createElement('div');
        selectionBox.className = 'dm-selection';
        selectionBox.style.display = 'none';
        overlay.appendChild(selectionBox);

        overlay.addEventListener('mousedown', onMouseDown);
        overlay.addEventListener('mousemove', onMouseMove);
        overlay.addEventListener('mouseup', onMouseUp);
        document.addEventListener('keydown', onKeyDown);
    }

    function onMouseDown(e) {
        selectionStart = { x: e.clientX, y: e.clientY };
        selectionBox.style.left = e.clientX + 'px';
        selectionBox.style.top = e.clientY + 'px';
        selectionBox.style.width = '0';
        selectionBox.style.height = '0';
        selectionBox.style.display = 'block';
    }

    function onMouseMove(e) {
        if (!selectionStart) return;

        const x = Math.min(e.clientX, selectionStart.x);
        const y = Math.min(e.clientY, selectionStart.y);
        const w = Math.abs(e.clientX - selectionStart.x);
        const h = Math.abs(e.clientY - selectionStart.y);

        selectionBox.style.left = x + 'px';
        selectionBox.style.top = y + 'px';
        selectionBox.style.width = w + 'px';
        selectionBox.style.height = h + 'px';
    }

    function onMouseUp(e) {
        if (!selectionStart) return;

        const rect = {
            x: Math.min(e.clientX, selectionStart.x),
            y: Math.min(e.clientY, selectionStart.y),
            width: Math.abs(e.clientX - selectionStart.x),
            height: Math.abs(e.clientY - selectionStart.y)
        };

        cancelSelection();

        if (rect.width > 10 && rect.height > 10) {
            captureArea(rect);
        }
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            cancelSelection();
        }
    }

    function cancelSelection() {
        isSelecting = false;
        selectionStart = null;
        if (overlay) {
            overlay.remove();
            overlay = null;
        }
        if (hint) {
            hint.remove();
            hint = null;
        }
        document.removeEventListener('keydown', onKeyDown);
    }

    let screenStream = null;
    let streamRequested = false;

    async function captureArea(rect) {
        panel.show();
        panel.showLoading();

        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                panel.showError('Захват экрана недоступен в этом браузере/контексте.\n\nВозможные причины:\n• Страница открыта по HTTP (нужен HTTPS)\n• Браузер не поддерживает getDisplayMedia\n\nПопробуйте:\n• Вставить скриншот (Ctrl+V)\n• Загрузить файл\n• Перетащить изображение');
                return;
            }
            if (!screenStream || !screenStream.active) {
                if (!streamRequested) {
                    showToast('Выберите вкладку/экран для захвата (один раз за сессию)');
                }
                streamRequested = true;
                
                screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: { 
                        mediaSource: 'screen',
                        cursor: 'never',
                        displaySurface: 'browser'
                    },
                    audio: false,
                    preferCurrentTab: true
                });

                screenStream.getVideoTracks()[0].onended = () => {
                    screenStream = null;
                };
            }

            const video = document.createElement('video');
            video.srcObject = screenStream;
            video.muted = true;
            await video.play();

            await new Promise(r => setTimeout(r, 100));

            const scale = window.devicePixelRatio || 1;
            const canvas = document.createElement('canvas');
            canvas.width = rect.width * scale;
            canvas.height = rect.height * scale;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(
                video,
                rect.x * scale,
                rect.y * scale,
                rect.width * scale,
                rect.height * scale,
                0, 0,
                canvas.width, canvas.height
            );

            video.pause();
            video.srcObject = null;

            const base64 = canvas.toDataURL('image/png');
            sendToServer(base64);

        } catch (err) {
            console.error('Ошибка захвата:', err);
            if (screenStream) {
                screenStream.getTracks().forEach(t => t.stop());
                screenStream = null;
            }
            
            if (err.name === 'NotAllowedError') {
                panel.showError('Доступ к экрану отклонён.\nРазрешите доступ и попробуйте снова.');
            } else {
                panel.showError('Ошибка захвата области.\nПопробуйте:\n• Вставить скриншот из буфера (Ctrl+V)\n• Загрузить файл\n• Перетащить изображение');
            }
        }
    }

    window.addEventListener('beforeunload', () => {
        if (screenStream) {
            screenStream.getTracks().forEach(t => t.stop());
        }
    });

    async function pasteFromClipboard() {
        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                for (const type of item.types) {
                    if (type.startsWith('image/')) {
                        const blob = await item.getType(type);
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            panel.show();
                            sendToServer(e.target.result);
                        };
                        reader.readAsDataURL(blob);
                        return;
                    }
                }
            }
            showToast('В буфере нет изображения');
        } catch (err) {
            console.error('Ошибка чтения буфера:', err);
            showToast('Не удалось прочитать буфер обмена');
        }
    }

    function openFilePicker() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.className = 'dm-hidden-input';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                readFileAsBase64(file);
            }
            input.remove();
        };
        document.body.appendChild(input);
        input.click();
    }

    function readFileAsBase64(file) {
        panel.show();
        panel.showLoading();

        const reader = new FileReader();
        reader.onload = (e) => {
            sendToServer(e.target.result);
        };
        reader.onerror = () => {
            panel.showError('Ошибка чтения файла');
        };
        reader.readAsDataURL(file);
    }

    const LOG_PREFIX = '[DataMatrix Scanner]';
    
    function log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logMsg = `${LOG_PREFIX} [${timestamp}] [${level}] ${message}`;
        
        switch(level) {
            case 'ERROR':
                console.error(logMsg, data || '');
                break;
            case 'WARN':
                console.warn(logMsg, data || '');
                break;
            case 'DEBUG':
                console.debug(logMsg, data || '');
                break;
            default:
                console.log(logMsg, data || '');
        }
    }
    
    function logRequest(method, url, data = null) {
        log('INFO', `→ ${method} ${url}`);
        if (data) {
            const preview = typeof data === 'string' 
                ? (data.length > 100 ? data.substring(0, 100) + '...' : data)
                : JSON.stringify(data).substring(0, 100);
            log('DEBUG', `  Request data: ${preview}`);
        }
    }
    
    function logResponse(method, url, response, duration) {
        const status = response.status || 'N/A';
        const statusText = response.statusText || '';
        log('INFO', `← ${method} ${url} [${status} ${statusText}] (${duration}ms)`);
        
        if (response.responseHeaders) {
            log('DEBUG', `  Response headers: ${response.responseHeaders.substring(0, 200)}`);
        }
        if (response.responseText) {
            const preview = response.responseText.length > 500 
                ? response.responseText.substring(0, 500) + '...' 
                : response.responseText;
            log('DEBUG', `  Response body: ${preview}`);
        }
    }
    
    function logError(method, url, error, duration) {
        log('ERROR', `✗ ${method} ${url} FAILED (${duration}ms)`, error);
    }

    function getServerBaseUrl() {
        let url = (CONFIG.serverUrl || '').trim();
        if (!url) url = 'http://93.88.203.166:5005';

        if (!/^https?:\/\//i.test(url)) {
            url = `http://${url}`;
        }

        if (CONFIG.forceHttp && url.startsWith('https://')) {
            url = `http://${url.substring('https://'.length)}`;
        }

        return url.replace(/\/+$/, '');
    }

    function checkServerHealth() {
        const baseUrl = getServerBaseUrl();
        const url = `${baseUrl}/api/decode/health`;
        const startTime = Date.now();
        
        logRequest('GET', url);
        
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            timeout: 10000,
            onload: function(response) {
                const duration = Date.now() - startTime;
                logResponse('GET', url, response, duration);
                
                if (response.status === 200) {
                    log('INFO', `✓ Сервер доступен: ${baseUrl}`);
                } else {
                    log('WARN', `⚠ Сервер вернул статус ${response.status}`);
                }
            },
            onerror: function(error) {
                const duration = Date.now() - startTime;
                logError('GET', url, error, duration);
                log('WARN', `⚠ Сервер недоступен. Проверьте:
  1. Сервер запущен на ${baseUrl}
  2. Порт не заблокирован
  3. Нет принудительного HTTPS (HSTS/upgrade-insecure-requests)`);
            },
            ontimeout: function() {
                const duration = Date.now() - startTime;
                log('ERROR', `✗ Health check timeout (${duration}ms)`);
            }
        });
    }

    function sendToServer(base64Image) {
        if (!panel.element) {
            panel.show();
        }
        panel.showLoading();

        const baseUrl = getServerBaseUrl();
        const url = `${baseUrl}/api/decode/base64`;
        const requestData = JSON.stringify({ imageBase64: base64Image });
        const startTime = Date.now();
        
        logRequest('POST', url, `[Base64 image, ${Math.round(base64Image.length / 1024)} KB]`);

        GM_xmlhttpRequest({
            method: 'POST',
            url: url,
            headers: {
                'Content-Type': 'application/json'
            },
            data: requestData,
            onload: function(response) {
                const duration = Date.now() - startTime;
                logResponse('POST', url, response, duration);
                
                try {
                    const data = JSON.parse(response.responseText);
                    panel.showResult(data);

                    if (data.success) {
                        log('INFO', `✓ Распознано: ${data.rawText}`);
                        showNotification('Распознано!', data.formattedText || data.rawText);
                    } else {
                        log('WARN', `⚠ Не распознано: ${data.error || 'unknown'}`);
                    }
                } catch (e) {
                    log('ERROR', 'Ошибка парсинга JSON', e);
                    panel.showError('Ошибка парсинга ответа сервера:\n' + response.responseText.substring(0, 200));
                }
            },
            onerror: function(error) {
                const duration = Date.now() - startTime;
                logError('POST', url, error, duration);
                
                let errorMsg = `Не удалось связаться с сервером: ${baseUrl}\n\n`;
                
                if (error.status === 0 || error.status === 408) {
                    errorMsg += 'Возможные причины:\n';
                    errorMsg += '• Сертификат не принят в браузере\n';
                    errorMsg += '• Сервер не запущен\n';
                    errorMsg += '• Порт заблокирован файрволом\n\n';
                    if (!CONFIG.forceHttp) {
                        errorMsg += `Откройте ${baseUrl}/swagger\n`;
                        errorMsg += 'и примите сертификат вручную.';
                    } else {
                        errorMsg += 'Проверьте, что браузер не принудительно включает HTTPS (HSTS или upgrade-insecure-requests).';
                    }
                } else {
                    errorMsg += `Статус: ${error.status} ${error.statusText}`;
                }
                
                panel.showError(errorMsg);
            },
            ontimeout: function() {
                const duration = Date.now() - startTime;
                log('ERROR', `✗ Timeout после ${duration}ms`);
                panel.showError('Превышено время ожидания ответа от сервера (30 сек)');
            },
            timeout: 30000
        });
    }

    function checkKeyHotkey(e, hotkey) {
        if (!hotkey || hotkey.type !== 'key') return false;
        const modifiersMatch = (!!e.ctrlKey === !!hotkey.ctrl) &&
                               (!!e.shiftKey === !!hotkey.shift) &&
                               (!!e.altKey === !!hotkey.alt);
        if (!modifiersMatch) return false;

        if (hotkey.code) {
            return e.code === hotkey.code;
        }

        return e.key.toUpperCase() === hotkey.key?.toUpperCase();
    }

    function checkMouseHotkey(e, hotkey) {
        if (!hotkey || hotkey.type !== 'mouse') return false;
        return (!!e.ctrlKey === !!hotkey.ctrl) &&
               (!!e.shiftKey === !!hotkey.shift) &&
               (!!e.altKey === !!hotkey.alt) &&
               (e.button === hotkey.button);
    }

    function handleHotkeyAction(action, e) {
        e.preventDefault();
        e.stopPropagation();
        
        switch (action) {
            case 'screenshot':
                startScreenshot();
                break;
            case 'file':
                panel.show();
                openFilePicker();
                break;
            case 'paste':
                pasteFromClipboard();
                break;
        }
    }

    document.addEventListener('keydown', (e) => {
        if (isSelecting) return;
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

        for (const [action, hotkey] of Object.entries(CONFIG.hotkeys)) {
            if (checkKeyHotkey(e, hotkey)) {
                handleHotkeyAction(action, e);
                return;
            }
        }
    });

    document.addEventListener('mousedown', (e) => {
        if (isSelecting) return;
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
        
        if (e.button === 0 && !e.ctrlKey && !e.shiftKey && !e.altKey) return;

        for (const [action, hotkey] of Object.entries(CONFIG.hotkeys)) {
            if (checkMouseHotkey(e, hotkey)) {
                handleHotkeyAction(action, e);
                return;
            }
        }
    });

    document.addEventListener('paste', (e) => {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const blob = item.getAsFile();
                const reader = new FileReader();
                reader.onload = (ev) => {
                    panel.show();
                    sendToServer(ev.target.result);
                };
                reader.readAsDataURL(blob);
                return;
            }
        }
    });

    if (typeof GM_registerMenuCommand !== 'undefined') {
        GM_registerMenuCommand('📷 Открыть сканер', () => panel.show());
        GM_registerMenuCommand(`📸 Выделить область (${formatHotkey(CONFIG.hotkeys.screenshot)})`, () => startScreenshot());
        GM_registerMenuCommand(`📋 Вставить из буфера (${formatHotkey(CONFIG.hotkeys.paste)})`, () => pasteFromClipboard());
        GM_registerMenuCommand(`📁 Загрузить файл (${formatHotkey(CONFIG.hotkeys.file)})`, () => {
            panel.show();
            openFilePicker();
        });
        GM_registerMenuCommand('⚙️ Настройки', () => panel.show(true));
    }

    injectStyles();
    
    log('INFO', '═══════════════════════════════════════════════════');
    log('INFO', '  DataMatrix Scanner v2.2.0 загружен');
    log('INFO', '═══════════════════════════════════════════════════');
    log('INFO', `  Сервер: ${getServerBaseUrl()}`);
    log('INFO', `  Force HTTP: ${CONFIG.forceHttp ? 'Да' : 'Нет'}`);
    log('INFO', `  Автокопирование: ${CONFIG.autoCopy ? 'Да' : 'Нет'}`);
    log('INFO', '  Горячие клавиши:');
    log('INFO', `    ${formatHotkey(CONFIG.hotkeys.screenshot)} - выделить область`);
    log('INFO', `    ${formatHotkey(CONFIG.hotkeys.file)} - загрузить файл`);
    log('INFO', `    ${formatHotkey(CONFIG.hotkeys.paste)} - вставить из буфера`);
    log('INFO', '    Ctrl+V - автоматическая вставка изображения');
    log('INFO', '───────────────────────────────────────────────────');
    
    checkServerHealth();

})();

