"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsPanel = void 0;
const vscode = __importStar(require("vscode"));
const extension_1 = require("./extension");
class SettingsPanel {
    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel._panel.reveal(column);
            return;
        }
        const panel = vscode.window.createWebviewPanel('cppAsmSettings', 'C++ Assembly Settings', column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, 'media')
            ]
        });
        SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri);
    }
    constructor(panel, extensionUri) {
        this._disposables = [];
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'updateSettings':
                    await this.updateSettings(data.settings);
                    return;
                case 'detectCompiler':
                    await this.detectCompiler();
                    return;
                case 'resetToDefault':
                    await this.resetToDefault();
                    return;
                case 'getCurrentSettings':
                    await this.sendCurrentSettings();
                    return;
            }
        }, null, this._disposables);
    }
    async updateSettings(settings) {
        const config = vscode.workspace.getConfiguration('cpp-asm-viewer');
        const compilerManager = (0, extension_1.getCompilerManager)();
        if (settings.compilerPath !== undefined) {
            await config.update('compilerPath', settings.compilerPath, vscode.ConfigurationTarget.Global);
        }
        if (settings.compilerArgs !== undefined) {
            await config.update('compilerArgs', settings.compilerArgs, vscode.ConfigurationTarget.Global);
        }
        if (settings.outputType !== undefined) {
            await config.update('outputType', settings.outputType, vscode.ConfigurationTarget.Global);
        }
        // Обновляем компилятор в менеджере
        if (settings.compilerPath) {
            const currentCompiler = compilerManager.getCurrentCompiler();
            if (currentCompiler) {
                compilerManager.setCompiler({
                    ...currentCompiler,
                    path: settings.compilerPath
                });
            }
        }
        vscode.window.showInformationMessage('Settings updated successfully');
        // Отправляем обновленные настройки обратно в webview
        this.sendCurrentSettings();
    }
    async detectCompiler() {
        const compilerManager = (0, extension_1.getCompilerManager)();
        const detectedCompiler = await compilerManager.autoDetectCompiler();
        if (detectedCompiler) {
            this._panel.webview.postMessage({
                type: 'compilerDetected',
                compiler: detectedCompiler
            });
        }
        else {
            this._panel.webview.postMessage({
                type: 'compilerDetectionFailed'
            });
        }
    }
    async resetToDefault() {
        const config = vscode.workspace.getConfiguration('cpp-asm-viewer');
        await config.update('compilerPath', undefined, vscode.ConfigurationTarget.Global);
        await config.update('compilerArgs', '/Od /c /Zi', vscode.ConfigurationTarget.Global); // Обновлено
        await config.update('outputType', 'asm', vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('Settings reset to default');
        this.sendCurrentSettings();
    }
    async sendCurrentSettings() {
        const config = vscode.workspace.getConfiguration('cpp-asm-viewer');
        const compilerManager = (0, extension_1.getCompilerManager)();
        const currentCompiler = compilerManager.getCurrentCompiler();
        const settings = {
            compilerPath: config.get('compilerPath') || '',
            compilerArgs: config.get('compilerArgs') || '/Od /FA /c',
            outputType: config.get('outputType') || 'asm',
            currentCompiler: currentCompiler
        };
        this._panel.webview.postMessage({
            type: 'currentSettings',
            settings: settings
        });
    }
    dispose() {
        SettingsPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
        // Отправляем текущие настройки после загрузки
        setTimeout(() => {
            this.sendCurrentSettings();
        }, 100);
    }
    _getHtmlForWebview(webview) {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>C++ Assembly Settings</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 20px;
                        margin: 0;
                    }
                    
                    .setting-group {
                        margin-bottom: 25px;
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 4px;
                        padding: 15px;
                        background-color: var(--vscode-input-background);
                    }
                    
                    .setting-title {
                        font-weight: bold;
                        margin-bottom: 10px;
                        color: var(--vscode-titleBar-activeForeground);
                    }
                    
                    label {
                        display: block;
                        margin-bottom: 5px;
                        font-weight: 600;
                    }
                    
                    input, select, textarea {
                        width: 100%;
                        padding: 8px;
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 2px;
                        box-sizing: border-box;
                    }
                    
                    textarea {
                        min-height: 60px;
                        resize: vertical;
                        font-family: var(--vscode-editor-font-family);
                    }
                    
                    button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 16px;
                        margin-right: 10px;
                        margin-bottom: 10px;
                        border-radius: 2px;
                        cursor: pointer;
                    }
                    
                    button:hover {
                        background-color: var(--vscode-button-hover-background);
                    }
                    
                    button.secondary {
                        background-color: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }
                    
                    button.secondary:hover {
                        background-color: var(--vscode-button-secondaryHoverBackground);
                    }
                    
                    .button-group {
                        margin-top: 20px;
                        display: flex;
                        flex-wrap: wrap;
                        gap: 10px;
                    }
                    
                    .info {
                        background-color: var(--vscode-textBlockQuote-background);
                        border-left: 4px solid var(--vscode-textBlockQuote-border);
                        padding: 10px;
                        margin: 10px 0;
                        font-size: 0.9em;
                    }
                    
                    .status {
                        padding: 8px;
                        margin: 10px 0;
                        border-radius: 2px;
                        font-size: 0.9em;
                    }
                    
                    .status.success {
                        background-color: var(--vscode-inputValidation-infoBackground);
                        border: 1px solid var(--vscode-inputValidation-infoBorder);
                    }
                    
                    .status.error {
                        background-color: var(--vscode-inputValidation-errorBackground);
                        border: 1px solid var(--vscode-inputValidation-errorBorder);
                    }
                    
                    .compiler-info {
                        background-color: var(--vscode-badge-background);
                        color: var(--vscode-badge-foreground);
                        padding: 8px 12px;
                        border-radius: 2px;
                        margin: 10px 0;
                        font-size: 0.9em;
                    }
                    
                    .hidden {
                        display: none;
                    }
                </style>
            </head>
            <body>
                <h2>C++ Assembly Viewer Settings</h2>
                
                <div class="setting-group">
                    <div class="setting-title">Compiler Configuration</div>
                    
                    <div id="compilerStatus" class="status hidden"></div>
                    
                    <div>
                        <label for="compilerPath">Compiler Path:</label>
                        <input type="text" id="compilerPath" placeholder="Auto-detected if empty">
                        <div class="info">
                            Leave empty for auto-detection. For MSVC, this should point to cl.exe
                        </div>
                    </div>
                    
                    <div class="button-group">
                        <button onclick="detectCompiler()">Auto-detect Compiler</button>
                        <button onclick="browseCompiler()" class="secondary">Browse...</button>
                    </div>
                    
                    <div id="currentCompilerInfo" class="compiler-info hidden">
                        <strong>Current Compiler:</strong>
                        <div id="compilerDetails"></div>
                    </div>
                </div>
                
                <div class="setting-group">
                    <div class="setting-title">Compilation Options</div>
                    
                    <div>
                        <label for="compilerArgs">Compiler Arguments:</label>
                        <textarea id="compilerArgs" placeholder="Enter compiler arguments"></textarea>
                        <div class="info">
                            Default arguments for compilation. For MSVC: /Od /FA /c
                        </div>
                    </div>
                    
                    <div class="button-group">
                        <button onclick="resetArgsToDefault()" class="secondary">Reset to Default</button>
                    </div>
                </div>
                
                <div class="setting-group">
                    <div class="setting-title">Output Format</div>
                    
                    <div>
                        <label for="outputType">Assembly Output Type:</label>
                        <select id="outputType">
                            <option value="asm">Assembly only</option>
                            <option value="asm+hex">Assembly + Machine Code</option>
                            <option value="asm+hex+addr">Assembly + Machine Code + Addresses</option>
                        </select>
                        <div class="info">
                            Default arguments for compilation. For MSVC: /Od /c /Zi<br>
                            <strong>Note:</strong> /FA flags are added automatically based on output type
                        </div>
                    </div>
                </div>
                
                <div class="button-group">
                    <button onclick="saveSettings()">Save Settings</button>
                    <button onclick="resetToDefault()" class="secondary">Reset All to Default</button>
                </div>
                
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    let currentSettings = {};
                    
                    // Обработчики сообщений от расширения
                    window.addEventListener('message', event => {
                        const message = event.data;
                        
                        switch (message.type) {
                            case 'currentSettings':
                                currentSettings = message.settings;
                                updateUIWithSettings(message.settings);
                                break;
                                
                            case 'compilerDetected':
                                showStatus('Compiler detected successfully: ' + message.compiler.path, 'success');
                                updateCompilerInfo(message.compiler);
                                break;
                                
                            case 'compilerDetectionFailed':
                                showStatus('No compiler detected automatically. Please configure manually.', 'error');
                                break;
                        }
                    });
                    
                    function updateUIWithSettings(settings) {
                        // Обновляем поля формы
                        document.getElementById('compilerPath').value = settings.compilerPath || '';
                        document.getElementById('compilerArgs').value = settings.compilerArgs || '/Od /FA /c';
                        document.getElementById('outputType').value = settings.outputType || 'asm';
                        
                        // Обновляем информацию о компиляторе
                        if (settings.currentCompiler) {
                            updateCompilerInfo(settings.currentCompiler);
                        }
                    }
                    
                    function updateCompilerInfo(compiler) {
                        const compilerInfo = document.getElementById('currentCompilerInfo');
                        const compilerDetails = document.getElementById('compilerDetails');
                        
                        compilerDetails.innerHTML = \`
                            <div>Path: \${compiler.path}</div>
                            <div>Version: \${compiler.version}</div>
                            <div>Type: \${compiler.type}</div>
                        \`;
                        
                        compilerInfo.classList.remove('hidden');
                    }
                    
                    function showStatus(message, type) {
                        const statusElement = document.getElementById('compilerStatus');
                        statusElement.textContent = message;
                        statusElement.className = 'status ' + type;
                        statusElement.classList.remove('hidden');
                        
                        // Автоматически скрываем через 5 секунд
                        setTimeout(() => {
                            statusElement.classList.add('hidden');
                        }, 5000);
                    }
                    
                    function saveSettings() {
                        const settings = {
                            compilerPath: document.getElementById('compilerPath').value,
                            compilerArgs: document.getElementById('compilerArgs').value,
                            outputType: document.getElementById('outputType').value
                        };
                        
                        vscode.postMessage({
                            type: 'updateSettings',
                            settings: settings
                        });
                        
                        showStatus('Settings saved successfully', 'success');
                    }
                    
                    function detectCompiler() {
                        vscode.postMessage({
                            type: 'detectCompiler'
                        });
                        showStatus('Detecting compiler...', 'success');
                    }
                    
                    function resetArgsToDefault() {
                        document.getElementById('compilerArgs').value = '/Od /c /Zi';
                        showStatus('Arguments reset to default', 'success');
                    }
                    
                    function resetToDefault() {
                        vscode.postMessage({
                            type: 'resetToDefault'
                        });
                    }
                    
                    function browseCompiler() {
                        // В реальной реализации здесь можно добавить диалог выбора файла
                        showStatus('File browser would open here in full implementation', 'success');
                    }
                    
                    // Запрашиваем текущие настройки при загрузке
                    vscode.postMessage({
                        type: 'getCurrentSettings'
                    });
                </script>
            </body>
            </html>`;
    }
}
exports.SettingsPanel = SettingsPanel;
//# sourceMappingURL=settingsPanel.js.map