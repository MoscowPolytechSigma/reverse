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
exports.AssemblyViewer2 = void 0;
const vscode = __importStar(require("vscode"));
class AssemblyViewer2 {
    constructor(compilerManager2) {
        this.isScrolling = false;
        this.disposables = [];
        this.currentMappings = [];
        // Удаляем статические декорации и их цвета
        this.temporaryDecorations = [];
        this.lastHighlightedSourceLine = -1;
        this.lastHighlightedAssemblyLines = [];
        this.compilerManager2 = compilerManager2;
    }
    async compileCurrentFile() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }
        const document = editor.document;
        if (document.languageId !== 'cpp' && document.languageId !== 'c') {
            vscode.window.showWarningMessage('Only C/C++ files are supported');
            return;
        }
        // Сохраняем URI исходного документа
        this.sourceDocumentUri = document.uri;
        this.sourceEditor = editor;
        // Очищаем предыдущее состояние
        this.dispose();
        console.log('Starting compilation...');
        try {
            const result = await this.compilerManager2.compileToAssembly2(document.fileName);
            if (result.success && result.assembly) {
                await this.showAssembly(result);
                vscode.window.showInformationMessage('Compilation successful');
            }
            else {
                vscode.window.showErrorMessage(`Compilation failed: ${result.error}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Compilation error: ${error}`);
        }
    }
    async showAssembly(result) {
        if (!result.assembly)
            return;
        // Создаем документ с ассемблерным кодом
        const document = await vscode.workspace.openTextDocument({
            content: result.assembly,
            language: 'asm'
        });
        // Показываем ассемблерный код в соседней панели
        this.assemblyEditor = await vscode.window.showTextDocument(document, {
            viewColumn: vscode.ViewColumn.Beside,
            preview: false
        });
        console.log('Assembly document opened successfully');
        // Восстанавливаем исходный редактор
        await this.restoreSourceEditor();
        // Сохраняем маппинги
        this.currentMappings = result.mappings || [];
        console.log(`Loaded ${this.currentMappings.length} mappings`);
        // Инициализируем редакторы
        await this.initializeEditors();
    }
    async restoreSourceEditor() {
        if (!this.sourceDocumentUri)
            return;
        try {
            // Пытаемся найти уже открытый редактор с нашим исходным файлом
            const editors = vscode.window.visibleTextEditors;
            for (const editor of editors) {
                if (editor.document.uri.toString() === this.sourceDocumentUri.toString()) {
                    this.sourceEditor = editor;
                    console.log('Found source editor in visible editors');
                    return;
                }
            }
            // Если не нашли, открываем файл заново
            const document = await vscode.workspace.openTextDocument(this.sourceDocumentUri);
            this.sourceEditor = await vscode.window.showTextDocument(document, {
                viewColumn: vscode.ViewColumn.One,
                preview: false
            });
            console.log('Reopened source document');
        }
        catch (error) {
            console.error('Failed to restore source editor:', error);
        }
    }
    async initializeEditors() {
        console.log('Initializing editors...');
        console.log('Source editor valid:', this.sourceEditor !== undefined);
        console.log('Assembly editor valid:', this.assemblyEditor !== undefined);
        if (!this.sourceEditor || !this.assemblyEditor) {
            console.error('Editors are not valid after initialization');
            return;
        }
        // Слушаем закрытие редактора ассемблера
        const closeDisposable = vscode.window.onDidChangeVisibleTextEditors((editors) => {
            if (!this.assemblyEditor)
                return;
            const isAssemblyEditorOpen = editors.some(editor => editor === this.assemblyEditor);
            if (!isAssemblyEditorOpen) {
                console.log('Assembly editor was closed, cleaning up highlights');
                this.clearAllTemporaryHighlights();
            }
        });
        this.disposables.push(closeDisposable);
        // Даем время редакторам полностью инициализироваться
        setTimeout(() => {
            this.setupSyncScrolling();
            console.log('Editors initialized successfully');
        }, 500);
    }
    setupSyncScrolling() {
        if (!this.sourceEditor || !this.assemblyEditor) {
            console.error('Cannot setup sync scrolling: editors not available');
            return;
        }
        console.log('Setting up sync scrolling between editors');
        // Обработчик для исходного кода -> ассемблер
        const sourceDisposable = vscode.window.onDidChangeTextEditorSelection((event) => {
            if (this.isScrolling)
                return;
            if (event.textEditor === this.sourceEditor && event.selections.length > 0) {
                const line = event.selections[0].active.line + 1;
                console.log(`Source selection: line ${line}`);
                this.clearAllTemporaryHighlights();
                this.syncScrollToAssembly(line);
                this.highlightCorrespondingAssembly(line);
            }
        });
        // Обработчик для ассемблера -> исходный код
        const assemblyDisposable = vscode.window.onDidChangeTextEditorSelection((event) => {
            if (this.isScrolling)
                return;
            if (event.textEditor === this.assemblyEditor && event.selections.length > 0) {
                const line = event.selections[0].active.line + 1;
                console.log(`Assembly selection: line ${line}`);
                this.clearAllTemporaryHighlights();
                this.syncScrollToSource(line);
                this.highlightCorrespondingSource(line);
            }
        });
        this.disposables.push(sourceDisposable, assemblyDisposable);
    }
    syncScrollToAssembly(sourceLine) {
        if (!this.assemblyEditor)
            return;
        const mapping = this.findMappingBySourceLine(sourceLine);
        if (mapping && mapping.assemblyLines.length > 0) {
            const targetLine = mapping.assemblyLines[0] - 1;
            this.scrollToLine(this.assemblyEditor, targetLine);
            console.log(`Scrolling assembly to line ${targetLine + 1}`);
        }
        else {
            console.log(`No mapping found for source line ${sourceLine}`);
        }
    }
    syncScrollToSource(assemblyLine) {
        if (!this.sourceEditor)
            return;
        const mapping = this.findMappingByAssemblyLine(assemblyLine);
        if (mapping) {
            const targetLine = mapping.sourceLine - 1;
            this.scrollToLine(this.sourceEditor, targetLine);
            console.log(`Scrolling source to line ${targetLine + 1}`);
        }
        else {
            console.log(`No mapping found for assembly line ${assemblyLine}`);
        }
    }
    scrollToLine(editor, line) {
        this.isScrolling = true;
        const position = new vscode.Position(Math.max(0, line), 0);
        const range = new vscode.Range(position, position);
        try {
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        }
        catch (error) {
            console.error('Error scrolling to line:', error);
        }
        setTimeout(() => {
            this.isScrolling = false;
        }, 50);
    }
    highlightCorrespondingAssembly(sourceLine) {
        const mapping = this.findMappingBySourceLine(sourceLine);
        if (mapping && this.assemblyEditor) {
            this.createTemporaryHighlight(this.assemblyEditor, mapping.assemblyLines, mapping.color);
            this.lastHighlightedAssemblyLines = mapping.assemblyLines;
            console.log(`Highlighting assembly lines: ${mapping.assemblyLines.join(', ')}`);
        }
    }
    highlightCorrespondingSource(assemblyLine) {
        const mapping = this.findMappingByAssemblyLine(assemblyLine);
        if (mapping && this.sourceEditor) {
            // Подсвечиваем строку исходного кода
            this.createTemporaryHighlight(this.sourceEditor, [mapping.sourceLine], mapping.color);
            this.lastHighlightedSourceLine = mapping.sourceLine;
            // Подсвечиваем весь блок ассемблера
            if (this.assemblyEditor) {
                this.createTemporaryHighlight(this.assemblyEditor, mapping.assemblyLines, mapping.color);
                this.lastHighlightedAssemblyLines = mapping.assemblyLines;
            }
            console.log(`Highlighting source line ${mapping.sourceLine} and assembly lines: ${mapping.assemblyLines.join(', ')}`);
        }
    }
    createTemporaryHighlight(editor, lines, color) {
        const ranges = lines.map(line => {
            // Получаем весь текст строки, чтобы узнать её длину
            const lineText = editor.document.lineAt(line - 1).text;
            const maxColumn = Math.max(lineText.length, 100); // Минимум 100 символов ширины
            return new vscode.Range(new vscode.Position(line - 1, 0), new vscode.Position(line - 1, maxColumn));
        });
        const decoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: `${color}40`,
            border: `2px solid ${color}`,
            borderRadius: '3px',
            overviewRulerColor: color,
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            isWholeLine: true // Это ключевое свойство - подсвечиваем всю строку
        });
        editor.setDecorations(decoration, ranges);
        this.temporaryDecorations.push(decoration);
    }
    clearAllTemporaryHighlights() {
        this.temporaryDecorations.forEach(decoration => {
            decoration.dispose();
        });
        this.temporaryDecorations = [];
        this.lastHighlightedSourceLine = -1;
        this.lastHighlightedAssemblyLines = [];
    }
    findMappingBySourceLine(sourceLine) {
        return this.currentMappings.find(mapping => mapping.sourceLine === sourceLine);
    }
    findMappingByAssemblyLine(assemblyLine) {
        return this.currentMappings.find(mapping => mapping.assemblyLines.includes(assemblyLine));
    }
    dispose() {
        console.log('Disposing AssemblyViewer resources');
        this.clearAllTemporaryHighlights();
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
        this.sourceEditor = undefined;
        this.assemblyEditor = undefined;
        this.currentMappings = [];
        this.isScrolling = false;
        // Не очищаем sourceDocumentUri, чтобы можно было восстановить
    }
}
exports.AssemblyViewer2 = AssemblyViewer2;
//# sourceMappingURL=assemblyViewer2.js.map