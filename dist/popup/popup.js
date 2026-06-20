"use strict";
(() => {
  // node_modules/.pnpm/preact@10.29.2/node_modules/preact/dist/preact.module.js
  var n;
  var l;
  var u;
  var t;
  var i;
  var r;
  var o;
  var e;
  var f;
  var c;
  var a;
  var s;
  var h;
  var p;
  var v;
  var y;
  var d = {};
  var w = [];
  var _ = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;
  var g = Array.isArray;
  function m(n2, l3) {
    for (var u4 in l3) n2[u4] = l3[u4];
    return n2;
  }
  function b(n2) {
    n2 && n2.parentNode && n2.parentNode.removeChild(n2);
  }
  function k(l3, u4, t3) {
    var i4, r3, o3, e3 = {};
    for (o3 in u4) "key" == o3 ? i4 = u4[o3] : "ref" == o3 ? r3 = u4[o3] : e3[o3] = u4[o3];
    if (arguments.length > 2 && (e3.children = arguments.length > 3 ? n.call(arguments, 2) : t3), "function" == typeof l3 && null != l3.defaultProps) for (o3 in l3.defaultProps) void 0 === e3[o3] && (e3[o3] = l3.defaultProps[o3]);
    return x(l3, e3, i4, r3, null);
  }
  function x(n2, t3, i4, r3, o3) {
    var e3 = { type: n2, props: t3, key: i4, ref: r3, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: null == o3 ? ++u : o3, __i: -1, __u: 0 };
    return null == o3 && null != l.vnode && l.vnode(e3), e3;
  }
  function S(n2) {
    return n2.children;
  }
  function C(n2, l3) {
    this.props = n2, this.context = l3;
  }
  function $(n2, l3) {
    if (null == l3) return n2.__ ? $(n2.__, n2.__i + 1) : null;
    for (var u4; l3 < n2.__k.length; l3++) if (null != (u4 = n2.__k[l3]) && null != u4.__e) return u4.__e;
    return "function" == typeof n2.type ? $(n2) : null;
  }
  function I(n2) {
    if (n2.__P && n2.__d) {
      var u4 = n2.__v, t3 = u4.__e, i4 = [], r3 = [], o3 = m({}, u4);
      o3.__v = u4.__v + 1, l.vnode && l.vnode(o3), q(n2.__P, o3, u4, n2.__n, n2.__P.namespaceURI, 32 & u4.__u ? [t3] : null, i4, null == t3 ? $(u4) : t3, !!(32 & u4.__u), r3), o3.__v = u4.__v, o3.__.__k[o3.__i] = o3, D(i4, o3, r3), u4.__e = u4.__ = null, o3.__e != t3 && P(o3);
    }
  }
  function P(n2) {
    if (null != (n2 = n2.__) && null != n2.__c) return n2.__e = n2.__c.base = null, n2.__k.some(function(l3) {
      if (null != l3 && null != l3.__e) return n2.__e = n2.__c.base = l3.__e;
    }), P(n2);
  }
  function A(n2) {
    (!n2.__d && (n2.__d = true) && i.push(n2) && !H.__r++ || r != l.debounceRendering) && ((r = l.debounceRendering) || o)(H);
  }
  function H() {
    try {
      for (var n2, l3 = 1; i.length; ) i.length > l3 && i.sort(e), n2 = i.shift(), l3 = i.length, I(n2);
    } finally {
      i.length = H.__r = 0;
    }
  }
  function L(n2, l3, u4, t3, i4, r3, o3, e3, f4, c3, a3) {
    var s3, h3, p3, v3, y3, _2, g2, m3 = t3 && t3.__k || w, b2 = l3.length;
    for (f4 = T(u4, l3, m3, f4, b2), s3 = 0; s3 < b2; s3++) null != (p3 = u4.__k[s3]) && (h3 = -1 != p3.__i && m3[p3.__i] || d, p3.__i = s3, _2 = q(n2, p3, h3, i4, r3, o3, e3, f4, c3, a3), v3 = p3.__e, p3.ref && h3.ref != p3.ref && (h3.ref && J(h3.ref, null, p3), a3.push(p3.ref, p3.__c || v3, p3)), null == y3 && null != v3 && (y3 = v3), (g2 = !!(4 & p3.__u)) || h3.__k === p3.__k ? (f4 = j(p3, f4, n2, g2), g2 && h3.__e && (h3.__e = null)) : "function" == typeof p3.type && void 0 !== _2 ? f4 = _2 : v3 && (f4 = v3.nextSibling), p3.__u &= -7);
    return u4.__e = y3, f4;
  }
  function T(n2, l3, u4, t3, i4) {
    var r3, o3, e3, f4, c3, a3 = u4.length, s3 = a3, h3 = 0;
    for (n2.__k = new Array(i4), r3 = 0; r3 < i4; r3++) null != (o3 = l3[r3]) && "boolean" != typeof o3 && "function" != typeof o3 ? ("string" == typeof o3 || "number" == typeof o3 || "bigint" == typeof o3 || o3.constructor == String ? o3 = n2.__k[r3] = x(null, o3, null, null, null) : g(o3) ? o3 = n2.__k[r3] = x(S, { children: o3 }, null, null, null) : void 0 === o3.constructor && o3.__b > 0 ? o3 = n2.__k[r3] = x(o3.type, o3.props, o3.key, o3.ref ? o3.ref : null, o3.__v) : n2.__k[r3] = o3, f4 = r3 + h3, o3.__ = n2, o3.__b = n2.__b + 1, e3 = null, -1 != (c3 = o3.__i = O(o3, u4, f4, s3)) && (s3--, (e3 = u4[c3]) && (e3.__u |= 2)), null == e3 || null == e3.__v ? (-1 == c3 && (i4 > a3 ? h3-- : i4 < a3 && h3++), "function" != typeof o3.type && (o3.__u |= 4)) : c3 != f4 && (c3 == f4 - 1 ? h3-- : c3 == f4 + 1 ? h3++ : (c3 > f4 ? h3-- : h3++, o3.__u |= 4))) : n2.__k[r3] = null;
    if (s3) for (r3 = 0; r3 < a3; r3++) null != (e3 = u4[r3]) && 0 == (2 & e3.__u) && (e3.__e == t3 && (t3 = $(e3)), K(e3, e3));
    return t3;
  }
  function j(n2, l3, u4, t3) {
    var i4, r3;
    if ("function" == typeof n2.type) {
      for (i4 = n2.__k, r3 = 0; i4 && r3 < i4.length; r3++) i4[r3] && (i4[r3].__ = n2, l3 = j(i4[r3], l3, u4, t3));
      return l3;
    }
    n2.__e != l3 && (t3 && (l3 && n2.type && !l3.parentNode && (l3 = $(n2)), u4.insertBefore(n2.__e, l3 || null)), l3 = n2.__e);
    do {
      l3 = l3 && l3.nextSibling;
    } while (null != l3 && 8 == l3.nodeType);
    return l3;
  }
  function O(n2, l3, u4, t3) {
    var i4, r3, o3, e3 = n2.key, f4 = n2.type, c3 = l3[u4], a3 = null != c3 && 0 == (2 & c3.__u);
    if (null === c3 && null == e3 || a3 && e3 == c3.key && f4 == c3.type) return u4;
    if (t3 > (a3 ? 1 : 0)) {
      for (i4 = u4 - 1, r3 = u4 + 1; i4 >= 0 || r3 < l3.length; ) if (null != (c3 = l3[o3 = i4 >= 0 ? i4-- : r3++]) && 0 == (2 & c3.__u) && e3 == c3.key && f4 == c3.type) return o3;
    }
    return -1;
  }
  function z(n2, l3, u4) {
    "-" == l3[0] ? n2.setProperty(l3, null == u4 ? "" : u4) : n2[l3] = null == u4 ? "" : "number" != typeof u4 || _.test(l3) ? u4 : u4 + "px";
  }
  function N(n2, l3, u4, t3, i4) {
    var r3, o3;
    n: if ("style" == l3) if ("string" == typeof u4) n2.style.cssText = u4;
    else {
      if ("string" == typeof t3 && (n2.style.cssText = t3 = ""), t3) for (l3 in t3) u4 && l3 in u4 || z(n2.style, l3, "");
      if (u4) for (l3 in u4) t3 && u4[l3] == t3[l3] || z(n2.style, l3, u4[l3]);
    }
    else if ("o" == l3[0] && "n" == l3[1]) r3 = l3 != (l3 = l3.replace(s, "$1")), o3 = l3.toLowerCase(), l3 = o3 in n2 || "onFocusOut" == l3 || "onFocusIn" == l3 ? o3.slice(2) : l3.slice(2), n2.l || (n2.l = {}), n2.l[l3 + r3] = u4, u4 ? t3 ? u4[a] = t3[a] : (u4[a] = h, n2.addEventListener(l3, r3 ? v : p, r3)) : n2.removeEventListener(l3, r3 ? v : p, r3);
    else {
      if ("http://www.w3.org/2000/svg" == i4) l3 = l3.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
      else if ("width" != l3 && "height" != l3 && "href" != l3 && "list" != l3 && "form" != l3 && "tabIndex" != l3 && "download" != l3 && "rowSpan" != l3 && "colSpan" != l3 && "role" != l3 && "popover" != l3 && l3 in n2) try {
        n2[l3] = null == u4 ? "" : u4;
        break n;
      } catch (n3) {
      }
      "function" == typeof u4 || (null == u4 || false === u4 && "-" != l3[4] ? n2.removeAttribute(l3) : n2.setAttribute(l3, "popover" == l3 && 1 == u4 ? "" : u4));
    }
  }
  function V(n2) {
    return function(u4) {
      if (this.l) {
        var t3 = this.l[u4.type + n2];
        if (null == u4[c]) u4[c] = h++;
        else if (u4[c] < t3[a]) return;
        return t3(l.event ? l.event(u4) : u4);
      }
    };
  }
  function q(n2, u4, t3, i4, r3, o3, e3, f4, c3, a3) {
    var s3, h3, p3, v3, y3, d3, _2, k3, x3, M, $2, I2, P2, A3, H2, T3 = u4.type;
    if (void 0 !== u4.constructor) return null;
    128 & t3.__u && (c3 = !!(32 & t3.__u), o3 = [f4 = u4.__e = t3.__e]), (s3 = l.__b) && s3(u4);
    n: if ("function" == typeof T3) try {
      if (k3 = u4.props, x3 = T3.prototype && T3.prototype.render, M = (s3 = T3.contextType) && i4[s3.__c], $2 = s3 ? M ? M.props.value : s3.__ : i4, t3.__c ? _2 = (h3 = u4.__c = t3.__c).__ = h3.__E : (x3 ? u4.__c = h3 = new T3(k3, $2) : (u4.__c = h3 = new C(k3, $2), h3.constructor = T3, h3.render = Q), M && M.sub(h3), h3.state || (h3.state = {}), h3.__n = i4, p3 = h3.__d = true, h3.__h = [], h3._sb = []), x3 && null == h3.__s && (h3.__s = h3.state), x3 && null != T3.getDerivedStateFromProps && (h3.__s == h3.state && (h3.__s = m({}, h3.__s)), m(h3.__s, T3.getDerivedStateFromProps(k3, h3.__s))), v3 = h3.props, y3 = h3.state, h3.__v = u4, p3) x3 && null == T3.getDerivedStateFromProps && null != h3.componentWillMount && h3.componentWillMount(), x3 && null != h3.componentDidMount && h3.__h.push(h3.componentDidMount);
      else {
        if (x3 && null == T3.getDerivedStateFromProps && k3 !== v3 && null != h3.componentWillReceiveProps && h3.componentWillReceiveProps(k3, $2), u4.__v == t3.__v || !h3.__e && null != h3.shouldComponentUpdate && false === h3.shouldComponentUpdate(k3, h3.__s, $2)) {
          u4.__v != t3.__v && (h3.props = k3, h3.state = h3.__s, h3.__d = false), u4.__e = t3.__e, u4.__k = t3.__k, u4.__k.some(function(n3) {
            n3 && (n3.__ = u4);
          }), w.push.apply(h3.__h, h3._sb), h3._sb = [], h3.__h.length && e3.push(h3);
          break n;
        }
        null != h3.componentWillUpdate && h3.componentWillUpdate(k3, h3.__s, $2), x3 && null != h3.componentDidUpdate && h3.__h.push(function() {
          h3.componentDidUpdate(v3, y3, d3);
        });
      }
      if (h3.context = $2, h3.props = k3, h3.__P = n2, h3.__e = false, I2 = l.__r, P2 = 0, x3) h3.state = h3.__s, h3.__d = false, I2 && I2(u4), s3 = h3.render(h3.props, h3.state, h3.context), w.push.apply(h3.__h, h3._sb), h3._sb = [];
      else do {
        h3.__d = false, I2 && I2(u4), s3 = h3.render(h3.props, h3.state, h3.context), h3.state = h3.__s;
      } while (h3.__d && ++P2 < 25);
      h3.state = h3.__s, null != h3.getChildContext && (i4 = m(m({}, i4), h3.getChildContext())), x3 && !p3 && null != h3.getSnapshotBeforeUpdate && (d3 = h3.getSnapshotBeforeUpdate(v3, y3)), A3 = null != s3 && s3.type === S && null == s3.key ? E(s3.props.children) : s3, f4 = L(n2, g(A3) ? A3 : [A3], u4, t3, i4, r3, o3, e3, f4, c3, a3), h3.base = u4.__e, u4.__u &= -161, h3.__h.length && e3.push(h3), _2 && (h3.__E = h3.__ = null);
    } catch (n3) {
      if (u4.__v = null, c3 || null != o3) if (n3.then) {
        for (u4.__u |= c3 ? 160 : 128; f4 && 8 == f4.nodeType && f4.nextSibling; ) f4 = f4.nextSibling;
        o3[o3.indexOf(f4)] = null, u4.__e = f4;
      } else {
        for (H2 = o3.length; H2--; ) b(o3[H2]);
        B(u4);
      }
      else u4.__e = t3.__e, u4.__k = t3.__k, n3.then || B(u4);
      l.__e(n3, u4, t3);
    }
    else null == o3 && u4.__v == t3.__v ? (u4.__k = t3.__k, u4.__e = t3.__e) : f4 = u4.__e = G(t3.__e, u4, t3, i4, r3, o3, e3, c3, a3);
    return (s3 = l.diffed) && s3(u4), 128 & u4.__u ? void 0 : f4;
  }
  function B(n2) {
    n2 && (n2.__c && (n2.__c.__e = true), n2.__k && n2.__k.some(B));
  }
  function D(n2, u4, t3) {
    for (var i4 = 0; i4 < t3.length; i4++) J(t3[i4], t3[++i4], t3[++i4]);
    l.__c && l.__c(u4, n2), n2.some(function(u5) {
      try {
        n2 = u5.__h, u5.__h = [], n2.some(function(n3) {
          n3.call(u5);
        });
      } catch (n3) {
        l.__e(n3, u5.__v);
      }
    });
  }
  function E(n2) {
    return "object" != typeof n2 || null == n2 || n2.__b > 0 ? n2 : g(n2) ? n2.map(E) : void 0 !== n2.constructor ? null : m({}, n2);
  }
  function G(u4, t3, i4, r3, o3, e3, f4, c3, a3) {
    var s3, h3, p3, v3, y3, w3, _2, m3 = i4.props || d, k3 = t3.props, x3 = t3.type;
    if ("svg" == x3 ? o3 = "http://www.w3.org/2000/svg" : "math" == x3 ? o3 = "http://www.w3.org/1998/Math/MathML" : o3 || (o3 = "http://www.w3.org/1999/xhtml"), null != e3) {
      for (s3 = 0; s3 < e3.length; s3++) if ((y3 = e3[s3]) && "setAttribute" in y3 == !!x3 && (x3 ? y3.localName == x3 : 3 == y3.nodeType)) {
        u4 = y3, e3[s3] = null;
        break;
      }
    }
    if (null == u4) {
      if (null == x3) return document.createTextNode(k3);
      u4 = document.createElementNS(o3, x3, k3.is && k3), c3 && (l.__m && l.__m(t3, e3), c3 = false), e3 = null;
    }
    if (null == x3) m3 === k3 || c3 && u4.data == k3 || (u4.data = k3);
    else {
      if (e3 = "textarea" == x3 && null != k3.defaultValue ? null : e3 && n.call(u4.childNodes), !c3 && null != e3) for (m3 = {}, s3 = 0; s3 < u4.attributes.length; s3++) m3[(y3 = u4.attributes[s3]).name] = y3.value;
      for (s3 in m3) y3 = m3[s3], "dangerouslySetInnerHTML" == s3 ? p3 = y3 : "children" == s3 || s3 in k3 || "value" == s3 && "defaultValue" in k3 || "checked" == s3 && "defaultChecked" in k3 || N(u4, s3, null, y3, o3);
      for (s3 in k3) y3 = k3[s3], "children" == s3 ? v3 = y3 : "dangerouslySetInnerHTML" == s3 ? h3 = y3 : "value" == s3 ? w3 = y3 : "checked" == s3 ? _2 = y3 : c3 && "function" != typeof y3 || m3[s3] === y3 || N(u4, s3, y3, m3[s3], o3);
      if (h3) c3 || p3 && (h3.__html == p3.__html || h3.__html == u4.innerHTML) || (u4.innerHTML = h3.__html), t3.__k = [];
      else if (p3 && (u4.innerHTML = ""), L("template" == t3.type ? u4.content : u4, g(v3) ? v3 : [v3], t3, i4, r3, "foreignObject" == x3 ? "http://www.w3.org/1999/xhtml" : o3, e3, f4, e3 ? e3[0] : i4.__k && $(i4, 0), c3, a3), null != e3) for (s3 = e3.length; s3--; ) b(e3[s3]);
      c3 && "textarea" != x3 || (s3 = "value", "progress" == x3 && null == w3 ? u4.removeAttribute("value") : null != w3 && (w3 !== u4[s3] || "progress" == x3 && !w3 || "option" == x3 && w3 != m3[s3]) && N(u4, s3, w3, m3[s3], o3), s3 = "checked", null != _2 && _2 != u4[s3] && N(u4, s3, _2, m3[s3], o3));
    }
    return u4;
  }
  function J(n2, u4, t3) {
    try {
      if ("function" == typeof n2) {
        var i4 = "function" == typeof n2.__u;
        i4 && n2.__u(), i4 && null == u4 || (n2.__u = n2(u4));
      } else n2.current = u4;
    } catch (n3) {
      l.__e(n3, t3);
    }
  }
  function K(n2, u4, t3) {
    var i4, r3;
    if (l.unmount && l.unmount(n2), (i4 = n2.ref) && (i4.current && i4.current != n2.__e || J(i4, null, u4)), null != (i4 = n2.__c)) {
      if (i4.componentWillUnmount) try {
        i4.componentWillUnmount();
      } catch (n3) {
        l.__e(n3, u4);
      }
      i4.base = i4.__P = null;
    }
    if (i4 = n2.__k) for (r3 = 0; r3 < i4.length; r3++) i4[r3] && K(i4[r3], u4, t3 || "function" != typeof n2.type);
    t3 || b(n2.__e), n2.__c = n2.__ = n2.__e = void 0;
  }
  function Q(n2, l3, u4) {
    return this.constructor(n2, u4);
  }
  function R(u4, t3, i4) {
    var r3, o3, e3, f4;
    t3 == document && (t3 = document.documentElement), l.__ && l.__(u4, t3), o3 = (r3 = "function" == typeof i4) ? null : i4 && i4.__k || t3.__k, e3 = [], f4 = [], q(t3, u4 = (!r3 && i4 || t3).__k = k(S, null, [u4]), o3 || d, d, t3.namespaceURI, !r3 && i4 ? [i4] : o3 ? null : t3.firstChild ? n.call(t3.childNodes) : null, e3, !r3 && i4 ? i4 : o3 ? o3.__e : t3.firstChild, r3, f4), D(e3, u4, f4);
  }
  function X(n2) {
    function l3(n3) {
      var u4, t3;
      return this.getChildContext || (u4 = /* @__PURE__ */ new Set(), (t3 = {})[l3.__c] = this, this.getChildContext = function() {
        return t3;
      }, this.componentWillUnmount = function() {
        u4 = null;
      }, this.shouldComponentUpdate = function(n4) {
        this.props.value != n4.value && u4.forEach(function(n5) {
          n5.__e = true, A(n5);
        });
      }, this.sub = function(n4) {
        u4.add(n4);
        var l4 = n4.componentWillUnmount;
        n4.componentWillUnmount = function() {
          u4 && u4.delete(n4), l4 && l4.call(n4);
        };
      }), n3.children;
    }
    return l3.__c = "__cC" + y++, l3.__ = n2, l3.Provider = l3.__l = (l3.Consumer = function(n3, l4) {
      return n3.children(l4);
    }).contextType = l3, l3;
  }
  n = w.slice, l = { __e: function(n2, l3, u4, t3) {
    for (var i4, r3, o3; l3 = l3.__; ) if ((i4 = l3.__c) && !i4.__) try {
      if ((r3 = i4.constructor) && null != r3.getDerivedStateFromError && (i4.setState(r3.getDerivedStateFromError(n2)), o3 = i4.__d), null != i4.componentDidCatch && (i4.componentDidCatch(n2, t3 || {}), o3 = i4.__d), o3) return i4.__E = i4;
    } catch (l4) {
      n2 = l4;
    }
    throw n2;
  } }, u = 0, t = function(n2) {
    return null != n2 && void 0 === n2.constructor;
  }, C.prototype.setState = function(n2, l3) {
    var u4;
    u4 = null != this.__s && this.__s != this.state ? this.__s : this.__s = m({}, this.state), "function" == typeof n2 && (n2 = n2(m({}, u4), this.props)), n2 && m(u4, n2), null != n2 && this.__v && (l3 && this._sb.push(l3), A(this));
  }, C.prototype.forceUpdate = function(n2) {
    this.__v && (this.__e = true, n2 && this.__h.push(n2), A(this));
  }, C.prototype.render = S, i = [], o = "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, e = function(n2, l3) {
    return n2.__v.__b - l3.__v.__b;
  }, H.__r = 0, f = Math.random().toString(8), c = "__d" + f, a = "__a" + f, s = /(PointerCapture)$|Capture$/i, h = 0, p = V(false), v = V(true), y = 0;

  // node_modules/.pnpm/preact@10.29.2/node_modules/preact/hooks/dist/hooks.module.js
  var t2;
  var r2;
  var u2;
  var i2;
  var o2 = 0;
  var f2 = [];
  var c2 = l;
  var e2 = c2.__b;
  var a2 = c2.__r;
  var v2 = c2.diffed;
  var l2 = c2.__c;
  var m2 = c2.unmount;
  var s2 = c2.__;
  function p2(n2, t3) {
    c2.__h && c2.__h(r2, n2, o2 || t3), o2 = 0;
    var u4 = r2.__H || (r2.__H = { __: [], __h: [] });
    return n2 >= u4.__.length && u4.__.push({}), u4.__[n2];
  }
  function d2(n2) {
    return o2 = 1, h2(D2, n2);
  }
  function h2(n2, u4, i4) {
    var o3 = p2(t2++, 2);
    if (o3.t = n2, !o3.__c && (o3.__ = [i4 ? i4(u4) : D2(void 0, u4), function(n3) {
      var t3 = o3.__N ? o3.__N[0] : o3.__[0], r3 = o3.t(t3, n3);
      t3 !== r3 && (o3.__N = [r3, o3.__[1]], o3.__c.setState({}));
    }], o3.__c = r2, !r2.__f)) {
      var f4 = function(n3, t3, r3) {
        if (!o3.__c.__H) return true;
        var u5 = o3.__c.__H.__.filter(function(n4) {
          return n4.__c;
        });
        if (u5.every(function(n4) {
          return !n4.__N;
        })) return !c3 || c3.call(this, n3, t3, r3);
        var i5 = o3.__c.props !== n3;
        return u5.some(function(n4) {
          if (n4.__N) {
            var t4 = n4.__[0];
            n4.__ = n4.__N, n4.__N = void 0, t4 !== n4.__[0] && (i5 = true);
          }
        }), c3 && c3.call(this, n3, t3, r3) || i5;
      };
      r2.__f = true;
      var c3 = r2.shouldComponentUpdate, e3 = r2.componentWillUpdate;
      r2.componentWillUpdate = function(n3, t3, r3) {
        if (this.__e) {
          var u5 = c3;
          c3 = void 0, f4(n3, t3, r3), c3 = u5;
        }
        e3 && e3.call(this, n3, t3, r3);
      }, r2.shouldComponentUpdate = f4;
    }
    return o3.__N || o3.__;
  }
  function y2(n2, u4) {
    var i4 = p2(t2++, 3);
    !c2.__s && C2(i4.__H, u4) && (i4.__ = n2, i4.u = u4, r2.__H.__h.push(i4));
  }
  function A2(n2) {
    return o2 = 5, T2(function() {
      return { current: n2 };
    }, []);
  }
  function T2(n2, r3) {
    var u4 = p2(t2++, 7);
    return C2(u4.__H, r3) && (u4.__ = n2(), u4.__H = r3, u4.__h = n2), u4.__;
  }
  function q2(n2, t3) {
    return o2 = 8, T2(function() {
      return n2;
    }, t3);
  }
  function x2(n2) {
    var u4 = r2.context[n2.__c], i4 = p2(t2++, 9);
    return i4.c = n2, u4 ? (null == i4.__ && (i4.__ = true, u4.sub(r2)), u4.props.value) : n2.__;
  }
  function j2() {
    for (var n2; n2 = f2.shift(); ) {
      var t3 = n2.__H;
      if (n2.__P && t3) try {
        t3.__h.some(z2), t3.__h.some(B2), t3.__h = [];
      } catch (r3) {
        t3.__h = [], c2.__e(r3, n2.__v);
      }
    }
  }
  c2.__b = function(n2) {
    r2 = null, e2 && e2(n2);
  }, c2.__ = function(n2, t3) {
    n2 && t3.__k && t3.__k.__m && (n2.__m = t3.__k.__m), s2 && s2(n2, t3);
  }, c2.__r = function(n2) {
    a2 && a2(n2), t2 = 0;
    var i4 = (r2 = n2.__c).__H;
    i4 && (u2 === r2 ? (i4.__h = [], r2.__h = [], i4.__.some(function(n3) {
      n3.__N && (n3.__ = n3.__N), n3.u = n3.__N = void 0;
    })) : (i4.__h.some(z2), i4.__h.some(B2), i4.__h = [], t2 = 0)), u2 = r2;
  }, c2.diffed = function(n2) {
    v2 && v2(n2);
    var t3 = n2.__c;
    t3 && t3.__H && (t3.__H.__h.length && (1 !== f2.push(t3) && i2 === c2.requestAnimationFrame || ((i2 = c2.requestAnimationFrame) || w2)(j2)), t3.__H.__.some(function(n3) {
      n3.u && (n3.__H = n3.u), n3.u = void 0;
    })), u2 = r2 = null;
  }, c2.__c = function(n2, t3) {
    t3.some(function(n3) {
      try {
        n3.__h.some(z2), n3.__h = n3.__h.filter(function(n4) {
          return !n4.__ || B2(n4);
        });
      } catch (r3) {
        t3.some(function(n4) {
          n4.__h && (n4.__h = []);
        }), t3 = [], c2.__e(r3, n3.__v);
      }
    }), l2 && l2(n2, t3);
  }, c2.unmount = function(n2) {
    m2 && m2(n2);
    var t3, r3 = n2.__c;
    r3 && r3.__H && (r3.__H.__.some(function(n3) {
      try {
        z2(n3);
      } catch (n4) {
        t3 = n4;
      }
    }), r3.__H = void 0, t3 && c2.__e(t3, r3.__v));
  };
  var k2 = "function" == typeof requestAnimationFrame;
  function w2(n2) {
    var t3, r3 = function() {
      clearTimeout(u4), k2 && cancelAnimationFrame(t3), setTimeout(n2);
    }, u4 = setTimeout(r3, 35);
    k2 && (t3 = requestAnimationFrame(r3));
  }
  function z2(n2) {
    var t3 = r2, u4 = n2.__c;
    "function" == typeof u4 && (n2.__c = void 0, u4()), r2 = t3;
  }
  function B2(n2) {
    var t3 = r2;
    n2.__c = n2.__(), r2 = t3;
  }
  function C2(n2, t3) {
    return !n2 || n2.length !== t3.length || t3.some(function(t4, r3) {
      return t4 !== n2[r3];
    });
  }
  function D2(n2, t3) {
    return "function" == typeof t3 ? t3(n2) : t3;
  }

  // src/popup/i18n/en.ts
  var en = {
    // Header
    tagline: "Extract filters from V-Tools & Souk.to",
    howItWorks: "How it works",
    close: "Close",
    // Status chip
    statusWaiting: "Waiting for data\u2026",
    sourceVtools: "V-Tools",
    sourceSouk: "Souk.to",
    sourceGeneric: "Filters",
    captured: (n2) => `${n2} captured`,
    // Toolbar
    searchPlaceholder: "Search filters\u2026",
    filtersShown: (n2) => `${n2} shown`,
    selectedOf: (selected, total) => `${selected} of ${total} selected`,
    selectAll: "Select all",
    // Table
    colName: "Name",
    colBrands: "Brands",
    colPrice: "Price",
    colStatus: "Status",
    statusActive: "Active",
    statusOff: "Off",
    unnamed: "(unnamed)",
    noResults: "No filters match your search",
    // Action bar
    exportN: (n2) => `Export ${n2}`,
    exportSelectedN: (n2) => `Export ${n2} selected`,
    refresh: "Refresh",
    more: "More",
    // Menus
    refreshVtools: "Refresh V-Tools",
    refreshSouk: "Refresh Souk.to",
    clear: "Clear filters",
    debugExport: "Export debug session",
    debugInclude: "Include filter data",
    debugIncludeHint: "Includes your captured filters in the bundle (your own data)",
    lastCapture: (time) => `Last capture ${time}`,
    // Empty state / onboarding
    emptyTitle: "No filters captured yet",
    step1: "Open your V-Tools or Souk.to filters page",
    step2: "Your filters are captured automatically",
    step3: "Come back here and export them",
    openVtools: "Open V-Tools",
    openSouk: "Open Souk.to",
    // Loading
    loading: "Loading filters\u2026",
    // Errors
    errConnect: "Couldn't reach the extension. Try reopening the popup.",
    errParse: (n2) => `${n2} warning${n2 !== 1 ? "s" : ""} during capture`,
    errExport: "Export failed \u2014 try again",
    errNoFilters: "No filters to export",
    errClear: "Clear failed \u2014 try again",
    errDownload: "Download failed \u2014 check the console",
    errOpenPage: "Couldn't open the page",
    errDebug: "Debug export failed \u2014 try again",
    // Toasts
    toastExported: (n2) => `Exported ${n2} filter${n2 !== 1 ? "s" : ""}`,
    toastCleared: "Filters cleared",
    toastDebugSavedCopied: "Debug session saved + copied",
    toastDebugSaved: "Debug session saved",
    refreshOpening: (source) => `Opening ${source} \u2014 filters capture automatically. Reopen this popup to see them.`
  };

  // src/popup/i18n/fr.ts
  var fr = {
    // Header
    tagline: "Exportez vos filtres V-Tools & Souk.to",
    howItWorks: "Comment \xE7a marche",
    close: "Fermer",
    // Status chip
    statusWaiting: "En attente de donn\xE9es\u2026",
    sourceVtools: "V-Tools",
    sourceSouk: "Souk.to",
    sourceGeneric: "Filtres",
    captured: (n2) => `${n2} captur\xE9${n2 > 1 ? "s" : ""}`,
    // Toolbar
    searchPlaceholder: "Rechercher des filtres\u2026",
    filtersShown: (n2) => `${n2} affich\xE9${n2 > 1 ? "s" : ""}`,
    selectedOf: (selected, total) => `${selected} sur ${total} s\xE9lectionn\xE9${selected > 1 ? "s" : ""}`,
    selectAll: "Tout s\xE9lectionner",
    // Table
    colName: "Nom",
    colBrands: "Marques",
    colPrice: "Prix",
    colStatus: "Statut",
    statusActive: "Actif",
    statusOff: "Inactif",
    unnamed: "(sans nom)",
    noResults: "Aucun filtre ne correspond",
    // Action bar
    exportN: (n2) => `Exporter ${n2}`,
    exportSelectedN: (n2) => `Exporter ${n2} s\xE9lectionn\xE9${n2 > 1 ? "s" : ""}`,
    refresh: "Actualiser",
    more: "Plus",
    // Menus
    refreshVtools: "Actualiser V-Tools",
    refreshSouk: "Actualiser Souk.to",
    clear: "Effacer les filtres",
    debugExport: "Exporter la session de d\xE9bogage",
    debugInclude: "Inclure les donn\xE9es de filtres",
    debugIncludeHint: "Inclut vos filtres captur\xE9s dans le bundle (vos propres donn\xE9es)",
    lastCapture: (time) => `Derni\xE8re capture ${time}`,
    // Empty state / onboarding
    emptyTitle: "Aucun filtre captur\xE9",
    step1: "Ouvrez votre page de filtres V-Tools ou Souk.to",
    step2: "Vos filtres sont captur\xE9s automatiquement",
    step3: "Revenez ici pour les exporter",
    openVtools: "Ouvrir V-Tools",
    openSouk: "Ouvrir Souk.to",
    // Loading
    loading: "Chargement des filtres\u2026",
    // Errors
    errConnect: "Connexion \xE0 l'extension impossible. Rouvrez le popup.",
    errParse: (n2) => `${n2} avertissement${n2 > 1 ? "s" : ""} pendant la capture`,
    errExport: "\xC9chec de l'export \u2014 r\xE9essayez",
    errNoFilters: "Aucun filtre \xE0 exporter",
    errClear: "\xC9chec de l'effacement \u2014 r\xE9essayez",
    errDownload: "\xC9chec du t\xE9l\xE9chargement \u2014 voir la console",
    errOpenPage: "Impossible d'ouvrir la page",
    errDebug: "\xC9chec de l'export de d\xE9bogage \u2014 r\xE9essayez",
    // Toasts
    toastExported: (n2) => `${n2} filtre${n2 > 1 ? "s" : ""} export\xE9${n2 > 1 ? "s" : ""}`,
    toastCleared: "Filtres effac\xE9s",
    toastDebugSavedCopied: "Session de d\xE9bogage enregistr\xE9e + copi\xE9e",
    toastDebugSaved: "Session de d\xE9bogage enregistr\xE9e",
    refreshOpening: (source) => `Ouverture de ${source} \u2014 les filtres se capturent automatiquement. Rouvrez ce popup pour les voir.`
  };

  // node_modules/.pnpm/preact@10.29.2/node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js
  var f3 = 0;
  var i3 = Array.isArray;
  function u3(e3, t3, n2, o3, i4, u4) {
    t3 || (t3 = {});
    var a3, c3, p3 = t3;
    if ("ref" in p3) for (c3 in p3 = {}, t3) "ref" == c3 ? a3 = t3[c3] : p3[c3] = t3[c3];
    var l3 = { type: e3, props: p3, key: n2, ref: a3, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: --f3, __i: -1, __u: 0, __source: i4, __self: u4 };
    if ("function" == typeof e3 && (a3 = e3.defaultProps)) for (c3 in a3) void 0 === p3[c3] && (p3[c3] = a3[c3]);
    return l.vnode && l.vnode(l3), l3;
  }

  // src/popup/i18n/index.tsx
  var catalogs = { en, fr };
  function detectLocale(lang) {
    const tag = lang ?? (typeof navigator !== "undefined" ? navigator.language : "en") ?? "en";
    return tag.toLowerCase().startsWith("fr") ? "fr" : "en";
  }
  var MessagesContext = X(en);
  function I18nProvider({
    locale,
    children
  }) {
    const resolved = locale ?? detectLocale();
    return /* @__PURE__ */ u3(MessagesContext.Provider, { value: catalogs[resolved], children });
  }
  function useMessages() {
    return x2(MessagesContext);
  }

  // src/diagnostics.ts
  var EXPORT_DEBUG_ACTION = "EXPORT_DEBUG";

  // src/popup/lib/messaging.ts
  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response ?? {});
        });
      } catch (err) {
        reject(err);
      }
    });
  }
  function getFilters() {
    return sendMessage({ action: "GET_FILTERS" });
  }
  function exportJson(selectedIndices) {
    return sendMessage({ action: "EXPORT_JSON", selectedIndices });
  }
  function clearFilters() {
    return sendMessage({ action: "CLEAR_FILTERS" });
  }
  function exportDebug(includeFilters, environment) {
    return sendMessage({ action: EXPORT_DEBUG_ACTION, includeFilters, environment });
  }

  // src/popup/lib/constants.ts
  var EXPORT_SCHEMA_VERSION = 1;
  var REFRESH_TARGETS = {
    vtoolsv2: "https://dashboard.v-tools.com/dashboard/filters",
    souk: "https://souk.to/app/alerts"
  };
  var LOG_PREFIX = "[Kops Filter Exporter]";

  // src/popup/lib/download.ts
  function downloadJson(json, filename) {
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a3 = document.createElement("a");
      a3.href = url;
      a3.download = filename;
      a3.style.display = "none";
      document.body.appendChild(a3);
      a3.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a3.remove();
      }, 200);
      return true;
    } catch (err) {
      console.error(LOG_PREFIX, "download failed:", err);
      return false;
    }
  }
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  // src/popup/state/store.tsx
  var INITIAL = {
    status: "loading",
    filters: [],
    source: null,
    lastUpdate: null,
    banner: null,
    search: "",
    selection: /* @__PURE__ */ new Set(),
    toast: null,
    exporting: false,
    helpOpen: false
  };
  var StoreContext = X(null);
  function StoreProvider({ children }) {
    const m3 = useMessages();
    const [state, setState] = d2(INITIAL);
    const stateRef = A2(state);
    stateRef.current = state;
    const toastTimer = A2(null);
    const toastSeq = A2(0);
    const showToast = q2((message, kind = "info") => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      const id = toastSeq.current += 1;
      setState((s3) => ({ ...s3, toast: { id, message, kind } }));
      toastTimer.current = setTimeout(() => {
        setState((s3) => s3.toast?.id === id ? { ...s3, toast: null } : s3);
      }, 2500);
    }, []);
    const dismissToast = q2(() => setState((s3) => ({ ...s3, toast: null })), []);
    const load = q2(async () => {
      try {
        const res = await getFilters();
        if (res.ok === false && res.error) {
          console.warn(LOG_PREFIX, res.error);
          setState((s3) => ({ ...s3, status: "empty", filters: [], selection: /* @__PURE__ */ new Set(), banner: m3.errConnect }));
          return;
        }
        const filters = Array.isArray(res.filters) ? res.filters : [];
        if (filters.length > 0) {
          const warn = res.lastErrors && res.lastErrors.length > 0 ? m3.errParse(res.lastErrors.length) : null;
          setState((s3) => ({
            ...s3,
            status: "list",
            filters,
            source: res.lastSource ?? null,
            lastUpdate: res.lastUpdate ?? null,
            banner: warn,
            selection: /* @__PURE__ */ new Set()
          }));
        } else {
          setState((s3) => ({
            ...s3,
            status: "empty",
            filters: [],
            source: res.lastSource ?? null,
            lastUpdate: null,
            banner: null,
            selection: /* @__PURE__ */ new Set()
          }));
        }
      } catch (err) {
        console.error(LOG_PREFIX, "load failed:", err);
        setState((s3) => ({ ...s3, status: "empty", banner: m3.errConnect }));
      }
    }, [m3]);
    const setSearch = q2((query) => setState((s3) => ({ ...s3, search: query })), []);
    const toggleRow = q2((index) => {
      setState((s3) => {
        const selection = new Set(s3.selection);
        if (selection.has(index)) selection.delete(index);
        else selection.add(index);
        return { ...s3, selection };
      });
    }, []);
    const setSelection = q2((next) => setState((s3) => ({ ...s3, selection: next })), []);
    const exportFilters = q2(async () => {
      const cur = stateRef.current;
      if (cur.exporting || cur.filters.length === 0) return;
      setState((s3) => ({ ...s3, exporting: true }));
      try {
        const selected = cur.selection.size > 0 ? [...cur.selection].sort((a3, b2) => a3 - b2) : void 0;
        const res = await exportJson(selected);
        if (!res.ok || !res.json) {
          if (res.error) console.warn(LOG_PREFIX, res.error);
          showToast(m3.errExport, "error");
          return;
        }
        const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
        const saved = downloadJson(res.json, `kops-filters-v${EXPORT_SCHEMA_VERSION}-${date}.json`);
        showToast(saved ? m3.toastExported(res.count ?? 0) : m3.errDownload, saved ? "success" : "error");
      } catch (err) {
        console.error(LOG_PREFIX, "export failed:", err);
        showToast(m3.errExport, "error");
      } finally {
        setState((s3) => ({ ...s3, exporting: false }));
      }
    }, [m3, showToast]);
    const clearAll = q2(async () => {
      try {
        const res = await clearFilters();
        if (res.ok === false && res.error) console.warn(LOG_PREFIX, res.error);
        setState((s3) => ({
          ...s3,
          status: "empty",
          filters: [],
          source: null,
          lastUpdate: null,
          banner: null,
          search: "",
          selection: /* @__PURE__ */ new Set()
        }));
        showToast(m3.toastCleared, "info");
      } catch (err) {
        console.error(LOG_PREFIX, "clear failed:", err);
        showToast(m3.errClear, "error");
      }
    }, [m3, showToast]);
    const refresh = q2(
      async (source, focus = false) => {
        const label = source === "vtoolsv2" ? m3.sourceVtools : m3.sourceSouk;
        try {
          await chrome.tabs.create({ url: REFRESH_TARGETS[source], active: focus });
          if (!focus) showToast(m3.refreshOpening(label), "info");
        } catch (err) {
          console.error(LOG_PREFIX, "refresh failed:", err);
          showToast(m3.errOpenPage, "error");
        }
      },
      [m3, showToast]
    );
    const exportDebugSession = q2(
      async (includeFilters) => {
        try {
          const res = await exportDebug(includeFilters, {
            userAgent: navigator.userAgent,
            language: navigator.language
          });
          if (!res.ok || !res.json) {
            if (res.error) console.warn(LOG_PREFIX, res.error);
            showToast(m3.errDebug, "error");
            return;
          }
          const filename = res.filename || `kops-debug-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
          if (!downloadJson(res.json, filename)) {
            showToast(m3.errDownload, "error");
            return;
          }
          const copied = await copyToClipboard(res.json);
          showToast(copied ? m3.toastDebugSavedCopied : m3.toastDebugSaved, "success");
        } catch (err) {
          console.error(LOG_PREFIX, "debug export failed:", err);
          showToast(m3.errDebug, "error");
        }
      },
      [m3, showToast]
    );
    const toggleHelp = q2(
      (open) => setState((s3) => ({ ...s3, helpOpen: open ?? !s3.helpOpen })),
      []
    );
    y2(() => {
      void load();
      const listener = (changes, area) => {
        if (area === "local" && changes.filters) void load();
      };
      chrome.storage.onChanged.addListener(listener);
      return () => {
        chrome.storage.onChanged.removeListener(listener);
        if (toastTimer.current) clearTimeout(toastTimer.current);
      };
    }, [load]);
    const actions = T2(
      () => ({
        setSearch,
        toggleRow,
        setSelection,
        exportFilters,
        clearAll,
        refresh,
        exportDebugSession,
        toggleHelp,
        dismissToast
      }),
      [
        setSearch,
        toggleRow,
        setSelection,
        exportFilters,
        clearAll,
        refresh,
        exportDebugSession,
        toggleHelp,
        dismissToast
      ]
    );
    return /* @__PURE__ */ u3(StoreContext.Provider, { value: { state, actions }, children });
  }
  function useStore() {
    const ctx = x2(StoreContext);
    if (!ctx) throw new Error("useStore must be used within <StoreProvider>");
    return ctx;
  }

  // src/popup/lib/format.ts
  function brandsText(filter) {
    return filter.brand_names.length > 0 ? filter.brand_names.join(", ") : "\u2014";
  }
  function priceText(filter) {
    const from = filter.price_min != null ? String(filter.price_min) : "0";
    const to = filter.price_max != null ? String(filter.price_max) : "\u221E";
    return `\u20AC${from}\u2013${to}`;
  }
  function keywordText(filter) {
    const parts = [];
    if (filter.keyword_rules) {
      for (const group of filter.keyword_rules.groups) parts.push(...group.keywords);
    }
    parts.push(...filter.blacklist_keywords);
    return parts.join(" ");
  }
  function formatTime(iso, locale) {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }

  // src/popup/state/selectors.ts
  function matchesSearch(filter, query) {
    if (!query) return true;
    const haystack = [filter.name, ...filter.brand_names, keywordText(filter)].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(query);
  }
  function computeVisibleIndices(filters, search) {
    const query = search.trim().toLowerCase();
    const out = [];
    filters.forEach((filter, i4) => {
      if (matchesSearch(filter, query)) out.push(i4);
    });
    return out;
  }
  function selectionSummary(visibleIndices, selection) {
    const visibleSelected = visibleIndices.filter((i4) => selection.has(i4)).length;
    const allVisibleSelected = visibleIndices.length > 0 && visibleSelected === visibleIndices.length;
    const indeterminate = visibleSelected > 0 && visibleSelected < visibleIndices.length;
    return { visibleSelected, allVisibleSelected, indeterminate };
  }
  function toggleAllVisible(visibleIndices, selection) {
    const next = new Set(selection);
    const allSelected = visibleIndices.every((i4) => next.has(i4)) && visibleIndices.length > 0;
    if (allSelected) visibleIndices.forEach((i4) => next.delete(i4));
    else visibleIndices.forEach((i4) => next.add(i4));
    return next;
  }

  // src/popup/components/Icon.tsx
  var PATHS = {
    filter: /* @__PURE__ */ u3("path", { d: "M3 4h18l-7 8.5V18l-4 2v-7.5L3 4z" }),
    help: /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3("circle", { cx: "12", cy: "12", r: "10" }),
      /* @__PURE__ */ u3("path", { d: "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.2-3 4" }),
      /* @__PURE__ */ u3("circle", { cx: "12", cy: "17.5", r: "0.6", fill: "currentColor", stroke: "none" })
    ] }),
    search: /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3("circle", { cx: "11", cy: "11", r: "8" }),
      /* @__PURE__ */ u3("path", { d: "M21 21l-4.3-4.3" })
    ] }),
    export: /* @__PURE__ */ u3("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" }),
    refresh: /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3("path", { d: "M1 4v6h6M23 20v-6h-6" }),
      /* @__PURE__ */ u3("path", { d: "M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" })
    ] }),
    more: /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3("circle", { cx: "5", cy: "12", r: "1.6", fill: "currentColor", stroke: "none" }),
      /* @__PURE__ */ u3("circle", { cx: "12", cy: "12", r: "1.6", fill: "currentColor", stroke: "none" }),
      /* @__PURE__ */ u3("circle", { cx: "19", cy: "12", r: "1.6", fill: "currentColor", stroke: "none" })
    ] }),
    clear: /* @__PURE__ */ u3("path", { d: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }),
    debug: /* @__PURE__ */ u3("path", { d: "M9 4.5L7.5 2M15 4.5L16.5 2M12 8a4 4 0 0 1 4 4v3a4 4 0 0 1-8 0v-3a4 4 0 0 1 4-4zM12 8v12M5 12H3m18 0h-2M5.5 8L4 6.5m14.5 1.5L20 6.5M5.5 17L4 18.5m14.5-1.5L20 18.5" }),
    info: /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3("circle", { cx: "12", cy: "12", r: "10" }),
      /* @__PURE__ */ u3("line", { x1: "12", y1: "8", x2: "12", y2: "12" }),
      /* @__PURE__ */ u3("circle", { cx: "12", cy: "16", r: "0.6", fill: "currentColor", stroke: "none" })
    ] }),
    close: /* @__PURE__ */ u3("path", { d: "M18 6L6 18M6 6l12 12" }),
    external: /* @__PURE__ */ u3("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" }),
    check: /* @__PURE__ */ u3("path", { d: "M20 6L9 17l-5-5" })
  };
  function Icon({ name, size = 16, class: cls }) {
    return /* @__PURE__ */ u3(
      "svg",
      {
        class: cls,
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "aria-hidden": "true",
        children: PATHS[name]
      }
    );
  }

  // src/popup/components/StatusChip.tsx
  function StatusChip() {
    const m3 = useMessages();
    const { state } = useStore();
    if (state.status !== "list") {
      return /* @__PURE__ */ u3("div", { class: "status-chip status-muted", children: [
        /* @__PURE__ */ u3("span", { class: "status-dot" }),
        /* @__PURE__ */ u3("span", { class: "status-text", children: m3.statusWaiting })
      ] });
    }
    const label = state.source === "vtools" ? m3.sourceVtools : state.source === "souk" ? m3.sourceSouk : m3.sourceGeneric;
    const time = formatTime(state.lastUpdate);
    return /* @__PURE__ */ u3("div", { class: "status-chip status-live", title: time ? m3.lastCapture(time) : void 0, children: [
      /* @__PURE__ */ u3("span", { class: "status-dot" }),
      /* @__PURE__ */ u3("span", { class: "status-source", children: label }),
      /* @__PURE__ */ u3("span", { class: "status-sep", "aria-hidden": "true", children: "\xB7" }),
      /* @__PURE__ */ u3("span", { class: "status-count", children: m3.captured(state.filters.length) })
    ] });
  }

  // src/popup/components/Header.tsx
  function Header() {
    const m3 = useMessages();
    const { state, actions } = useStore();
    return /* @__PURE__ */ u3("header", { class: "header", children: [
      /* @__PURE__ */ u3("div", { class: "brand", children: [
        /* @__PURE__ */ u3("span", { class: "brand-icon", children: /* @__PURE__ */ u3(Icon, { name: "filter", size: 17 }) }),
        /* @__PURE__ */ u3("div", { class: "brand-text", children: [
          /* @__PURE__ */ u3("h1", { class: "brand-name", children: "Kops Filter Exporter" }),
          /* @__PURE__ */ u3(StatusChip, {})
        ] })
      ] }),
      /* @__PURE__ */ u3(
        "button",
        {
          type: "button",
          class: `icon-btn help-btn${state.helpOpen ? " is-open" : ""}`,
          "aria-label": m3.howItWorks,
          title: m3.howItWorks,
          "aria-pressed": state.helpOpen,
          onClick: () => actions.toggleHelp(),
          children: /* @__PURE__ */ u3(Icon, { name: "help", size: 17 })
        }
      )
    ] });
  }

  // src/popup/components/Toolbar.tsx
  function Toolbar({ visible }) {
    const m3 = useMessages();
    const { state, actions } = useStore();
    const { allVisibleSelected, indeterminate } = selectionSummary(visible, state.selection);
    const selCount = state.selection.size;
    const label = selCount > 0 ? m3.selectedOf(selCount, state.filters.length) : m3.filtersShown(visible.length);
    return /* @__PURE__ */ u3("div", { class: "toolbar", children: [
      /* @__PURE__ */ u3("div", { class: "search", children: [
        /* @__PURE__ */ u3(Icon, { name: "search", size: 15, class: "search-icon" }),
        /* @__PURE__ */ u3(
          "input",
          {
            type: "text",
            class: "search-input",
            value: state.search,
            placeholder: m3.searchPlaceholder,
            autocomplete: "off",
            spellcheck: false,
            onInput: (e3) => actions.setSearch(e3.currentTarget.value)
          }
        )
      ] }),
      /* @__PURE__ */ u3("label", { class: "select-all", title: m3.selectAll, children: [
        /* @__PURE__ */ u3(
          "input",
          {
            type: "checkbox",
            checked: allVisibleSelected,
            ref: (el) => {
              if (el) el.indeterminate = indeterminate;
            },
            onChange: () => actions.setSelection(toggleAllVisible(visible, state.selection))
          }
        ),
        /* @__PURE__ */ u3("span", { class: "count-label", children: label })
      ] })
    ] });
  }

  // src/popup/components/FilterRow.tsx
  function FilterRow({
    filter,
    index,
    selected,
    dim,
    onToggle
  }) {
    const m3 = useMessages();
    const active = filter.enabled === true;
    const brands = brandsText(filter);
    return /* @__PURE__ */ u3("tr", { class: `row${dim ? " dim" : ""}${selected ? " selected" : ""}`, children: [
      /* @__PURE__ */ u3("td", { class: "cell-check", children: /* @__PURE__ */ u3(
        "input",
        {
          type: "checkbox",
          checked: selected,
          onChange: () => onToggle(index),
          "aria-label": filter.name || m3.unnamed
        }
      ) }),
      /* @__PURE__ */ u3("td", { class: "cell-name", children: /* @__PURE__ */ u3("span", { class: "filter-name", title: filter.name || void 0, children: filter.name || m3.unnamed }) }),
      /* @__PURE__ */ u3("td", { class: "cell-brands", children: /* @__PURE__ */ u3("span", { class: "filter-brands", title: brands !== "\u2014" ? brands : void 0, children: brands }) }),
      /* @__PURE__ */ u3("td", { class: "cell-price", children: /* @__PURE__ */ u3("span", { class: "filter-price", children: priceText(filter) }) }),
      /* @__PURE__ */ u3("td", { class: "cell-status", children: /* @__PURE__ */ u3("span", { class: `badge ${active ? "badge-active" : "badge-off"}`, children: active ? m3.statusActive : m3.statusOff }) })
    ] });
  }

  // src/popup/components/FilterTable.tsx
  function FilterTable({ visible }) {
    const m3 = useMessages();
    const { state, actions } = useStore();
    const searching = state.search.trim().length > 0;
    if (visible.length === 0 && searching) {
      return /* @__PURE__ */ u3("div", { class: "table-empty", children: m3.noResults });
    }
    const hasSelection = state.selection.size > 0;
    return /* @__PURE__ */ u3("div", { class: "table-scroll", children: /* @__PURE__ */ u3("table", { class: "filter-table", children: [
      /* @__PURE__ */ u3("thead", { children: /* @__PURE__ */ u3("tr", { children: [
        /* @__PURE__ */ u3("th", { class: "cell-check", "aria-hidden": "true" }),
        /* @__PURE__ */ u3("th", { class: "cell-name", children: m3.colName }),
        /* @__PURE__ */ u3("th", { class: "cell-brands", children: m3.colBrands }),
        /* @__PURE__ */ u3("th", { class: "cell-price", children: m3.colPrice }),
        /* @__PURE__ */ u3("th", { class: "cell-status", children: m3.colStatus })
      ] }) }),
      /* @__PURE__ */ u3("tbody", { children: visible.map((i4) => /* @__PURE__ */ u3(
        FilterRow,
        {
          filter: state.filters[i4],
          index: i4,
          selected: state.selection.has(i4),
          dim: hasSelection && !state.selection.has(i4),
          onToggle: actions.toggleRow
        },
        i4
      )) })
    ] }) });
  }

  // src/popup/components/Menu.tsx
  function Menu({
    icon,
    label,
    align = "end",
    children
  }) {
    const [open, setOpen] = d2(false);
    const ref = A2(null);
    y2(() => {
      if (!open) return;
      const onDoc = (e3) => {
        if (ref.current && !ref.current.contains(e3.target)) setOpen(false);
      };
      const onKey = (e3) => {
        if (e3.key === "Escape") setOpen(false);
      };
      document.addEventListener("click", onDoc);
      document.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("click", onDoc);
        document.removeEventListener("keydown", onKey);
      };
    }, [open]);
    return /* @__PURE__ */ u3("div", { class: "menu", ref, children: [
      /* @__PURE__ */ u3(
        "button",
        {
          type: "button",
          class: `icon-btn${open ? " is-open" : ""}`,
          "aria-label": label,
          title: label,
          "aria-haspopup": "menu",
          "aria-expanded": open,
          onClick: (e3) => {
            e3.stopPropagation();
            setOpen((o3) => !o3);
          },
          children: /* @__PURE__ */ u3(Icon, { name: icon, size: 16 })
        }
      ),
      open && /* @__PURE__ */ u3("div", { class: `menu-pop menu-pop-${align}`, role: "menu", children: children(() => setOpen(false)) })
    ] });
  }
  function MenuItem({
    icon,
    label,
    onClick,
    danger = false,
    disabled = false
  }) {
    return /* @__PURE__ */ u3(
      "button",
      {
        type: "button",
        class: `menu-item${danger ? " danger" : ""}`,
        role: "menuitem",
        disabled,
        onClick,
        children: [
          /* @__PURE__ */ u3(Icon, { name: icon, size: 15 }),
          /* @__PURE__ */ u3("span", { children: label })
        ]
      }
    );
  }

  // src/popup/components/ActionBar.tsx
  function RefreshMenu() {
    const m3 = useMessages();
    const { actions } = useStore();
    return /* @__PURE__ */ u3(Menu, { icon: "refresh", label: m3.refresh, children: (close) => /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(
        MenuItem,
        {
          icon: "external",
          label: m3.refreshVtools,
          onClick: () => {
            close();
            void actions.refresh("vtoolsv2");
          }
        }
      ),
      /* @__PURE__ */ u3(
        MenuItem,
        {
          icon: "external",
          label: m3.refreshSouk,
          onClick: () => {
            close();
            void actions.refresh("souk");
          }
        }
      )
    ] }) });
  }
  function OverflowMenu() {
    const m3 = useMessages();
    const { state, actions } = useStore();
    const [includeFilters, setIncludeFilters] = d2(false);
    const time = formatTime(state.lastUpdate);
    return /* @__PURE__ */ u3(Menu, { icon: "more", label: m3.more, children: (close) => /* @__PURE__ */ u3(S, { children: [
      /* @__PURE__ */ u3(
        MenuItem,
        {
          icon: "clear",
          label: m3.clear,
          danger: true,
          disabled: state.filters.length === 0,
          onClick: () => {
            close();
            void actions.clearAll();
          }
        }
      ),
      /* @__PURE__ */ u3("div", { class: "menu-sep" }),
      /* @__PURE__ */ u3("label", { class: "menu-check", title: m3.debugIncludeHint, children: [
        /* @__PURE__ */ u3(
          "input",
          {
            type: "checkbox",
            checked: includeFilters,
            onChange: (e3) => setIncludeFilters(e3.currentTarget.checked)
          }
        ),
        /* @__PURE__ */ u3("span", { children: m3.debugInclude })
      ] }),
      /* @__PURE__ */ u3(
        MenuItem,
        {
          icon: "debug",
          label: m3.debugExport,
          onClick: () => {
            close();
            void actions.exportDebugSession(includeFilters);
          }
        }
      ),
      time && /* @__PURE__ */ u3("div", { class: "menu-foot", children: m3.lastCapture(time) })
    ] }) });
  }
  function ActionBar() {
    const m3 = useMessages();
    const { state, actions } = useStore();
    const selCount = state.selection.size;
    const label = selCount > 0 ? m3.exportSelectedN(selCount) : m3.exportN(state.filters.length);
    return /* @__PURE__ */ u3("div", { class: "action-bar", children: [
      /* @__PURE__ */ u3(
        "button",
        {
          type: "button",
          class: "btn btn-primary export-btn",
          disabled: state.exporting || state.filters.length === 0,
          onClick: () => void actions.exportFilters(),
          children: [
            /* @__PURE__ */ u3(Icon, { name: "export", size: 16 }),
            /* @__PURE__ */ u3("span", { children: label })
          ]
        }
      ),
      /* @__PURE__ */ u3(RefreshMenu, {}),
      /* @__PURE__ */ u3(OverflowMenu, {})
    ] });
  }

  // src/popup/components/EmptyState.tsx
  function EmptyState() {
    const m3 = useMessages();
    const { actions } = useStore();
    return /* @__PURE__ */ u3("div", { class: "empty", children: [
      /* @__PURE__ */ u3("div", { class: "empty-icon", children: /* @__PURE__ */ u3(Icon, { name: "filter", size: 26 }) }),
      /* @__PURE__ */ u3("h2", { class: "empty-title", children: m3.emptyTitle }),
      /* @__PURE__ */ u3("ol", { class: "steps", children: [
        /* @__PURE__ */ u3("li", { children: [
          /* @__PURE__ */ u3("span", { class: "step-n", children: "1" }),
          /* @__PURE__ */ u3("span", { class: "step-text", children: m3.step1 })
        ] }),
        /* @__PURE__ */ u3("li", { children: [
          /* @__PURE__ */ u3("span", { class: "step-n", children: "2" }),
          /* @__PURE__ */ u3("span", { class: "step-text", children: m3.step2 })
        ] }),
        /* @__PURE__ */ u3("li", { children: [
          /* @__PURE__ */ u3("span", { class: "step-n", children: "3" }),
          /* @__PURE__ */ u3("span", { class: "step-text", children: m3.step3 })
        ] })
      ] }),
      /* @__PURE__ */ u3("div", { class: "empty-actions", children: [
        /* @__PURE__ */ u3("button", { type: "button", class: "btn btn-secondary", onClick: () => void actions.refresh("vtoolsv2", true), children: [
          /* @__PURE__ */ u3(Icon, { name: "external", size: 15 }),
          /* @__PURE__ */ u3("span", { children: m3.openVtools })
        ] }),
        /* @__PURE__ */ u3("button", { type: "button", class: "btn btn-secondary", onClick: () => void actions.refresh("souk", true), children: [
          /* @__PURE__ */ u3(Icon, { name: "external", size: 15 }),
          /* @__PURE__ */ u3("span", { children: m3.openSouk })
        ] })
      ] }),
      /* @__PURE__ */ u3("button", { type: "button", class: "link-btn", onClick: () => void actions.exportDebugSession(false), children: m3.debugExport })
    ] });
  }

  // src/popup/components/HelpSheet.tsx
  function HelpSheet() {
    const m3 = useMessages();
    const { actions } = useStore();
    const open = (source) => {
      actions.toggleHelp(false);
      void actions.refresh(source, true);
    };
    return /* @__PURE__ */ u3("div", { class: "sheet-backdrop", onClick: () => actions.toggleHelp(false), children: /* @__PURE__ */ u3("div", { class: "sheet", role: "dialog", "aria-label": m3.howItWorks, onClick: (e3) => e3.stopPropagation(), children: [
      /* @__PURE__ */ u3("div", { class: "sheet-head", children: [
        /* @__PURE__ */ u3("h2", { children: m3.howItWorks }),
        /* @__PURE__ */ u3("button", { type: "button", class: "icon-btn", "aria-label": m3.close, onClick: () => actions.toggleHelp(false), children: /* @__PURE__ */ u3(Icon, { name: "close", size: 16 }) })
      ] }),
      /* @__PURE__ */ u3("p", { class: "sheet-tagline", children: m3.tagline }),
      /* @__PURE__ */ u3("ol", { class: "steps", children: [
        /* @__PURE__ */ u3("li", { children: [
          /* @__PURE__ */ u3("span", { class: "step-n", children: "1" }),
          /* @__PURE__ */ u3("span", { class: "step-text", children: m3.step1 })
        ] }),
        /* @__PURE__ */ u3("li", { children: [
          /* @__PURE__ */ u3("span", { class: "step-n", children: "2" }),
          /* @__PURE__ */ u3("span", { class: "step-text", children: m3.step2 })
        ] }),
        /* @__PURE__ */ u3("li", { children: [
          /* @__PURE__ */ u3("span", { class: "step-n", children: "3" }),
          /* @__PURE__ */ u3("span", { class: "step-text", children: m3.step3 })
        ] })
      ] }),
      /* @__PURE__ */ u3("div", { class: "sheet-actions", children: [
        /* @__PURE__ */ u3("button", { type: "button", class: "btn btn-secondary", onClick: () => open("vtoolsv2"), children: [
          /* @__PURE__ */ u3(Icon, { name: "external", size: 15 }),
          /* @__PURE__ */ u3("span", { children: m3.openVtools })
        ] }),
        /* @__PURE__ */ u3("button", { type: "button", class: "btn btn-secondary", onClick: () => open("souk"), children: [
          /* @__PURE__ */ u3(Icon, { name: "external", size: 15 }),
          /* @__PURE__ */ u3("span", { children: m3.openSouk })
        ] })
      ] })
    ] }) });
  }

  // src/popup/components/LoadingState.tsx
  function LoadingState() {
    const m3 = useMessages();
    return /* @__PURE__ */ u3("div", { class: "loading", children: [
      /* @__PURE__ */ u3("span", { class: "spinner", "aria-hidden": "true" }),
      /* @__PURE__ */ u3("span", { class: "loading-text", children: m3.loading })
    ] });
  }

  // src/popup/components/ErrorBanner.tsx
  function ErrorBanner({ message }) {
    return /* @__PURE__ */ u3("div", { class: "error-banner", role: "alert", children: [
      /* @__PURE__ */ u3(Icon, { name: "info", size: 14 }),
      /* @__PURE__ */ u3("span", { children: message })
    ] });
  }

  // src/popup/components/Toasts.tsx
  function Toasts() {
    const { state, actions } = useStore();
    const toast = state.toast;
    if (!toast) return null;
    const icon = toast.kind === "success" ? "check" : "info";
    return /* @__PURE__ */ u3("div", { class: "toast-host", children: /* @__PURE__ */ u3(
      "div",
      {
        class: `toast toast-${toast.kind}`,
        role: "status",
        onClick: () => actions.dismissToast(),
        children: [
          /* @__PURE__ */ u3(Icon, { name: icon, size: 15, class: "toast-icon" }),
          /* @__PURE__ */ u3("span", { class: "toast-msg", children: toast.message })
        ]
      },
      toast.id
    ) });
  }

  // src/popup/App.tsx
  function App() {
    const { state } = useStore();
    const visible = T2(
      () => computeVisibleIndices(state.filters, state.search),
      [state.filters, state.search]
    );
    return /* @__PURE__ */ u3("div", { class: "app", children: [
      /* @__PURE__ */ u3(Header, {}),
      state.banner && /* @__PURE__ */ u3(ErrorBanner, { message: state.banner }),
      /* @__PURE__ */ u3("main", { class: "work", children: [
        state.status === "loading" && /* @__PURE__ */ u3(LoadingState, {}),
        state.status === "empty" && /* @__PURE__ */ u3(EmptyState, {}),
        state.status === "list" && /* @__PURE__ */ u3(S, { children: [
          /* @__PURE__ */ u3(Toolbar, { visible }),
          /* @__PURE__ */ u3(FilterTable, { visible })
        ] })
      ] }),
      state.status === "list" && /* @__PURE__ */ u3(ActionBar, {}),
      state.helpOpen && /* @__PURE__ */ u3(HelpSheet, {}),
      /* @__PURE__ */ u3(Toasts, {})
    ] });
  }

  // src/popup/main.tsx
  var root = document.getElementById("root");
  if (root) {
    R(
      /* @__PURE__ */ u3(I18nProvider, { children: /* @__PURE__ */ u3(StoreProvider, { children: /* @__PURE__ */ u3(App, {}) }) }),
      root
    );
  }
})();
