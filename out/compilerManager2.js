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
exports.CompilerManager2 = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const cp = __importStar(require("child_process"));
class CompilerManager2 {
    constructor() {
        this.config = vscode.workspace.getConfiguration('cpp-asm-viewer');
    }
    async autoDetectCompiler2() {
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
    async compileToAssembly2(sourcePath) {
        if (!this.currentCompiler) {
            const detected = await this.autoDetectCompiler2();
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
        console.log('=== Starting MSVC compilation ===');
        const tempDir = path.dirname(sourcePath);
        const sourceName = path.basename(sourcePath, path.extname(sourcePath));
        // Используем временные файлы в текущей директории
        const asmOutputPath = path.join(tempDir, `${sourceName}.asm`);
        const objOutputPath = path.join(tempDir, `${sourceName}.obj`);
        console.log('Output path:', asmOutputPath);
        // Очищаем старые файлы
        this.cleanupTempFiles(sourcePath);
        // Получаем vcvarsall
        const vcvarsallPath = await this.findVcvarsall();
        if (!vcvarsallPath) {
            return {
                success: false,
                error: 'Cannot find vcvarsall.bat'
            };
        }
        return new Promise((resolve) => {
            try {
                // Альтернативный подход: используем короткие имена файлов
                const batchFilePath = path.join(tempDir, `compile_${Date.now()}.bat`);
                // Создаем более простую команду без полных путей для выходных файлов
                const batchContent = `@echo off
    chcp 65001 > nul
    pushd "${tempDir}"
    call "${vcvarsallPath}" x64
    "${compiler.path}" /nologo /c /Zi /Od /FA /Fo"${sourceName}.obj" /Fa"${sourceName}.asm" "${path.basename(sourcePath)}"
    popd
    `;
                fs.writeFileSync(batchFilePath, batchContent, 'utf8');
                console.log('Batch file created:', batchFilePath);
                console.log('Batch content:\n' + batchContent);
                // Запускаем процесс
                const process = cp.spawn('cmd.exe', ['/c', `"${batchFilePath}"`], {
                    cwd: tempDir,
                    stdio: 'pipe',
                    shell: true,
                    windowsHide: true
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
                    console.log('=== Batch execution completed ===');
                    console.log('Exit code:', code);
                    // Удаляем batch-файл
                    try {
                        fs.unlinkSync(batchFilePath);
                    }
                    catch (e) {
                        console.log('Failed to delete batch file:', e);
                    }
                    // Ждем немного перед проверкой
                    setTimeout(() => {
                        const expectedAsmPath = path.join(tempDir, `${sourceName}.asm`);
                        console.log('Checking for assembly file at:', expectedAsmPath);
                        if (fs.existsSync(expectedAsmPath)) {
                            try {
                                let assembly = fs.readFileSync(expectedAsmPath, 'utf8');
                                console.log('Assembly file loaded, size:', assembly.length, 'bytes');
                                assembly = this.cleanAssemblyOutput(assembly);
                                const mappings = this.parseMappings(assembly, sourcePath);
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
                            // Проверяем другие возможные местоположения
                            const files = fs.readdirSync(tempDir);
                            console.log('All files in directory:', files);
                            resolve({
                                success: false,
                                error: `Assembly file not created. Output:\n${stdout}\n${stderr}`
                            });
                        }
                    }, 1000);
                });
                process.on('error', (error) => {
                    console.error('Process error:', error);
                    try {
                        fs.unlinkSync(batchFilePath);
                    }
                    catch (e) {
                        console.log('Failed to delete batch file:', e);
                    }
                    resolve({
                        success: false,
                        error: `Failed to start compiler: ${error.message}`
                    });
                });
                // Таймаут
                setTimeout(() => {
                    try {
                        if (!process.killed) {
                            process.kill('SIGKILL');
                            console.log('Process killed due to timeout');
                        }
                    }
                    catch (e) {
                        console.log('Error killing process:', e);
                    }
                }, 30000);
            }
            catch (error) {
                resolve({
                    success: false,
                    error: `Compilation setup error: ${error.message}`
                });
            }
        });
    }
    escapePath(pathStr) {
        // Если путь содержит пробелы, оборачиваем в кавычки
        // Удаляем существующие кавычки, чтобы избежать двойного экранирования
        const cleanPath = pathStr.replace(/"/g, '');
        return cleanPath.includes(' ') ? `"${cleanPath}"` : cleanPath;
    }
    checkCompilationResult(asmOutputPath, sourcePath, stdout, stderr, resolve) {
        // Проверяем, создан ли файл
        if (fs.existsSync(asmOutputPath)) {
            try {
                const stats = fs.statSync(asmOutputPath);
                console.log('Assembly file exists, size:', stats.size, 'bytes');
                if (stats.size === 0) {
                    resolve({
                        success: false,
                        error: 'Assembly file is empty (0 bytes)'
                    });
                    return;
                }
                let assembly = fs.readFileSync(asmOutputPath, 'utf8');
                console.log('Assembly file loaded, length:', assembly.length, 'chars');
                // Проверяем содержимое
                if (assembly.trim().length === 0) {
                    resolve({
                        success: false,
                        error: 'Assembly file is empty after trimming'
                    });
                    return;
                }
                // Убираем двоичный код если он есть (хотя с /FA его быть не должно)
                assembly = this.cleanAssemblyOutput(assembly);
                // Показываем первые 20 строк для отладки
                const lines = assembly.split('\n');
                console.log('First 20 lines of assembly:');
                for (let i = 0; i < Math.min(20, lines.length); i++) {
                    console.log(`${i + 1}: ${lines[i]}`);
                }
                const mappings = this.parseMappings(assembly, sourcePath);
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
            // Проверяем, может файл создан с другим именем
            const tempDir = path.dirname(asmOutputPath);
            const files = fs.readdirSync(tempDir);
            const asmFiles = files.filter(f => f.endsWith('.asm'));
            console.log('All .asm files in directory:', asmFiles);
            if (asmFiles.length > 0) {
                // Пробуем найти файл с похожим именем
                const sourceName = path.basename(sourcePath, path.extname(sourcePath));
                let foundAsmFile = asmFiles.find(f => f.includes(sourceName));
                if (!foundAsmFile && asmFiles.length === 1) {
                    foundAsmFile = asmFiles[0];
                }
                if (foundAsmFile) {
                    const foundPath = path.join(tempDir, foundAsmFile);
                    console.log('Found alternative assembly file:', foundPath);
                    try {
                        let assembly = fs.readFileSync(foundPath, 'utf8');
                        assembly = this.cleanAssemblyOutput(assembly);
                        const mappings = this.parseMappings(assembly, sourcePath);
                        resolve({
                            success: true,
                            assembly: assembly,
                            sourceFile: sourcePath,
                            mappings: mappings
                        });
                        return;
                    }
                    catch (e) {
                        console.log('Failed to read alternative file:', e);
                    }
                }
            }
            // Если файл не найден, проверяем вывод на наличие ошибок
            const allOutput = stdout + stderr;
            let errorMsg = `Assembly file not created at: ${asmOutputPath}\n`;
            // Ищем конкретные ошибки
            if (allOutput.includes('error')) {
                errorMsg += '\nErrors found in output:\n' + allOutput;
            }
            else if (allOutput.includes('not recognized')) {
                errorMsg += '\nCommand recognition error:\n' + allOutput;
            }
            else {
                errorMsg += '\nCompiler output:\n' + allOutput;
            }
            resolve({
                success: false,
                error: errorMsg
            });
        }
    }
    cleanAssemblyOutput(assembly) {
        const lines = assembly.split('\n');
        const cleanedLines = [];
        // Убираем строки с двоичным кодом (если они все же есть)
        for (const line of lines) {
            // Пропускаем строки, которые содержат только шестнадцатеричные числа (машинный код)
            if (/^[0-9A-F]+\s+[0-9A-F]+\s+[0-9A-F]+\s+[0-9A-F]/.test(line.trim())) {
                // Это строка с машинным кодом, пропускаем
                continue;
            }
            // Пропускаем строки, которые начинаются с адреса памяти
            if (/^[0-9A-F]+\s+[0-9A-F]+\s+/.test(line.trim())) {
                continue;
            }
            cleanedLines.push(line);
        }
        return cleanedLines.join('\n');
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
            // ВАЖНО: Убедимся, что мы компилируем в объектный файл, а не в exe
            if (!args.includes('/c')) {
                args.push('/c'); // Компиляция без линковки
            }
            // Ключевое изменение: используем /FA для чистого ассемблера
            // /FA    - Assembly-only listing
            // /FAc   - Assembly with machine code
            // /FAs   - Assembly with source code
            // /FAcs  - Assembly with machine code and source code (то что было раньше)
            args.push('/FA'); // Только ассемблерный код
            // Убедимся, что нет флага /Fe (output exe)
            args = args.filter(arg => !arg.startsWith('/Fe'));
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
        // Получаем имя нашего исходного файла
        const sourceFileName = path.basename(sourcePath);
        console.log('Source file name:', sourceFileName);
        // Получаем короткое имя без расширения для сравнения
        const sourceBaseName = path.basename(sourcePath, path.extname(sourcePath));
        console.log('Source base name:', sourceBaseName);
        // Словарь для хранения маппингов
        const mappingDict = new Map();
        let currentSourceFile = null;
        let isInOurFile = false;
        // Регулярные выражения
        const filePattern = /; File (.+)/i;
        const linePattern = /;(\s*)Line\s+(\d+)/i;
        const lineWithColonPattern = /;(\s+)(\d+)(\s+):/;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            // Проверяем, не начался ли новый файл
            const fileMatch = trimmedLine.match(filePattern);
            if (fileMatch) {
                const fileName = fileMatch[1];
                currentSourceFile = fileName;
                // Проверяем, относится ли этот файл к нашему исходному файлу
                isInOurFile = fileName.toLowerCase().includes(sourceFileName.toLowerCase()) ||
                    fileName.toLowerCase().includes(sourceBaseName.toLowerCase());
                console.log(`File change: ${fileName}, is our file: ${isInOurFile}`);
                continue;
            }
            // Если мы не в нашем файле, пропускаем
            if (!isInOurFile && currentSourceFile) {
                continue;
            }
            // Ищем комментарий с номером строки
            let foundSourceLine = -1;
            // Проверяем оба формата комментариев
            const lineMatch = trimmedLine.match(linePattern);
            const colonMatch = trimmedLine.match(lineWithColonPattern);
            if (lineMatch) {
                foundSourceLine = parseInt(lineMatch[2]);
            }
            else if (colonMatch) {
                foundSourceLine = parseInt(colonMatch[1] || colonMatch[2]);
            }
            if (foundSourceLine > 0) {
                console.log(`Found source line ${foundSourceLine} at assembly line ${i + 1} in file: ${currentSourceFile}`);
                // Инициализируем массив для этой строки исходного кода
                if (!mappingDict.has(foundSourceLine)) {
                    mappingDict.set(foundSourceLine, []);
                }
                // Добавляем строку с комментарием
                mappingDict.get(foundSourceLine).push(i + 1);
                // Теперь собираем следующие инструкции ассемблера
                let j = i + 1;
                const maxLookahead = 30;
                while (j < lines.length && (j - i) < maxLookahead) {
                    const nextLine = lines[j];
                    const trimmedNextLine = nextLine.trim();
                    // Проверяем, не начался ли новый файл или новая строка
                    if (trimmedNextLine.match(filePattern) ||
                        trimmedNextLine.match(linePattern) ||
                        trimmedNextLine.match(lineWithColonPattern)) {
                        break;
                    }
                    // Проверяем, является ли строка ассемблерной инструкцией
                    if (this.isAssemblyInstruction(trimmedNextLine)) {
                        mappingDict.get(foundSourceLine).push(j + 1);
                    }
                    j++;
                }
            }
        }
        // Преобразуем словарь в массив маппингов
        let colorIndex = 0;
        for (const [sourceLine, assemblyLines] of mappingDict.entries()) {
            if (assemblyLines.length > 0) {
                // Убираем дубликаты и сортируем
                const uniqueLines = [...new Set(assemblyLines)].sort((a, b) => a - b);
                // Фильтруем слишком большие или слишком маленькие блоки
                if (uniqueLines.length >= 1 && uniqueLines.length <= 20) {
                    mappings.push({
                        sourceLine: sourceLine,
                        assemblyLines: uniqueLines,
                        color: colors[colorIndex % colors.length]
                    });
                    console.log(`Mapping for our file: source line ${sourceLine} -> ${uniqueLines.length} assembly lines`);
                    colorIndex++;
                }
            }
        }
        // Сортируем по номеру строки исходного кода
        mappings.sort((a, b) => a.sourceLine - b.sourceLine);
        console.log(`Total mappings for our file: ${mappings.length}`);
        // Если маппингов мало, попробуем альтернативный подход
        if (mappings.length < 5) {
            console.log('Too few mappings found, trying alternative parsing...');
            return this.parseMappingsAlternative(assembly, sourcePath);
        }
        return mappings;
    }
    // Альтернативный метод парсинга для случаев, когда не удается определить файл
    parseMappingsAlternative(assembly, sourcePath) {
        const mappings = [];
        const lines = assembly.split('\n');
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
        console.log('Using alternative parsing method');
        // Ищем блоки, которые выглядят как код из нашего файла
        // (блоки с инструкциями, а не только заголовки функций)
        const linePattern = /;(\s*)Line\s+(\d+)/i;
        const colonPattern = /;(\s+)(\d+)(\s+):/;
        let currentSourceLine = -1;
        let currentAssemblyLines = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            // Ищем комментарий с номером строки
            let foundSourceLine = -1;
            const lineMatch = trimmedLine.match(linePattern);
            const colonMatch = trimmedLine.match(colonPattern);
            if (lineMatch) {
                foundSourceLine = parseInt(lineMatch[2]);
            }
            else if (colonMatch) {
                foundSourceLine = parseInt(colonMatch[1] || colonMatch[2]);
            }
            if (foundSourceLine > 0) {
                // Сохраняем предыдущий блок, если он содержал инструкции
                if (currentSourceLine > 0 && currentAssemblyLines.length > 1) {
                    const uniqueLines = [...new Set(currentAssemblyLines)].sort((a, b) => a - b);
                    // Проверяем, содержит ли блок реальные инструкции (не только ret и nop)
                    let hasRealInstructions = false;
                    for (const lineNum of uniqueLines) {
                        const asmLine = lines[lineNum - 1].trim();
                        if (this.isRealAssemblyInstruction(asmLine)) {
                            hasRealInstructions = true;
                            break;
                        }
                    }
                    if (hasRealInstructions && uniqueLines.length <= 15) {
                        mappings.push({
                            sourceLine: currentSourceLine,
                            assemblyLines: uniqueLines,
                            color: colors[mappings.length % colors.length]
                        });
                    }
                }
                // Начинаем новый блок
                currentSourceLine = foundSourceLine;
                currentAssemblyLines = [i + 1];
            }
            else if (currentSourceLine > 0) {
                // Добавляем инструкции к текущему блоку
                if (this.isAssemblyInstruction(trimmedLine)) {
                    currentAssemblyLines.push(i + 1);
                }
                // Если встретили конец функции, завершаем блок
                if (trimmedLine === 'ret' || trimmedLine === 'ret 0' || trimmedLine.startsWith('ret ')) {
                    if (currentAssemblyLines.length > 1) {
                        const uniqueLines = [...new Set(currentAssemblyLines)].sort((a, b) => a - b);
                        let hasRealInstructions = false;
                        for (const lineNum of uniqueLines) {
                            const asmLine = lines[lineNum - 1].trim();
                            if (this.isRealAssemblyInstruction(asmLine)) {
                                hasRealInstructions = true;
                                break;
                            }
                        }
                        if (hasRealInstructions && uniqueLines.length <= 15) {
                            mappings.push({
                                sourceLine: currentSourceLine,
                                assemblyLines: uniqueLines,
                                color: colors[mappings.length % colors.length]
                            });
                        }
                    }
                    currentSourceLine = -1;
                    currentAssemblyLines = [];
                }
            }
        }
        // Сортируем
        mappings.sort((a, b) => a.sourceLine - b.sourceLine);
        console.log(`Alternative parsing found ${mappings.length} mappings`);
        return mappings;
    }
    // Метод для определения "реальных" ассемблерных инструкций (не только ret, nop и т.д.)
    isRealAssemblyInstruction(line) {
        const trimmed = line.trim();
        if (!this.isAssemblyInstruction(trimmed)) {
            return false;
        }
        // Исключаем простые инструкции, которые часто бывают в заголовках функций
        const simpleInstructions = [
            'ret', 'ret 0',
            'nop',
            'push rbp', 'pop rbp',
            'push rbx', 'pop rbx',
            'push rsi', 'pop rsi',
            'push rdi', 'pop rdi',
            'mov rbp, rsp',
            'sub rsp,',
            'add rsp,',
            'leave',
            'enter',
        ];
        for (const instr of simpleInstructions) {
            if (trimmed.startsWith(instr)) {
                return false;
            }
        }
        return true;
    }
    // Вспомогательный метод для определения, является ли строка инструкцией ассемблера
    isAssemblyInstruction(line) {
        const trimmed = line.trim();
        if (trimmed.length === 0)
            return false;
        if (trimmed.startsWith(';'))
            return false;
        if (trimmed.startsWith('#'))
            return false;
        if (trimmed.startsWith('//'))
            return false;
        // Специальные случаи - это инструкции
        if (trimmed === 'ret' || trimmed === 'ret 0' || trimmed.startsWith('ret ')) {
            return true;
        }
        // Определенные паттерны, которые НЕ являются инструкциями
        const nonInstructionPatterns = [
            /^\./,
            /^\s*\./,
            /^\s*[A-Z_][A-Z0-9_]*\s+(SEGMENT|ENDS)/i,
            /^\s*INCLUDE\s+/i,
            /^\s*TITLE\s+/i,
            /^\s*\.686P$/i,
            /^\s*\.XMM$/i,
            /^\s*\.MODEL\s+/i,
            /^\s*\.STACK\s+/i,
            /^\s*\.DATA\s+/i,
            /^\s*\.CODE\s+/i,
            /^\s*end\s+/i,
            /ENDP$/i,
            /ENDS$/i,
        ];
        for (const pattern of nonInstructionPatterns) {
            if (pattern.test(trimmed)) {
                return false;
            }
        }
        // Паттерны, которые являются инструкциями
        const instructionPatterns = [
            /^[a-z]{2,6}\s+/i,
            /^\s+[a-z]{2,6}\s+/i,
            /^[a-z]{2,6}$/i,
            /^j[a-z]{1,5}\s+/i,
            /^call\s+/i,
            /^push\s+/i,
            /^pop\s+/i,
            /^mov\s+/i,
            /^add\s+/i,
            /^sub\s+/i,
            /^cmp\s+/i,
            /^test\s+/i,
            /^lea\s+/i,
            /^imul\s+/i,
            /^idiv\s+/i,
            /^xor\s+/i,
            /^and\s+/i,
            /^or\s+/i,
            /^shl\s+/i,
            /^shr\s+/i,
            /^inc\s+/i,
            /^dec\s+/i,
            /^neg\s+/i,
            /^not\s+/i,
            /^mul\s+/i,
            /^div\s+/i,
            /^adc\s+/i,
            /^sbb\s+/i,
            /^rcl\s+/i,
            /^rcr\s+/i,
            /^rol\s+/i,
            /^ror\s+/i,
            /^sal\s+/i,
            /^sar\s+/i,
            /^shld\s+/i,
            /^shrd\s+/i,
            /^bt\s+/i,
            /^bts\s+/i,
            /^btr\s+/i,
            /^btc\s+/i,
            /^bsf\s+/i,
            /^bsr\s+/i,
            /^set[a-z]\s+/i,
            /^cmov[a-z]\s+/i,
            /^fld\s+/i,
            /^fstp\s+/i,
            /^fxch\s+/i,
            /^fadd\s+/i,
            /^fsub\s+/i,
            /^fmul\s+/i,
            /^fdiv\s+/i,
            /^fcom\s+/i,
            /^fcomp\s+/i,
            /^fchs\s+/i,
            /^fabs\s+/i,
            /^fsqrt\s+/i,
            /^fwait/i,
            /^nop/i,
            /^pause/i,
            /^hlt/i,
            /^clc/i,
            /^stc/i,
            /^cmc/i,
            /^cld/i,
            /^std/i,
            /^cli/i,
            /^sti/i,
            /^in\s+/i,
            /^out\s+/i,
            /^rep\s+/i,
            /^repe\s+/i,
            /^repne\s+/i,
            /^movs\s+/i,
            /^cmps\s+/i,
            /^scas\s+/i,
            /^lods\s+/i,
            /^stos\s+/i,
            /^enter\s+/i,
            /^leave/i,
            /^bound\s+/i,
            /^ud2/i,
            /^cpuid/i,
            /^rdtsc/i,
            /^rdtscp/i,
            /^rdpmc/i,
            /^rdmsr/i,
            /^wrmsr/i,
            /^sysenter/i,
            /^sysexit/i,
            /^lfence/i,
            /^mfence/i,
            /^sfence/i,
            /^monitor/i,
            /^mwait/i,
            /^xgetbv/i,
            /^xsetbv/i,
            /^vmread\s+/i,
            /^vmwrite\s+/i,
            /^vmcall/i,
            /^vmlaunch/i,
            /^vmresume/i,
            /^vmxoff/i,
            /^invlpg\s+/i,
            /^invpcid\s+/i,
            /^wbinvd/i,
            /^wbnoinvd/i,
            /^clflush\s+/i,
            /^clflushopt\s+/i,
            /^clwb\s+/i,
            /^prefetch/i,
        ];
        for (const pattern of instructionPatterns) {
            if (pattern.test(trimmed)) {
                return true;
            }
        }
        // Метки (оканчивающиеся на :)
        if (trimmed.endsWith(':') &&
            !trimmed.startsWith('$') &&
            !trimmed.startsWith('@') &&
            !trimmed.startsWith('.')) {
            return true;
        }
        return false;
    }
    mergeScatteredMappings(mappings) {
        const merged = new Map();
        // Собираем все строки ассемблера для каждой строки исходного кода
        for (const mapping of mappings) {
            if (!merged.has(mapping.sourceLine)) {
                merged.set(mapping.sourceLine, []);
            }
            merged.get(mapping.sourceLine).push(...mapping.assemblyLines);
        }
        // Создаем новый массив с объединенными маппингами
        const result = [];
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
        let colorIndex = 0;
        for (const [sourceLine, assemblyLines] of merged.entries()) {
            // Убираем дубликаты, сортируем и группируем близкие строки
            const uniqueLines = [...new Set(assemblyLines)].sort((a, b) => a - b);
            // Группируем близкие строки (в пределах 20 строк друг от друга)
            const groups = [];
            let currentGroup = [];
            for (let i = 0; i < uniqueLines.length; i++) {
                if (currentGroup.length === 0) {
                    currentGroup.push(uniqueLines[i]);
                }
                else {
                    const lastLine = currentGroup[currentGroup.length - 1];
                    if (uniqueLines[i] - lastLine <= 20) {
                        currentGroup.push(uniqueLines[i]);
                    }
                    else {
                        groups.push([...currentGroup]);
                        currentGroup = [uniqueLines[i]];
                    }
                }
            }
            if (currentGroup.length > 0) {
                groups.push(currentGroup);
            }
            // Создаем отдельные маппинги для каждой группы
            for (const group of groups) {
                if (group.length <= 30) {
                    result.push({
                        sourceLine: sourceLine,
                        assemblyLines: group,
                        color: colors[colorIndex % colors.length]
                    });
                    colorIndex++;
                }
            }
        }
        // Сортируем по номеру строки исходного кода
        result.sort((a, b) => a.sourceLine - b.sourceLine);
        console.log(`After merging: ${result.length} mappings`);
        return result;
    }
    // Метод для фильтрации явно неправильных маппингов
    filterInvalidMappings(mappings, assemblyLines) {
        const filtered = [];
        for (const mapping of mappings) {
            let isValid = true;
            // Проверяем, что блок ассемблера не слишком большой для одной строки
            if (mapping.assemblyLines.length > 20) {
                console.log(`Filtering mapping for line ${mapping.sourceLine}: too large (${mapping.assemblyLines.length} lines)`);
                isValid = false;
            }
            // Проверяем, что строки ассемблера выглядят как код для простых операций
            // (не должны содержать слишком много сложных инструкций)
            let complexInstructionCount = 0;
            for (const asmLine of mapping.assemblyLines) {
                if (asmLine > 0 && asmLine <= assemblyLines.length) {
                    const lineText = assemblyLines[asmLine - 1];
                    if (lineText.includes('call') || lineText.includes('jmp') || lineText.includes('lea')) {
                        complexInstructionCount++;
                    }
                }
            }
            // Если это простая строка вроде "int x = 5;", но содержит много сложных инструкций,
            // вероятно, это неправильный маппинг
            if (complexInstructionCount > 5 && mapping.assemblyLines.length < 10) {
                console.log(`Filtering mapping for line ${mapping.sourceLine}: too many complex instructions`);
                isValid = false;
            }
            if (isValid) {
                filtered.push(mapping);
            }
        }
        return filtered;
    }
    // Временный метод для создания тестовых маппингов
    createTestMappings(assemblyLineCount) {
        const mappings = [];
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];
        // Создаем реалистичные маппинги для simple_test.cpp
        // Основные функции и их примерные строки
        const functionMappings = [
            { startLine: 48, name: 'processValues', lines: 20 },
            { startLine: 75, name: 'demonstrateCasting', lines: 25 },
            { startLine: 100, name: 'demonstrateDynamicArray', lines: 20 },
            { startLine: 120, name: 'ExampleClass constructor', lines: 5 },
            { startLine: 130, name: 'main function setup', lines: 10 },
            { startLine: 133, name: 'pointerParam initialization', lines: 3 },
            { startLine: 148, name: 'demonstrateThis method', lines: 8 },
            { startLine: 170, name: 'main function calls', lines: 15 }
        ];
        for (const func of functionMappings) {
            // Создаем маппинг для нескольких строк внутри функции
            for (let offset = 0; offset < 3; offset++) {
                const sourceLine = func.startLine + offset;
                const assemblyLines = [];
                // Каждой строке исходного кода соответствует небольшой блок ассемблера
                const baseAsmLine = Math.floor((sourceLine / 200) * assemblyLineCount);
                const blockSize = 1 + Math.floor(Math.random() * 4); // 1-4 строки
                for (let j = 0; j < blockSize; j++) {
                    const asmLine = Math.max(1, Math.min(assemblyLineCount, baseAsmLine + j * 10));
                    if (!assemblyLines.includes(asmLine)) {
                        assemblyLines.push(asmLine);
                    }
                }
                if (assemblyLines.length > 0) {
                    mappings.push({
                        sourceLine: sourceLine,
                        assemblyLines: assemblyLines.sort((a, b) => a - b),
                        color: colors[sourceLine % colors.length]
                    });
                }
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
exports.CompilerManager2 = CompilerManager2;
//# sourceMappingURL=compilerManager2.js.map