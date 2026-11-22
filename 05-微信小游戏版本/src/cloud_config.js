/**
 * 微信云开发（CloudBase）客户端配置文件
 *
 * 开通云开发后，可将环境 ID（形如 'cloud1-xxxx'）填入 CLOUD_ENV_ID；
 * 若当前小程序账号下仅创建了 1 个云开发环境，留空 '' 也会自动连接默认环境。
 */
'use strict';

module.exports = {
  // 云开发环境 ID（已绑定当前小游戏云开发环境）
  CLOUD_ENV_ID: 'dev-d0ggz3zx89d349af3',

  // 聚合云函数名称（对应 cloudfunctions/kissa_sync）
  CLOUD_FUNCTION_NAME: 'kissa_sync',

  // 是否启用云端自动同步与全服排行榜
  ENABLE_CLOUD_SYNC: true,

  // 局外数据变更后的防抖上云间隔（毫秒）
  SYNC_DEBOUNCE_MS: 1800
};
