//core data 'structures' are actually embedded in typed arrays

//points

//pox/poy are original positions at time of creation
//poldx/poldy are used by relax() to calculate velocity
let PX = 0, PY = 1, PRADIUS = 2, PINTEN = 3, PID = 4, PLVL = 5;
let POX = 6, POY = 7, PDX = 8, PDY = 9, POLDX = 10, POLDY = 11, PBAD = 12, PRADIUS2 = 13;
let PTH = 14, PTOT = 15;

window.APP_VERSION = 0.6;

Math._random = Math.random;
Math.random = function () {
  if (USE_MERSENNE) {
    return _util.random();
  } else {
    return Math._random();
  }
}

window.RASTER_MODES = {
  DIFFUSION: 0,
  PATTERN  : 1,
  CMYK     : 2
}

window.USE_CMYK_MASK = false;

window._search_offs = new Array(64);
_search_offs[0] = [];

let _const = undefined;
define([
  "util", "mask_file", "ui", "profiles"
], function (util, mask_file, ui, profiles) {
  'use strict';

  let exports = _const = {};

  exports.defaultConfig = Object.assign({
    DIMEN : 256
  }, profiles.BASIC);

  exports.DefaultCurves = {
    TONE_CURVE   : undefined,
    DENSITY_CURVE: undefined
  };

  window._checkConfigKey = function(key, val) {
    if (!(key in exports.defaultConfig)) {
      exports.defaultConfig[key] = val;
    }
  }

  exports.toJSON = function () {
    let ret = {};

    for (let k in exports.defaultConfig) {
      ret[k] = window[k];
    }

    return ret;
  }

  exports.loadJSON = function (json) {
    for (let k in json) {
      if (typeof k === "symbol") {
        continue;
      }

      let v = json[k];

      if (typeof v === "object" && v.is_new_curve !== undefined) {
        console.log("Loading curve!");
        v = new ui.Curve(k);
      }

      window[k] = v;

      if (!(k in exports.defaultConfig)) {
        exports.defaultConfig[k] = v;
      }
    }

    return this;
  }

  //note that we config into global variables, need to refactor this
  //to be properly encapsulated.
  exports.loadJSON(exports.defaultConfig);

  let _spotfuncs = exports._spotfuncs = {};

  let bez4 = exports.bez4 = function bez4(a, b, c, d, t) {
    let r1 = a + (b - a)*t;
    let r2 = b + (c - b)*t;
    let r3 = c + (d - c)*t;

    let r4 = r1 + (r2 - r1)*t;
    let r5 = r2 + (r3 - r2)*t;

    return r4 + (r5 - r4)*t;
  }

  let get_spotfunc = exports.get_spotfunc = function get_spotfunc(n, inten, noreport) {
    let r = n, i = n;

    if (_spotfuncs.length <= n) {
      _spotfuncs.length = n + 1;
    }

    let key = n + "," + inten.toFixed(2);

    if (_spotfuncs[key] != undefined) {
      return _spotfuncs[key];
    }

    if (!noreport)
      console.trace("generate search a off of radius", n, "...");

    let lst = [];
    for (let x = -i; x <= i; x++) {
      for (let y = -i; y <= i; y++) {
        let x2 = x < 0 ? x + 0 : x;
        let y2 = y < 0 ? y + 0 : y;

        let dis = x2*x2 + y2*y2;
        dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;

        //*
        let sqrdis = Math.max(Math.abs(x2), Math.abs(y2))*Math.sqrt(2.0);

        //let f = 1.0-Math.sqrt(0.0001+inten);

        //f = 1.0-Math.abs(f-0.5)*2.0;
        //f *= f;

        let f = inten;
        f = f < 0.4 ? 1 : 0;

        if (n > 1) {
          dis = dis*(1.0 - f) + sqrdis*f;
        }

        //dis = sqrdis;
        //*/

        if (dis > r + 0.0001) {
          continue;
        }

        lst.push([x, y]);
      }
    }

    //sort by distance
    lst.sort(function (a, b) {
      return a[0]*a[0] + a[1]*a[1] - b[0]*b[0] - b[1]*b[1];
    });

    _spotfuncs[key] = lst;

    return lst;
  }

  let get_searchoff = exports.get_searchoff = function get_searchoff(n, noreport) {
    let r = n, i = n;

    if (_search_offs.length <= n) {
      _search_offs.length = n + 1;
    }

    if (_search_offs[n] != undefined) {
      return _search_offs[n];
    }

    if (!noreport)
      console.trace("generate search a off of radius", n, "...");

    let lst = [];
    for (let x = -i; x <= i; x++) {
      for (let y = -i; y <= i; y++) {
        //why did I write these next two lines again?
        //let x2 = x < 0 ? x+1 : x;
        //let y2 = y < 0 ? y+1 : y;
        let x2 = x, y2 = y;

        let dis = x2*x2 + y2*y2;
        //dis = dis != 0.0 ? Math.sqrt(dis) : 0.0;

        //console.log(dis.toFixed(3), r.toFixed(3));

        if (dis > r*r) {
          continue;
        }

        lst.push([x, y]);
      }
    }

    //sort by distance
    lst.sort(function (a, b) {
      return a[0]*a[0] + a[1]*a[1] - b[0]*b[0] - b[1]*b[1];
    });

    _search_offs[n] = lst;

    return lst;
  }

  for (let i = 0; i < 32; i++) {
    get_searchoff(i, true);
  }


  let spline = exports.spline = function spline() {
    let t = arguments[arguments.length - 1];

    for (let i = arguments.length - 3; i >= 0; i -= 2) {
      if (t >= arguments[i]) {
        let ta = arguments[i];
        let tb = arguments[i < arguments.length - 3 ? i + 2 : i];

        let a = arguments[i + 1];
        let b = arguments[i < arguments.length - 3 ? i + 3 : i + 1];

        t -= ta;
        if (tb != ta)
          t /= tb - ta;

        return a + (b - a)*t;
      }
    }

    return 0.0;
  }

  exports.sharpen_cache = new Array(256);

  let last_sharpness = -1;
  exports.basic_cache = new Array(256);

  exports.get_sharpen_filter = function get_sharpen_filter(fwid, sharpness) {
    if (!window.SHARPEN) {
      if (exports.basic_cache[fwid] != undefined) {
        return exports.basic_cache[fwid];
      }

      let ret = [];
      for (let i = 0; i < fwid*fwid; i++) {
        let fwid2 = fwid - 1;

        let xoff = ((i)%fwid)/fwid2;
        let yoff = (~~((i)/fwid))/fwid2;

        xoff -= 0.5;
        yoff -= 0.5;

        let w = xoff*xoff + yoff*yoff;

        w = w == 0.0 ? 0.0 : Math.sqrt(w);
        w = 1.0 - w/Math.sqrt(2.0);
        w = Math.pow(w, 3.0);

        ret.push(w);
      }

      exports.basic_cache[fwid] = ret;
      return ret;
    }

    if (last_sharpness != sharpness) {
      last_sharpness = sharpness;
      exports.sharpen_cache = {};
    }

    if (exports.sharpen_cache[fwid] != undefined) {
      return exports.sharpen_cache[fwid];
    }

    function bez4(a, b, c, d, t) {
      let r1 = a + (b - a)*t;
      let r2 = b + (c - b)*t;
      let r3 = c + (d - c)*t;

      let r4 = r1 + (r2 - r1)*t;
      let r5 = r2 + (r3 - r2)*t;

      return r4 + (r5 - r4)*t;
    }

    let ret = [];
    let totsample = fwid*fwid;
    for (let i = 0; i < totsample; i++) {
      if (0 && totsample == 9) {
        let d = 2;

        ret = [
          -d, -d, -d,
          -d, 22, -d,
          -d, -d, -d,
        ]
        let tot = 0;

        for (let j = 0; j < totsample; j++) {
          tot += ret[j];
        }

        for (let j = 0; j < totsample; j++) {
          ret[j] /= tot;
        }

        break
      }

      let fwid2 = fwid - 1;
      let xoff = ((i)%fwid)/fwid2;
      let yoff = (~~((i)/fwid))/fwid2;

      xoff -= 0.5;
      yoff -= 0.5;

      let w = xoff*xoff + yoff*yoff;

      w = w == 0.0 ? 0.0 : Math.sqrt(w);
      w = 1.0 - 2.0*w/Math.sqrt(2.0);

      /*
      w = spline(
        0,0,
        0.3, -0.3,
        1.0, 1.3,
        w
      );
      //*/

      let fac = 1.3;

      let s = sharpness;

      w = bez4(0, -0.75 - s*2, (0.95 + s*2)*fac, 1.0, w);

      ret.push(w);
    }

    exports.sharpen_cache[fwid] = ret;
    return ret;
  }

  return exports;
});
