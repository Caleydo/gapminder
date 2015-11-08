define(["require", "exports", '../caleydo_core/main', '../clue_demo/template', '../caleydo_window/databrowser', './gapminder', 'd3'], function (require, exports, C, template, databrowser, gapminder, d3) {
    //create main
    var main = document.querySelector('div.gapminder');
    var elems = template.create(document.body, {
        app: 'GapMinder'
    });
    elems.$main.node().appendChild(main);
    var app = gapminder.create(main, elems.graph);
    databrowser.create(d3.select('aside.left').append('section').classed('databrowser', true).node(), {
        filter: function (d) { return /.*gapminder.*/.test(d.desc.fqname); }
    });
    function updateBounds() {
        var bounds = C.bounds(main);
        app.setBounds(bounds.x, bounds.y, bounds.w, bounds.h);
    }
    $(window).on('resize', updateBounds);
    updateBounds();
    elems.jumpToStored();
});
//# sourceMappingURL=main.js.map