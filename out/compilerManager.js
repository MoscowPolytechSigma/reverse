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
class CompilerManager {
    constructor() {
        this.config = vscode.workspace.getConfiguration('cpp-asm-viewer');
    }
    async autoDetectCompiler() {
        // Try MSVC first
        const msvc = await this.detectMSVC();
        if (msvc) {
            this.currentCompiler = msvc;
            vscode.window.showInformationMessage(`Found MSVC compiler: ${msvc.version}`);
            return msvc;
        }
        // Try GCC
        const gcc = await this.detectGCC();
        if (gcc) {
            this.currentCompiler = gcc;
            vscode.window.showInformationMessage(`Found GCC compiler: ${gcc.version}`);
            return gcc;
        }
        // Try Clang
        const clang = await this.detectClang();
        if (clang) {
            this.currentCompiler = clang;
            vscode.window.showInformationMessage(`Found Clang compiler: ${clang.version}`);
            return clang;
        }
        vscode.window.showWarningMessage('No C++ compiler found. Please configure manually.');
        return undefined;
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
                // Теперь basePath гарантированно строка и существует
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
                    error: 'No compiler available. Please configure a C++ compiler.'
                };
            }
        }
        const compiler = this.currentCompiler;
        // Для MSVC устанавливаем правильное окружение
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
                error: 'Cannot find vcvarsall.bat. Please make sure Visual Studio is installed correctly.'
            };
        }
        const args = this.getCompilerArgs(sourcePath);
        return new Promise((resolve) => {
            try {
                const compilerCommand = compiler.path.includes(' ') ? `"${compiler.path}"` : compiler.path;
                const sourceFile = sourcePath.includes(' ') ? `"${sourcePath}"` : sourcePath;
                const vcvarsall = vcvarsallPath.includes(' ') ? `"${vcvarsallPath}"` : vcvarsallPath;
                const fullCommand = `chcp 65001 > nul && ${vcvarsall} x64 && ${compilerCommand} ${args.join(' ')} ${sourceFile}`;
                console.log('Executing command:', fullCommand);
                cp.exec(fullCommand, {
                    cwd: path.dirname(sourcePath),
                    encoding: 'utf8',
                    maxBuffer: 10 * 1024 * 1024
                }, (error, stdout, stderr) => {
                    if (error) {
                        const errorMessage = stderr || stdout || `Compiler exited with code ${error.code}`;
                        resolve({
                            success: false,
                            error: this.fixEncoding(errorMessage)
                        });
                    }
                    else {
                        const asmFile = sourcePath.replace(/\.(cpp|c)$/, '.asm');
                        if (fs.existsSync(asmFile)) {
                            try {
                                const assembly = fs.readFileSync(asmFile, 'utf8');
                                console.log('Assembly file content (first 50 lines):');
                                console.log(assembly.split('\n').slice(0, 50).join('\n'));
                                const mappings = this.parseMappings(assembly, sourcePath);
                                // НЕ удаляем временные файлы для отладки
                                // this.cleanupTempFiles(sourcePath);
                                resolve({
                                    success: true,
                                    assembly: assembly,
                                    sourceFile: sourcePath,
                                    mappings: mappings
                                });
                            }
                            catch (readError) {
                                resolve({
                                    success: false,
                                    error: `Failed to read assembly file: ${readError.message}`
                                });
                            }
                        }
                        else {
                            resolve({
                                success: false,
                                error: `Assembly file not found at: ${asmFile}. Compiler output: ${stdout}${stderr}`
                            });
                        }
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
    // Функция для исправления проблем с кодировкой
    fixEncoding(text) {
        // Пытаемся исправить русский текст в разных кодировках
        try {
            // Если текст в CP866 (стандартная кодировка Windows консоли)
            const buffer = Buffer.from(text, 'binary');
            return buffer.toString('utf8');
        }
        catch {
            return text;
        }
    }
    // Очистка временных файлов
    cleanupTempFiles(sourcePath) {
        const baseName = sourcePath.replace(/\.(cpp|c)$/, '');
        const filesToClean = [
            `${baseName}.asm`,
            `${baseName}.obj`,
            `${baseName}.exe`
        ];
        filesToClean.forEach(file => {
            if (fs.existsSync(file)) {
                try {
                    fs.unlinkSync(file);
                }
                catch {
                    // Игнорируем ошибки удаления
                }
            }
        });
    }
    getCompilerArgs(sourcePath) {
        const baseArgs = this.config.get('compilerArgs', '/Od /c /Zi').split(' ');
        const outputType = this.config.get('outputType', 'asm');
        let args = [...baseArgs];
        if (this.currentCompiler?.type === 'msvc') {
            if (!args.includes('/nologo')) {
                args.unshift('/nologo');
            }
            // Убедимся, что есть флаги для отладочной информации
            if (!args.some(arg => arg.startsWith('/Z'))) {
                args.push('/Zi'); // Генерация отладочной информации
            }
            // Удаляем все существующие флаги /FA* чтобы избежать конфликтов
            args = args.filter(arg => !arg.startsWith('/FA'));
            // Добавляем правильный флаг в зависимости от outputType
            switch (outputType) {
                case 'asm+hex':
                    args.push('/FAsc');
                    break;
                case 'asm+hex+addr':
                    args.push('/FAscu');
                    break;
                default: // 'asm'
                    args.push('/FAs'); // Assembly with source code
            }
            if (!args.some(arg => arg.startsWith('/std:'))) {
                args.push('/std:c++17');
            }
        }
        else if (this.currentCompiler?.type === 'gcc' || this.currentCompiler?.type === 'clang') {
            // Удаляем флаги MSVC если они есть
            args = args.filter(arg => !arg.startsWith('/'));
            args.push('-S', '-fverbose-asm', '-g');
            if (outputType === 'asm+hex' || outputType === 'asm+hex+addr') {
                args.push('-masm=intel');
            }
            if (!args.some(arg => arg.startsWith('-std='))) {
                args.push('-std=c++17');
            }
        }
        console.log('Final compiler args:', args);
        return args;
    }
    parseMappings(assembly, sourcePath) {
        const mappings = [];
        const lines = assembly.split('\n');
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
        console.log('Starting to parse mappings from assembly code');
        console.log('Total assembly lines:', lines.length);
        let currentSourceLine = -1;
        let assemblyLines = [];
        let colorIndex = 0;
        // Получаем только имя файла для поиска в комментариях
        const sourceFileName = path.basename(sourcePath);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Пытаемся найти разные форматы маппингов:
            // 1. MSVC с исходным кодом: "; 15   : int x = 5;"
            const msvcSourceMatch = line.match(/;(\s+)(\d+)(\s+):/);
            // 2. MSVC с именем файла: "; File: d:\path\file.cpp"
            const msvcFileMatch = line.match(/; File:\s*(.+)/);
            // 3. MSVC номер строки: "; Line 15"
            const msvcLineMatch = line.match(/; Line\s+(\d+)/i);
            // 4. GCC/Clang формат: "#15 \"file.cpp\""
            const gccMatch = line.match(/#\s*(\d+)\s*"/);
            let lineNumber = -1;
            if (msvcSourceMatch) {
                lineNumber = parseInt(msvcSourceMatch[2]);
                console.log(`Found MSVC source mapping: line ${lineNumber} at assembly line ${i + 1}`);
            }
            else if (msvcLineMatch) {
                lineNumber = parseInt(msvcLineMatch[1]);
                console.log(`Found MSVC line directive: line ${lineNumber} at assembly line ${i + 1}`);
            }
            else if (gccMatch) {
                lineNumber = parseInt(gccMatch[1]);
                console.log(`Found GCC mapping: line ${lineNumber} at assembly line ${i + 1}`);
            }
            if (lineNumber > 0) {
                // Сохраняем предыдущий маппинг
                if (currentSourceLine > 0 && assemblyLines.length > 0) {
                    mappings.push({
                        sourceLine: currentSourceLine,
                        assemblyLines: [...assemblyLines],
                        color: colors[colorIndex % colors.length]
                    });
                    console.log(`Saved mapping: ${currentSourceLine} -> ${assemblyLines.join(',')}`);
                    colorIndex++;
                }
                // Начинаем новый маппинг
                currentSourceLine = lineNumber;
                assemblyLines = [i + 1];
            }
            else if (currentSourceLine > 0) {
                // Если это не комментарий и не директива, добавляем к текущему маппингу
                if (line &&
                    !line.startsWith(';') &&
                    !line.startsWith('#') &&
                    !line.startsWith('.') &&
                    !line.includes('@eh') &&
                    !line.includes('DEBUG') &&
                    !line.startsWith('//')) {
                    assemblyLines.push(i + 1);
                }
            }
        }
        // Добавляем последний маппинг
        if (currentSourceLine > 0 && assemblyLines.length > 0) {
            mappings.push({
                sourceLine: currentSourceLine,
                assemblyLines: [...assemblyLines],
                color: colors[colorIndex % colors.length]
            });
            console.log(`Final mapping: ${currentSourceLine} -> ${assemblyLines.join(',')}`);
        }
        console.log(`Total mappings found: ${mappings.length}`);
        // Если маппингов нет, создаем тестовые
        if (mappings.length === 0) {
            console.log('No mappings found, creating test mappings');
            return this.createTestMappings(lines.length);
        }
        return mappings;
    }
    // Временный метод для создания тестовых маппингов
    createTestMappings(assemblyLineCount) {
        const mappings = [];
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];
        // Создаем искусственные маппинги для тестирования
        for (let i = 1; i <= 10; i++) {
            const assemblyLines = [];
            // Каждой строке C++ ставим в соответствие 3-5 строк ассемблера
            for (let j = 0; j < 3 + (i % 3); j++) {
                const asmLine = (i * 5 + j) % assemblyLineCount;
                if (asmLine > 0 && asmLine <= assemblyLineCount) {
                    assemblyLines.push(asmLine);
                }
            }
            if (assemblyLines.length > 0) {
                mappings.push({
                    sourceLine: i,
                    assemblyLines: assemblyLines,
                    color: colors[i % colors.length]
                });
            }
        }
        console.log(`Created ${mappings.length} test mappings`);
        return mappings;
    }
    // Добавляем метод dispose для совместимости с VS Code API
    dispose() {
        // Cleanup if needed
        console.log('CompilerManager disposed');
    }
    getCurrentCompiler() {
        return this.currentCompiler;
    }
    setCompiler(compiler) {
        this.currentCompiler = compiler;
    }
}
exports.CompilerManager = CompilerManager;
//# sourceMappingURL=compilerManager.js.map