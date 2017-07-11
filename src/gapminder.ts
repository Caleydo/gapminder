/**
 * Created by Samuel Gratzl on 15.12.2014.
 */

import * as C from 'phovea_core/src/index';
import * as datas from 'phovea_core/src/data';
import * as datatypes from 'phovea_core/src/datatype';
import * as matrix from 'phovea_core/src/matrix';
import * as stratification from 'phovea_core/src/stratification';
import * as prov from 'phovea_core/src/provenance';
import * as idtypes from 'phovea_core/src/idtype';
import * as views from 'phovea_core/src/layout_view';
import * as ranges from 'phovea_core/src/range';
import {Rect} from 'phovea_core/src/geom';
import tooltipBind from 'phovea_d3/src/tooltip';
import * as d3 from 'd3';
import {IVisStateApp} from 'phovea_clue/src/provenance_retrieval/IVisState';
import {
  categoricalProperty, createPropertyValue, IProperty, IPropertyValue, numericalProperty, PropertyType,
  setProperty
} from 'phovea_core/src/provenance/retrieval/VisStateProperty';

const filteredSelectionType = 'filtered';

function setAttributeImpl(inputs, parameter, graph, within) {
  const gapminder:GapMinder = inputs[0].value,
    name = parameter.name;

  return inputs[1].v.then((data) => {
    if (data === '') {
      data = null;
    }
    return gapminder.setAttributeImpl(name, data).then((old) => {
      return {
        inverse: setAttribute(name, inputs[0], old),
        consumed: within
      };
    });
  });
}
function setAttributeScaleImpl(inputs, parameter, graph, within) {
  const gapminder:GapMinder = inputs[0].value,
    name = parameter.name;

  const old = gapminder.setAttributeScaleImpl(name, parameter.scale);
  return {
    inverse: setAttributeScale(name, inputs[0], old),
    consumed: within
  };
}

function toggleGapMinderTrailsImpl(inputs, parameter) {
  const gapminder:GapMinder = inputs[0].value,
    show = parameter.show;

  gapminder.showTrailsImpl(show);
  return {
    inverse: createToggleTrails(inputs[0], !show)
  };
}



/**
 * compresses the given path by removing redundant set gap minder attribute calls
 * @param path
 * @returns {prov.ActionNode[]}
 */
export function compressSetAttribute(path:prov.ActionNode[]) {
  const lastByAttribute:any = {};
  path.forEach((p) => {
    if (p.f_id === 'setGapMinderAttribute') {
      const para = p.parameter.name;
      lastByAttribute[para] = p;
    }
  });
  return path.filter((p) => {
    if (p.f_id !== 'setGapMinderAttribute') {
      return true;
    }
    const para = p.parameter.name;
    //last one remains
    return lastByAttribute[para] === p;
  });
}

/**
 * compresses the given path by removing redundant set gap minder attribute scale calls
 * @param path
 * @returns {prov.ActionNode[]}
 */
export function compressSetAttributeScale(path:prov.ActionNode[]) {
  const lastByAttribute:any = {};
  path.forEach((p) => {
    if (p.f_id === 'setGapMinderAttributeScale') {
      const para = p.parameter.name;
      lastByAttribute[para] = p;
    }
  });
  return path.filter((p) => {
    if (p.f_id !== 'setGapMinderAttributeScale') {
      return true;
    }
    const para = p.parameter.name;
    //last one remains
    return lastByAttribute[para] === p;
  });
}

export function compressToggleGapMinderTrails(path:prov.ActionNode[]) {
  const l = path.filter((p) => p.f_id === 'toggleGapMinderTrails');

  const good = l.length %2 === 0 ? null : l[l.length-1];
  //remove all except the last if uneven number of changes
  return path.filter((p) => p.f_id !== 'toggleGapMinderTrails' || p === good);
}


// externally called to recall implementation for prov graph
// rebuild based on the --> createCmd --> maps name to a function
export function createCmd(id) {
  switch (id) {
    case 'setGapMinderAttribute' :
      return setAttributeImpl;
    case 'setGapMinderAttributeScale':
      return setAttributeScaleImpl;
    case 'toggleGapMinderTrails':
      return toggleGapMinderTrailsImpl;
  }
  return null;
}

function capitalize(s: string) {
  return s.split(' ').map((d) => d[0].toUpperCase()+d.slice(1)).join(' ');
}

