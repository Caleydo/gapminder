/**
 * Created by Samuel Gratzl on 15.12.2014.
 */
/// <amd-dependency path='d3-lasso-plugin' />
import C = require('../caleydo_core/main');
import datatypes = require('../caleydo_core/datatype');
import matrix = require('../caleydo_core/matrix');
import stratification = require('../caleydo_core/stratification');
import prov = require('../caleydo_provenance/main');
import idtypes = require('../caleydo_core/idtype');
import views = require('../caleydo_core/layout_view');
import ranges = require('../caleydo_core/range');
import databrowser = require('../caleydo_d3/databrowser');
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
  return prov.action(prov.meta('Set Attribute ' + name+' to '+(data?data.name:'<none>'), prov.cat.visual, prov.op.update), 'setGapMinderAttribute', setAttributeImpl, [$main_ref, data], {
    name: name
  });
}
export function setAttributeScale(name: string, $main_ref:prov.IObjectRef<GapMinder>, scale: string) {
  return prov.action(prov.meta('Set Attribute ' + name+' to '+scale, prov.cat.visual, prov.op.update), 'setGapMinderAttributeScale', setAttributeScaleImpl, [$main_ref], {
    scale: scale,
    name: name
  });
}

class Attribute {
  data : matrix.IMatrix = null;
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

  private attrs: {
    x : Attribute,
    y : Attribute,
    size : Attribute,
  } = {
    x: new Attribute(),
    y: new Attribute(),
    size: new Attribute()
  };
  private color : stratification.IStratification = null;

  private $elem: d3.Selection<GapMinder>;

  private xaxis = d3.svg.axis().orient('bottom');
  private yaxis = d3.svg.axis().orient('left');

  private timelineaxis = d3.svg.axis().orient('bottom');
  private timelinescale = d3.scale.ordinal<string,number>();

  private lasso : any;

  constructor(private elem:Element, private provGraph:prov.ProvenanceGraph) {
    super();
    this.$elem = d3.select(elem).datum(this);
    this.ref = provGraph.findOrAddObject(this, 'GapMinder', 'visual');

    this.noneRef = provGraph.findOrAddObject('', 'None', 'data');

    this.init(this.$elem);
  }

  private get refData(): matrix.IMatrix {
    if (this.attrs.x.valid) {
      return this.attrs.x.data;
    }
    if (this.attrs.y.valid) {
      return this.attrs.y.data;
    }
    return this.attrs.size.data;
  }

  setInteractive(interactive: boolean) {
    this.$elem.select('rect.lassoarea').style('display', interactive ? null: 'none');
    this.$elem.selectAll('select').attr('disabled',interactive ? null: 'disabled');
    this.$elem.select('line.marker').style('pointer-events', interactive ? null: 'none');
  }


