/**
 * Created by Samuel Gratzl on 15.12.2014.
 */
import { ActionNode, IObjectRef, IDataType, INumericalMatrix, Range, IDType, Rect, AView, IStratification, ProvenanceGraph } from 'phovea_core';
declare class Attribute {
    scale: string;
    data: INumericalMatrix;
    arr: number[][];
    constructor(scale?: string);
    get label(): string;
    get valid(): boolean;
    get format(): (n: number) => string;
    to_format(): any;
}
interface IItem {
    id: number;
    name: string;
}
export declare class GapMinderCmds {
    private static setAttributeImpl;
    private static setAttributeScaleImpl;
    private static toggleGapMinderTrailsImpl;
    /**
     * compresses the given path by removing redundant set gap minder attribute calls
     * @param path
     * @returns {ActionNode[]}
     */
    static compressSetAttribute(path: ActionNode[]): ActionNode[];
    /**
     * compresses the given path by removing redundant set gap minder attribute scale calls
     * @param path
     * @returns { ActionNode[]}
     */
    static compressSetAttributeScale(path: ActionNode[]): ActionNode[];
    static compressToggleGapMinderTrails(path: ActionNode[]): ActionNode[];
    static createCmd(id: any): typeof GapMinderCmds.toggleGapMinderTrailsImpl | typeof GapMinderCmds.setAttributeImpl;
    static capitalize(s: string): string;
    static createToggleTrails($mainRef: IObjectRef<GapMinder>, show: boolean): import("phovea_core").IAction;
    static setAttribute(name: string, $mainRef: IObjectRef<GapMinder>, data: IObjectRef<IDataType>): import("phovea_core").IAction;
    static setAttributeScale(name: string, $mainRef: IObjectRef<GapMinder>, scale: string): import("phovea_core").IAction;
}
export declare class GapMinder extends AView {
    private elem;
    private graph;
    private static readonly filteredSelectionType;
    private dim;
    ref: IObjectRef<GapMinder>;
    noneRef: IObjectRef<any>;
    attrs: {
        x: Attribute;
        y: Attribute;
        size: Attribute;
    };
    private bounds;
    private items;
    private color;
    private colorRange;
    private $node;
    private xaxis;
    private yaxis;
    private timelinescale;
    private timelineaxis;
    private initedListener;
    private timeIds;
    private showUseTrails;
    private interactive;
    private totooltip;
    constructor(elem: Element, graph: ProvenanceGraph);
    get data(): (INumericalMatrix | IStratification)[];
    get idtypes(): any[];
    private get refData();
    get node(): Element;
    setInteractive(interactive: boolean): void;
    private init;
    private computeScales;
    private computeData;
    updateLegend(): void;
    private selectTimePoint;
    private createTooltip;
    animationDuration(): number;
    private updateChart;
    private update;
    showTrails(show: boolean): void;
    showTrailsImpl(show: boolean): void;
    private onYearSelect;
    private onItemSelect;
    private updateHoverLine;
    private updateSelectionLines;
    private updateSelectionTools;
    private updatePopulationSlider;
    private updateTimeLine;
    reset(): void;
    getBounds(): Rect;
    setBounds(x: any, y: any, w: any, h: any): void;
    relayout(): void;
    setXAttribute(m: INumericalMatrix): Promise<import("phovea_core").ICmdResult>;
    setYAttribute(m: INumericalMatrix): Promise<import("phovea_core").ICmdResult>;
    setSizeAttribute(m: INumericalMatrix): Promise<import("phovea_core").ICmdResult>;
    setColor(m: IStratification): Promise<import("phovea_core").ICmdResult>;
    setColorImpl(attr: string, m: IStratification): IObjectRef<any>;
    setAttributeImpl(attr: string, m: IDataType): Promise<IObjectRef<any>>;
    setAttributeScaleImpl(attr: string, scale: string): any;
    setAttributeScale(attr: string, scale: string): Promise<import("phovea_core").ICmdResult>;
    setAttribute(attr: string, m: IDataType): Promise<import("phovea_core").ICmdResult>;
    createTimeIds(names: string[], ids: Range, idtype: IDType): {
        idtype: IDType;
        ids: number[];
        names: string[];
        ts: number[];
        minmax: [number, number];
    };
    createItems(names: string[], ids: Range, idtype: IDType): IItem[];
    static create(parent: Element, provGraph: ProvenanceGraph): GapMinder;
}
export {};