export function createToggleTrails($mainRef:prov.IObjectRef<GapMinder>, show: boolean) {
  return prov.action(prov.meta((show? 'Show' : 'Hide') + ' trails', prov.cat.layout, prov.op.update), 'toggleGapMinderTrails', toggleGapMinderTrailsImpl, [$mainRef], {
    show
  });
}

export function setAttribute(name:string, $mainRef:prov.IObjectRef<GapMinder>, data:prov.IObjectRef<datatypes.IDataType>) {
  return prov.action(prov.meta(capitalize(name) + '=' + (data ? data.name : '<none>'), prov.cat.data, prov.op.update), 'setGapMinderAttribute', setAttributeImpl, [$mainRef, data], {
    name
  });
}
export function setAttributeScale(name:string, $mainRef:prov.IObjectRef<GapMinder>, scale:string) {
  return prov.action(prov.meta('scale('+capitalize(name) + ')=' + capitalize(scale), prov.cat.visual, prov.op.update), 'setGapMinderAttributeScale', setAttributeScaleImpl, [$mainRef], {
    scale,
    name
  });
}

class Attribute {
  data:matrix.INumericalMatrix = null;

  arr:number[][] = null;

  constructor(public scale = 'linear') {

  }

  get label() {
    return this.data ? this.data.desc.name : 'None';
  }

  get valid() {
    return this.data !== null;
  }

  get format() {
    return d3.format(this.to_format());
  }

  to_format() {
    if (!this.valid) {
      return ',d';
    }
    return (<any>this.data.desc).formatter || ',d';
  }
}

interface IScale {
  (x:number): number;
  ticks?(count: number): number[];
}

interface IItem {
  id: number;
  name: string;
}

function createTimeIds(names:string[], ids:ranges.Range, idtype:idtypes.IDType) {
  const ts = names.map((d) => parseInt(d, 10));
  const idsAsList = ids.dim(0).asList();
  idtype.fillMapCache(idsAsList, names);
  return {
    idtype,
    ids: idsAsList,
    names,
    ts,
    minmax: d3.extent(ts)
  };
}

function createItems(names:string[], ids:ranges.Range, idtype:idtypes.IDType):IItem[] {
  const idAsList = ids.dim(0).asList();
  idtype.fillMapCache(idAsList, names);
  return idAsList.map((id, i) => {
    return {
      id,
      name: names[i]
    };
  });
}

class GapMinder extends views.AView implements IVisStateApp {

  private dim:[number, number] = [100, 100];
  ref:prov.IObjectRef<GapMinder>;
  noneRef:prov.IObjectRef<any>;

  attrs = {
    x: new Attribute(),
    y: new Attribute(),
    size: new Attribute('sqrt')
  };

  private bounds = new Rect(0,0,0,0);

  private items:IItem[] = [];

  private color:stratification.IStratification = null;
  private colorRange:ranges.CompositeRange1D = null;

  private $node:d3.Selection<GapMinder>;
  private xaxis = d3.svg.axis().orient('bottom');
  private yaxis = d3.svg.axis().orient('left');
  private timelinescale = d3.scale.linear();
  private timelineaxis = d3.svg.axis().orient('bottom').scale(this.timelinescale).tickFormat(d3.format('d'));
  //private popRadial = d3.svg.line.radial();

  private initedListener = false;
  private timeIds:any = null;

  private showUseTrails = false;

  private interactive = true;

  private totooltip = tooltipBind(this.createTooltip.bind(this), 0);

  // for colorScale domain is continent groups mapped to the range which is colorPalette
  constructor(private elem:Element, private graph:prov.ProvenanceGraph) {
    super();
    this.$node = d3.select(elem).datum(this);
    this.ref = graph.findOrAddObject(this, 'GapMinder', 'visual');

    this.noneRef = graph.findOrAddObject('', 'None', 'data');

    this.init(this.$node);
  }

  get data() {
    return [this.attrs.x.data, this.attrs.y.data, this.attrs.size.data, this.color].filter((d) => !!d);
  }

  get idtypes() {
    return Array.from(new Set([].concat(...this.data.map((d) => d.idtypes))));
  }

  /* ------------------ REF DATA ---------------------- */
  private get refData():matrix.INumericalMatrix {
    if (this.attrs.x.valid) {
      return this.attrs.x.data;
    }
    if (this.attrs.y.valid) {
      return this.attrs.y.data;
    }
    return this.attrs.size.data;
  }


  get node() {
    return <Element>this.$node.node();
  }

  /* ----------------------------------------- */

  private scatterplotStatistics = [
    'outlying',
    'skewed',
    'clumpy',
    'sparse',
    'striated',
    'convex',
    'skinny',
    'stringy',
    'monotonic'
  ];

