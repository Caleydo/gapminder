define(["require", "exports", '../clue_demo/template', '../caleydo_window/databrowser', './gapminder', 'd3'], function (require, exports, template, databrowser, gapminder, d3) {
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
    elems.jumpToStored();
});
//# sourceMappingURL=main.js.map