import * as vscode from 'vscode';
import { CompilerManager, CompilationResult, LineMapping } from './compilerManager';

export class AssemblyViewer {
    private compilerManager: CompilerManager;
    private sourceEditor: vscode.TextEditor | undefined;
    private assemblyEditor: vscode.TextEditor | undefined;
    private isScrolling: boolean = false;
    
    private disposables: vscode.Disposable[] = [];
    private currentMappings: LineMapping[] = [];
    private sourceDocumentUri: vscode.Uri | undefined;
    
    // Декорации для активного выделения
    private activeSourceHighlight: vscode.TextEditorDecorationType | undefined;
    private activeAssemblyHighlight: vscode.TextEditorDecorationType | undefined;
    
    // Отслеживаем закрытие редактора ассемблера
    private assemblyEditorDisposable: vscode.Disposable | undefined;
    // Отслеживаем изменение видимых редакторов
    private visibleEditorsDisposable: vscode.Disposable | undefined;

    constructor(compilerManager: CompilerManager) {
        this.compilerManager = compilerManager;
    }

    public async compileCurrentFile(): Promise<void> {
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

        this.sourceDocumentUri = document.uri;
        this.sourceEditor = editor;

        // Очищаем предыдущее состояние
        this.dispose();

        console.log('Starting compilation...');

        try {
            const result = await this.compilerManager.compileToAssembly(document.fileName);
            
            if (result.success && result.assembly) {
                // Выводим первые 50 строк для проверки формата
                console.log('First 50 lines of assembly output:');
                const lines = result.assembly.split('\n');
                for (let i = 0; i < Math.min(50, lines.length); i++) {
                    console.log(`${i + 1}: ${lines[i]}`);
                }
                
                await this.showAssembly(result);
                vscode.window.showInformationMessage('Compilation successful');
            } else {
                vscode.window.showErrorMessage(`Compilation failed: ${result.error}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Compilation error: ${error}`);
        }
    }

    private async showAssembly(result: CompilationResult): Promise<void> {
        if (!result.assembly) return;

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

        // Следим за закрытием редактора ассемблера
        this.assemblyEditorDisposable = vscode.workspace.onDidCloseTextDocument((closedDoc) => {
            if (closedDoc === this.assemblyEditor?.document) {
                console.log('Assembly editor closed, cleaning up highlights');
                this.cleanupHighlights();
                this.assemblyEditor = undefined;
                this.assemblyEditorDisposable?.dispose();
            }
        });

        // Также следим за изменением видимых редакторов
        this.visibleEditorsDisposable = vscode.window.onDidChangeVisibleTextEditors((editors) => {
            const isAssemblyEditorVisible = editors.some(editor => 
                editor === this.assemblyEditor
            );
            
            if (!isAssemblyEditorVisible && this.assemblyEditor) {
                console.log('Assembly editor is no longer visible, cleaning up highlights');
                this.cleanupHighlights();
                this.assemblyEditor = undefined;
            }
        });

        this.disposables.push(this.assemblyEditorDisposable, this.visibleEditorsDisposable);

        // Восстанавливаем исходный редактор
        await this.restoreSourceEditor();

        // Сохраняем маппинги
        this.currentMappings = result.mappings || [];
        console.log(`Loaded ${this.currentMappings.length} mappings`);

        // Инициализируем редакторы
        await this.initializeEditors();
    }

    private async restoreSourceEditor(): Promise<void> {
        if (!this.sourceDocumentUri) return;

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
        } catch (error) {
            console.error('Failed to restore source editor:', error);
        }
    }

    private async initializeEditors(): Promise<void> {
        console.log('Initializing editors...');
        console.log('Source editor valid:', this.sourceEditor !== undefined);
        console.log('Assembly editor valid:', this.assemblyEditor !== undefined);

        if (!this.sourceEditor || !this.assemblyEditor) {
            console.error('Editors are not valid after initialization');
            return;
        }

        // Даем время редакторам полностью инициализироваться
        setTimeout(() => {
            this.setupSyncScrolling();
            console.log('Editors initialized successfully');
        }, 300);
    }