  getVisStateProps():Promise<IProperty[]> {
    const scales = categoricalProperty('Scales', [
      'log',
      'linear',
      'sqrt'
    ]);

    const attributes = categoricalProperty('Attributes', [
      'GDP',
      'Population',
      'Child Mortality',
      'Children per woman',
      'Life Expectancy'
    ]);

    const dataStatistics = categoricalProperty('Data Statistics', [
      {id: 'spearmans_correlation', text: 'Spearman\'s Correlation'},
      {id: 'binomial_distribution', text: 'Binomial Distribution'},
      {id: 'normal_distribution', text: 'Normal Distribution'},
      {id: 'uniform_distribution', text: 'Uniform Distribution'},
      {id: 'lognormal_distribution', text: 'Lognormal Distribution'},
      {id: 'exponential_distribution', text: 'Exponential Distribution'},
    ]);

    const scatterplotStatistics = numericalProperty('Scatterplot Statistics', this.scatterplotStatistics, true);

    // wait for async property values
    return new Promise((resolve, reject) => {
      const onReady = () => {
        this.off('ready', onReady); // unregister to execute only once

        // convert countries
        const countries = setProperty('Selected Countries', this.items.map((d) => {
          return {id: d.id, text: d.name};
        }));

        const years = numericalProperty('Selected Year', this.timeIds.ids.map((id, i) => {
          return {id: this.timeIds.idtype.id, text: this.timeIds.names[i], payload: {numVal: this.timeIds.names[i]}};
        }));

        const properties = [
          attributes,
          scales,
          countries,
          years,
          //dataStatistics,
          scatterplotStatistics,
        ];

        resolve(properties);
      };
      this.on('ready', onReady.bind(this));
    });
  }

  getCurrVisState():IPropertyValue[] {
    const attrs:IPropertyValue[] = [
      createPropertyValue(PropertyType.CATEGORICAL, this.attrs.x.label),
      createPropertyValue(PropertyType.CATEGORICAL, this.attrs.x.scale),
      createPropertyValue(PropertyType.CATEGORICAL, this.attrs.y.label),
      createPropertyValue(PropertyType.CATEGORICAL, this.attrs.y.scale),
      createPropertyValue(PropertyType.CATEGORICAL, this.attrs.size.label),
      createPropertyValue(PropertyType.CATEGORICAL, this.attrs.size.scale),
      ...this.scatterplotStatistics.map((d) => {
        return createPropertyValue(PropertyType.NUMERICAL, {
          id: d,
          payload: {
            numVal: Math.random()
          }
        });
      })
    ];

    if(this.attrs.x.data) {
      const selectionIdType = this.attrs.x.data.rowtype;
      const selections = selectionIdType.selections().dim(0).asList().map((id) => {
        return createPropertyValue(PropertyType.SET, {
          id,
          text: this.items.find((d) => d.id === id).name
        });
      });

      const yearIdType = this.attrs.x.data.coltype;
      const yearId = yearIdType.selections().dim(0).asList()[0]; // only 1 year can be selected
      const yearName = this.timeIds.names[this.timeIds.ids.indexOf(yearId)];
      const year = createPropertyValue(PropertyType.NUMERICAL, {
        id: yearIdType.id,
        text: yearName,
        payload: {
          numVal: yearName
        }
      });

      attrs.push(year, ...selections);
    }

    return attrs;
  }

  /* ----------------------------------------- */
  setInteractive(interactive:boolean) {
    this.interactive = interactive;
    this.$node.selectAll('select').attr('disabled', interactive ? null : 'disabled');
    this.$node.selectAll('.slider, rect.clearer').style('pointer-events', interactive ? null : 'none');
  }

