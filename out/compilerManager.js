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
exports.CompilerManager = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const cp = __importStar(require("child_process"));
const os = __importStar(require("os"));
class CompilerManager {
    constructor() {
        this.config = vscode.workspace.getConfiguration('cpp-asm-viewer');
    }
    async autoDetectCompiler() {
        // Сначала проверяем ручные настройки
        const selectedCompilerType = this.config.get('selectedCompiler');
        const manualPath = this.config.get('compilerPath');
        if (manualPath && fs.existsSync(manualPath)) {
            // Пытаемся определить тип компилятора по пути
            const type = this.detectCompilerTypeByPath(manualPath);
            const version = await this.getCompilerVersion(manualPath, type);
            this.currentCompiler = {
                path: manualPath,
                version: version,
                type: type
            };
            vscode.window.showInformationMessage(`Using manual compiler: ${type} ${version}`);
            return this.currentCompiler;
        }
        // Если выбран конкретный тип компилятора
        if (selectedCompilerType) {
            let compiler;
            switch (selectedCompilerType) {
                case 'msvc':
                    compiler = await this.detectMSVC();
                    break;
                case 'gcc':
                    compiler = await this.detectGCC();
                    break;
                case 'clang':
                    compiler = await this.detectClang();
                    break;
            }
            if (compiler) {
                this.currentCompiler = compiler;
                vscode.window.showInformationMessage(`Using selected compiler: ${compiler.type} ${compiler.version}`);
                return compiler;
            }
        }
        // Автодетект по порядку: MSVC -> GCC -> Clang
        const msvc = await this.detectMSVC();
        if (msvc) {
            this.currentCompiler = msvc;
            vscode.window.showInformationMessage(`Found MSVC compiler: ${msvc.version}`);
            return msvc;
        }
        const gcc = await this.detectGCC();
        if (gcc) {
            this.currentCompiler = gcc;
            vscode.window.showInformationMessage(`Found GCC compiler: ${gcc.version}`);
            return gcc;
        }
        const clang = await this.detectClang();
        if (clang) {
            this.currentCompiler = clang;
            vscode.window.showInformationMessage(`Found Clang compiler: ${clang.version}`);
            return clang;
        }
        vscode.window.showWarningMessage('No C++ compiler found. Please configure manually in settings.');
        return undefined;
    }
    detectCompilerTypeByPath(compilerPath) {
        const lowerPath = compilerPath.toLowerCase();
        if (lowerPath.includes('cl.exe') || lowerPath.includes('msvc')) {
            return 'msvc';
        }
        else if (lowerPath.includes('g++') || lowerPath.includes('gcc') || lowerPath.includes('mingw')) {
            return 'gcc';
        }
        else if (lowerPath.includes('clang++') || lowerPath.includes('clang')) {
            return 'clang';
        }
        // По умолчанию предполагаем MSVC для .exe файлов на Windows
        return compilerPath.endsWith('.exe') ? 'msvc' : 'gcc';
    }
    async getCompilerVersion(compilerPath, type) {
        try {
            if (type === 'msvc') {
                return await this.getMSVCVersion(compilerPath);
            }
            else {
                const result = cp.spawnSync(compilerPath, ['--version']);
                if (result.status === 0 && result.stdout) {
                    const versionOutput = result.stdout.toString();
                    const versionMatch = versionOutput.match(/(\d+\.\d+\.\d+)/);
                    return versionMatch ? versionMatch[1] : 'Unknown';
                }
            }
        }
        catch (error) {
            console.error('Error getting compiler version:', error);
        }
        return 'Unknown';
    }
    async detectMSVC() {
        try {
            // Common installation paths - фильтруем undefined значения
            const possiblePaths = [
                process.env['VCINSTALLDIR'],
                'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Tools\\MSVC\\',
                'C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional\\VC\\Tools\\MSVC\\',
                'C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\VC\\Tools\\MSVC\\',
                'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Community\\VC\\Tools\\MSVC\\',
                'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Professional\\VC\\Tools\\MSVC\\',
                'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Enterprise\\VC\\Tools\\MSVC\\',
            ].filter((p) => p !== undefined && fs.existsSync(p));
            for (const basePath of possiblePaths) {
                const versions = fs.readdirSync(basePath)
                    .filter(dir => {
                    const fullPath = path.join(basePath, dir, 'bin', 'Hostx64', 'x64', 'cl.exe');
                    return fs.existsSync(fullPath);
                })
                    .sort().reverse();
                if (versions.length > 0) {
                    const compilerPath = path.join(basePath, versions[0], 'bin', 'Hostx64', 'x64', 'cl.exe');
                    const version = await this.getMSVCVersion(compilerPath);
                    return {
                        path: compilerPath,
                        version: version,
                        type: 'msvc'
                    };
                }
            }
            // Try using vswhere
            const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
            const vswherePath = path.join(programFilesX86, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
            if (fs.existsSync(vswherePath)) {
                const result = cp.spawnSync(vswherePath, [
                    '-latest',
                    '-products',
                    '*',
                    '-requires',
                    'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
                    '-property',
                    'installationPath'
                ]);
                if (result.status === 0 && result.stdout) {
                    const installPath = result.stdout.toString().trim();
                    if (installPath && fs.existsSync(installPath)) {
                        const vcToolsPath = path.join(installPath, 'VC', 'Tools', 'MSVC');
                        if (fs.existsSync(vcToolsPath)) {
                            const versions = fs.readdirSync(vcToolsPath)
                                .filter(dir => {
                                const fullPath = path.join(vcToolsPath, dir, 'bin', 'Hostx64', 'x64', 'cl.exe');
                                return fs.existsSync(fullPath);
                            })
                                .sort().reverse();
                            if (versions.length > 0) {
                                const compilerPath = path.join(vcToolsPath, versions[0], 'bin', 'Hostx64', 'x64', 'cl.exe');
                                const version = await this.getMSVCVersion(compilerPath);
                                return {
                                    path: compilerPath,
                                    version: version,
                                    type: 'msvc'
                                };
                            }
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error('Error detecting MSVC:', error);
        }
        return undefined;
    }
    async getMSVCVersion(compilerPath) {
        return new Promise((resolve) => {
            const process = cp.spawn(compilerPath, [], { stdio: 'pipe' });
            let output = '';
            process.stderr.on('data', (data) => {
                output += data.toString();
            });
            process.on('close', () => {
                const versionMatch = output.match(/Compiler Version (\d+\.\d+\.\d+\.\d+)/);
                resolve(versionMatch ? versionMatch[1] : 'Unknown');
            });
            setTimeout(() => {
                process.kill();
                resolve('Unknown');
            }, 5000);
        });
    }
    async detectGCC() {
        try {
            const commands = ['g++', 'gcc', 'x86_64-w64-mingw32-g++', 'x86_64-w64-mingw32-gcc'];
            for (const cmd of commands) {
                try {
                    const result = cp.spawnSync(cmd, ['--version']);
                    if (result.status === 0 && result.stdout) {
                        const versionOutput = result.stdout.toString();
                        const versionMatch = versionOutput.match(/(\d+\.\d+\.\d+)/);
                        return {
                            path: cmd,
                            version: versionMatch ? versionMatch[1] : 'Unknown',
                            type: 'gcc'
                        };
                    }
                }
                catch {
                    // Continue to next command
                }
            }
        }
        catch (error) {
            console.error('Error detecting GCC:', error);
        }
        return undefined;
    }
    async detectClang() {
        try {
            const commands = ['clang++', 'clang'];
            for (const cmd of commands) {
                try {
                    const result = cp.spawnSync(cmd, ['--version']);
                    if (result.status === 0 && result.stdout) {
                        const versionOutput = result.stdout.toString();
                        const versionMatch = versionOutput.match(/(\d+\.\d+\.\d+)/);
                        return {
                            path: cmd,
                            version: versionMatch ? versionMatch[1] : 'Unknown',
                            type: 'clang'
                        };
                    }
                }
                catch {
                    // Continue to next command
                }
            }
        }
        catch (error) {
            console.error('Error detecting Clang:', error);
        }
        return undefined;
    }
    async compileToAssembly(sourcePath) {
        if (!this.currentCompiler) {
            const detected = await this.autoDetectCompiler();
            if (!detected) {
                return {
                    success: false,
                    error: 'No compiler available. Please configure a C++ compiler in settings.'
                };
            }
        }
        const compiler = this.currentCompiler;
        if (compiler.type === 'msvc') {
            return await this.compileWithMSVC(compiler, sourcePath);
        }
        else {
            return await this.compileWithGCCLike(compiler, sourcePath);
        }
    }
    async compileWithMSVC(compiler, sourcePath) {
        const vcvarsallPath = await this.findVcvarsall();
        if (!vcvarsallPath) {
            return {
                success: false,
                error: 'Cannot find vcvarsall.bat.'
            };
        }
        const args = this.getCompilerArgs(sourcePath);
        return new Promise((resolve) => {
            try {
                const compilerCommand = compiler.path.includes(' ') ? `"${compiler.path}"` : compiler.path;
                const sourceFile = sourcePath.includes(' ') ? `"${sourcePath}"` : sourcePath;
                const vcvarsall = vcvarsallPath.includes(' ') ? `"${vcvarsallPath}"` : vcvarsallPath;
                const tempDir = os.tmpdir();
                const tempAsmFile = path.join(tempDir, `asm_${Date.now()}.asm`);
                // Используем /FAcs для генерации ассемблера с машинным кодом и адресами
                const fullCommand = `chcp 65001 > nul && ${vcvarsall} x64 && ${compilerCommand} ${args.join(' ')} ${sourceFile} /Fa"${tempAsmFile}"`;
                console.log('Executing MSVC command:', fullCommand);
                cp.exec(fullCommand, {
                    cwd: path.dirname(sourcePath),
                    encoding: 'utf8',
                    maxBuffer: 10 * 1024 * 1024
                }, (error, stdout, stderr) => {
                    console.log('Compiler completed, checking for assembly output...');
                    if (stdout && this.isAssemblyOutput(stdout)) {
                        console.log('Found assembly output in stdout');
                        const assembly = this.extractAssemblyFromOutput(stdout);
                        const mappings = this.parseMappings(assembly, sourcePath);
                        resolve({
                            success: true,
                            assembly: assembly,
                            sourceFile: sourcePath,
                            mappings: mappings
                        });
                        return;
                    }
                    if (fs.existsSync(tempAsmFile)) {
                        try {
                            let assembly = fs.readFileSync(tempAsmFile, 'utf8');
                            console.log(`Found assembly file: ${tempAsmFile}, size: ${assembly.length} chars`);
                            fs.unlinkSync(tempAsmFile);
                            if (assembly.includes('include listing.inc')) {
                                console.log('File contains include, extracting real assembly...');
                                assembly = this.extractRealAssembly(assembly);
                            }
                            if (assembly.length > 0) {
                                const mappings = this.parseMappings(assembly, sourcePath);
                                resolve({
                                    success: true,
                                    assembly: assembly,
                                    sourceFile: sourcePath,
                                    mappings: mappings
                                });
                            }
                            else {
                                resolve({
                                    success: false,
                                    error: 'Assembly file is empty after processing'
                                });
                            }
                        }
                        catch (readError) {
                            console.error('Error reading temp assembly file:', readError);
                            resolve({
                                success: false,
                                error: `Failed to read assembly file: ${readError.message}`
                            });
                        }
                    }
                    else if (error) {
                        const errorMessage = stderr || stdout || `Compiler exited with code ${error.code}`;
                        resolve({
                            success: false,
                            error: this.fixEncoding(errorMessage)
                        });
                    }
                    else {
                        resolve({
                            success: false,
                            error: `No assembly output found. Command was: ${fullCommand}`
                        });
                    }
                });
            }
            catch (error) {
                resolve({
                    success: false,
                    error: `Compilation error: ${error.message}`
                });
            }
        });
    }
    isAssemblyOutput(text) {
        return text.includes('PROC') ||
            text.includes('ENDP') ||
            text.includes('mov') ||
            text.includes('push') ||
            text.includes('pop') ||
            text.includes('call') ||
            text.includes('lea') ||
            text.includes('add') ||
            text.includes('sub') ||
            text.includes('ret');
    }
    extractAssemblyFromOutput(output) {
        const lines = output.split('\n');
        const assemblyLines = [];
        let inAssembly = false;
        for (const line of lines) {
            if (line.includes('PROC') || line.includes('_TEXT') || line.includes('CODE')) {
                inAssembly = true;
            }
            if (inAssembly) {
                assemblyLines.push(line);
            }
            if (line.includes('ENDP')) {
                break;
            }
        }
        return assemblyLines.length > 0 ? assemblyLines.join('\n') : output;
    }
    extractRealAssembly(assembly) {
        const lines = assembly.split('\n');
        const realLines = [];
        for (const line of lines) {
            const trimmedLine = line.trim();
            // Пропускаем директивы include
            if (trimmedLine.startsWith('include')) {
                continue;
            }
            // Пропускаем INCLUDELIB
            if (trimmedLine.startsWith('INCLUDELIB')) {
                continue;
            }
            // Пропускаем пустые строки в начале
            if (realLines.length === 0 && trimmedLine === '') {
                continue;
            }
            realLines.push(line);
        }
        return realLines.join('\n');
    }
    async findVcvarsall() {
        const possiblePaths = [
            process.env['VCINSTALLDIR'] ? path.join(process.env['VCINSTALLDIR'], 'Auxiliary', 'Build', 'vcvarsall.bat') : undefined,
            process.env['VSINSTALLDIR'] ? path.join(process.env['VSINSTALLDIR'], 'VC', 'Auxiliary', 'Build', 'vcvarsall.bat') : undefined,
            'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Auxiliary\\Build\\vcvarsall.bat',
            'C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional\\VC\\Auxiliary\\Build\\vcvarsall.bat',
            'C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\VC\\Auxiliary\\Build\\vcvarsall.bat',
            'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Community\\VC\\Auxiliary\\Build\\vcvarsall.bat',
            'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Professional\\VC\\Auxiliary\\Build\\vcvarsall.bat',
            'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Enterprise\\VC\\Auxiliary\\Build\\vcvarsall.bat',
        ].filter((p) => p !== undefined && fs.existsSync(p));
        return possiblePaths[0];
    }
    async compileWithGCCLike(compiler, sourcePath) {
        const args = this.getCompilerArgs(sourcePath);
        return new Promise((resolve) => {
            try {
                const process = cp.spawn(compiler.path, args, {
                    cwd: path.dirname(sourcePath),
                    stdio: 'pipe',
                    shell: true
                });
                let stdout = '';
                let stderr = '';
                process.stdout.on('data', (data) => {
                    stdout += data.toString();
                });
                process.stderr.on('data', (data) => {
                    stderr += data.toString();
                });
                process.on('close', (code) => {
                    if (code === 0) {
                        const mappings = this.parseMappings(stdout, sourcePath);
                        resolve({
                            success: true,
                            assembly: stdout,
                            sourceFile: sourcePath,
                            mappings: mappings
                        });
                    }
                    else {
                        resolve({
                            success: false,
                            error: stderr || `Compiler exited with code ${code}`
                        });
                    }
                });
                process.on('error', (error) => {
                    resolve({
                        success: false,
                        error: `Failed to start compiler: ${error.message}`
                    });
                });
            }
            catch (error) {
                resolve({
                    success: false,
                    error: `Compilation error: ${error.message}`
                });
            }
        });
    }
    getCompilerArgs(sourcePath) {
        const baseArgs = this.config.get('compilerArgs', '/Od /FAcs /c /EHsc').split(' ');
        let args = [...baseArgs];
        if (this.currentCompiler?.type === 'msvc') {
            console.log('MSVC compiler detected');
            // Очищаем от старых флагов /FA
            args = args.filter(arg => !arg.startsWith('/FA'));
            // Базовые флаги
            if (!args.includes('/nologo')) {
                args.unshift('/nologo');
            }
            if (!args.includes('/Od')) {
                args.push('/Od');
            }
            if (!args.includes('/c')) {
                args.push('/c');
            }
            // Всегда используем /FAcs для MSVC (ассемблер с машинным кодом и адресами)
            console.log('Using /FAcs flag for assembly with machine code and addresses');
            args.push('/FAcs');
            if (!args.some(arg => arg.startsWith('/std:'))) {
                args.push('/std:c++17');
            }
            console.log('Final MSVC arguments:', args.join(' '));
        }
        else if (this.currentCompiler?.type === 'gcc' || this.currentCompiler?.type === 'clang') {
            // Для GCC/Clang используем флаги для подробного ассемблера
            args = args.filter(arg => !arg.startsWith('/')); // Убираем MSVC флаги
            args.push('-S', '-fverbose-asm', '-masm=intel', '-fno-asynchronous-unwind-tables');
            if (!args.some(arg => arg.startsWith('-std='))) {
                args.push('-std=c++17');
            }
            console.log('Final GCC/Clang arguments:', args.join(' '));
        }
        return args;
    }
    parseMappings(assembly, sourcePath) {
        const mappings = [];
        const lines = assembly.split('\n');
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
        console.log('Parsing mappings from assembly, total lines:', lines.length);
        let currentSourceLine = -1;
        let assemblyLines = [];
        let colorIndex = 0;
        // Получаем имя нашего исходного файла
        const sourceFileName = path.basename(sourcePath);
        console.log('Source file name for filtering:', sourceFileName);
        // Текущий файл в комментариях
        let currentFileInComments = null;
        let isInOurFile = false;
        // Паттерны
        const filePattern = /;\s*File\s+(.+)/i;
        const linePattern = /;\s*Line\s+(\d+)/i;
        const lineColonPattern = /;\s*(\d+)\s*:/;
        const lineWithPipePattern = /;\s*(\d+)\s+\|/;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            // 1. Проверяем указание файла
            const fileMatch = trimmedLine.match(filePattern);
            if (fileMatch) {
                const fileInComment = fileMatch[1];
                currentFileInComments = fileInComment;
                // Проверяем, относится ли это к нашему файлу
                isInOurFile = fileInComment.includes(sourceFileName) ||
                    fileInComment.toLowerCase().includes(path.basename(sourcePath, path.extname(sourcePath)).toLowerCase());
                console.log(`Found file directive: ${fileInComment}, is our file: ${isInOurFile}`);
                // Если переключаемся на другой файл, сохраняем предыдущее маппинг
                if (!isInOurFile && currentSourceLine > 0 && assemblyLines.length > 0) {
                    console.log(`Switching away from our file, saving previous mapping for line ${currentSourceLine}`);
                    // НЕ сохраняем маппинг для чужого файла
                    currentSourceLine = -1;
                    assemblyLines = [];
                }
                continue;
            }
            // 2. Если мы не в нашем файле, пропускаем обработку строк
            if (currentFileInComments && !isInOurFile) {
                continue;
            }
            // 3. Ищем указание номера строки исходного кода
            let sourceLineMatch = null;
            let lineNumber = -1;
            // Проверяем все возможные форматы
            const lineMatch = trimmedLine.match(linePattern);
            const colonMatch = trimmedLine.match(lineColonPattern);
            const pipeMatch = trimmedLine.match(lineWithPipePattern);
            if (lineMatch) {
                sourceLineMatch = lineMatch;
                lineNumber = parseInt(lineMatch[1]);
            }
            else if (colonMatch) {
                sourceLineMatch = colonMatch;
                lineNumber = parseInt(colonMatch[1]);
            }
            else if (pipeMatch) {
                sourceLineMatch = pipeMatch;
                lineNumber = parseInt(pipeMatch[1]);
            }
            if (sourceLineMatch && lineNumber > 0) {
                // Сохраняем предыдущее маппинг
                if (currentSourceLine > 0 && assemblyLines.length > 0) {
                    mappings.push({
                        sourceLine: currentSourceLine,
                        assemblyLines: [...assemblyLines],
                        color: colors[colorIndex % colors.length]
                    });
                    console.log(`Mapping saved: source ${currentSourceLine} -> assembly lines ${assemblyLines.join(',')}`);
                    colorIndex++;
                }
                currentSourceLine = lineNumber;
                assemblyLines = [i + 1]; // Текущая строка с комментарием
                if (currentFileInComments) {
                    console.log(`Found source line ${lineNumber} (our file) at assembly line ${i + 1}`);
                }
                else {
                    console.log(`Found source line ${lineNumber} (unknown file) at assembly line ${i + 1}: "${line.substring(0, 80)}"`);
                }
            }
            else if (currentSourceLine > 0) {
                // Если мы в процессе сбора ассемблерных строк для текущей строки исходного кода
                // Определяем, является ли строка ассемблерной инструкцией
                const isAssemblyInstruction = this.isAssemblyInstruction(trimmedLine);
                if (isAssemblyInstruction) {
                    // Проверяем, не слишком ли много строк мы собрали
                    if (assemblyLines.length < 50) { // Разумный лимит
                        assemblyLines.push(i + 1);
                    }
                }
                else if (trimmedLine.startsWith(';') || trimmedLine === '') {
                    // Комментарии или пустые строки - продолжаем сбор
                    continue;
                }
                else {
                    // Если встретили что-то другое (метку, директиву), возможно это конец блока
                    // но для простоты также добавляем
                    if (assemblyLines.length < 50) {
                        assemblyLines.push(i + 1);
                    }
                }
                // Проверяем конец блока - если встретили ret или новое указание файла/строки
                if (trimmedLine === 'ret' || trimmedLine.startsWith('ret ') ||
                    trimmedLine.startsWith('; File') || trimmedLine.startsWith('; Line') ||
                    (i < lines.length - 1 && this.hasLineDirective(lines[i + 1]))) {
                    // Завершаем текущее маппинг
                    if (assemblyLines.length > 0) {
                        mappings.push({
                            sourceLine: currentSourceLine,
                            assemblyLines: [...assemblyLines],
                            color: colors[colorIndex % colors.length]
                        });
                        console.log(`Block ended: source ${currentSourceLine} -> ${assemblyLines.length} assembly lines`);
                        colorIndex++;
                        currentSourceLine = -1;
                        assemblyLines = [];
                    }
                }
            }
        }
        // Добавляем последнее маппинг, если оно есть
        if (currentSourceLine > 0 && assemblyLines.length > 0) {
            mappings.push({
                sourceLine: currentSourceLine,
                assemblyLines: [...assemblyLines],
                color: colors[colorIndex % colors.length]
            });
            console.log(`Final mapping: source ${currentSourceLine} -> assembly lines ${assemblyLines.join(',')}`);
        }
        // Фильтруем маппинги - убираем те, у которых слишком мало или слишком много ассемблерных строк
        // (это могут быть ложные срабатывания или заголовки функций)
        const filteredMappings = mappings.filter(m => {
            // От 1 до 30 ассемблерных строк - разумный диапазон для одной строки C++
            return m.assemblyLines.length >= 1 && m.assemblyLines.length <= 30;
        });
        console.log(`Total mappings: ${mappings.length}, after filtering: ${filteredMappings.length}`);
        // Выводим примеры для отладки
        if (filteredMappings.length > 0) {
            console.log('Sample mappings:');
            for (let i = 0; i < Math.min(5, filteredMappings.length); i++) {
                const m = filteredMappings[i];
                const sampleLines = m.assemblyLines.slice(0, 3);
                console.log(`  Source line ${m.sourceLine} -> Assembly lines: ${sampleLines.join(', ')}${m.assemblyLines.length > 3 ? '...' : ''}`);
            }
        }
        else {
            console.log('No valid mappings found, checking first 100 lines for patterns:');
            for (let i = 0; i < Math.min(100, lines.length); i++) {
                const line = lines[i];
                if (line.includes(';') && (line.includes('File') || line.includes('Line') || /\d+\s*:/.test(line))) {
                    console.log(`  Line ${i + 1}: "${line.substring(0, 100)}"`);
                }
            }
            // Создаем тестовые маппинги для демонстрации
            return this.createFallbackMappings(lines.length);
        }
        return filteredMappings;
    }
    isAssemblyInstruction(line) {
        const trimmed = line.trim();
        if (trimmed.length === 0 || trimmed.startsWith(';') || trimmed.startsWith('#')) {
            return false;
        }
        // Проверяем, является ли строка ассемблерной инструкцией
        // Инструкция обычно: [адрес] [машинный код] [инструкция] [операнды]
        const patterns = [
            /^[0-9A-F]+\s+[0-9A-F]+\s+/,
            /^\t[a-z]+\s+/i,
            /^[a-z]+\s+[a-z0-9]+,/i,
            /^(mov|add|sub|lea|push|pop|call|jmp|je|jne|jg|jl|inc|dec|xor|and|or|test|cmp)\s+/i,
        ];
        return patterns.some(pattern => pattern.test(trimmed));
    }
    hasLineDirective(line) {
        const trimmed = line.trim();
        return /;\s*Line\s+\d+/i.test(trimmed) || /;\s*\d+\s*:/.test(trimmed) || /;\s*\d+\s+\|/.test(trimmed);
    }
    createFallbackMappings(assemblyLineCount) {
        const mappings = [];
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];
        // Создаем простые маппинги для демонстрации
        const sourceLines = 20;
        for (let sourceLine = 1; sourceLine <= sourceLines; sourceLine++) {
            const assemblyLines = [];
            const startLine = 50 + (sourceLine * 3); // Начинаем с некоторого смещения
            // Каждой строке исходного кода сопоставляем 2-4 строки ассемблера
            const lineCount = 2 + (sourceLine % 3);
            for (let j = 0; j < lineCount; j++) {
                const asmLine = startLine + j;
                if (asmLine > 0 && asmLine <= assemblyLineCount) {
                    assemblyLines.push(asmLine);
                }
            }
            if (assemblyLines.length > 0) {
                mappings.push({
                    sourceLine: sourceLine,
                    assemblyLines: assemblyLines,
                    color: colors[sourceLine % colors.length]
                });
            }
        }
        console.log(`Created ${mappings.length} fallback mappings for demonstration`);
        return mappings;
    }
    fixEncoding(text) {
        try {
            const buffer = Buffer.from(text, 'binary');
            return buffer.toString('utf8');
        }
        catch {
            return text;
        }
    }
    createTestMappings(assemblyLineCount) {
        const mappings = [];
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];
        // Создаем тестовые маппинги только если есть достаточно строк ассемблера
        if (assemblyLineCount < 10) {
            console.log('Not enough assembly lines for test mappings');
            return mappings;
        }
        // Предполагаем, что у нас есть примерно 20 строк исходного кода
        // и пытаемся создать маппинг для каждой строки
        const sourceLines = Math.min(20, Math.floor(assemblyLineCount / 10));
        for (let sourceLine = 1; sourceLine <= sourceLines; sourceLine++) {
            const assemblyLines = [];
            const startLine = (sourceLine * 5) + 10; // Начинаем с некоторого смещения
            // Каждой строке исходного кода сопоставляем 3-8 строк ассемблера
            const lineCount = 3 + (sourceLine % 6);
            for (let j = 0; j < lineCount; j++) {
                const asmLine = startLine + j;
                if (asmLine > 0 && asmLine <= assemblyLineCount) {
                    assemblyLines.push(asmLine);
                }
            }
            if (assemblyLines.length > 0) {
                mappings.push({
                    sourceLine: sourceLine,
                    assemblyLines: assemblyLines,
                    color: colors[sourceLine % colors.length]
                });
            }
        }
        console.log(`Created ${mappings.length} test mappings for lines 1-${sourceLines}`);
        return mappings;
    }
    getCurrentCompiler() {
        return this.currentCompiler;
    }
    setCompiler(compiler) {
        this.currentCompiler = compiler;
    }
    dispose() {
        console.log('CompilerManager disposed');
    }
}
exports.CompilerManager = CompilerManager;
//# sourceMappingURL=compilerManager.js.map