import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import * as os from 'os';

export interface CompilerInfo {
    path: string;
    version: string;
    type: 'msvc' | 'gcc' | 'clang';
}

export interface CompilationResult {
    success: boolean;
    assembly?: string;
    error?: string;
    sourceFile?: string;
    mappings?: LineMapping[];
}

export interface LineMapping {
    sourceLine: number;
    assemblyLines: number[];
    color: string;
}

export class CompilerManager {
    private currentCompiler: CompilerInfo | undefined;
    private config: vscode.WorkspaceConfiguration;
    
    constructor() {
        this.config = vscode.workspace.getConfiguration('cpp-asm-viewer');
    }
    
    public async autoDetectCompiler(): Promise<CompilerInfo | undefined> {
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
    
    private async detectMSVC(): Promise<CompilerInfo | undefined> {
        try {
            // Common installation paths
            const possiblePaths = [
                process.env['VCINSTALLDIR'],
                'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Tools\\MSVC\\',
                'C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional\\VC\\Tools\\MSVC\\',
                'C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\VC\\Tools\\MSVC\\',
                'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Community\\VC\\Tools\\MSVC\\',
                'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Professional\\VC\\Tools\\MSVC\\',
                'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Enterprise\\VC\\Tools\\MSVC\\',
            ].filter(p => p);
            
            for (const basePath of possiblePaths) {
                if (fs.existsSync(basePath)) {
                    const versions = fs.readdirSync(basePath)
                        .filter(dir => fs.existsSync(path.join(basePath, dir, 'bin', 'Hostx64', 'x64', 'cl.exe')))
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
            }
            
            // Try using vswhere
            const vswherePath = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 
                                         'Microsoft Visual Studio\\Installer\\vswhere.exe');
            if (fs.existsSync(vswherePath)) {
                const result = cp.spawnSync(vswherePath, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath']);
                if (result.status === 0) {
                    const installPath = result.stdout.toString().trim();
                    const vcToolsPath = path.join(installPath, 'VC', 'Tools', 'MSVC');
                    if (fs.existsSync(vcToolsPath)) {
                        const versions = fs.readdirSync(vcToolsPath)
                            .filter(dir => fs.existsSync(path.join(vcToolsPath, dir, 'bin', 'Hostx64', 'x64', 'cl.exe')))
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
        } catch (error) {
            console.error('Error detecting MSVC:', error);
        }
        
        return undefined;
    }
    
    private async getMSVCVersion(compilerPath: string): Promise<string> {
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
    
    private async detectGCC(): Promise<CompilerInfo | undefined> {
        try {
            const commands = ['g++', 'gcc', 'x86_64-w64-mingw32-g++', 'x86_64-w64-mingw32-gcc'];
            
            for (const cmd of commands) {
                try {
                    const result = cp.spawnSync(cmd, ['--version']);
                    if (result.status === 0) {
                        const versionOutput = result.stdout.toString();
                        const versionMatch = versionOutput.match(/(\d+\.\d+\.\d+)/);
                        return {
                            path: cmd,
                            version: versionMatch ? versionMatch[1] : 'Unknown',
                            type: 'gcc'
                        };
                    }
                } catch {
                    // Continue to next command
                }
            }
        } catch (error) {
            console.error('Error detecting GCC:', error);
        }
        
        return undefined;
    }
    
    private async detectClang(): Promise<CompilerInfo | undefined> {
        try {
            const commands = ['clang++', 'clang'];
            
            for (const cmd of commands) {
                try {
                    const result = cp.spawnSync(cmd, ['--version']);
                    if (result.status === 0) {
                        const versionOutput = result.stdout.toString();
                        const versionMatch = versionOutput.match(/(\d+\.\d+\.\d+)/);
                        return {
                            path: cmd,
                            version: versionMatch ? versionMatch[1] : 'Unknown',
                            type: 'clang'
                        };
                    }
                } catch {
                    // Continue to next command
                }
            }
        } catch (error) {
            console.error('Error detecting Clang:', error);
        }
        
        return undefined;
    }
    
    public async compileToAssembly(sourcePath: string): Promise<CompilationResult> {
        if (!this.currentCompiler) {
            const detected = await this.autoDetectCompiler();
            if (!detected) {
                return {
                    success: false,
                    error: 'No compiler available. Please configure a C++ compiler.'
                };
            }
        }
        
        const compiler = this.currentCompiler!;
        const args = this.getCompilerArgs(sourcePath);
        
        return new Promise((resolve) => {
            try {
                const tempDir = os.tmpdir();
                const outputPath = path.join(tempDir, `asm_output_${Date.now()}.asm`);
                
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
                        // For MSVC, read the generated .asm file
                        if (compiler.type === 'msvc') {
                            const asmFile = sourcePath.replace(/\.(cpp|c)$/, '.asm');
                            if (fs.existsSync(asmFile)) {
                                const assembly = fs.readFileSync(asmFile, 'utf8');
                                const mappings = this.parseMappings(assembly, sourcePath);
                                fs.unlinkSync(asmFile); // Clean up
                                resolve({
                                    success: true,
                                    assembly: assembly,
                                    sourceFile: sourcePath,
                                    mappings: mappings
                                });
                            } else {
                                resolve({
                                    success: false,
                                    error: 'Assembly file not generated'
                                });
                            }
                        } else {
                            // For GCC/Clang, stdout contains assembly
                            const mappings = this.parseMappings(stdout, sourcePath);
                            resolve({
                                success: true,
                                assembly: stdout,
                                sourceFile: sourcePath,
                                mappings: mappings
                            });
                        }
                    } else {
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
                
            } catch (error: any) {
                resolve({
                    success: false,
                    error: `Compilation error: ${error.message}`
                });
            }
        });
    }
    
    private getCompilerArgs(sourcePath: string): string[] {
        const baseArgs = this.config.get<string>('compilerArgs', '/Od /FA /c').split(' ');
        const outputType = this.config.get<string>('outputType', 'asm');
        
        let args = [...baseArgs];
        
        // Add output type specific flags
        if (this.currentCompiler?.type === 'msvc') {
            switch (outputType) {
                case 'asm+hex':
                    args.push('/FAsc');
                    break;
                case 'asm+hex+addr':
                    args.push('/FAscu');
                    break;
                default:
                    args.push('/FA');
            }
        } else if (this.currentCompiler?.type === 'gcc' || this.currentCompiler?.type === 'clang') {
            args.push('-S', '-fverbose-asm');
            if (outputType === 'asm+hex' || outputType === 'asm+hex+addr') {
                args.push('-masm=intel');
            }
        }
        
        args.push(sourcePath);
        return args;
    }
    
    private parseMappings(assembly: string, sourcePath: string): LineMapping[] {
        const mappings: LineMapping[] = [];
        const lines = assembly.split('\n');
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
        let colorIndex = 0;
        
        let currentSourceLine = -1;
        let assemblyLines: number[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // MSVC format: .line 15
            // GCC/Clang format: #15
            const msvcMatch = line.match(/\.line\s+(\d+)/);
            const gccMatch = line.match(/#\s*(\d+)/);
            
            const lineNumber = msvcMatch ? parseInt(msvcMatch[1]) : 
                              gccMatch ? parseInt(gccMatch[1]) : -1;
            
            if (lineNumber > 0) {
                // Save previous mapping
                if (currentSourceLine > 0 && assemblyLines.length > 0) {
                    mappings.push({
                        sourceLine: currentSourceLine,
                        assemblyLines: [...assemblyLines],
                        color: colors[colorIndex % colors.length]
                    });
                    colorIndex++;
                }
                
                // Start new mapping
                currentSourceLine = lineNumber;
                assemblyLines = [i + 1]; // +1 because line numbers are 1-based
            } else if (currentSourceLine > 0 && line.trim() && !line.trim().startsWith('.')) {
                // Add to current mapping if it's actual assembly code
                assemblyLines.push(i + 1);
            }
        }
        
        // Add the last mapping
        if (currentSourceLine > 0 && assemblyLines.length > 0) {
            mappings.push({
                sourceLine: currentSourceLine,
                assemblyLines: [...assemblyLines],
                color: colors[colorIndex % colors.length]
            });
        }
        
        return mappings;
    }
    
    public setCompiler(compiler: CompilerInfo) {
        this.currentCompiler = compiler;
    }
    
    public getCurrentCompiler(): CompilerInfo | undefined {
        return this.currentCompiler;
    }
    
    public dispose() {
        // Cleanup if needed
    }
}