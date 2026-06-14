// Minimal shell-quote stub — only the API surface used by react-devtools-core
'use strict';

exports.quote = function quote(xs) {
  return xs.map(function (s) {
    if (s && typeof s === 'object') {
      return s.op.replace(/(.)/g, '\\$1');
    }
    if (/["\s\\$`!#&*;|<>(){}]/.test(s) || s.length === 0) {
      return '"' + s.replace(/["`\\$!]/g, '\\$&') + '"';
    }
    return String(s).replace(/([^\\]|^)([A-Za-z0-9@%+=:,./-]*)/, function (m, p, q) {
      return q ? q : '""';
    }) || s;
  }).join(' ');
};

exports.parse = function parse(s, env) {
  var chunksRaw = s.split(/(#.*$|\\.|\$\w+|\$\{[^}]*\}|"[^"]*"|'[^']*'|\s+)/);
  var chunks = [];
  for (var i = 0; i < chunksRaw.length; i++) {
    var c = chunksRaw[i];
    if (c === undefined || c === '') continue;
    if (/^\s+$/.test(c)) continue;
    if (c.charAt(0) === '#') continue;
    if (c.charAt(0) === '$') {
      var key = c.slice(1).replace(/[{}]/g, '');
      if (typeof env === 'function') { chunks.push(env(key)); }
      else if (env && key in env) { chunks.push(env[key]); }
      else { chunks.push(''); }
    } else if (c.charAt(0) === '"') {
      chunks.push(c.slice(1, -1).replace(/\\(.)/g, '$1'));
    } else if (c.charAt(0) === "'") {
      chunks.push(c.slice(1, -1));
    } else if (c.charAt(0) === '\\') {
      chunks.push(c.slice(1));
    } else {
      chunks.push(c);
    }
  }
  return chunks;
};
