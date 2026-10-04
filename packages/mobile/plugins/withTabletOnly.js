const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Sólo tablet en Android (B7, decisión D1 del fundador).
 *
 * En iOS lo da `ios.isTabletOnly`. En Android no hay opción de app.json: lo
 * que filtra en Play es `<supports-screens>` del manifiesto. Sin pantallas
 * chicas ni normales, Play no ofrece la app en teléfonos. El atril y la
 * Biblia están diseñados para 11-13″; en un teléfono de 375 pt se salen.
 */
function applyTabletOnly(manifest) {
    const root = manifest.manifest;
    root['supports-screens'] = [
        {
            $: {
                'android:smallScreens': 'false',
                'android:normalScreens': 'false',
                'android:largeScreens': 'true',
                'android:xlargeScreens': 'true',
                'android:requiresSmallestWidthDp': '600',
            },
        },
    ];
    return manifest;
}

const withTabletOnly = (config) =>
    withAndroidManifest(config, (cfg) => {
        cfg.modResults = applyTabletOnly(cfg.modResults);
        return cfg;
    });

module.exports = withTabletOnly;
module.exports.applyTabletOnly = applyTabletOnly;