  private init($elem:d3.Selection<any>) {
    const that = this;

    //find all gapminder datasets
    datas.list((d) => /.*gapminder.*/.test(d.desc.fqname)).then((list) => {
      const matrices = <matrix.INumericalMatrix[]>list.filter((d) => d.desc.type === 'matrix');
      ['x', 'y','size'].forEach((attr) => {
        const $options = d3.select('select.attr-' + attr).selectAll('option').data(matrices);
        $options.enter().append('option');
        $options.attr('value', (d) => d.desc.id).text((d) => d.desc.name);
        $options.exit().remove();

        $elem.select('select.attr-' + attr).on('change', function () {
          that.setAttribute(attr, matrices[this.selectedIndex]);
        });
        $elem.select('select.attr-' + attr + '-scale').on('change', function () {
          that.setAttributeScale(attr, this.value);
        });
      });

      const stratifications = <stratification.IStratification[]>list.filter((d) => d.desc.type === 'stratification');
      {
        const $options = d3.select('select.attr-color').selectAll('option').data(stratifications);
        $options.enter().append('option');
        $options.attr('value', (d) => d.desc.id).text((d) => d.desc.name);
        $options.exit().remove();

        $elem.select('select.attr-color').on('change', function () {
          that.setAttribute('color', stratifications[this.selectedIndex]);
        });
      }
      //select default datasets
      if (this.graph.states.length === 1) { //first one

        this.setXAttribute(C.search(matrices, (d) => d.desc.id === 'gapminderGdp') || matrices[0]);
        this.setYAttribute(C.search(matrices, (d) => d.desc.id === 'gapminderLifeExpectancy') || matrices[0]);
        this.setSizeAttribute(C.search(matrices, (d) => d.desc.id === 'gapminderPopulation') || matrices[0]);

        this.setColor(C.search(stratifications, (d) => d.desc.id === 'gapminderContinent') || stratifications[0]);
      }
    });

    $elem.select('rect.clearer').on('click', () => {
      const ref = this.refData;
      if (ref) {
        //clear selection
        ref.rowtype.clear();
      }
    });

    this.update();
  }

  private computeScales():Promise<{ x: IScale; y: IScale; size: IScale; color: (s:string) => string }> {
    const margin = 25;
    const dim = this.dim;
    const maxShift = 1.1;

    // need to have updateLabels() also for updating labels correctly

    function to_scale(a:Attribute) {
      if (!a.valid) {
        return d3.scale.linear().domain([0, 100]);
      }
      const valueRange = a.data.valuetype.range.slice();
      valueRange[1] *= maxShift;

      if (a.scale === 'log') {
        return d3.scale.log().domain([Math.max(1, valueRange[0]), valueRange[1]]).clamp(true);
        // need to update Labels
      } else if (a.scale === 'sqrt') {
        return d3.scale.sqrt().domain(valueRange).clamp(true);
      }
      return d3.scale.linear().domain(valueRange).clamp(true);
    }

    const x = to_scale(this.attrs.x).range([80, dim[0] - 35]);
    const y = to_scale(this.attrs.y).range([dim[1] - margin, 35]);
    const s = to_scale(this.attrs.size).range([2, 40]);
    const color = this.color ? d3.scale.ordinal<string,string>().domain(this.color.groups.map((g) => g.name)).range(this.color.groups.map((g) => g.color)) : () => 'gray';

    return Promise.resolve({
      x,
      y,
      size: s,
      color
    });
  }

  private computeData(selectedTimeId:number):{ x: number; y: number; size: number; color: string }[] {
    if (this.items.length <= 0 || !this.timeIds || !this.refData) {
      return [];
    }
    const xData = this.attrs.x.arr;
    const yData = this.attrs.y.arr;
    const sData = this.attrs.size.arr;
    const cData = this.colorRange;

    const rowSelection = this.refData.rowtype.selections();
    const rowFilter = this.refData.rowtype.selections(filteredSelectionType);

    const selectecdTimeIndex = this.timeIds.ids.indexOf(selectedTimeId);

    return this.items.map((item, i) => {
      return {
        id: item.id,
        name: item.name,
        selected: rowSelection.dim(0).contains(item.id),
        filtered: rowFilter.dim(0).contains(item.id),
        x: xData && selectecdTimeIndex >= 0 ? xData[i][selectecdTimeIndex] : 0,
        y: yData && selectecdTimeIndex >= 0 ? yData[i][selectecdTimeIndex] : 0,
        size: sData && selectecdTimeIndex >= 0 ? sData[i][selectecdTimeIndex] : 0,
        //not the id ... local range
        color: cData ? C.search(cData.groups, (g) => g.contains(item.id)).name : null
      };
    });
  }

  /* ------------------ Handling Dropdown Menu ------------- */
  /* -------- called in update() --------------------------- */

