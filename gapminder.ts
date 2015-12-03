/**
 * Created by Samuel Gratzl on 15.12.2014.
 */

import C = require('../caleydo_core/main');
import datas = require('../caleydo_core/data');
import datatypes = require('../caleydo_core/datatype');
import matrix = require('../caleydo_core/matrix');
import stratification = require('../caleydo_core/stratification');
import prov = require('../caleydo_provenance/main');
import idtypes = require('../caleydo_core/idtype');
import views = require('../caleydo_core/layout_view');
import ranges = require('../caleydo_core/range');
import d3 = require('d3');

function setAttributeImpl(inputs, parameter) {
  var gapminder:GapMinder = inputs[0].value,
    name = parameter.name;

  return inputs[1].v.then((data) => {
    const old = gapminder.setAttributeImpl(name, data);
    return {
      inverse: setAttribute(name, inputs[0], old)
    };
  });
}
function setAttributeScaleImpl(inputs, parameter) {
  var gapminder:GapMinder = inputs[0].value,
    name = parameter.name;

  const old = gapminder.setAttributeScaleImpl(name, parameter.scale);
  return {
    inverse: setAttributeScale(name, inputs[0], old)
  };
}

/**
 * compresses the given path by removing redundant set gap minder attribute calls
 * @param path
 * @returns {prov.ActionNode[]}
 */