    private setupSyncScrolling(): void {
        if (!this.sourceEditor || !this.assemblyEditor) {
            console.error('Cannot setup sync scrolling: editors not available');
            return;
        }

        console.log('Setting up sync scrolling between editors');

        // Обработчик для исходного кода -> ассемблер
        const sourceDisposable = vscode.window.onDidChangeTextEditorSelection((event) => {
            if (this.isScrolling) return;
            
            if (event.textEditor === this.sourceEditor && event.selections.length > 0) {
                const line = event.selections[0].active.line + 1;
                console.log(`Source selection: line ${line}`);
                
                this.syncScrollToAssembly(line);
                this.highlightCorrespondingAssembly(line);
            }
        });

        // Обработчик для ассемблера -> исходный код
        const assemblyDisposable = vscode.window.onDidChangeTextEditorSelection((event) => {
            if (this.isScrolling) return;
            
            if (event.textEditor === this.assemblyEditor && event.selections.length > 0) {
                const line = event.selections[0].active.line + 1;
                console.log(`Assembly selection: line ${line}`);
                
                this.syncScrollToSource(line);
                this.highlightCorrespondingSource(line);
            }
        });

        this.disposables.push(sourceDisposable, assemblyDisposable);
    }

    private syncScrollToAssembly(sourceLine: number): void {
        if (!this.assemblyEditor) return;

        const mapping = this.findMappingBySourceLine(sourceLine);
        if (mapping && mapping.assemblyLines.length > 0) {
            const targetLine = mapping.assemblyLines[0] - 1;
            this.scrollToLine(this.assemblyEditor, targetLine);
            console.log(`Scrolling assembly to line ${targetLine + 1}`);
        } else {
            console.log(`No mapping found for source line ${sourceLine}`);
        }
    }

    private syncScrollToSource(assemblyLine: number): void {
        if (!this.sourceEditor) return;

        const mapping = this.findMappingByAssemblyLine(assemblyLine);
        if (mapping) {
            const targetLine = mapping.sourceLine - 1;
            this.scrollToLine(this.sourceEditor, targetLine);
            console.log(`Scrolling source to line ${targetLine + 1}`);
        } else {
            console.log(`No mapping found for assembly line ${assemblyLine}`);
        }
    }

    private scrollToLine(editor: vscode.TextEditor, line: number): void {
        this.isScrolling = true;

        const position = new vscode.Position(Math.max(0, line), 0);
        const range = new vscode.Range(position, position);

        try {
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        } catch (error) {
            console.error('Error scrolling to line:', error);
        }

        setTimeout(() => {
            this.isScrolling = false;
        }, 50);
    }

    private highlightCorrespondingAssembly(sourceLine: number): void {
        const mapping = this.findMappingBySourceLine(sourceLine);
        if (mapping && this.assemblyEditor) {
            // Очищаем предыдущие выделения
            this.cleanupHighlights();
            
            // Подсвечиваем строки ассемблера на всю ширину
            this.highlightAssemblyLines(mapping.assemblyLines, mapping.color);
            console.log(`Highlighting assembly lines: ${mapping.assemblyLines.join(', ')}`);
        }
    }

    private highlightCorrespondingSource(assemblyLine: number): void {
        const mapping = this.findMappingByAssemblyLine(assemblyLine);
        if (mapping && this.sourceEditor) {
            // Очищаем предыдущие выделения
            this.cleanupHighlights();
            
            // Подсвечиваем строку исходного кода на всю ширину
            this.highlightSourceLine(mapping.sourceLine, mapping.color);
            
            // Подсвечиваем весь блок ассемблера
            if (this.assemblyEditor) {
                this.highlightAssemblyLines(mapping.assemblyLines, mapping.color);
            }
            console.log(`Highlighting source line ${mapping.sourceLine} and assembly lines: ${mapping.assemblyLines.join(', ')}`);
        }
    }

