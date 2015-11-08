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
const main = document.querySelector('div.gapminder');

const elems = template.create(document.body, {
  app: 'GapMinder'
});
(<Node>elems.$main.node()).appendChild(main);

const app = gapminder.create(<Element>main,elems.graph);

databrowser.create(<Element>d3.select('aside.left').append('section').classed('databrowser',true).node(), {
  filter: (d) => /.*gapminder.*/.test(d.desc.fqname)
});

elems.jumpToStored();
