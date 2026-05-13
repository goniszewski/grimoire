import { describe, expect, it } from "vitest";
import type {
  BackupDestinationDto,
  BackupEntryDto,
  BackupScheduleDto,
  BookmarkDto,
  CategoryNodeDto,
  DomainDto,
  SettingsDto,
  SuggestionDto,
  TimelinePageDto,
} from "../../daemon/src/api/types";
import type {
  ApiBackupDestination,
  ApiBackupEntry,
  ApiBackupSchedule,
  ApiBookmark,
  ApiCategory,
  ApiDomain,
  ApiSettings,
  ApiSettingsPatch,
  ApiSuggestion,
  ApiTimelineEvent,
} from "./api";

type AssertAssignable<Actual extends Expected, Expected> = true;
type SuggestionMetadataValue = ApiSuggestion["metadata"][string];
type TimelineMetadataValue = ApiTimelineEvent["metadata"][string];

describe("frontend API contract types", () => {
  it("derives frontend DTO aliases from the daemon contract", () => {
    const _contractAssertions: [
      AssertAssignable<ApiSettings["ai"], SettingsDto["ai"]>,
      AssertAssignable<ApiSettings["backup"]["schedule"], SettingsDto["backup"]["schedule"]>,
      AssertAssignable<ApiSettings["runtime"], SettingsDto["runtime"]>,
      AssertAssignable<ApiBookmark["status"], BookmarkDto["status"]>,
      AssertAssignable<ApiBookmark["is_pinned"], BookmarkDto["is_pinned"]>,
      AssertAssignable<ApiCategory["id"], CategoryNodeDto["id"]>,
      AssertAssignable<ApiCategory["children"][number]["parent_id"], CategoryNodeDto["parent_id"]>,
      AssertAssignable<ApiDomain["domain"], DomainDto["domain"]>,
      AssertAssignable<ApiTimelineEvent["type"], TimelinePageDto["data"][number]["type"]>,
      AssertAssignable<ApiTimelineEvent["source"], TimelinePageDto["data"][number]["source"]>,
      AssertAssignable<unknown, TimelineMetadataValue>,
      AssertAssignable<ApiSuggestion["type"], SuggestionDto["type"]>,
      AssertAssignable<ApiSuggestion["status"], SuggestionDto["status"]>,
      AssertAssignable<unknown, SuggestionMetadataValue>,
      AssertAssignable<ApiBackupEntry["source"], BackupEntryDto["source"]>,
      AssertAssignable<ApiBackupSchedule["next_run_at"], BackupScheduleDto["next_run_at"]>,
      AssertAssignable<ApiBackupDestination["writable"], BackupDestinationDto["writable"]>,
    ] = [
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ];

    const _settingsPatch: ApiSettingsPatch = {
      ai: { embeddings: { provider: "openai" } },
      backup: { s3: { bucket: "little-imp-test" } },
    };

    void _contractAssertions;
    void _settingsPatch;
    expect(true).toBe(true);
  });
});
