/**
 * Created by Samuel Gratzl on 15.12.2014.
 */

// Determine the order of css files manually

// HACK! because <amd-dependency path="bootstrap" /> is loaded after all the other stylesheets and not before (as declared)
/// <amd-dependency path="css!/bower_components/bootstrap/dist/css/bootstrap" />

/// <amd-dependency path="font-awesome" />
/// <amd-dependency path="css!phovea_bootstrap_fontawesome/style.css" /src/>
/// <amd-dependency path="css!./style.css"/>


import * as C from 'phovea_core/src/index';
import * as template from 'phovea_clue/src/template';
import * as cmode from 'phovea_clue/src/mode';
import * as gapminder from './gapminder';

//scoping let --> function level scope in js vs java global, local
let helper = document.querySelector('div.gapminder');

const elems = template.create(document.body, {
  app: 'GapMinder',
  application: '/gapminder',
  id: 'clue_gapminder',
  recordSelectionTypes: 'selected,filtered',
  animatedSelections: true,
  thumbnails: false
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
    app.setBounds(bounds.x, bounds.y, bounds.w - 200, bounds.h - 80);
  }

  //d3.select(elems.header.options).append('label').html(`<input type="checkbox">Show Trails`).select('input').on('change', function () {
  //    app.showTrails(this.checked);
  //  });

  elems.on('modeChanged', function (event, new_) {
    app.setInteractive(new_.exploration >= 0.8);
    //for the animations to end
    setTimeout(updateBounds, 300);
  });

  $(window).on('resize', updateBounds);
  setTimeout(updateBounds, 500);

  app.setInteractive(cmode.getMode().exploration >= 0.8);

  elems.jumpToStored();
});
