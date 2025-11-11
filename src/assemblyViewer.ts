import * as vscode from 'vscode';
import { CompilerManager, CompilationResult } from './compilerManager';

export class AssemblyViewer {
    private compilerManager: CompilerManager;
    private sourceEditor: vscode.TextEditor | undefined;
    private assemblyEditor: vscode.TextEditor | undefined;
    private isScrolling: boolean = false;
    private decorations: Map<string, vscode.TextEditorDecorationType> = new Map();
    
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
        
        this.sourceEditor = editor;
        
        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Compiling to assembly...',
            cancellable: false
        }, async (progress) => {
            const result = await this.compilerManager.compileToAssembly(document.fileName);
            
            if (result.success && result.assembly) {
                await this.showAssembly(result);
                vscode.window.showInformationMessage('Compilation successful');
            } else {
                vscode.window.showErrorMessage(`Compilation failed: ${result.error}`);
            }
        });
    }
    
    private async showAssembly(result: CompilationResult): Promise<void> {
        // Create or show assembly document
        const document = await vscode.workspace.openTextDocument({
            content: result.assembly,
            language: 'asm'
        });
        
        this.assemblyEditor = await vscode.window.showTextDocument(document, {
            viewColumn: vscode.ViewColumn.Beside,
            preview: false
        });
        
        // Setup synchronized scrolling and highlighting
        this.setupSyncScrolling();
        this.setupHighlighting(result.mappings || []);
    }
    
    private setupSyncScrolling(): void {
        if (!this.sourceEditor || !this.assemblyEditor) {
            return;
        }
        
        // Source to assembly scrolling
        const sourceDisposable = vscode.window.onDidChangeTextEditorSelection((event) => {
            if (event.textEditor === this.sourceEditor && !this.isScrolling) {
                this.syncScrollToAssembly(event.selections[0].active.line);
            }
        });
        
        // Assembly to source scrolling
        const assemblyDisposable = vscode.window.onDidChangeTextEditorSelection((event) => {
            if (event.textEditor === this.assemblyEditor && !this.isScrolling) {
                this.syncScrollToSource(event.selections[0].active.line);
            }
        });
        
        // Store disposables for cleanup
        if (this.sourceEditor) {
            (this.sourceEditor as any).asmDisposable = sourceDisposable;
        }
        if (this.assemblyEditor) {
            (this.assemblyEditor as any).asmDisposable = assemblyDisposable;
        }
    }
    
    private syncScrollToAssembly(sourceLine: number): void {
        if (!this.assemblyEditor || !this.sourceEditor) return;
        
        // This would need the mapping data to work properly
        // For now, just scroll to a similar relative position
        const sourceDoc = this.sourceEditor.document;
        const assemblyDoc = this.assemblyEditor.document;
        
        const sourceLineCount = sourceDoc.lineCount;
        const assemblyLineCount = assemblyDoc.lineCount;
        
        if (sourceLineCount > 0 && assemblyLineCount > 0) {
            const targetLine = Math.floor((sourceLine / sourceLineCount) * assemblyLineCount);
            this.scrollToLine(this.assemblyEditor, targetLine);
        }
    }
    
    private syncScrollToSource(assemblyLine: number): void {
        if (!this.assemblyEditor || !this.sourceEditor) return;
        
        const sourceDoc = this.sourceEditor.document;
        const assemblyDoc = this.assemblyEditor.document;
        
        const sourceLineCount = sourceDoc.lineCount;
        const assemblyLineCount = assemblyDoc.lineCount;
        
        if (sourceLineCount > 0 && assemblyLineCount > 0) {
            const targetLine = Math.floor((assemblyLine / assemblyLineCount) * sourceLineCount);
            this.scrollToLine(this.sourceEditor, targetLine);
        }
    }
    
    private scrollToLine(editor: vscode.TextEditor, line: number): void {
        this.isScrolling = true;
        
        const position = new vscode.Position(Math.max(0, line), 0);
        const range = new vscode.Range(position, position);
        
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        editor.selection = new vscode.Selection(position, position);
        
        setTimeout(() => {
            this.isScrolling = false;
        }, 100);
    }
    
    private setupHighlighting(mappings: any[]): void {
        if (!this.sourceEditor || !this.assemblyEditor) {
            return;
        }
        
        // Clear existing decorations
        this.clearDecorations();
        
        // Create decorations for each mapping
        mappings.forEach((mapping, index) => {
            this.highlightMapping(mapping);
        });
        
        // Setup selection handlers for interactive highlighting
        this.setupSelectionHandlers(mappings);
    }
    
    private highlightMapping(mapping: any): void {
        if (!this.sourceEditor || !this.assemblyEditor) return;
        
        const sourceDecoration = this.createDecoration(mapping.color, true);
        const assemblyDecoration = this.createDecoration(mapping.color, false);
        
        // Highlight source line
        const sourceRange = new vscode.Range(
            new vscode.Position(mapping.sourceLine - 1, 0),
            new vscode.Position(mapping.sourceLine - 1, 1000)
        );
        
        // Highlight assembly lines
        const assemblyRanges = mapping.assemblyLines.map((line: number) => {
            return new vscode.Range(
                new vscode.Position(line - 1, 0),
                new vscode.Position(line - 1, 1000)
            );
        });
        
        this.sourceEditor.setDecorations(sourceDecoration, [sourceRange]);
        this.assemblyEditor.setDecorations(assemblyDecoration, assemblyRanges);
        
        // Store decorations for cleanup
        this.decorations.set(`source-${mapping.sourceLine}`, sourceDecoration);
        this.decorations.set(`assembly-${mapping.sourceLine}`, assemblyDecoration);
    }
    
    private createDecoration(color: string, isSource: boolean): vscode.TextEditorDecorationType {
        return vscode.window.createTextEditorDecorationType({
            backgroundColor: `${color}20`,
            border: `1px solid ${color}40`,
            borderRadius: '2px',
            overviewRulerColor: color,
            overviewRulerLane: isSource ? vscode.OverviewRulerLane.Left : vscode.OverviewRulerLane.Right
        });
    }
    
    private setupSelectionHandlers(mappings: any[]): void {
        if (!this.sourceEditor || !this.assemblyEditor) return;
        
        // Source selection handler
        const sourceDisposable = vscode.window.onDidChangeTextEditorSelection((event) => {
            if (event.textEditor === this.sourceEditor && event.selections.length > 0) {
                const line = event.selections[0].active.line + 1;
                this.highlightCorrespondingAssembly(mappings, line);
            }
        });
        
        // Assembly selection handler
        const assemblyDisposable = vscode.window.onDidChangeTextEditorSelection((event) => {
            if (event.textEditor === this.assemblyEditor && event.selections.length > 0) {
                const line = event.selections[0].active.line + 1;
                this.highlightCorrespondingSource(mappings, line);
            }
        });
        
        // Store for cleanup
        if (this.sourceEditor) {
            (this.sourceEditor as any).asmHighlightDisposable = sourceDisposable;
        }
        if (this.assemblyEditor) {
            (this.assemblyEditor as any).asmHighlightDisposable = assemblyDisposable;
        }
    }
    
    private highlightCorrespondingAssembly(mappings: any[], sourceLine: number): void {
        const mapping = mappings.find(m => m.sourceLine === sourceLine);
        if (mapping && this.assemblyEditor) {
            this.highlightAssemblyLines(mapping.assemblyLines);
        }
    }
    
    private highlightCorrespondingSource(mappings: any[], assemblyLine: number): void {
        const mapping = mappings.find(m => m.assemblyLines.includes(assemblyLine));
        if (mapping && this.sourceEditor) {
            this.highlightSourceLine(mapping.sourceLine);
        }
    }
    
    private highlightAssemblyLines(lines: number[]): void {
        if (!this.assemblyEditor) return;
        
        const ranges = lines.map(line => 
            new vscode.Range(
                new vscode.Position(line - 1, 0),
                new vscode.Position(line - 1, 1000)
            )
        );
        
        const decoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: '#FFFF0020',
            border: '1px solid #FFFF0040'
        });
        
        this.assemblyEditor.setDecorations(decoration, ranges);
        
        // Auto-remove after short time
        setTimeout(() => {
            decoration.dispose();
        }, 1000);
    }
    
    private highlightSourceLine(line: number): void {
        if (!this.sourceEditor) return;
        
        const range = new vscode.Range(
            new vscode.Position(line - 1, 0),
            new vscode.Position(line - 1, 1000)
        );
        
        const decoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: '#FFFF0020',
            border: '1px solid #FFFF0040'
        });
        
        this.sourceEditor.setDecorations(decoration, [range]);
        
        // Auto-remove after short time
        setTimeout(() => {
            decoration.dispose();
        }, 1000);
    }
    
    private clearDecorations(): void {
        this.decorations.forEach(decoration => {
            decoration.dispose();
        });
        this.decorations.clear();
    }
    
    public dispose(): void {
        this.clearDecorations();
        
        // Clean up event listeners
        if (this.sourceEditor) {
            const disposables = [
                (this.sourceEditor as any).asmDisposable,
                (this.sourceEditor as any).asmHighlightDisposable
            ];
            disposables.forEach(d => d?.dispose());
        }
        
        if (this.assemblyEditor) {
            const disposables = [
                (this.assemblyEditor as any).asmDisposable,
                (this.assemblyEditor as any).asmHighlightDisposable
            ];
            disposables.forEach(d => d?.dispose());
        }
    }
}