import * as vscode from 'vscode';
import { CompilerManager } from './compilerManager';
import { SettingsPanel } from './settingsPanel';
import { AssemblyViewer } from './assemblyViewer';

export function activate(context: vscode.ExtensionContext) {
    console.log('C++ Assembly Viewer extension activated');
    
    const compilerManager = new CompilerManager();
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
    
    // Auto-detect compiler on activation
    compilerManager.autoDetectCompiler();
    
    context.subscriptions.push(
        compileCommand,
        settingsCommand,
        statusBarItem,
        compilerManager,
        assemblyViewer
    );
}

export function deactivate() {}