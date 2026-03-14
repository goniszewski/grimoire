import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createBackup,
  listBackups,
  restoreBackup,
  restoreRemoteBackup,
  getBackupSchedule,
  updateBackupSchedule,
  testS3Connection,
} from "@/lib/api";
import type { ApiBackupSchedule } from "@/lib/api";

export const backupKeys = {
  all: ["backup"] as const,
  list: () => [...backupKeys.all, "list"] as const,
  listRemote: () => [...backupKeys.all, "list-remote"] as const,
  schedule: () => [...backupKeys.all, "schedule"] as const,
};

export function useBackupList() {
  return useQuery({
    queryKey: backupKeys.list(),
    queryFn: () => listBackups(false).then((r) => r.data),
    staleTime: 30_000,
  });
}

/** Lazy — only fetches when `enabled` is true so we don't hit S3 on every page load. */
export function useBackupListWithRemote(enabled: boolean) {
  return useQuery({
    queryKey: backupKeys.listRemote(),
    queryFn: () => listBackups(true).then((r) => r.data),
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
    queryFn: () => getBackupSchedule().then((r) => r.data),
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
