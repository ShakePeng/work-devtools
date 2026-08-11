export const STORAGE_KEYS = {
  data: 'work_devtools.data',
  localMigrated: 'work_devtools.local_migrated',
  cookieInjector: {
    expandedPersonIds: 'work_devtools.cookie_injector.expanded_person_ids',
    bridgeRuntimeSession: '__WORK_DEVTOOLS_COOKIE_INJECTOR_BRIDGE_MOCKS__',
  },
  webDav: {
    config: 'work_devtools.webdav.config',
  },
  system: {
    releaseCheck: 'work_devtools.system.release_check',
  },
  /** 导出 / 同步时是否携带敏感信息（如 TinyPNG API Key）；默认关闭。 */
  sensitiveExportEnabled: 'work_devtools.sensitive_export_enabled',
} as const