  public updateLegend() {
    Object.keys(this.attrs).forEach((attr) => {
      const m = this.attrs[attr];
      const $optionns = this.$node.select('.attr-' + attr).selectAll('option');
      if (!$optionns.empty()) {
        const choices = $optionns.data();
        this.$node.select('.attr-' + attr).property('selectedIndex', choices.indexOf(m.data));
        this.$node.select('.attr-' + attr + '-scale').property('value', m.scale);
        this.$node.select('.attr-' + attr+'-label').text(m.valid ? m.data.desc.name : 'None');
        this.$node.select('.attr-' + attr+'-desc').text(m.valid ? m.data.desc.description : '');
        this.$node.select('.attr-' + attr + '-scale-label').text(m.scale);
      }
    });

    {
      const $optionns = this.$node.select('.attr-color').selectAll('option');
      if (!$optionns.empty()) {
        const choices = $optionns.data();
        this.$node.select('.attr-color').property('selectedIndex', choices.indexOf(this.color));
        this.$node.select('.attr-color-label').text(this.color != null ? (<any>this.color.desc).name : 'None');
        this.$node.select('.attr-color-desc').text(this.color != null ? (<any>this.color.desc).description : '');
      }
    }

    const that = this;
    const $legends = d3.select('div.color_legend').selectAll('div.legend').data(this.colorRange ? this.colorRange.groups : []);
    const $legendsEnter = $legends.enter().append('div').classed('legend', true)
      .on('click', function(d) {
        if (!that.interactive) {
          return;
        }
        const isActive = d3.select(this).select('i').classed('fa-circle');
        d3.select(this).select('i').classed('fa-circle-o', isActive).classed('fa-circle', !isActive);
        that.color.idtype.select(filteredSelectionType,ranges.list(d), isActive ? idtypes.SelectOperation.ADD : idtypes.SelectOperation.REMOVE);
      });
    $legendsEnter.append('i').attr('class', 'fa fa-circle');
    $legendsEnter.append('span');

    if (this.color != null) {
      const filtered = this.color.idtype.selections(filteredSelectionType).dim(0);
      $legends.select('i')
        .style('color', (d) => d.color)
        .classed('fa-circle', (d) => !filtered.contains(d.first))
        .classed('fa-circle-o', (d) => {
          return filtered.contains(d.first);
        });
    }
    $legends.select('span').text((d) => d.name);
    $legends.exit().remove();
  }

  /* ---------------------- selectTimePoint() ------------------- */
  private selectTimePoint() {
    const refData = this.refData;
    if (refData) {
      const type = refData.coltype;
      const hovered = type.selections(idtypes.hoverSelectionType).first;
      if (hovered != null) {
        return hovered;
      }
      return type.selections().first;
    }
    return null;
  }

  private createTooltip(d: any) {
    let r= `<strong>${d.name}</strong><br>`;
    const f = d3.format(',.0f');
    if (this.color) {
      r += this.color.desc.name+':\t' + d.color +'<br>';
    }
    Object.keys(this.attrs).forEach((attr) => {
      const a = this.attrs[attr];
      if (a.valid) {
        r += a.data.desc.name+':\t' + f(d[attr]) +'<br>';
      }
    });
    return r.slice(0,r.length-1);
  }

  animationDuration() {
    const guess = this.graph.executeCurrentActionWithin;
    return guess < 0 ? 100 : guess;
  }

  /* --------------------------- updateChart() ----------------------- */

