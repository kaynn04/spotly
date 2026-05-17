const { withAndroidManifest } = require('expo/config-plugins');

const PERMISSIONS = {
  camera: 'android.permission.CAMERA',
  internet: 'android.permission.INTERNET',
  notifications: 'android.permission.POST_NOTIFICATIONS',
  readStorage: 'android.permission.READ_EXTERNAL_STORAGE',
  recordAudio: 'android.permission.RECORD_AUDIO',
  vibrate: 'android.permission.VIBRATE',
  writeStorage: 'android.permission.WRITE_EXTERNAL_STORAGE',
  systemAlertWindow: 'android.permission.SYSTEM_ALERT_WINDOW',
};

function getPermissionName(permission) {
  return permission?.$?.['android:name'];
}

function removePermission(manifest, permissionName) {
  manifest['uses-permission'] = (manifest['uses-permission'] ?? []).filter(
    (permission) => getPermissionName(permission) !== permissionName
  );
}

function ensurePermission(manifest, permissionName, attrs = {}) {
  const permissions = manifest['uses-permission'] ?? [];
  const existing = permissions.find((permission) => getPermissionName(permission) === permissionName);
  const nextAttrs = {
    'android:name': permissionName,
    ...attrs,
  };

  if (existing) {
    existing.$ = {
      ...existing.$,
      ...nextAttrs,
    };
  } else {
    permissions.push({ $: nextAttrs });
  }

  manifest['uses-permission'] = permissions;
}

function withAndroidCompatibility(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    config.modResults.$ = {
      ...config.modResults.$,
      'xmlns:tools': 'http://schemas.android.com/tools',
    };

    removePermission(manifest, PERMISSIONS.systemAlertWindow);

    ensurePermission(manifest, PERMISSIONS.internet);
    ensurePermission(manifest, PERMISSIONS.camera);
    ensurePermission(manifest, PERMISSIONS.notifications);
    ensurePermission(manifest, PERMISSIONS.recordAudio);
    ensurePermission(manifest, PERMISSIONS.vibrate);
    ensurePermission(manifest, PERMISSIONS.readStorage, {
      'android:maxSdkVersion': '32',
      'tools:node': 'replace',
    });
    ensurePermission(manifest, PERMISSIONS.writeStorage, {
      'android:maxSdkVersion': '32',
      'tools:node': 'replace',
    });

    return config;
  });
}

module.exports = withAndroidCompatibility;
