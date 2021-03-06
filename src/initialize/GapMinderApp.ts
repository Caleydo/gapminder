/**
 * Created by Samuel Gratzl on 15.12.2014.
 */

import {CLUEWrapper, ModeWrapper} from 'phovea_clue';
import {GapMinder} from '../app/gapminder';
import {I18nextManager, BaseUtils, EventHandler} from 'phovea_core';

export class GapMinderApp {

  //scoping let --> function level scope in js vs java global, local
  private  helper = document.querySelector('div.gapminder');

  constructor() {

    I18nextManager.getInstance().initI18n().then(() => {
      const elems = CLUEWrapper.createCLUEWrapper(document.body, {
        app: 'GapMinder',
        application: '/gapminder',
        id: 'clue_gapminder',
        recordSelectionTypes: 'selected,filtered',
        animatedSelections: true,
        thumbnails: false
      });

      {
        while(this.helper.firstChild) {
          (<Node>elems.$main.node()).appendChild(this.helper.firstChild);
        }
      }

      elems.graph.then((graph) => {
        const app = GapMinder.create(<Element>elems.$main.node(), graph);

        app.on('wait', elems.header.wait.bind(elems.header));
        app.on('ready', elems.header.ready.bind(elems.header));

        function updateBounds() {
          const bounds = BaseUtils.bounds(document.querySelector('main'));
          app.setBounds(bounds.x, bounds.y, bounds.w - 200, bounds.h - 80);
        }

        //d3.select(elems.header.options).append('label').html(`<input type="checkbox">Show Trails`).select('input').on('change', function () {
        //    app.showTrails(this.checked);
        //  });

        elems.on('modeChanged', function (event, newMode) {
          app.setInteractive(newMode.exploration >= 0.8);
          //for the animations to end
          setTimeout(updateBounds, 300);
        });

        window.addEventListener('resize', updateBounds);
        setTimeout(updateBounds, 500);

        app.setInteractive(ModeWrapper.getInstance().getMode().exploration >= 0.8);

        elems.jumpToStored();
      });

    });
  }
}
