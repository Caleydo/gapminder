//register all extensions in the registry following the given pattern
export default function (registry) {
    //registry.push('extension-type', 'extension-id', function() { return import('./src/extension_impl'); }, {});
    // generator-phovea:begin
    registry.push('view', 'gapminder', function () { return import('./app/gapminder').then((g) => g.GapMinder); }, {
        'location': 'gapminder'
    });
    registry.push('actionFactory', 'gapminder', function () { return import('./app/gapminder').then((g) => g.GapMinderCmds); }, {
        'factory': 'createCmd',
        'creates': '(setGapMinderAttribute|setGapMinderAttributeScale|toggleGapMinderTrails)'
    });
    registry.push('actionCompressor', 'gapminder-setGapMinderAttribute', function () { return import('./app/gapminder').then((g) => g.GapMinderCmds); }, {
        'factory': 'compressSetAttribute',
        'matches': 'setGapMinderAttribute'
    });
    registry.push('actionCompressor', 'gapminder-setGapMinderAttribute', function () { return import('./app/gapminder').then((g) => g.GapMinderCmds); }, {
        'factory': 'compressToggleGapMinderTrails',
        'matches': 'toggleGapMinderTrails'
    });
    registry.push('actionCompressor', 'gapminder-setGapMinderAttributeScale', function () { return import('./app/gapminder').then((g) => g.GapMinderCmds); }, {
        'factory': 'compressSetAttributeScale',
        'matches': 'setGapMinderAttributeScale'
    });
    registry.push('app', 'gapminder', null, {
        'name': 'GapMinder'
    });
    // generator-phovea:end
}
//# sourceMappingURL=phovea.js.map