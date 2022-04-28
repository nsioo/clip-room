module.exports = {
  pluginOptions: {
    electronBuilder: {
      nodeIntegration: true,
      experimentalNativeDepCheck: true,
      externals: ['express', 'fluent-ffmpeg', 'electron-context-menu'],
      builderOptions: {
        publish: ['github'],
        artifactName: '${productName} Setup.${ext}',
        appId: 'app.yesmore.cliproom',
        productName: 'Stream Clip Room',
        fileAssociations: [
          {
            ext: ['mp4', 'webm', 'ogg', 'wav', 'mp3'],
            name: 'Edit video',
            description: 'Edit video with Stream Clip Room.',
            icon: 'open.ico',
            role: 'Editor',
          },
          {
            ext: ['scrproject', 'SCRPROJECT'],
            name: 'Open project',
            description: 'Open project file with Stream Clip Room.',
            icon: 'open.ico',
            role: 'Editor',
          },
        ],
        win: {
          // win相关配置
          icon: './public/favicon.ico', // 图标，当前图标在根目录下，注意这里有两个坑
          // "requestedExecutionLevel": "requireAdministrator", //获取管理员权限
          target: [
            {
              target: 'nsis', // 利用nsis制作安装程序
              arch: [
                'x64', // 64位
                'ia32',
              ],
            },
          ],
        },
        nsis: {
          oneClick: false, // 是否一键安装
          allowElevation: true, // 允许请求提升。 如果为false，则用户必须使用提升的权限重新启动安装程序。
          allowToChangeInstallationDirectory: true, // 允许修改安装目录
          installerIcon: './public/favicon.ico', // 安装图标
          uninstallerIcon: './public/favicon.ico', // 卸载图标
          installerHeaderIcon: './public/favicon.ico', // 安装时头部图标
          createDesktopShortcut: true, // 创建桌面图标
          createStartMenuShortcut: false, // 创建开始菜单图标
          shortcutName: 'Clip Room', // 图标名称(项目名称)
        },
      },
    },
  },
  transpileDependencies: ['vuetify'],
  publicPath: '/cliproom',
  pwa: {
    name: 'Stream Clip Room',
    themeColor: '#17181a',
    msTileColor: '#ed4b83',
    manifestOptions: {
      name: 'Stream Clip Room',
      short_name: 'Clip Room',
      start_url: './',
      display: 'standalone',
      background_color: '#17181a',
      theme_color: '#ed4b83',
      description: 'Edit videos',
      icons: [
        {
          src: 'img/icons/favicon-16x16.png',
          sizes: '16x16',
          type: 'image/png',
        },
        {
          src: 'img/icons/apple-touch-icon-76x76.png',
          sizes: '76x76',
          type: 'image/png',
        },
        {
          src: 'img/icons/favicon-32x32.png',
          sizes: '32x32',
          type: 'image/png',
        },
        {
          src: 'img/icons/msapplication-icon-144x144.png',
          sizes: '144x144',
          type: 'image/png',
        },
        {
          src: 'img/icons/android-chrome-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: 'img/icons/android-chrome-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
      ],
    },
  },
};