    private highlightSourceLine(line: number, color: string): void {
        if (!this.sourceEditor) return;

        // Очищаем предыдущее выделение
        if (this.activeSourceHighlight) {
            this.activeSourceHighlight.dispose();
        }

        // Подсветка всей строки - используем большую ширину
        const range = new vscode.Range(
            new vscode.Position(line - 1, 0),
            new vscode.Position(line - 1, 10000) // Достаточно большая ширина
        );

        this.activeSourceHighlight = vscode.window.createTextEditorDecorationType({
            backgroundColor: `${color}20`, // 20 = 12% прозрачности
            border: `2px solid ${color}`,
            borderStyle: 'solid',
            overviewRulerColor: color,
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            isWholeLine: true // Ключевое свойство - подсвечиваем всю строку
        });

        this.sourceEditor.setDecorations(this.activeSourceHighlight, [range]);
    }

    private highlightAssemblyLines(lines: number[], color: string): void {
        if (!this.assemblyEditor) return;

        // Очищаем предыдущее выделение
        if (this.activeAssemblyHighlight) {
            this.activeAssemblyHighlight.dispose();
        }

        const ranges = lines.map(line => 
            new vscode.Range(
                new vscode.Position(line - 1, 0),
                new vscode.Position(line - 1, 10000) // Достаточно большая ширина
            )
        );

        this.activeAssemblyHighlight = vscode.window.createTextEditorDecorationType({
            backgroundColor: `${color}20`, // 20 = 12% прозрачности
            border: `2px solid ${color}`,
            borderStyle: 'solid',
            overviewRulerColor: color,
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            isWholeLine: true // Ключевое свойство - подсвечиваем всю строку
        });

        this.assemblyEditor.setDecorations(this.activeAssemblyHighlight, ranges);
    }

    private cleanupHighlights(): void {
        if (this.activeSourceHighlight) {
            this.activeSourceHighlight.dispose();
            this.activeSourceHighlight = undefined;
        }
        
        if (this.activeAssemblyHighlight) {
            this.activeAssemblyHighlight.dispose();
            this.activeAssemblyHighlight = undefined;
        }
    }

    private findMappingBySourceLine(sourceLine: number): LineMapping | undefined {
        // Сначала ищем точное совпадение
        const exactMatch = this.currentMappings.find(mapping => mapping.sourceLine === sourceLine);
        if (exactMatch) {
            console.log(`Found exact mapping for source line ${sourceLine}: ${exactMatch.assemblyLines.length} asm lines`);
            return exactMatch;
        }
        
        // Если нет точного совпадения, ищем ближайшую строку в пределах 5 строк
        console.log(`No exact mapping for line ${sourceLine}, searching nearby...`);
        
        const sortedMappings = [...this.currentMappings].sort((a, b) => Math.abs(a.sourceLine - sourceLine) - Math.abs(b.sourceLine - sourceLine));
        
        for (const mapping of sortedMappings) {
            const distance = Math.abs(mapping.sourceLine - sourceLine);
            if (distance <= 5) {
                console.log(`Found nearby mapping: line ${mapping.sourceLine} (distance: ${distance}) with ${mapping.assemblyLines.length} asm lines`);
                return mapping;
            }
        }
        
        console.log(`No mapping found for line ${sourceLine} or nearby`);
        return undefined;
    }

    private findMappingByAssemblyLine(assemblyLine: number): LineMapping | undefined {
        // Ищем маппинг, содержащий эту строку ассемблера
        const mapping = this.currentMappings.find(mapping => 
            mapping.assemblyLines.includes(assemblyLine)
        );
        
        if (mapping) {
            console.log(`Found mapping for assembly line ${assemblyLine}: source line ${mapping.sourceLine}`);
        } else {
            console.log(`No mapping found for assembly line ${assemblyLine}`);
        }
        
        return mapping;
    }

    public dispose(): void {
        console.log('Disposing AssemblyViewer resources');
        
        this.cleanupHighlights();
        
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
        
        this.assemblyEditorDisposable?.dispose();
        this.visibleEditorsDisposable?.dispose();
        
        this.sourceEditor = undefined;
        this.assemblyEditor = undefined;
        this.currentMappings = [];
        this.isScrolling = false;
    }
}