import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createBackup,
  listBackups,
  restoreBackup,
  restoreRemoteBackup,
  verifyBackup,
  getBackupSchedule,
  updateBackupSchedule,
  getBackupDestination,
  updateBackupDestination,
  testS3Connection,
} from "@/lib/api";
import type { ApiBackupDestination, ApiBackupEntry, ApiBackupSchedule } from "@/lib/api";

export const backupKeys = {
  all: ["backup"] as const,
  list: () => [...backupKeys.all, "list"] as const,
  listRemote: () => [...backupKeys.all, "list-remote"] as const,
  schedule: () => [...backupKeys.all, "schedule"] as const,
  destination: () => [...backupKeys.all, "destination"] as const,
};

async function fetchBackupEntries(includeRemote: boolean): Promise<ApiBackupEntry[]> {
  const response = await listBackups(includeRemote) as unknown as { data: ApiBackupEntry[] };
  return response.data;
}

async function fetchBackupSchedule(): Promise<ApiBackupSchedule> {
  const response = await getBackupSchedule() as unknown as { data: ApiBackupSchedule };
  return response.data;
}

async function fetchBackupDestination(): Promise<ApiBackupDestination> {
  const response = await getBackupDestination() as unknown as { data: ApiBackupDestination };
  return response.data;
}

export function useBackupList() {
  return useQuery({
    queryKey: backupKeys.list(),
    queryFn: () => fetchBackupEntries(false),
    staleTime: 30_000,
  });
}

/** Lazy — only fetches when `enabled` is true so we don't hit S3 on every page load. */
export function useBackupListWithRemote(enabled: boolean) {
  return useQuery({
    queryKey: backupKeys.listRemote(),
    queryFn: () => fetchBackupEntries(true),
    staleTime: 30_000,
    enabled,
  });
}

export function useCreateBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createBackup,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: backupKeys.list() });
    },
  });
}

export function useRestoreBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => restoreBackup(name),
    onSuccess: () => {
      // The database on disk has been replaced; all cached data is now stale.
      qc.clear();
    },
  });
}

export function useVerifyBackup() {
  return useMutation({
    mutationFn: (name: string) => verifyBackup(name),
  });
}

export function useRestoreRemoteBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => restoreRemoteBackup(key),
    onSuccess: () => {
      qc.clear();
    },
  });
}

export function useTestS3Connection() {
  return useMutation({
    mutationFn: testS3Connection,
  });
}

export function useBackupSchedule() {
  return useQuery({
    queryKey: backupKeys.schedule(),
    queryFn: fetchBackupSchedule,
    staleTime: 60_000,
  });
}

export function useUpdateBackupSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Pick<ApiBackupSchedule, "enabled" | "cron" | "retention_count">>) =>
      updateBackupSchedule(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: backupKeys.schedule() });
    },
  });
}

export function useBackupDestination() {
  return useQuery({
    queryKey: backupKeys.destination(),
    queryFn: fetchBackupDestination,
    staleTime: 60_000,
  });
}

export function useUpdateBackupDestination() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => updateBackupDestination(path),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: backupKeys.destination() });
    },
  });
}
