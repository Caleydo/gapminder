/**
 * Created by Samuel Gratzl on 15.12.2014.
 */
import C = require('../caleydo_core/main');
import vis = require('../caleydo_core/vis');
import data = require('../caleydo_core/data');
import template = require('../clue_demo/template');
import cmode = require('../caleydo_provenance/mode');
import databrowser = require('../caleydo_window/databrowser');
import gapminder = require('./gapminder');


import d3 = require('d3');


//create main
let helper = document.querySelector('div.gapminder');

const elems = template.create(document.body, {
  app: 'GapMinder',
  id: 'clue_gapminder'
});
{
  while(helper.firstChild) {
    (<Node>elems.$main.node()).appendChild(helper.firstChild);
  }
}

const app = gapminder.create(<Element>elems.$main.node(),elems.graph);

databrowser.create(<Element>d3.select('aside.left').append('section').classed('databrowser',true).node(), {
  filter: (d) => /.*gapminder.*/.test(d.desc.fqname)
});

function updateBounds() {
  var bounds = C.bounds(document.querySelector('div.gapminder_i'));
  app.setBounds(bounds.x, bounds.y, bounds.w - 30, bounds.h - 60);
}

$(window).on('resize', updateBounds);
updateBounds();

elems.jumpToStored();
