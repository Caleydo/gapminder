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
    if (data == '') {
      data = null;
    }
    return gapminder.setAttributeImpl(name, data).then((old) => {
      return {
        inverse: setAttribute(name, inputs[0], old)
      };
    });
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


export function setAttribute(name:string, $main_ref:prov.IObjectRef<GapMinder>, data:prov.IObjectRef<datatypes.IDataType>) {
  return prov.action(prov.meta(name + '=' + (data ? data.name : '<none>'), prov.cat.visual, prov.op.update), 'setGapMinderAttribute', setAttributeImpl, [$main_ref, data], {
    name: name
  });
}
export function setAttributeScale(name:string, $main_ref:prov.IObjectRef<GapMinder>, scale:string) {
  return prov.action(prov.meta(name + '_scale=' + scale, prov.cat.visual, prov.op.update), 'setGapMinderAttributeScale', setAttributeScaleImpl, [$main_ref], {
    scale: scale,
    name: name
  });
}

class Attribute {
  data:matrix.IMatrix = null;
  scale = 'linear';

  arr:number[][] = null;

  get label() {
    return this.data ? this.data.desc.name : 'None';
  }

  get valid() {
    return this.data !== null;
  }
}

interface IScale {
  (x:number): number;
}

interface IItem {
  id: number;
  name: string;
}


function createTimeIds(names:string[], ids:ranges.Range, idtype:idtypes.IDType) {
  const ts = names.map((d) => parseInt(d, 10));
  const ids_l = ids.dim(0).asList();
  idtype.fillMapCache(ids_l, names);
  return {
    idtype: idtype,
    ids: ids_l,
    names: names,
    ts: ts,
    minmax: d3.extent(ts)
  };
}

function createItems(names:string[], ids:ranges.Range, idtype:idtypes.IDType):IItem[] {
  const ids_l = ids.dim(0).asList();
  idtype.fillMapCache(ids_l, names);
  return ids_l.map((id, i) => {
    return {
      id: id,
      name: names[i]
    };
  });
}

class GapMinder extends views.AView {

  private dim:[number, number] = [100, 100];
  ref:prov.IObjectRef<GapMinder>;
  noneRef:prov.IObjectRef<any>;

  attrs = {
    x: new Attribute(),
    y: new Attribute(),
    size: new Attribute()
  };

  private items:IItem[] = [];

  private color:stratification.IStratification = null;
  private color_range:ranges.CompositeRange1D = null;

  private $node:d3.Selection<GapMinder>;
  private xaxis = d3.svg.axis().orient('bottom');
  private yaxis = d3.svg.axis().orient('left');
  private timelinescale = d3.scale.linear();
  private timelineaxis = d3.svg.axis().orient('bottom').scale(this.timelinescale).ticks(1).tickFormat(d3.format('d'));

  private initedListener = false;
  private timeIds:any = null;

  // for colorScale domain is continent groups mapped to the range which is colorPalette
  constructor(private elem:Element, private graph:prov.ProvenanceGraph) {
    super();
    this.$node = d3.select(elem).datum(this);
    this.ref = graph.findOrAddObject(this, 'GapMinder', 'visual');

    this.noneRef = graph.findOrAddObject('', 'None', 'data');

    this.init(this.$node);
  }

  /* ------------------ REF DATA ---------------------- */
  private get refData():matrix.IMatrix {
    if (this.attrs.x.valid) {
      return this.attrs.x.data;
    }
    if (this.attrs.y.valid) {
      return this.attrs.y.data;
    }
    return this.attrs.size.data;
  }


  /* ----------------------------------------- */
  setInteractive(interactive:boolean) {

    this.$node.selectAll('select').attr('disabled', interactive ? null : 'disabled');
    this.$node.select('line.slider').style('pointer-events', interactive ? null : 'none');
  }

