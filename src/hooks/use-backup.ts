import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createBackup, listBackups, restoreBackup, getBackupSchedule, updateBackupSchedule } from "@/lib/api";
import type { ApiBackupSchedule } from "@/lib/api";

export const backupKeys = {
  all: ["backup"] as const,
  list: () => [...backupKeys.all, "list"] as const,
  schedule: () => [...backupKeys.all, "schedule"] as const,
};

export function useBackupList() {
  return useQuery({
    queryKey: backupKeys.list(),
    queryFn: () => listBackups().then((r) => r.data),
    staleTime: 30_000,
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