  private updateChart() {
    const $chart = this.$node.select('svg.chart');
    $chart.attr({
      width: this.dim[0],
      height: this.dim[1]
    });
    $chart.select('g.xaxis').attr('transform', `translate(0,${this.dim[1] - 25})`);

    let selectedTimePoint = this.selectTimePoint();
    if (selectedTimePoint == null) {
      //HACK just use the first one
      selectedTimePoint = 0;
    }
    //$chart.select('text.act_year').attr({
    //  x: this.dim[0] * 0.5,
    //  y: this.dim[1] * 0.5
    //});

    // setting year label based on the selectedTimePoint
    if (this.timeIds && selectedTimePoint != null) {
      $chart.select('text.act_year').text(this.timeIds.names[this.timeIds.ids.indexOf(selectedTimePoint)]);
    }

    /* ------ PROMISE using computeScales(), computeData() ------------- */
    Promise.all<any>([this.computeScales(), this.computeData(selectedTimePoint == null ? -1 : selectedTimePoint)]).then((args:any[]) => {
      const scales = args[0]; // x y size color resolved
      const data:any[] = args[1];

      this.xaxis.scale(scales.x).tickFormat(this.attrs.x.format);
      this.yaxis.scale(scales.y).tickFormat(this.attrs.y.format);

      ['x', 'y'].forEach((attr) => {
        let ticks = scales[attr].ticks();
        const axis = attr === 'x' ? this.xaxis : this.yaxis;
        if (this.attrs[attr].scale === 'log' && ticks.length > 30) {
          //remove every second one
          ticks = ticks.slice(0,11).concat(d3.range(11,21,2).map((i) => ticks[i]), d3.range(21,ticks.length,3).map((i) => ticks[i]));
          axis.tickValues(ticks);
        } else {
          axis.tickValues(null);
        }
      });

      $chart.select('g.xaxis').call(this.xaxis);
      $chart.select('g.yaxis').call(this.yaxis);


      //trails idea: append a new id with the time point encoded
      data.forEach((d) => {
        d.xx = scales.x(d.x);
        d.yy = scales.y(d.y);
        d.ssize = scales.size(d.size);
      });

      const $marks = $chart.select('g.marks').selectAll('.mark').data(data, (d) => d.id + (this.showUseTrails && d.selected ? '@'+selectedTimePoint : ''));


      $marks.enter().append('circle').classed('mark', true)
        .on('click', (d) => {
          if (!this.interactive) {
            return;
          }
          this.refData.rowtype.select([<number>d.id], idtypes.toSelectOperation(<MouseEvent>d3.event));
        })
        .on('mouseenter.select', (d) => this.refData.rowtype.select(idtypes.hoverSelectionType, [d.id], idtypes.SelectOperation.ADD))
        .on('mouseleave.select', (d) => this.refData.rowtype.select(idtypes.hoverSelectionType, [d.id], idtypes.SelectOperation.REMOVE))
        .call(this.totooltip)
        .attr('data-anchor', (d) => d.id)
        .attr('data-uid',(d) =>d.id + (this.showUseTrails && d.selected ? '@'+selectedTimePoint : ''));

      $marks
        .classed('phovea-select-selected', (d) => d.selected)
        .classed('phovea-select-filtered', (d) => d.filtered)
        .attr('data-id', (d) => d.id);

      $marks.interrupt().transition()
        .duration(this.animationDuration())
        .attr({
          r: (d) => d.ssize ,
          cx: (d) => d.xx,
          cy: (d) => d.yy
        })
        .style('fill', (d) => d.ccolor = scales.color(d.color));

      this.updateSelectionTools();

      let $exit = $marks.exit();
      if(this.showUseTrails) {
        $exit = $exit.filter((d) => {
          return data.filter((d2) => d2.id === d.id && d2.selected).length <= 0;
        });
      }
      $exit
        .style('opacity', 1)
        .transition()
        .style('opacity', 0)
        .remove();

      this.updatePopulationSlider(scales.size);

    });
  }


  /*--------------- trail lines ------------- */
  /*
   private updateTrail(){
   var trailine = d3.svg.line()
   .interpolate('bundle')
   .x(function (d) {
   // return year --> i.e over time
   })
   .y(function (d) {
   // return positional coordinates
   });

   /!*  path
   .datum(this.refData) //
   .transition()
   .duration(450)
   .attr('d',trailine);*!/
   }
   */

  /* ------------------------------------------ */


  /* --------------- update() --------------------------------------------- */
  /* --- called in reset(), updateBounds(), setAttribute(), setAttributeImpScale() ------------- */
  private update() {

    //update labels
    this.updateLegend();
    this.updateTimeLine();
    this.updateChart();

    const ref = this.refData;

    if (!this.initedListener && ref) {
      this.initedListener = true;
      ref.coltype.on('select', this.onYearSelect.bind(this));
      ref.rowtype.on('select', this.onItemSelect.bind(this));
    }
  }

  showTrails(show: boolean) {
    if (!this.interactive) {
      return;
    }
    this.graph.push(createToggleTrails(this.ref, show));
  }

  showTrailsImpl(show: boolean) {
    this.showUseTrails = show;
    this.updateChart();
  }

  private onYearSelect(event:any, type:string, act:ranges.Range) {
    const id = act.first;
    if (id !== null && this.timeIds) {
      let $slider : any = this.$node.select('svg.timeline .slider');
      const selectedTimePoint = this.timeIds.ts[this.timeIds.ids.indexOf(id)];
      const x = this.timelinescale(selectedTimePoint);

      if (type === idtypes.defaultSelectionType) { //animate just for selections
        $slider = $slider.transition().duration(this.animationDuration());
      }
      $slider.attr('transform', 'translate(' + x + ',14)');
      this.updateChart();
    }
  }

  private onItemSelect(event:any, type:string, act:ranges.Range) {
    const ids = act.dim(0).asList();
    this.$node.select('svg.chart g.marks').selectAll('.mark').classed('phovea-select-' + type, (d) => ids.indexOf(d.id) >= 0);

    if (type === idtypes.hoverSelectionType) {
      this.updateHoverLine(ids);
    } else if (type === filteredSelectionType) {
      this.updateLegend();
    } else if (type === idtypes.defaultSelectionType) {
      this.updateSelectionLines(ids);
    }
  }

