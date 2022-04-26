module.exports = {
    "pluginOptions": {
        "electronBuilder": {
            "nodeIntegration": true,
            "experimentalNativeDepCheck": true,
            "externals": [
                'express',
                'fluent-ffmpeg',
                'electron-context-menu',
            ],
            "builderOptions": {
                publish: ['github'],
                "artifactName": "${productName} Setup.${ext}",
                "appId": "dev.yesmore.cliproom",
                "productName": "Stream Clip Room",
                "fileAssociations": [
                    {
                        "ext": [
                            "mp4",
                            "webm",
                            "ogg",
                            "wav",
                            "mp3",
                        ],
                        "name": "Edit video",
                        "description": "Edit video with Stream Clip Room.",
                        "icon": "open.ico",
                        "role": "Editor"
                    },
                    {
                        "ext": [
                            "scrproject",
                            "SCRPROJECT",
                        ],
                        "name": "Open project",
                        "description": "Open project file with Stream Clip Room.",
                        "icon": "open.ico",
                        "role": "Editor"
                    },
                ],
            },
        }
    },
    "transpileDependencies": [
        "vuetify"
    ],
    publicPath: '/moviemaker',
    pwa: {
        name: 'Stream Clip Room',
        themeColor: '#17181a',
        msTileColor: "#ed4b83",
        manifestOptions: {
            "name": "Stream Clip Room",
            "short_name": "Clip Room",
            "start_url": "./",
            "display": "standalone",
            "background_color": "#17181a",
            "theme_color": "#ed4b83",
            "description": "Edit videos",
            "icons": [
                {
                    "src": "img/icons/favicon-16x16.png",
                    "sizes": "16x16",
                    "type": "image/png"
                },
                {
                    "src": "img/icons/apple-touch-icon-76x76.png",
                    "sizes": "76x76",
                    "type": "image/png"
                },
                {
                    "src": "img/icons/favicon-32x32.png",
                    "sizes": "32x32",
                    "type": "image/png"
                },
                {
                    "src": "img/icons/msapplication-icon-144x144.png",
                    "sizes": "144x144",
                    "type": "image/png"
                },
                {
                    "src": "img/icons/android-chrome-512x512.png",
                    "sizes": "512x512",
                    "type": "image/png"
                },
                {
                    "src": "img/icons/android-chrome-192x192.png",
                    "sizes": "192x192",
                    "type": "image/png"
                }
            ]
        },
    }
}