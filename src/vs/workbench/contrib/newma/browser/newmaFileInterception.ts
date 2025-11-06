/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IFileService, FileOperation, IFileService as IFS, IFileWriteOptions } from '../../../../platform/files/common/files.js';
import { VSBuffer } from '../../../../base/common/buffer.js';

class UndoEntry {
  constructor(readonly label: string, readonly undo: () => Promise<void>) {}
}

export class NewmaFileInterception extends Disposable implements IWorkbenchContribution {
  private lastUndo?: UndoEntry;

  constructor(
    @IFileService private readonly fileService: IFS,
    @INotificationService private readonly notifications: INotificationService,
  ) {
    super();
    this._register(this.fileService.onDidRunOperation(e => {
      try { this.handleOperation(e.operation, e.resource, (e as any).target?.resource ?? (e as any).target); } catch { /* no-op */ }
    }));
  }

  private async handleOperation(op: FileOperation, resource: URI, target?: URI): Promise<void> {
    if (!this.shouldIntercept(resource)) {
      return;
    }
    switch (op) {
      case FileOperation.WRITE: {
        await this.captureUndoForWrite(resource);
        this.notify(`Wrote ${resource.fsPath}`);
        break;
      }
      case FileOperation.CREATE: {
        this.captureUndoSimple(`Create ${resource.fsPath}`, async () => {
          await this.fileService.del(resource, { useTrash: true, recursive: false, atomic: false } as any);
        });
        this.notify(`Created ${resource.fsPath}`);
        break;
      }
      case FileOperation.DELETE: {
        // nothing to do (cannot restore without backup)
        this.lastUndo = undefined;
        this.notify(`Deleted ${resource.fsPath}`);
        break;
      }
      case FileOperation.MOVE: {
        if (target && URI.isUri(target)) {
          const from = resource; const to = target;
          this.captureUndoSimple(`Move ${from.fsPath} -> ${to.fsPath}`, async () => {
            await this.fileService.move(to, from, true);
          });
          this.notify(`Moved ${from.fsPath} -> ${to.fsPath}`);
        }
        break;
      }
      case FileOperation.COPY: {
        if (target && URI.isUri(target)) {
          const to = target;
          this.captureUndoSimple(`Remove copy ${to.fsPath}`, async () => {
            await this.fileService.del(to, { useTrash: true, recursive: true, atomic: false } as any);
          });
          this.notify(`Copied to ${to.fsPath}`);
        }
        break;
      }
    }
  }

  private shouldIntercept(resource: URI): boolean {
    try {
      const p = (resource?.fsPath || '').toLowerCase();
      if (!p) { return false; }

      // Suppress noisy internal writes under user data storage
      const ignoredPatterns = [
        'workspaceStorage',
        'chatEditingSessions',
        'globalStorage',
        'cachedExtensions',
        '.git/index.lock',
        '.git/config.lock',
        'node_modules',
        '.vscode-test',
        '.vs',
        '.idea',
        '__pycache__',
        '.DS_Store',
        'thumbs.db',
        'desktop.ini',
        // Ignore lock files and temp files
        '.lock',
        '.tmp',
        '.temp',
        '.swp',
        '.swo',
        '~$',
        // Ignore state and cache files
        'state.json',
        'cache.json',
        'settings.json.bak',
        // Ignore log files (unless explicitly needed)
        '.log',
      ];

      // Check if path matches any ignored pattern
      for (const pattern of ignoredPatterns) {
        if (p.includes(pattern.toLowerCase())) {
          return false;
        }
      }

      // Also filter out very long paths (likely temp/internal files)
      if (p.length > 200) {
        return false;
      }

      return true;
    } catch {
      return true;
    }
  }

  private async captureUndoForWrite(resource: URI): Promise<void> {
    try {
      const exists = await this.fileService.exists(resource);
      const prev = exists ? await this.fileService.readFile(resource) : undefined;
      if (prev) {
        const prevContent = prev.value; const prevMeta = { mtime: prev.mtime, etag: prev.etag };
        this.lastUndo = new UndoEntry(`Revert ${resource.fsPath}`, async () => {
          const opts: IFileWriteOptions = { create: true, mtime: prevMeta.mtime, etag: prevMeta.etag } as any;
          await this.fileService.writeFile(resource, VSBuffer.wrap(prevContent.buffer.slice(0)), opts);
        });
      } else {
        this.lastUndo = new UndoEntry(`Delete ${resource.fsPath}`, async () => {
          await this.fileService.del(resource, { useTrash: true, recursive: false, atomic: false } as any);
        });
      }
    } catch {
      // ignore
    }
  }

  private captureUndoSimple(label: string, undo: () => Promise<void>): void {
    this.lastUndo = new UndoEntry(label, undo);
  }

  private notify(msg: string) {
    // Extract filename for cleaner message
    const shortMsg = this.formatMessage(msg);

    if (this.lastUndo) {
      this.notifications.notify({
        severity: Severity.Info,
        message: shortMsg,
        actions: {
          primary: [{
            id: 'newma.undo',
            label: 'Undo',
            tooltip: this.lastUndo.label,
            class: undefined,
            enabled: true,
            run: async () => {
              try {
                await this.lastUndo?.undo();
                this.lastUndo = undefined;
              } catch (e) {
                this.notifications.error(String(e));
              }
            }
          }]
        }
      });
    } else {
      // Use silent notification for non-undoable operations to reduce noise
      this.notifications.info(shortMsg);
    }
  }

  private formatMessage(msg: string): string {
    // Extract filename from full path for cleaner display
    try {
      const match = msg.match(/(?:Wrote|Created|Deleted|Moved|Copied)\s+(.+)/);
      if (match && match[1]) {
        const fullPath = match[1];
        const parts = fullPath.split(/[/\\]/);
        const fileName = parts[parts.length - 1];

        // If path is short, show full path; otherwise show relative path
        if (fullPath.length < 60) {
          return msg;
        }

        // Show relative path with filename
        const parentDir = parts.length > 1 ? `.../${parts[parts.length - 2]}/` : '';
        const action = msg.split(/\s+/)[0]; // Get action verb
        return `${action} ${parentDir}${fileName}`;
      }
    } catch {
      // Fall through to return original message
    }
    return msg;
  }
}