  private updateHoverLine(ids: number[], animate = false) {
    if (ids.length > 0) {
      const first = ids[0];
      //direct access to d3 bound object
      const d = (<any>this.node.querySelector('svg.chart g.marks .mark[data-id="'+first+'"]')).__data__;
      const x = d.xx;
      const y = d.yy;

      //hack from computeScale
      const x0 = 80;
      const y0 = this.dim[1] - 25;
      let l : any = this.$node.select('polyline.hover_line');
      if (animate) {
        l = l.interrupt().transition()
        .duration(this.animationDuration());
      }
      l.attr('points', `${x0},${y} ${x},${y} ${x},${y0}`).style('opacity', 1);
    } else {
      this.$node.select('polyline.hover_line').interrupt().style('opacity', 0);
    }
    //show the hover line for this item
  }

  private updateSelectionLines(ids:number[], animate = false) {
    const $lines = this.$node.select('g.select_lines').selectAll('polyline').data(ids, String);
    $lines.enter().append('polyline').attr('class', 'select_line');
    let l : any = $lines;
    if (animate) {
      l = l.interrupt().transition()
        .duration(this.animationDuration());
    }
    l.attr('points', (id) => {
      const d = (<any>this.node.querySelector('svg.chart g.marks .mark[data-id="'+id+'"]')).__data__;
      const x = d.xx;
      const y = d.yy;

      //hack from computeScale
      const x0 = 80;
      const y0 = this.dim[1] - 25;
      return `${x0},${y} ${x},${y} ${x},${y0}`;
    }).style('opacity', 1);
    $lines.exit().remove();
  }

  private updateSelectionTools() {
    const r = this.refData;
    if (r) {
      this.updateHoverLine(r.rowtype.selections(idtypes.hoverSelectionType).dim(0).asList(), true);
      this.updateSelectionLines(r.rowtype.selections().dim(0).asList(), true);
    }
  }

  private updatePopulationSlider(scale: IScale) {
    const $popslider = this.$node.select('svg.size_legend');
    if (!this.attrs.size.valid) {
      $popslider.selectAll('*').remove();
      return;
    }
    const t = scale.ticks(7);

    const base = t.slice(1, t.length-3).reverse();
    if (this.attrs.size.scale === 'sqrt') {
      base.push(base[base.length-1]/2);
    }
    const data = base.map((v) => ({ v, s : scale(v) }));
    const $circles = $popslider.selectAll('g.size').data(data);
    $circles.enter().append('g').classed('size', true).html('<circle></circle><text></text>');
    $circles.exit().remove();

    $circles.attr('transform', (d, i) => 'translate(0,'+(d3.sum(data.slice(0,i),(d2) => Math.max(d2.s*2,10)+2))+')');
    $circles.select('circle')
      .attr('r', (d) => d.s)
      .attr('cx', data.length > 0 ? data[0].s: 0)
      .attr('cy', (d) => d.s);
    $circles.select('text').text((d) => this.attrs.size.format(d.v))
      .attr('x', data.length > 0 ? data[0].s*2+5 : 0)
      .attr('y', (d) => d.s+5);

  }

