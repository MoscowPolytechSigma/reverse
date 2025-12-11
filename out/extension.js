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
exports.deactivate2 = exports.getCompilerManager2 = exports.deactivate = exports.getCompilerManager = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const compilerManager_1 = require("./compilerManager");
const settingsPanel_1 = require("./settingsPanel");
const assemblyViewer_1 = require("./assemblyViewer");
const compilerManager2_1 = require("./compilerManager2");
const assemblyViewer2_1 = require("./assemblyViewer2");
// Глобальная ссылка на CompilerManager
let compilerManager;
let compilerManager2;
function activate(context) {
    console.log('C++ Assembly Viewer extension activated');
    compilerManager = new compilerManager_1.CompilerManager();
    const assemblyViewer = new assemblyViewer_1.AssemblyViewer(compilerManager);
    compilerManager2 = new compilerManager2_1.CompilerManager2();
    const assemblyViewer2 = new assemblyViewer2_1.AssemblyViewer2(compilerManager2);
    // Register commands - версия 1
    const compileCommand = vscode.commands.registerCommand('cpp-asm-viewer.compileToAssembly', () => assemblyViewer.compileCurrentFile());
    // Register commands - версия 2 (ASM)
    const compileCommand2 = vscode.commands.registerCommand('cpp-asm-viewer.compileAsmFAc', () => assemblyViewer2.compileCurrentFile());
    const settingsCommand = vscode.commands.registerCommand('cpp-asm-viewer.showSettings', () => settingsPanel_1.SettingsPanel.createOrShow(context.extensionUri));
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
    context.subscriptions.push(compileCommand, compileCommand2, settingsCommand, statusBarItem, statusBarItem2, settingsStatusBarItem, compilerManager, compilerManager2, assemblyViewer, assemblyViewer2);
}
exports.activate = activate;
// Экспортируем функцию для доступа к CompilerManager
function getCompilerManager() {
    return compilerManager;
}
exports.getCompilerManager = getCompilerManager;
function deactivate() {
    // VS Code automatically calls dispose() on all objects in context.subscriptions
}
exports.deactivate = deactivate;
// Экспортируем функцию для доступа к CompilerManager
function getCompilerManager2() {
    return compilerManager2;
}
exports.getCompilerManager2 = getCompilerManager2;
function deactivate2() {
    // VS Code automatically calls dispose() on all objects in context.subscriptions
}
exports.deactivate2 = deactivate2;
//# sourceMappingURL=extension.js.map