export function compressSetAttribute(path: prov.ActionNode[]) {
  const lastByAttribute : any = {};
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
export function compressSetAttributeScale(path: prov.ActionNode[]) {
  const lastByAttribute : any = {};
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


// externally called to recall implementation for prov graph
// rebuild based on the --> createCmd --> maps name to a function
export function createCmd(id) {
  switch (id) {
    case 'setGapMinderAttribute' :
      return setAttributeImpl;
    case 'setGapMinderAttributeScale':
      return setAttributeScaleImpl;
  }
  return null;
}


export function setAttribute(name: string, $main_ref:prov.IObjectRef<GapMinder>, data:prov.IObjectRef<datatypes.IDataType>) {
  return prov.action(prov.meta(name+'='+(data?data.name:'<none>'), prov.cat.visual, prov.op.update), 'setGapMinderAttribute', setAttributeImpl, [$main_ref, data], {
    name: name
  });
}
export function setAttributeScale(name: string, $main_ref:prov.IObjectRef<GapMinder>, scale: string) {
  return prov.action(prov.meta(name+'_scale='+scale, prov.cat.visual, prov.op.update), 'setGapMinderAttributeScale', setAttributeScaleImpl, [$main_ref], {
    scale: scale,
    name: name
  });
}

class Attribute {
  data:matrix.IMatrix = null;
  scale = 'linear';

  get label() {
    return this.data ? this.data.desc.name : 'None';
  }

  get valid() {
    return this.data !== null;
  }
}

interface IScale {
  (x: number): number;
}

class GapMinder extends views.AView {

  private dim:[number, number] = [100,100];
  ref:prov.IObjectRef<GapMinder>;
  noneRef : prov.IObjectRef<any>;

  public attrs: {
    x : Attribute,
    y : Attribute,
    size : Attribute,
  } = {
    x: new Attribute(),
    y: new Attribute(),
    size: new Attribute()
  };

  private color: stratification.IStratification = null;

  private $elem: d3.Selection<GapMinder>;
  private xaxis = d3.svg.axis().orient('bottom');
  private yaxis = d3.svg.axis().orient('left');
  private timelineaxis = d3.svg.axis().orient('bottom');
  private timelinescale = d3.scale.linear();
  private xScale = d3.scale.linear();
  private yScale = d3.scale.linear();

  private initedListener = false;
  private timeIds: any = null;

  // for colorScale domain is continent groups mapped to the range which is colorPalette
  constructor(private elem:Element, private graph:prov.ProvenanceGraph) {
    super();
    this.$elem = d3.select(elem).datum(this);
    this.ref = graph.findOrAddObject(this, 'GapMinder', 'visual');

    this.noneRef = graph.findOrAddObject('', 'None', 'data');

    this.init(this.$elem);
  }

  /* ------------------ REF DATA ---------------------- */
  private get refData(): matrix.IMatrix {
    if (this.attrs.x.valid) {
      return this.attrs.x.data;
    }
    if (this.attrs.y.valid) {
      return this.attrs.y.data;
    }
    return this.attrs.size.data;
  }


  /* ----------------------------------------- */
  setInteractive(interactive: boolean) {

    this.$elem.selectAll('select').attr('disabled',interactive ? null: 'disabled');
    this.$elem.select('line.slider').style('pointer-events', interactive ? null: 'none');
  }

  private init($elem: d3.Selection<any>) {

    //find all gapminder datasets
    datas.list((d) => /.*gapminder.*/.test(d.desc.fqname)).then((list) => {
      const matrices = <matrix.IMatrix[]>list.filter((d) => d.desc.type === 'matrix');
      ['x', 'y'].forEach((attr) => {
        const $options = d3.select('select.attr-'+attr).selectAll('option').data(matrices);
        $options.enter().append('option');
        $options.attr('value', (d) => d.desc.id).text((d) => d.desc.name);
        $options.exit().remove();
      });
      //select default datasets
      if (this.graph.states.length === 1) { //first one
        this.setXAttribute(C.search(matrices, (d) => d.desc.id === 'gapminderGdp') || matrices[0]);
        this.setYAttribute(C.search(matrices, (d) => d.desc.id === 'gapminderChildMortality5Years') || matrices[0]);
        this.setSizeAttribute(C.search(matrices, (d) => d.desc.id === 'gapminderPopulation') || matrices[0]);
        const stratifications = <stratification.IStratification[]>list.filter((d) => d.desc.type === 'stratification');
        this.setColor(C.search(stratifications, (d) => d.desc.id === 'gapminderContinent') || stratifications[0]);
      }
    });

    this.update();
  }

  private computeScales() : Promise<{ x: IScale; y: IScale; size: IScale; color: (s:string) => string }> {
    const margin = 25;
    const dim = this.dim;


    function to_scale(a : Attribute) {
      if (!a.valid) {
        return d3.scale.linear().domain([0,100]);
      }

      if (a.scale === 'log') {
        return d3.scale.log().domain([Math.max(1,a.data.valuetype.range[0]),a.data.valuetype.range[1]]).clamp(true);
        // need to update Labels
      }

      return d3.scale.linear().domain(a.data.valuetype.range).clamp(true);
    }

    // rewrite to_scale to take value of .property instead

    const x = to_scale(this.attrs.x).range([100,dim[0]-25]);
    const y = to_scale(this.attrs.y).range([dim[1]-margin,25]);
    const s = to_scale(this.attrs.size).range([0,40]);
    const color = this.color ? d3.scale.category10().domain(this.color.groups.map((g) => g.name)) : () => 'gray';

    return Promise.resolve( {
      x: x,
      y: y,
      size: s,
      color: color
    });
  }


  private getTimeIds(){
    const data = this.refData;
    if (!data) {
      return Promise.resolve({
        idtype: null,
        ids: [],
        names: [],
        ts: [],
        minmax : [0,0]
      });
    }

    //
    return Promise.all<any>([data.cols(), data.colIds()]).then((args) => {
      const names = <string[]>args[0];
      const ids = <ranges.Range>args[1];
      const ts = names.map((d) => parseInt(d,10));

      return {
        idtype: data.coltype,
        ids: ids.dim(0).asList(),
        names: names,
        ts : ts,
        minmax: d3.extent(ts)
      };
    });
  }

  // getTimeIds() --> returns object type --> idtype, ids, names

  private computeData(selectedTimeId : number) : Promise<{ x: number; y: number; size: number; color: string }[]> {
    if (!this.attrs.x.valid && !this.attrs.y.valid && !this.attrs.size.valid) {
      return Promise.resolve([]);
    }
    const xd = this.attrs.x.data;
    const yd = this.attrs.y.data;
    const sd = this.attrs.size.data;
    const cd = this.color;

    const to_data = (d) => d && selectedTimeId >= 0 ? d.slice(selectedTimeId).data() : null;
    const to_range = (d) => d ? d.range() : null;

    return Promise.all([this.refData.rowIds(), this.refData.rows(), to_data(xd), to_data(yd), to_data(sd), to_range(cd)]).then((dd) => {
      const ids : ranges.Range = dd[0]; //id_range
      const names :string[] = dd[1]; // rows
      const x_data : number[] = dd[2]; //
      const y_data : number[] = dd[3]; //
      const s_data : number[] = dd[4];
      const c_data : ranges.CompositeRange1D = dd[5];
      const row_sel = this.refData.rowtype.selections();

      return ids.dim(0).asList().map((id, i) => {
        return {
          id: id,
          selected : row_sel.dim(0).contains(id),
          name: names ? names[i] : 0,
          x: x_data ? x_data[i] : 0,
          y: y_data ? y_data[i] : 0,
          size: s_data ? s_data[i] : 0,
          color: c_data ? C.search(c_data.groups, (g) => g.contains(id)).color : null
        };
      });
    });
  }

  /* ------------------ Handling Dropdown Menu ------------- */
  /* -------- called in update() --------------------------- */

  public updateLegend() {
    Object.keys(this.attrs).forEach((attr) => {
      const m = this.attrs[attr];
      this.$elem.select('.attr-'+attr).property('value',m.valid ? m.data.desc.id: null);
      this.$elem.select('.attr-'+attr+'-scale').property('value',m.scale);
    });
    this.$elem.select('.attr-color').text(this.color ? this.color.desc.name :'None');
  }
 /* ---------------------- selectTimePoint() ------------------- */
  private selectTimePoint() {
    var refData = this.refData;
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

 /* --------------------------- updateChart() ----------------------- */

  private updateChart() {
    var $chart = this.$elem.select('svg.chart');
    $chart.attr({
      width: this.dim[0],
      height: this.dim[1]
    });
    $chart.select('g.xaxis').attr('transform', `translate(0,${this.dim[1] - 25})`);

    const selectedTimePoint = this.selectTimePoint();
    $chart.select('text.act_year').attr({
      x: this.dim[0] * 0.5,
      y: this.dim[1] * 0.5
    });

    var refData = this.refData;
    // setting year label based on the selectedTimePoint
    if (this.timeIds && selectedTimePoint != null) {
      $chart.select('text.act_year').text(this.timeIds.names[this.timeIds.ids.indexOf(selectedTimePoint)]);
    }

    /* ------ PROMISE using computeScales(), computeData() ------------- */
    Promise.all<any>([this.computeScales(), this.computeData(selectedTimePoint)]).then((args:any[]) => {
      const scales = args[0]; // x y size color resolved
      const data:any[] = args[1];

      $chart.select('g.xaxis').call(this.xaxis.scale(scales.x));
      $chart.select('g.yaxis').call(this.yaxis.scale(scales.y));

      const $marks = $chart.select('g.marks').selectAll('.mark').data(data, (d) => d.id);


      $marks.enter().append('circle').classed('mark', true)
       .on('click', (d) => this.refData.rowtype.select([d.id], idtypes.toSelectOperation(d3.event)))
        .append('title');

      $marks.classed('select-selected', (d) => d.selected)
        .select('title').text((d) => d.name);
      $marks.transition()
        .attr({
          r: (d) => scales.size(d.size),
          cx: (d) => scales.x(d.x),
          cy: (d) => scales.y(d.y)
        })
        .style('fill', (d) => scales.color(d.color));
      $marks.exit()
        .style('opacity', 1)
        .transition()
        .style('opacity', 0)
        .remove();
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
      ref.coltype.on('select', (event: any, type: string, new_: ranges.Range) => {
        const id = new_.first;
        if (id && this.timeIds) {
          var $slider = this.$elem.select('svg.timeline .slider');
          const selectedTimePoint = this.timeIds.ts[this.timeIds.ids.indexOf(id)];
          const x = this.timelinescale(selectedTimePoint);
          $slider.attr('transform', 'translate('+x+',0)');
          this.updateChart();
        }
      });
      ref.rowtype.on('select', (event: any, type: string, new_: ranges.Range) => {
        const ids = new_.dim(0).asList();
        this.$elem.select('svg.chart g.marks').selectAll('.mark').classed('select-'+type,(d) => ids.indexOf(d.id) >= 0);
      });
    }
  }

  /* ------------------------- updateTimeLine() ------------------------------- */
  private updateTimeLine() {
    const d = this.refData;
    var $timeline = this.$elem.select('svg.timeline');

    $timeline.attr({
      width: Math.max(this.dim[0]-20,0),
      height: 30
    });

    // if theres data
    if (!d) {
      return;
    }
    // slider
    var $slider = $timeline.select('.slider');

    // returns true if no timeline and false if theres a timeline
    var wasEmpty = $slider.empty();

    if (!$slider.empty()) { //already there
      return;
    }
    /* ---------------- dragged() ------------------------- */

    var dragged = () => {
      const xPos = (<any>d3.event).x;
      const year = d3.round(this.timelinescale.invert(xPos),0);
      const j = this.timeIds.ts.indexOf(year);
      this.timeIds.idtype.select(idtypes.hoverSelectionType, [this.timeIds.ids[j]]);
    };

     /* ---------------------------------------------------- */

    if (wasEmpty) {
      $slider = $timeline.append('circle').classed('slider', true).attr('r', 10);
      // using ref Data
      $slider.call(d3.behavior.drag()
        .on('drag', dragged)
        .on('dragend', () => {
          //select the last entry
          const s = d.coltype.selections(idtypes.hoverSelectionType);
          this.timeIds.idtype.select(idtypes.hoverSelectionType, ranges.none());
          this.timeIds.idtype.select(s.clone());
        }));
    }

    this.getTimeIds().then((data) => {
      this.timeIds = data;

      // timelinescale is linear
      var timeScaler = this.timelinescale.domain(data.minmax).range([20, this.dim[0] - 25]).clamp(true);

      const s = data.idtype.selections().dim(0);
      var t;

      if (s.isNone) {
        // set to 1800
        data.idtype.select([data.ids[0]]);
        t = data.ts[0];
      } else {
        t = data.ts[data.ids.indexOf(s.first)];
      }
      const x = this.timelinescale(t);

      // just visualizing where slider should be
      $slider.attr('transform', 'translate('+x+',0)');
    });
  } // end of updateTime()

  /* ------------------- reset() ------------------------------------- */
  reset(){
    this.attrs.x = null;
    this.attrs.y = null;
    this.attrs.size = null;
    this.color = null;
    this.update();
  }

  setBounds(x, y, w, h) {
    super.setBounds(x, y, w, h);
    this.dim = [w, h];
    this.relayout();
    this.update();
  }

  relayout() {
    //nothing to do
  }

/*  cleanData(m:matrix.IMatrix){
    //var ccd = m.filter(function (d) { return d.id > 0;});
    return cdd;
    }*/


  setXAttribute(m:matrix.IMatrix) {
    // cleanData(m);
    return this.setAttribute('x', m);
  }
  setYAttribute(m:matrix.IMatrix) {
    return this.setAttribute('y', m);
  }
  setSizeAttribute(m:matrix.IMatrix) {
    return this.setAttribute('size', m);
  }

  setColor(m:stratification.IStratification) {
    return this.setAttribute('color',m);
  }

  setColorImpl(attr: string, m: stratification.IStratification) {
    const old = this.color;
    this.color = m;

    this.update();

    return old === null ? this.noneRef : this.graph.findObject(old);
  }

  setAttributeImpl(attr: string, m: datatypes.IDataType) {
    const old = attr === 'color' ? this.color : this.attrs[attr].data;
    if (attr === 'color') {
      this.color = <stratification.IStratification>m;
    } else {
      this.attrs[attr].data = <matrix.IMatrix>m;
    }

    this.update();

    return old === null ? this.noneRef : this.graph.findObject(old);
  }

  setAttributeScaleImpl(attr: string, scale: string) {
    const old = this.attrs[attr].scale;
    this.attrs[attr].scale = scale;

    this.update();

    return old;
  }

  setAttribute(attr: string, m: datatypes.IDataType) {
    var that = this;
    var mref = this.graph.findOrAddObject(m, m.desc.name, 'data');
    return that.graph.push(setAttribute(attr, this.ref, mref));
  }
}

export function create(parent:Element, provGraph:prov.ProvenanceGraph) {
  return new GapMinder(parent, provGraph);
}
