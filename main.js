/**
 * Created by Samuel Gratzl on 15.12.2014.
 */
define(function (require) {
  'use strict';
  var $ = require('jquery');
  var data = require('../caleydo_core/data');
  var vis = require('../caleydo_core/vis');
  var C = require('../caleydo_core/main');
  var template = require('../clue_demo/template');
  var cmode = require('../caleydo_provenance/mode');


  var helper = document.querySelector('#mainhelper');
  var elems = template.create(document.body, {
    app: 'GapMinder'
  });
  var graph = elems.graph;
  {
    while(helper.firstChild) {
      elems.$main.node().appendChild(helper.firstChild);
    }
    helper.remove();
  }

  elems.jumpToStored();
});
