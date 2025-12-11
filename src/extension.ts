import * as vscode from 'vscode';
import { CompilerManager } from './compilerManager';
import { SettingsPanel } from './settingsPanel';
import { AssemblyViewer } from './assemblyViewer';
import { CompilerManager2 } from './compilerManager2';
import { AssemblyViewer2 } from './assemblyViewer2';

// Глобальная ссылка на CompilerManager
let compilerManager: CompilerManager;
let compilerManager2: CompilerManager2;

export function activate(context: vscode.ExtensionContext) {
    console.log('C++ Assembly Viewer extension activated');
    
    compilerManager = new CompilerManager();
    const assemblyViewer = new AssemblyViewer(compilerManager);
    
    compilerManager2 = new CompilerManager2();
    const assemblyViewer2 = new AssemblyViewer2(compilerManager2);
    
    // Register commands - версия 1
    const compileCommand = vscode.commands.registerCommand('cpp-asm-viewer.compileToAssembly', 
        () => assemblyViewer.compileCurrentFile());
    
    // Register commands - версия 2 (ASM)
    const compileCommand2 = vscode.commands.registerCommand('cpp-asm-viewer.compileAsmFAc', 
        () => assemblyViewer2.compileCurrentFile());
    
    const settingsCommand = vscode.commands.registerCommand('cpp-asm-viewer.showSettings',
        () => SettingsPanel.createOrShow(context.extensionUri));
    
    // Register status bar button - версия 1
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(code) ASM + машинные команды + адреса (/FAcs)";
    statusBarItem.tooltip = "Compile to Assembly with ASM + машинные команды + адреса (/FAcs)";
    statusBarItem.command = 'cpp-asm-viewer.compileToAssembly';
    statusBarItem.show();
    
    // Register status bar button - версия 2
    const statusBarItem2 = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
    statusBarItem2.text = "$(code) ASM (/FAc)";
    statusBarItem2.tooltip = "Compile to Assembly with /FAc flag";
    statusBarItem2.command = 'cpp-asm-viewer.compileAsmFAc';
    statusBarItem2.show();
    
    // Add settings button to status bar
    const settingsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    settingsStatusBarItem.text = "$(settings) Settings";
    settingsStatusBarItem.tooltip = "Open C++ Assembly Settings";
    settingsStatusBarItem.command = 'cpp-asm-viewer.showSettings';
    settingsStatusBarItem.show();
    
    // Auto-detect compilers
    compilerManager.autoDetectCompiler();
    compilerManager2.autoDetectCompiler2();
    
    // Add all disposables to context
    context.subscriptions.push(
        compileCommand,
        compileCommand2,
        settingsCommand,
        statusBarItem,
        statusBarItem2,
        settingsStatusBarItem,
        compilerManager,
        compilerManager2,
        assemblyViewer,
        assemblyViewer2
    );
}

// Экспортируем функцию для доступа к CompilerManager
export function getCompilerManager(): CompilerManager {
    return compilerManager;
}

export function deactivate() {
    // VS Code automatically calls dispose() on all objects in context.subscriptions
}

// Экспортируем функцию для доступа к CompilerManager
export function getCompilerManager2(): CompilerManager2 {
    return compilerManager2;
}

export function deactivate2() {
    // VS Code automatically calls dispose() on all objects in context.subscriptions
}