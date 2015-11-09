/**
 * Created by Samuel Gratzl on 15.12.2014.
 */
import C = require('../caleydo_core/main');
import datatypes = require('../caleydo_core/datatype');
import matrix = require('../caleydo_core/matrix');
import prov = require('../caleydo_provenance/main');
import views = require('../caleydo_core/layout_view');
import ranges = require('../caleydo_core/range');
import databrowser = require('../caleydo_window/databrowser');
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

export function setAttribute(name: string, $main_ref:prov.IObjectRef<GapMinder>, data:prov.IObjectRef<matrix.IMatrix>) {
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

  private $elem: d3.Selection<GapMinder>;

  private xaxis = d3.svg.axis().orient('bottom');
  private yaxis = d3.svg.axis().orient('left');

  constructor(private elem:Element, private provGraph:prov.ProvenanceGraph) {
    super();
    this.$elem = d3.select(elem).datum(this);
    this.ref = provGraph.findOrAddObject(this, 'GapMinder', 'visual');

    this.noneRef = provGraph.findOrAddObject('', 'None', 'data');

    this.init(this.$elem);
  }


  private init($elem: d3.Selection<any>) {
    const that = this;
    Object.keys(this.attrs).forEach((attr) => {
      const sel = $elem.select('.attr-'+attr);
      databrowser.makeDropable(<Element>sel.node())
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
        return d3.scale.log().domain([Math.max(1,a.data.valuetype.range[0]),a.data.valuetype.range[1]]);
      }
      return d3.scale.linear().domain(a.data.valuetype.range);
    }

    const x = to_scale(this.attrs.x).range([100,dim[0]-25]);
    const y = to_scale(this.attrs.y).range([dim[1]-margin,25]);
    const s = to_scale(this.attrs.size).range([1,200]);

    return Promise.resolve( {
      x: x,
      y: y,
      size: s,
      color: (d) => d
    });
  }
  private computeData() : Promise<{ x: number; y: number; size: number; color: string }[]> {
    //no data
    if (!this.attrs.x.valid && !this.attrs.y.valid && !this.attrs.size.valid) {
      return Promise.resolve([]);
    }
    const xd = this.attrs.x.data;
    const yd = this.attrs.y.data;
    const sd = this.attrs.size.data;

    const to_ids = (d) => d ? d.rowIds(): null;
    const to_data = (d, r) => d ? d.slice(0).data(r) : null;

    return Promise.all([to_ids(xd), to_ids(yd), to_ids(sd)]).then((ids) => {
      var r:ranges.Range = null;
      ids.forEach((id) => {
        if (id) {
          if (r === null) {
            r = id;
          } else {
            r = r.intersect(id);
          }
        }
      });
      return Promise.all([r, (xd ? xd : (yd ? yd : sd)).rows(r), to_data(xd, r), to_data(yd, r), to_data(sd, r)]);
    }).then((dd) => {
      const r = dd[0];
      const names = dd[1];
      const x_data = dd[2];
      const y_data = dd[3];
      const s_data = dd[4];

      //r contains the valid ids
      return r.dim(0).asList().map((id, i) => {
        return {
          id: id,
          name: names ? names[i] : 0,
          x: x_data ? x_data[i] : 0,
          y: y_data ? y_data[i] : 0,
          size: s_data ? s_data[i] : 0,
          color: 'black'
        };
      });
    });
  }


  private update() {
    //TODO

    Object.keys(this.attrs).forEach((attr) => {
      const m = this.attrs[attr];
      this.$elem.select('.attr-'+attr).text(m.label);
      this.$elem.select('.attr-'+attr+'-scale').property('value',m.scale);
    });

    var $chart = this.$elem.select('svg.chart');
    $chart.attr({
      width: this.dim[0],
      height: this.dim[1]
    });
    $chart.select('g.xaxis').attr('transform', `translate(0,${this.dim[1]-25})`);

    Promise.all<any>([this.computeScales(), this.computeData()]).then((args : any[]) => {
      const scales = args[0];
      const data : any[] = args[1];
      $chart.select('g.xaxis').call(this.xaxis.scale(scales.x));
      $chart.select('g.yaxis').call(this.yaxis.scale(scales.y));

      const $marks = $chart.select('g.marks').selectAll('.mark').data(data, (d) => d.id);
      const $marks_enter = $marks.enter().append('g').classed('mark',true)
        .attr('transform',(d) => `translate(${scales.x(d.x)},${scales.y(d.y)})`);
      $marks_enter.append('circle')
        .attr('r',(d) => scales.size(d.size))
        .style('fill', (d) => scales.color(d.color))
        .append('title');

      $marks.transition()
        .attr('transform',(d) => `translate(${scales.x(d.x)},${scales.y(d.y)})`)
        .select('circle').attr('r',(d) => scales.size(d.size))
        .select('title').text((d) => d.name);

      $marks.exit()
        .style('opacity',1)
        .transition()
          .style('opacity',0)
          .remove();
    });
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

  setAttributeImpl(attr: string, m: matrix.IMatrix) {
    const old = this.attrs[attr].data;
    this.attrs[attr].data = m;

    this.update();

    return old === null ? this.noneRef : this.provGraph.findObject(old);
  }

  setAttributeScaleImpl(attr: string, scale: string) {
    const old = this.attrs[attr].scale;
    this.attrs[attr].scale = scale;

    this.update();

    return old;
  }

  setAttribute(attr: string, m: matrix.IMatrix) {
    var that = this;
    var mref = this.provGraph.findOrAddObject(m, m.desc.name, 'data');
    that.provGraph.push(setAttribute(attr, this.ref, mref));
  }
}
export function create(parent:Element, provGraph:prov.ProvenanceGraph) {
  return new GapMinder(parent, provGraph);
}
