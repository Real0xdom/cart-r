import fs from 'node:fs';
import path from 'node:path';

export interface SharedRunState {
  bookingId?: string;
  bookingNumber?: string;
  createdAtIso?: string;
}

const statePath = path.resolve(process.cwd(), 'reports', 'run-state.json');

export function readState(): SharedRunState {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8')) as SharedRunState;
  } catch {
    return {};
  }
}

export function writeState(next: SharedRunState): void {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(next, null, 2), 'utf8');
}

export function mergeState(patch: SharedRunState): SharedRunState {
  const curr = readState();
  const next = { ...curr, ...patch };
  writeState(next);
  return next;
}