import * as vscode from 'vscode';

export class SettingsPanel {
    public static currentPanel: SettingsPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'cppAsmSettings',
            'C++ Assembly Settings',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async (data) => {
                switch (data.type) {
                    case 'updateSettings':
                        await this.updateSettings(data.settings);
                        return;
                    case 'getCurrentSettings':
                        await this.sendCurrentSettings();
                        return;
                    case 'detectCompilers':
                        await this.detectAndSendCompilers();
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    private async detectAndSendCompilers() {
        // Импортируем CompilerManager
        const { CompilerManager } = await import('./compilerManager');
        const compilerManager = new CompilerManager();
        
        const compilers = [];
        
        // Проверяем MSVC
        const msvc = await compilerManager['detectMSVC']();
        if (msvc) {
            compilers.push({
                type: msvc.type,
                version: msvc.version,
                path: msvc.path,
                displayName: `MSVC ${msvc.version} (${msvc.path})`
            });
        }
        
        // Проверяем GCC
        const gcc = await compilerManager['detectGCC']();
        if (gcc) {
            compilers.push({
                type: gcc.type,
                version: gcc.version,
                path: gcc.path,
                displayName: `GCC ${gcc.version} (${gcc.path})`
            });
        }
        
        // Проверяем Clang
        const clang = await compilerManager['detectClang']();
        if (clang) {
            compilers.push({
                type: clang.type,
                version: clang.version,
                path: clang.path,
                displayName: `Clang ${clang.version} (${clang.path})`
            });
        }

        this._panel.webview.postMessage({
            type: 'availableCompilers',
            compilers: compilers
        });
    }

    private async updateSettings(settings: any) {
        const config = vscode.workspace.getConfiguration('cpp-asm-viewer');
        
        try {
            if (settings.compilerArgs !== undefined) {
                await config.update('compilerArgs', settings.compilerArgs, vscode.ConfigurationTarget.Global);
            }
            
            if (settings.selectedCompiler !== undefined) {
                await config.update('selectedCompiler', settings.selectedCompiler, vscode.ConfigurationTarget.Global);
            }

            if (settings.compilerPath !== undefined) {
                await config.update('compilerPath', settings.compilerPath, vscode.ConfigurationTarget.Global);
            }

            vscode.window.showInformationMessage('Settings saved successfully');
            
            // Отправляем обновленные настройки обратно
            this.sendCurrentSettings();
        } catch (error) {
            console.error('Error saving settings:', error);
            vscode.window.showErrorMessage('Failed to save settings');
        }
    }

    private async sendCurrentSettings() {
        const config = vscode.workspace.getConfiguration('cpp-asm-viewer');
        
        const settings = {
            compilerArgs: config.get<string>('compilerArgs') || '/Od /FAcs /c /EHsc',
            selectedCompiler: config.get<string>('selectedCompiler') || '',
            compilerPath: config.get<string>('compilerPath') || ''
        };

        this._panel.webview.postMessage({
            type: 'currentSettings',
            settings: settings
        });
    }

    public dispose() {
        SettingsPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        this._panel.webview.html = this._getHtmlForWebview();
        
        // Отправляем текущие настройки после загрузки
        setTimeout(() => {
            this.sendCurrentSettings();
            this.detectAndSendCompilers();
        }, 100);
    }

    private _getHtmlForWebview(): string {
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
                    
                    textarea, select, input {
                        width: 100%;
                        padding: 8px;
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 2px;
                        box-sizing: border-box;
                    }
                    
                    textarea {
                        min-height: 80px;
                        resize: vertical;
                        font-family: var(--vscode-editor-font-family);
                        font-size: 0.9em;
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
                    
                    .button-group {
                        margin-top: 20px;
                        display: flex;
                        flex-wrap: wrap;
                        gap: 10px;
                    }
                    
                    .info {
                        background-color: var(--vscode-textBlockQuote-background);
                        border-left: 4px solid var(--vscode-textBlockQuote-border);
                        padding: 8px 12px;
                        margin: 8px 0;
                        font-size: 0.85em;
                        line-height: 1.4;
                    }
                    
                    .status {
                        padding: 8px;
                        margin: 10px 0;
                        border-radius: 2px;
                        font-size: 0.9em;
                        display: none;
                    }
                    
                    .status.show {
                        display: block;
                    }
                    
                    .status.success {
                        background-color: var(--vscode-inputValidation-infoBackground);
                        border: 1px solid var(--vscode-inputValidation-infoBorder);
                    }
                    
                    h2 {
                        margin-top: 0;
                        margin-bottom: 20px;
                        color: var(--vscode-titleBar-activeForeground);
                    }
                    
                    .compiler-option {
                        display: flex;
                        align-items: center;
                        margin: 5px 0;
                        padding: 5px;
                    }
                    
                    .compiler-radio {
                        margin-right: 10px;
                    }
                    
                    .compiler-details {
                        flex: 1;
                    }
                    
                    .compiler-name {
                        font-weight: bold;
                    }
                    
                    .compiler-path {
                        font-size: 0.85em;
                        color: var(--vscode-descriptionForeground);
                    }
                    
                    .detect-button {
                        margin-bottom: 15px;
                    }
                </style>
            </head>
            <body>
                <h2>C++ Assembly Viewer Settings</h2>
                
                <div id="status" class="status"></div>
                
                <div class="setting-group">
                    <div class="setting-title">Compiler Selection</div>
                    
                    <div>
                        <button onclick="detectCompilers()" class="detect-button">Detect Compilers</button>
                        
                        <div id="compilersList"></div>
                        
                        <div style="margin-top: 15px;">
                            <label for="compilerPath">Manual Compiler Path (optional):</label>
                            <input type="text" id="compilerPath" placeholder="C:\\Path\\To\\Compiler\\cl.exe or g++" />
                            <div class="info">
                                Leave empty to use auto-detected compiler or select from detected compilers above.
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="setting-group">
                    <div class="setting-title">Compilation Options</div>
                    
                    <div>
                        <label for="compilerArgs">Compiler Arguments:</label>
                        <textarea id="compilerArgs" placeholder="Enter compiler arguments"></textarea>
                        <div class="info">
                            Default: /Od /FAcs /c /EHsc<br>
                            • <strong>/Od</strong> - disable optimizations<br>
                            • <strong>/FAcs</strong> - generate assembly with machine code and addresses<br>
                            • <strong>/c</strong> - compile only (no linking)<br>
                            • <strong>/EHsc</strong> - C++ exceptions
                        </div>
                    </div>
                </div>
                
                <div class="button-group">
                    <button onclick="saveSettings()">Save Settings</button>
                    <button onclick="resetToDefault()">Reset to Default</button>
                </div>
                
                <script>
                    const vscode = acquireVsCodeApi();
                    let availableCompilers = [];
                    
                    // Обработчики сообщений от расширения
                    window.addEventListener('message', event => {
                        const message = event.data;
                        
                        if (message.type === 'currentSettings') {
                            updateUIWithSettings(message.settings);
                        }
                        
                        if (message.type === 'availableCompilers') {
                            availableCompilers = message.compilers || [];
                            updateCompilersList();
                        }
                    });
                    
                    function updateUIWithSettings(settings) {
                        console.log('Updating UI with settings:', settings);
                        document.getElementById('compilerArgs').value = settings.compilerArgs || '/Od /FAcs /c /EHsc';
                        document.getElementById('compilerPath').value = settings.compilerPath || '';
                        
                        // Устанавливаем выбранный компилятор
                        if (settings.selectedCompiler) {
                            const radios = document.querySelectorAll('input[name="compiler"]');
                            for (const radio of radios) {
                                if (radio.value === settings.selectedCompiler) {
                                    radio.checked = true;
                                    break;
                                }
                            }
                        }
                    }
                    
                    function updateCompilersList() {
                        const compilersList = document.getElementById('compilersList');
                        
                        if (availableCompilers.length === 0) {
                            compilersList.innerHTML = '<div class="info">No compilers detected. Please install a C++ compiler (MSVC, GCC, or Clang).</div>';
                            return;
                        }
                        
                        let html = '<div style="margin-bottom: 10px;">Detected compilers:</div>';
                        
                        availableCompilers.forEach((compiler, index) => {
                            const compilerId = 'compiler_' + index;
                            html += \`
                                <div class="compiler-option">
                                    <input type="radio" 
                                           id="\${compilerId}" 
                                           name="compiler" 
                                           value="\${compiler.type}" 
                                           class="compiler-radio"
                                           data-path="\${compiler.path}">
                                    <label for="\${compilerId}" class="compiler-details">
                                        <div class="compiler-name">\${compiler.displayName}</div>
                                    </label>
                                </div>
                            \`;
                        });
                        
                        html += '<div class="info" style="margin-top: 10px;">Select a compiler to use for assembly generation.</div>';
                        
                        compilersList.innerHTML = html;
                    }
                    
                    function detectCompilers() {
                        vscode.postMessage({
                            type: 'detectCompilers'
                        });
                        showStatus('Detecting compilers...', 'success');
                    }
                    
                    function showStatus(message, type) {
                        const statusElement = document.getElementById('status');
                        statusElement.textContent = message;
                        statusElement.className = 'status ' + type + ' show';
                        
                        setTimeout(() => {
                            statusElement.className = 'status';
                        }, 3000);
                    }
                    
                    function saveSettings() {
                        const selectedCompilerRadio = document.querySelector('input[name="compiler"]:checked');
                        const selectedCompiler = selectedCompilerRadio ? selectedCompilerRadio.value : '';
                        
                        const settings = {
                            compilerArgs: document.getElementById('compilerArgs').value.trim(),
                            selectedCompiler: selectedCompiler,
                            compilerPath: document.getElementById('compilerPath').value.trim()
                        };
                        
                        console.log('Saving settings:', settings);
                        
                        vscode.postMessage({
                            type: 'updateSettings',
                            settings: settings
                        });
                        
                        showStatus('Settings saved successfully', 'success');
                    }
                    
                    function resetToDefault() {
                        const defaultSettings = {
                            compilerArgs: '/Od /FAcs /c /EHsc',
                            selectedCompiler: '',
                            compilerPath: ''
                        };
                        
                        updateUIWithSettings(defaultSettings);
                        showStatus('Reset to default values', 'success');
                    }
                    
                    // Запрашиваем текущие настройки при загрузке
                    vscode.postMessage({
                        type: 'getCurrentSettings'
                    });
                    
                    // Автоматически детектим компиляторы при загрузке
                    vscode.postMessage({
                        type: 'detectCompilers'
                    });
                </script>
            </body>
            </html>`;
    }
}