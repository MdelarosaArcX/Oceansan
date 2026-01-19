export interface FileEntry {
  path: string;
  size: number;
}

export interface CopyProgress {
  copiedSize: number;
  totalSize: number;
  percent: number;
  currentFile: string;
}

export interface CopyStart {
  totalFiles: number;
  totalSize: number;
}

export interface CopyComplete {
  copiedSize: number;
  totalSize: number;
}
