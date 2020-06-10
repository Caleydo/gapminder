/**
 * Created by Samuel Gratzl on 15.12.2014.
 */
// Determine the order of css files manually
import 'file-loader?name=404.html!../404.html';
import 'file-loader?name=robots.txt!../robots.txt';
import 'phovea_ui/dist/webpack/_bootstrap';
import 'phovea_ui/dist/webpack/_font-awesome';
import '../scss/main.scss';
import { CLUEWrapper, ModeWrapper } from 'phovea_clue';
import { GapMinder } from '../app/gapminder';
import { I18nextManager, BaseUtils } from 'phovea_core';
export class GapMinderApp {
    constructor() {
        //scoping let --> function level scope in js vs java global, local
        this.helper = document.querySelector('div.gapminder');
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
                while (this.helper.firstChild) {
                    elems.$main.node().appendChild(this.helper.firstChild);
                }
            }
            elems.graph.then((graph) => {
                const app = GapMinder.create(elems.$main.node(), graph);
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
//# sourceMappingURL=GapMinderApp.js.map