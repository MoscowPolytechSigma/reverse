import * as vscode from 'vscode';
import { CompilerManager } from './compilerManager';
import { SettingsPanel } from './settingsPanel';
import { AssemblyViewer } from './assemblyViewer';

// Глобальная ссылка на CompilerManager
let compilerManager: CompilerManager;

export function activate(context: vscode.ExtensionContext) {
    console.log('C++ Assembly Viewer extension activated');
    
    compilerManager = new CompilerManager();
    const assemblyViewer = new AssemblyViewer(compilerManager);
    
    // Register commands
    const compileCommand = vscode.commands.registerCommand('cpp-asm-viewer.compileToAssembly', 
        () => assemblyViewer.compileCurrentFile());
    
    const settingsCommand = vscode.commands.registerCommand('cpp-asm-viewer.showSettings',
        () => SettingsPanel.createOrShow(context.extensionUri));
    
    // Register status bar button
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(code) View Assembly";
    statusBarItem.tooltip = "Compile to Assembly";
    statusBarItem.command = 'cpp-asm-viewer.compileToAssembly';
    statusBarItem.show();
    
    // Add settings button to status bar
    const settingsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    settingsStatusBarItem.text = "$(settings) Settings";
    settingsStatusBarItem.tooltip = "Open C++ Assembly Settings";
    settingsStatusBarItem.command = 'cpp-asm-viewer.showSettings';
    settingsStatusBarItem.show();
    
    // Auto-detect compiler on activation
    compilerManager.autoDetectCompiler();
    
    // Add all disposables to context
    context.subscriptions.push(
        compileCommand,
        settingsCommand,
        statusBarItem,
        settingsStatusBarItem,
        compilerManager,
        assemblyViewer
    );
}

// Экспортируем функцию для доступа к CompilerManager
export function getCompilerManager(): CompilerManager {
    return compilerManager;
}

export function deactivate() {
    // VS Code automatically calls dispose() on all objects in context.subscriptions
}