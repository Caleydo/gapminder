/**
 * Created by Samuel Gratzl on 15.12.2014.
 */
import 'file-loader?name=index.html!extract-loader!html-loader!../index.html';
import 'file-loader?name=404.html!../404.html';
import 'file-loader?name=robots.txt!../robots.txt';
import 'phovea_ui/dist/webpack/_bootstrap';
import 'phovea_ui/dist/webpack/_font-awesome';
import '../scss/main.scss';
export declare class GapMinderApp {
    private helper;
    constructor();
}