  private init($elem: d3.Selection<any>) {
    const that = this;
    Object.keys(this.attrs).forEach((attr) => {
      const sel = $elem.select('.attr-'+attr);
      databrowser.makeDropable(<Element>sel.node(), null, { types: ['matrix']})
      .on('enter', () => sel.classed('over', true))
      .on('enter', () => sel.classed('over', false))
      .on('drop', (event, d) => {
        sel.classed('over', false);
        this.setAttribute(attr, d);
      });
      $elem.select('select.attr-'+attr+'-scale').on('change', function() {
        that.provGraph.push(setAttributeScale(attr, that.ref, this.value));
      })
    });
    {
      const sel = $elem.select('.attr-color');
      databrowser.makeDropable(<Element>sel.node(), null, { types: ['stratification']})
      .on('enter', () => sel.classed('over', true))
      .on('enter', () => sel.classed('over', false))
      .on('drop', (event, d) => {
        sel.classed('over', false);
        this.setColor(d);
      });
    }

    // Lasso functions to execute while lassoing
    var lasso_start = function () {
      /*lasso.items()
       .attr("r",3.5) // reset size
       .style("fill",null) // clear all of the fills
       .classed({"not_possible":true,"selected":false}); // style as not possible
       */
    };

    var lasso_draw = function () {
      /*// Style the possible dots
       lasso.items().filter(function(d) {return d.possible===true})
       .classed({"not_possible":false,"possible":true});

       // Style the not possible dot
       lasso.items().filter(function(d) {return d.possible===false})
       .classed({"not_possible":true,"possible":false});
       */
    };

    var lasso_end = () => {
      const selected = this.lasso.items().filter(function(d) {return d.selected===true}).data();
      this.lasso.items().classed('select-selected', (d) => d.selected);
      console.log(selected.map((d) => d.id));
      const refdata = this.refData;
      if (refdata) {
        refdata.rowtype.select(selected.map((d) => d.id));
      }
    };

    // Create the area where the lasso event can be triggered
    var $lasso_area = $elem.select('rect.lassoarea');

    // Define the lasso
    this.lasso = (<any>d3).lasso()
      .closePathDistance(75) // max distance for the lasso loop to be closed
      .closePathSelect(true) // can items be selected by closing the path?
      .hoverSelect(true) // can items by selected by hovering over them?
      .area($lasso_area) // area where the lasso can be started
      .on('start', lasso_start) // lasso start function
      .on('draw', lasso_draw) // lasso draw function
      .on('end', lasso_end); // lasso end function

    // Init the lasso on the svg:g that contains the dots
    $elem.select('g.marks').call(this.lasso);

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
      }
      return d3.scale.linear().domain(a.data.valuetype.range).clamp(true);
    }

    const x = to_scale(this.attrs.x).range([100,dim[0]-25]);
    const y = to_scale(this.attrs.y).range([dim[1]-margin,25]);
    const s = to_scale(this.attrs.size).range([1,100]);

    return Promise.resolve( {
      x: x,
      y: y,
      size: s,
      color: (d) => d
    });
  }

  private getTimeIds() {
    const xd = this.attrs.x.data;
    const yd = this.attrs.y.data;
    const sd = this.attrs.size.data;
    if (!xd && !yd && !sd) {
      return Promise.resolve({
        idtype: null,
        ids: [],
        names: []
      });
    }
    return Promise.all<any>([xd ? xd.colIds() : null, yd ? yd.colIds() : null, sd ? sd.colIds() : null, xd ? xd.cols() : null, yd ? yd.cols() : null, sd ? sd.cols() : null]).then((arr) => {
      var ids = ranges.Range1D.none();
      var lookup : any = {};
      const names = arr.slice(3);
      arr.slice(0,3).forEach((a: ranges.Range, i) => {
        if (a) {
          ids = ids.union(a.dim(0));
          const name = names[i];
          a.dim(0).asList().forEach((id,j) => {
            lookup[id] = name[j];
          });
        }
      });
      //we have the union ids, now their names
      ids = ids.sort();
      var name = [];
      ids.forEach((id) => name.push(lookup[id]));
      return {
        idtype: (xd ? xd.coltype : (yd ? yd.coltype : sd.coltype)),
        ids: ids.asList(),
        names: name
      };
    })
  }

  private getRowIds() {
    const xd = this.attrs.x.data;
    const yd = this.attrs.y.data;
    const sd = this.attrs.size.data;
    if (!xd && !yd && !sd) {
      return Promise.resolve({
        ids: ranges.none(),
        names: []
      });
    }
    return Promise.all<any>([xd ? xd.rowIds() : null, yd ? yd.rowIds() : null, sd ? sd.rowIds() : null, xd ? xd.rows() : null, yd ? yd.rows() : null, sd ? sd.rows() : null]).then((arr) => {
      var ids = ranges.Range1D.none();
      var lookup : any = {};
      const names = arr.slice(3);
      arr.slice(0,3).forEach((a: ranges.Range, i) => {
        if (a) {
          ids = ids.intersect(a.dim(0));
          const name = names[i];
          a.dim(0).asList().forEach((id,j) => {
            lookup[id] = name[j];
          });
        }
      });
      //we have the union ids, now their names
      ids = ids.sort();
      var name = [];
      ids.forEach((id) => name.push(lookup[id]));
      return {
        ids: ranges.list(ids),
        names: name
      };
    })
  }

  private computeData(selectedTimeId : number) : Promise<{ x: number; y: number; size: number; color: string }[]> {
    //no data
    if (!this.attrs.x.valid && !this.attrs.y.valid && !this.attrs.size.valid) {
      return Promise.resolve([]);
    }
    const xd = this.attrs.x.data;
    const yd = this.attrs.y.data;
    const sd = this.attrs.size.data;

    const to_ids = (d) => d ? d.rowIds(): null;
    const to_cols = (d) => d ? d.colIds(): null;
    const to_data = (d, r, dim) => d && dim >= 0 ? d.slice(dim).data(r) : null;

    return Promise.all([this.refData.rowIds(), to_ids(xd), to_ids(yd), to_ids(sd), to_cols(xd), to_cols(yd), to_cols(sd)]).then((ids) => {
      var id_range:ranges.Range = ids[0];

      ids.slice(1,4).forEach((id: ranges.Range) => {
        if (id) {
          id_range = id_range.intersect(id);
        }
      });
      id_range = ranges.list(id_range.dim(0).sort());
      const localids = ids.slice(0,4).map((id: ranges.Range) => {
        return id ? id.indexOf(id_range) : null
      });
      const localdims = ids.slice(4).map((cols) => {
        return selectedTimeId == null || !cols ? 0 : cols.indexOf(selectedTimeId);
      });
      return Promise.all([id_range, this.refData.rows(localids[0]), to_data(xd, localids[1], localdims[0]), to_data(yd, localids[2], localdims[1]), to_data(sd, localids[3], localdims[2])]);
    }).then((dd) => {
      const r = dd[0];
      const names = dd[1];
      const x_data = dd[2];
      const y_data = dd[3];
      const s_data = dd[4];
      const row_sel = this.refData.rowtype.selections();

      //r contains the valid ids
      return r.dim(0).asList().map((id, i) => {
        return {
          id: id,
          selected : row_sel.dim(0).contains(id),
          name: names ? names[i] : 0,
          x: x_data ? x_data[i] : 0,
          y: y_data ? y_data[i] : 0,
          size: s_data ? s_data[i] : 0,
          color: id
        };
      });
    });
  }
  private updateLegend() {
    Object.keys(this.attrs).forEach((attr) => {
      const m = this.attrs[attr];
      this.$elem.select('.attr-'+attr).text(m.label);
      this.$elem.select('.attr-'+attr+'-scale').property('value',m.scale);
    });
    this.$elem.select('.attr-color').text(this.color ? this.color.desc.name : 'None');
  }

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

  private updateChart(force = false) {
    var $chart = this.$elem.select('svg.chart');
    $chart.attr({
      width: this.dim[0],
      height: this.dim[1]
    });
    $chart.select('g.xaxis').attr('transform', `translate(0,${this.dim[1]-25})`);

    const selectedTimePoint = this.selectTimePoint();
    $chart.select('text.act_year').attr({
      x : this.dim[0]*0.5,
      y : this.dim[1]*0.5
    });
    var refData = this.refData;
    if (refData && selectedTimePoint != null) {
      refData.coltype.unmap([selectedTimePoint]).then((names) => {
        $chart.select('text.act_year').text(names[0]);
      });
    }

    {
      //
      const b = C.bounds(<Element>$chart.node());
      this.lasso.itemOffset({
        left: b.x,
        top: b.y,
      });
    }

    Promise.all<any>([this.computeScales(), this.computeData(selectedTimePoint)]).then((args : any[]) => {
      const scales = args[0];
      const data : any[] = args[1];
      $chart.select('g.xaxis').call(this.xaxis.scale(scales.x));
      $chart.select('g.yaxis').call(this.yaxis.scale(scales.y));

      const $marks = $chart.select('g.marks').selectAll('.mark').data(data, (d) => d.id);
      const $marks_enter = $marks.enter().append('circle').classed('mark',true)
        .each(function(d){
          const $this = d3.select(this);
          if (force) {
            $this.attr({
              r : 1,
              cx: 0,
              cy: 0
            });
          }
          if (d.size) {
            $this.attr('r', scales.size(d.size));
          }
          if (d.x) {
            $this.attr('cx', scales.x(d.x));
          }
          if (d.y) {
            $this.attr('cy', scales.y(d.y));
          }
        })
        //.style('fill', (d) => scales.color(d.color))
        .on('click', (d) => {
          this.refData.rowtype.select([d.id], idtypes.toSelectOperation(d3.event));
        })
        .append('title');

      this.lasso.items($marks);
      $marks.classed('select-selected', (d) => d.selected)
          .select('title').text((d) => d.name);
      $marks.transition()
        .each(function(d){
          const $this = d3.select(this);
          if (d.size) {
            $this.attr('r', scales.size(d.size));
          }
          if (d.x) {
            $this.attr('cx', scales.x(d.x));
          }
          if (d.y) {
            $this.attr('cy', scales.y(d.y));
          }
        });

      $marks.exit()
        .style('opacity',1)
        .transition()
          .style('opacity',0)
          .remove();
    });
  }

  private initedListener = false;
  private timeIds: any = null;

  private update(force = false) {
    //update labels
    this.updateLegend();
    this.updateTimeLine();
    this.updateChart(force);

    const ref = this.refData;
    if (!this.initedListener && ref) {
      this.initedListener = true;
      ref.coltype.on('select', (event: any, type: string, new_: ranges.Range) => {
        const id = new_.first;
        if (id && this.timeIds) {
          var $marker = this.$elem.select('svg.timeline line.marker');
          const selectedTimePoint = this.timeIds.names[this.timeIds.ids.indexOf(id)];
          const x = this.timelinescale(selectedTimePoint);
          $marker.attr({
            x1: x,
            x2: x
          });
          this.updateChart();
        }
      });
      ref.rowtype.on('select', (event: any, type: string, new_: ranges.Range) => {
        const ids = new_.dim(0).asList();
        this.$elem.select('svg.chart g.marks').selectAll('.mark').classed('select-'+type,(d) => ids.indexOf(d.id) >= 0);
      });
    }
  }

  private updateTimeLine() {
    const d = this.refData;
    var $chart = this.$elem.select('svg.timeline');
    $chart.attr({
      width: Math.max(this.dim[0]-200,0),
      height: 25
    });
    if (d) {
      var $marker = $chart.select('line.marker');
      var wasEmpty = $marker.empty();
      if ($marker.empty()) {
        $marker = $chart.append('line').classed('marker', true).attr({
          y1: 2,
          y2: 22
        }).call(d3.behavior.drag().on('drag', () => {
          var xPos = (<any>d3.event).x;
          var leftEdges = this.timelinescale.range();
          var width = this.timelinescale.rangeBand();
          var j;
          for(j=0; xPos > (leftEdges[j] + width); j++) {}
            //do nothing, just increment j until case fails
          //j in the new position
          this.timeIds.idtype.select(idtypes.hoverSelectionType, [this.timeIds.ids[j]]);
        }).on('dragend', () => {
          //select the last entry
          const s = d.coltype.selections(idtypes.hoverSelectionType);
          this.timeIds.idtype.select(idtypes.hoverSelectionType, ranges.none());
          this.timeIds.idtype.select(s.clone());
        }));
      }
      this.getTimeIds().then((data) => {
        this.timeIds = data;
        this.timelinescale.domain(data.names).rangeRoundPoints([20, this.dim[0]-220]);
        const sample = [];
        for (let i = 0; i < data.names.length; i+= 10) {
          sample.push(data.names[i]);
        }
        sample.push(data.names[data.names.length-1]);
        $chart.select('g.axis').call(this.timelineaxis.scale(this.timelinescale).tickValues(sample));

        if (wasEmpty) {
          const s = data.idtype.selections().dim(0);
          var t;
          if (s.isNone) {
            data.idtype.select([data.ids[0] ]);
            t = data.names[0];
          } else {
            t = data.names[<any>(data.ids.indexOf(s.first))];
          }
          const x = this.timelinescale(t);
          $marker.attr({
            x1: x,
            x2: x
          });
        }
      });
    }
  }

  reset() {
    this.attrs.x = null;
    this.attrs.y = null;
    this.attrs.size = null;
    this.$elem.selectAll('.attr-x,.attr-y,.attr-size').text('');
    this.update();
  }

  setBounds(x, y, w, h) {
    super.setBounds(x, y, w, h);
    this.dim = [w, h];
    this.relayout();
    this.update();
  }

  relayout() {

  }

  setXAttribute(m:matrix.IMatrix) {
    this.setAttribute('x', m);
  }
  setYAttribute(m:matrix.IMatrix) {
    this.setAttribute('y', m);
  }
  setSizeAttribute(m:matrix.IMatrix) {
    this.setAttribute('size', m);
  }
  setColor(m:stratification.IStratification) {
    this.setAttribute('color',m);
  }
  setColorImpl(attr: string, m: stratification.IStratification) {
    const old = this.color;
    this.color = m;

    this.update(true);

    return old === null ? this.noneRef : this.provGraph.findObject(old);
  }

  setAttributeImpl(attr: string, m: datatypes.IDataType) {
    const old = attr === 'color' ? this.color : this.attrs[attr].data;
    if (attr === 'color') {
      this.color = <stratification.IStratification>m;
    } else {
      this.attrs[attr].data = <matrix.IMatrix>m;
    }

    this.update(true);

    return old === null ? this.noneRef : this.provGraph.findObject(old);
  }

  setAttributeScaleImpl(attr: string, scale: string) {
    const old = this.attrs[attr].scale;
    this.attrs[attr].scale = scale;

    this.update();

    return old;
  }

  setAttribute(attr: string, m: datatypes.IDataType) {
    var that = this;
    var mref = this.provGraph.findOrAddObject(m, m.desc.name, 'data');
    that.provGraph.push(setAttribute(attr, this.ref, mref));
  }
}
export function create(parent:Element, provGraph:prov.ProvenanceGraph) {
  return new GapMinder(parent, provGraph);
}
