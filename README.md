# C/C++ Assembly Viewer for VS Code

A VS Code extension that shows assembly code for C/C++ files with synchronized scrolling and highlighting.

## Features

- **Auto-detection** of MSVC, GCC, and Clang compilers
- **Synchronized scrolling** between C/C++ and assembly views
- **Color-coded highlighting** of corresponding code sections
- **Multiple output formats**: assembly only, with machine code, with addresses
- **Side-by-side view** for easy comparison
- **One-click compilation** from editor toolbar

## Usage

1. Open a C/C++ file (.c or .cpp)
2. Click the "View Assembly" button in the editor toolbar or status bar
3. The assembly code will open in a split view
4. Scroll or click in either panel to see corresponding code highlighted

## Settings

- **Compiler Path**: Manual compiler path (auto-detected if empty)
- **Compiler Arguments**: Custom compilation flags
- **Output Type**: Assembly output format

## Supported Compilers

- MSVC (Visual Studio C++ compiler)
- GCC
- Clang

## Requirements

- VS Code 1.60.0 or higher
- A C++ compiler installed on your system

## Installation

1. Download the .vsix file
2. Run `code --install-extension cpp-asm-viewer-1.0.0.vsix`
3. Reload VS Code

## Building from Source

1. Clone the repository
2. Run `npm install`
3. Run `npm run compile`
4. Press F5 to debug in Extension Development Host