import React from 'react'
import { FileCode, FileJson, FileText, Code, Coffee } from 'lucide-react'

// Language icon mapping
export const getLanguageIcon = (language: string, size: number = 16) => {
  const iconStyle = { width: `${size}px`, height: `${size}px` }
  
  switch (language.toLowerCase()) {
    case 'python':
      return <Code size={size} style={{ color: '#3776ab' }} />
    case 'javascript':
    case 'typescript':
      return <Code size={size} style={{ color: '#f7df1e' }} />
    case 'java':
      return <Coffee size={size} style={{ color: '#ed8b00' }} />
    case 'cpp':
    case 'c':
      return <Code size={size} style={{ color: '#00599c' }} />
    case 'rust':
      return <Code size={size} style={{ color: '#000000' }} />
    case 'json':
      return <FileJson size={size} style={{ color: '#1f2937' }} />
    case 'markdown':
      return <FileText size={size} />
    case 'swift':
      return <Code size={size} style={{ color: '#fa7343' }} />
    case 'go':
      return <Code size={size} style={{ color: '#00add8' }} />
    case 'php':
      return <Code size={size} style={{ color: '#777bb4' }} />
    case 'ruby':
      return <Code size={size} style={{ color: '#cc342d' }} />
    default:
      return <FileCode size={size} />
  }
}

// Auto-detect language from filename
export const detectLanguageFromFileName = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  
  const extensionMap: Record<string, string> = {
    'py': 'python',
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'java': 'java',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'c': 'c',
    'rs': 'rust',
    'json': 'json',
    'md': 'markdown',
    'swift': 'swift',
    'go': 'go',
    'php': 'php',
    'rb': 'ruby',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
  }
  
  return extensionMap[ext] || 'python' // Default to python
}

