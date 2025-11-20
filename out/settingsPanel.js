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
                vscode.Uri.joinPath(extensionUri, 'media'),
                vscode.Uri.joinPath(extensionUri, 'out/compiler')
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
            }
        }, null, this._disposables);
    }
    async updateSettings(settings) {
        const config = vscode.workspace.getConfiguration('cpp-asm-viewer');
        if (settings.compilerPath !== undefined) {
            await config.update('compilerPath', settings.compilerPath, vscode.ConfigurationTarget.Global);
        }
        if (settings.compilerArgs !== undefined) {
            await config.update('compilerArgs', settings.compilerArgs, vscode.ConfigurationTarget.Global);
        }
        if (settings.outputType !== undefined) {
            await config.update('outputType', settings.outputType, vscode.ConfigurationTarget.Global);
        }
        vscode.window.showInformationMessage('Settings updated successfully');
    }
    async detectCompiler() {
        // This would trigger the auto-detection logic
        vscode.commands.executeCommand('cpp-asm-viewer.compileToAssembly');
        this._panel.webview.postMessage({
            type: 'compilerDetectionStarted'
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
    }
    _getHtmlForWebview(webview) {
        const config = vscode.workspace.getConfiguration('cpp-asm-viewer');
        const compilerPath = config.get('compilerPath') || '';
        const compilerArgs = config.get('compilerArgs') || '/Od /FA /c';
        const outputType = config.get('outputType') || 'asm';
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
                    }
                    
                    .setting-group {
                        margin-bottom: 20px;
                    }
                    
                    label {
                        display: block;
                        margin-bottom: 5px;
                        font-weight: bold;
                    }
                    
                    input, select {
                        width: 100%;
                        padding: 8px;
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 2px;
                    }
                    
                    button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 16px;
                        margin-right: 10px;
                        border-radius: 2px;
                        cursor: pointer;
                    }
                    
                    button:hover {
                        background-color: var(--vscode-button-hover-background);
                    }
                    
                    .button-group {
                        margin-top: 20px;
                    }
                    
                    .info {
                        background-color: var(--vscode-textBlockQuote-background);
                        border-left: 4px solid var(--vscode-textBlockQuote-border);
                        padding: 10px;
                        margin: 10px 0;
                    }
                </style>
            </head>
            <body>
                <h2>C++ Assembly Viewer Settings</h2>
                
                <div class="setting-group">
                    <label for="compilerPath">Compiler Path:</label>
                    <input type="text" id="compilerPath" value="${this.escapeHtml(compilerPath)}" placeholder="Auto-detected if empty">
                    <div class="info">Leave empty for auto-detection. For MSVC, this should point to cl.exe</div>
                </div>
                
                <div class="setting-group">
                    <label for="compilerArgs">Compiler Arguments:</label>
                    <input type="text" id="compilerArgs" value="${this.escapeHtml(compilerArgs)}">
                    <div class="info">Default arguments for compilation. For MSVC: /Od /FA /c</div>
                </div>
                
                <div class="setting-group">
                    <label for="outputType">Output Type:</label>
                    <select id="outputType">
                        <option value="asm" ${outputType === 'asm' ? 'selected' : ''}>Assembly only</option>
                        <option value="asm+hex" ${outputType === 'asm+hex' ? 'selected' : ''}>Assembly + Machine Code</option>
                        <option value="asm+hex+addr" ${outputType === 'asm+hex+addr' ? 'selected' : ''}>Assembly + Machine Code + Addresses</option>
                    </select>
                </div>
                
                <div class="button-group">
                    <button onclick="detectCompiler()">Auto-detect Compiler</button>
                    <button onclick="saveSettings()">Save Settings</button>
                </div>
                
                <script>
                    const vscode = acquireVsCodeApi();
                    
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
                    }
                    
                    function detectCompiler() {
                        vscode.postMessage({
                            type: 'detectCompiler'
                        });
                    }
                </script>
            </body>
            </html>`;
    }
    escapeHtml(value) {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}
exports.SettingsPanel = SettingsPanel;
//# sourceMappingURL=settingsPanel.js.map