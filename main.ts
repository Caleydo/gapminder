/**
 * Created by Samuel Gratzl on 15.12.2014.
 */
import C = require('../caleydo_core/main');
import template = require('../clue_demo/template');
import cmode = require('../caleydo_provenance/mode');
import gapminder = require('./gapminder');

//scoping let --> function level scope in js vs java global, local
let helper = document.querySelector('div.gapminder');

const elems = template.create(document.body, {
  app: 'GapMinder',
  application: '/gapminder',
  id: 'clue_gapminder'
});

{
  while(helper.firstChild) {
    (<Node>elems.$main.node()).appendChild(helper.firstChild);
  }
}

elems.graph.then((graph) => {
  const app = gapminder.create(<Element>elems.$main.node(), graph);

  app.on('wait', elems.header.wait.bind(elems.header));
  app.on('ready', elems.header.ready.bind(elems.header));

  function updateBounds() {
    var bounds = C.bounds(document.querySelector('main'));
    app.setBounds(bounds.x, bounds.y, bounds.w - 50, bounds.h - 70);
  }

  elems.on('modeChanged', function (event, new_) {
    app.setInteractive(new_.exploration >= 0.8);
    //for the animations to end
    setTimeout(updateBounds, 300);
  });

  $(window).on('resize', updateBounds);
  updateBounds();

  app.setInteractive(cmode.getMode().exploration >= 0.8);

  elems.jumpToStored();
});