  /* ------------------------- updateTimeLine() ------------------------------- */
  private updateTimeLine() {
    const $timeline = this.$node.select('svg.timeline');

    $timeline.attr({
      width: Math.max(this.dim[0],0),
      height: 40
    });

    // if theres data
    if (!this.timeIds) {
      return;
    }
    // slider
    let $slider = $timeline.select('.slider');

    // returns true if no timeline and false if theres a timeline
    const wasEmpty = $slider.empty();

     // timelinescale is linear
    this.timelinescale.domain(this.timeIds.minmax).range([40, this.dim[0] - 40]).clamp(true);
    $timeline.select('g.axis').attr('transform', 'translate(0,20)').call(this.timelineaxis);


    /* ---------------- dragged() ------------------------- */

    const dragged = () => {
      const xPos = (<any>d3.event).x;
      const year = d3.round(this.timelinescale.invert(xPos), 0);
      const j = this.timeIds.ts.indexOf(year);
      this.timeIds.idtype.select(idtypes.hoverSelectionType, [this.timeIds.ids[j]]);
    };

    /* ---------------------------------------------------- */

    if (wasEmpty) {
      $slider = $timeline.append('path').classed('slider', true)
        .attr('d', d3.svg.symbol().type('triangle-down')(0))
        .attr('transform', 'translate(0,14)');
      // using ref Data
      $slider.call(d3.behavior.drag()
        .on('drag', dragged)
        .on('dragend', () => {
          //select the last entry
          const s = this.timeIds.idtype.selections(idtypes.hoverSelectionType);
          this.timeIds.idtype.select(idtypes.hoverSelectionType, ranges.none());
          this.timeIds.idtype.select(s.clone());
        }));
    }

    //this.timelineaxis.ticks(20); //.tickValues(this.timeIds.range);

    const s = this.timeIds.idtype.selections().dim(0);
    let t;

    if (s.isNone && this.graph.states.length <= 4) { //just the initial datasets
      // set to 1800
      this.timeIds.idtype.select([this.timeIds.ids[0]]);
      t = this.timeIds.ts[0];
    } else {
      t = this.timeIds.ts[s.first != null ? this.timeIds.ids.indexOf(s.first): 0];
    }
    const x = this.timelinescale(t);

    // just visualizing where slider should be
    $slider.attr('transform', 'translate(' + x + ',14)');
  } // end of updateTime()

  /* ------------------- reset() ------------------------------------- */
  reset() {
    this.attrs.x = null;
    this.attrs.y = null;
    this.attrs.size = null;
    this.color = null;
    this.update();
  }

  getBounds() {
    return this.bounds;
  }

  setBounds(x, y, w, h) {
    this.bounds = new Rect(x,y,w,h);
    this.dim = [w, h];
    this.relayout();
    this.update();
  }

  relayout() {
    //nothing to do
  }


  setXAttribute(m:matrix.INumericalMatrix) {
    // cleanData(m);
    return this.setAttribute('x', m);
  }

  setYAttribute(m:matrix.INumericalMatrix) {
    return this.setAttribute('y', m);
  }

  setSizeAttribute(m:matrix.INumericalMatrix) {
    return this.setAttribute('size', m);
  }

  setColor(m:stratification.IStratification) {
    return this.setAttribute('color', m);
  }

  setColorImpl(attr:string, m:stratification.IStratification) {
    const old = this.color;
    this.color = m;

    this.update();

    return old === null ? this.noneRef : this.graph.findObject(old);
  }

  setAttributeImpl(attr:string, m:datatypes.IDataType) {
    if (m == null) {
      m = null;
    }
    const old = attr === 'color' ? this.color : this.attrs[attr].data;
    if (attr === 'color') {
      this.color = <stratification.IStratification>m;

      return (this.color ? this.color.idRange() : Promise.resolve(null)).then((arr) => {
        this.colorRange = arr;
        this.fire('ready');

        this.update();

        return old === null ? this.noneRef : this.graph.findObject(old);
      });
    } else {
      const matrix = <matrix.INumericalMatrix>m;
      const att = this.attrs[attr];
      att.data = matrix;

      this.fire('wait');
      if (this.refData === matrix && matrix != null) {
        return Promise.all<any>([matrix.data(), matrix.rows(), matrix.rowIds(), matrix.cols(), matrix.colIds()]).then((args) => {
          att.arr = args[0];

          //prepare the items
          this.items = createItems(<string[]>args[1], <ranges.Range>args[2], matrix.rowtype);

          //prepare time ids
          this.timeIds = createTimeIds(<string[]>args[3], <ranges.Range>args[4], matrix.coltype);

          this.fire('ready');

          this.update();

          return old === null ? this.noneRef : this.graph.findObject(old);
        });
      } else {
        return (matrix ? matrix.data(): Promise.resolve(null)).then((arr) => {
          this.attrs[attr].arr = arr;
          this.fire('ready');

          this.update();

          return old === null ? this.noneRef : this.graph.findObject(old);
        });
      }
    }
  }

  setAttributeScaleImpl(attr:string, scale:string) {
    const old = this.attrs[attr].scale;
    this.attrs[attr].scale = scale;

    this.update();

    return old;
  }

  setAttributeScale(attr:string, scale:string) {
    return this.graph.push(setAttributeScale(attr, this.ref, scale));
  }

  setAttribute(attr:string, m:datatypes.IDataType) {
    const mref = this.graph.findOrAddObject(m, m.desc.name, 'data');
    return this.graph.push(setAttribute(attr, this.ref, mref));
  }
}

export function create(parent:Element, provGraph:prov.ProvenanceGraph) {
  return new GapMinder(parent, provGraph);
}