  private init($elem:d3.Selection<any>) {
    const that = this;

    //find all gapminder datasets
    datas.list((d) => /.*gapminder.*/.test(d.desc.fqname)).then((list) => {
      const matrices = <matrix.IMatrix[]>list.filter((d) => d.desc.type === 'matrix');
      ['x', 'y'].forEach((attr) => {
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

  private computeScales():Promise<{ x: IScale; y: IScale; size: IScale; color: (s:string) => string }> {
    const margin = 25;
    const dim = this.dim;


    function to_scale(a:Attribute) {
      if (!a.valid) {
        return d3.scale.linear().domain([0, 100]);
      }

      if (a.scale === 'log') {
        return d3.scale.log().domain([Math.max(1, a.data.valuetype.range[0]), a.data.valuetype.range[1]]).clamp(true);
        // need to update Labels
      }

      return d3.scale.linear().domain(a.data.valuetype.range).clamp(true);
    }

    // rewrite to_scale to take value of .property instead

    const x = to_scale(this.attrs.x).range([100, dim[0] - 25]);
    const y = to_scale(this.attrs.y).range([dim[1] - margin, 25]);
    const s = to_scale(this.attrs.size).range([0, 200]);
    const color = this.color ? d3.scale.ordinal<string,string>().domain(this.color.groups.map((g) => g.name)).range(this.color.groups.map((g) => g.color)) : () => 'gray';

    return Promise.resolve({
      x: x,
      y: y,
      size: s,
      color: color
    });
  }

  private computeData(selectedTimeId:number):{ x: number; y: number; size: number; color: string }[] {
    if (this.items.length <= 0 || !this.timeIds || !this.refData) {
      return [];
    }
    const x_data = this.attrs.x.arr;
    const y_data = this.attrs.y.arr;
    const s_data = this.attrs.size.arr;
    const c_data = this.color_range;

    const row_sel = this.refData.rowtype.selections();
    const row_filter = this.refData.rowtype.selections('filter');

    const selectecdTimeIndex = this.timeIds.ids.indexOf(selectedTimeId);

    return this.items.map((item, i) => {
      return {
        id: item.id,
        name: item.name,
        selected: row_sel.dim(0).contains(item.id),
        filtered: row_sel.dim(0).contains(item.id),
        x: x_data && selectecdTimeIndex >= 0 ? x_data[i][selectecdTimeIndex] : 0,
        y: y_data && selectecdTimeIndex >= 0 ? y_data[i][selectecdTimeIndex] : 0,
        size: s_data && selectecdTimeIndex >= 0 ? s_data[i][selectecdTimeIndex] : 0,
        color: c_data ? C.search(c_data.groups, (g) => g.contains(item.id)).name : null
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
      }
    });
    this.$node.select('.attr-color').text(this.color ? this.color.desc.name : 'None');

    if (this.color_range) {
      const that = this;
      const $legends = d3.select('div.color_legend').selectAll('div.legend').data(this.color_range.groups);
      const $legends_enter = $legends.enter().append('div').classed('legend', true)
        .on('click', function(d) {
          const isActive = d3.select(this).select('i').classed('fa-circle-o');
          d3.select(this).select('i').classed('fa-circle-o', !isActive).classed('fa-circle', isActive);
          that.color.idtype.select('filter',ranges.list(d), isActive ? idtypes.SelectOperation.ADD : idtypes.SelectOperation.REMOVE);
        });
      $legends_enter.append('i').attr('class', 'fa fa-circle-o');
      $legends_enter.append('span');


      $legends.select('i').style('color', (d) => d.color);
      $legends.select('span').text((d) => d.name);
      $legends.exit().remove();
    }
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
    var $chart = this.$node.select('svg.chart');
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

    // setting year label based on the selectedTimePoint
    if (this.timeIds && selectedTimePoint != null) {
      $chart.select('text.act_year').text(this.timeIds.names[this.timeIds.ids.indexOf(selectedTimePoint)]);
    }

    /* ------ PROMISE using computeScales(), computeData() ------------- */
    Promise.all<any>([this.computeScales(), this.computeData(selectedTimePoint == null ? -1 : selectedTimePoint)]).then((args:any[]) => {
      const scales = args[0]; // x y size color resolved
      const data:any[] = args[1];

      $chart.select('g.xaxis').call(this.xaxis.scale(scales.x));
      $chart.select('g.yaxis').call(this.yaxis.scale(scales.y));

      const $marks = $chart.select('g.marks').selectAll('.mark').data(data, (d) => d.id);


      $marks.enter().append('circle').classed('mark', true)
        .on('click', (d) => this.refData.rowtype.select([d.id], idtypes.toSelectOperation(d3.event)))
        .on('mouseenter', (d) => this.refData.rowtype.select(idtypes.hoverSelectionType, [d.id], idtypes.SelectOperation.ADD))
        .on('mouseleave', (d) => this.refData.rowtype.select(idtypes.hoverSelectionType, [d.id], idtypes.SelectOperation.REMOVE))
        .append('title');

      $marks
        .classed('select-selected', (d) => d.selected)
        .classed('select-filtered', (d) => d.filtered)
        .attr('data-id', (d) => d.id)
        .select('title').text((d) => `${d.name}\nx=${d.x}\ny=${d.y}\nsize=${d.size}\ncolor=${d.color}`);
      $marks.interrupt().transition()
        .duration(100)
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
      ref.coltype.on('select', this.onYearSelect.bind(this));
      ref.rowtype.on('select', this.onItemSelect.bind(this));
    }
  }

  private onYearSelect(event:any, type:string, new_:ranges.Range) {
    const id = new_.first;
    if (id !== null && this.timeIds) {
      var $slider = this.$node.select('svg.timeline .slider');
      const selectedTimePoint = this.timeIds.ts[this.timeIds.ids.indexOf(id)];
      const x = this.timelinescale(selectedTimePoint);
      $slider.attr('transform', 'translate(' + x + ',0)');
      this.updateChart();
    }
  }

  private onItemSelect(event:any, type:string, new_:ranges.Range) {
    const ids = new_.dim(0).asList();
    const $marks = this.$node.select('svg.chart g.marks').selectAll('.mark').classed('select-' + type, (d) => ids.indexOf(d.id) >= 0);

    if (type === idtypes.hoverSelectionType) {
      if (ids.length > 0) {
        let first = ids[0];
        let $item = $marks.filter((d) => d.id === first);
        let x = parseInt($item.attr('cx'), 10);
        let y = parseInt($item.attr('cy'), 10);

        //hack from computeScale
        const x0 = 100;
        const y0 = this.dim[1] - 25;

        this.$node.select('polyline.hover_line').transition()
          .attr('points', `${x0},${y} ${x},${y} ${x},${y0}`)
          .style('opacity', 1)
      } else {
        this.$node.select('path.hover_line').transition().style('opacity', 0);
      }
      //show the hover line for this item
    }
  }

  /* ------------------------- updateTimeLine() ------------------------------- */
  private updateTimeLine() {
    var $timeline = this.$node.select('svg.timeline');

    $timeline.attr({
      width: Math.max(this.dim[0], 0),
      height: 40
    });

    // if theres data
    if (!this.timeIds) {
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
      const year = d3.round(this.timelinescale.invert(xPos), 0);
      const j = this.timeIds.ts.indexOf(year);
      this.timeIds.idtype.select(idtypes.hoverSelectionType, [this.timeIds.ids[j]]);
    };

    /* ---------------------------------------------------- */

    if (wasEmpty) {
      $slider = $timeline.append('circle').classed('slider', true)
        .attr('r', 10)
        .attr('cy', 20);
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

    // timelinescale is linear
    this.timelinescale.domain(this.timeIds.minmax).range([40, this.dim[0] - 40]).clamp(true);

    const s = this.timeIds.idtype.selections().dim(0);
    var t;

    if (s.isNone) {
      // set to 1800
      this.timeIds.idtype.select([this.timeIds.ids[0]]);
      t = this.timeIds.ts[0];
    } else {
      t = this.timeIds.ts[this.timeIds.ids.indexOf(s.first)];
    }
    const x = this.timelinescale(t);

    // just visualizing where slider should be
    $slider.attr('transform', 'translate(' + x + ',0)');

    $timeline.select('g.axis').attr('transform', 'translate(0,20)').call(this.timelineaxis);
  } // end of updateTime()

  /* ------------------- reset() ------------------------------------- */
  reset() {
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

      return (this.color ? this.color.range() : Promise.resolve(null)).then((arr) => {
        this.color_range = arr;
        this.fire('ready');

        this.update();

        return old === null ? this.noneRef : this.graph.findObject(old);
      });
    } else {
      let matrix = <matrix.IMatrix>m;
      let att = this.attrs[attr];
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
