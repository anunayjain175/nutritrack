'use strict';

/**
 * NutriCharts — SVG charting library for NutriTrack
 * Pure inline-SVG charts with smooth animations.
 * No external dependencies.
 *
 * Every chart function accepts a container element ID and a
 * config object.  Charts are responsive (viewBox-based) and
 * self-contained.
 */
window.NutriCharts = (function () {

  /* ───────────────── SVG helpers ────────────────────── */

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function _svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        el.setAttribute(k, attrs[k]);
      });
    }
    return el;
  }

  function _container(id) {
    var el = document.getElementById(id);
    if (!el) console.warn('[NutriCharts] Container #' + id + ' not found.');
    return el;
  }

  function _clear(id) {
    var el = _container(id);
    if (el) el.innerHTML = '';
  }

  /** Inject a scoped <style> block into a container (once). */
  function _injectStyle(container, css) {
    var style = document.createElement('style');
    style.textContent = css;
    container.appendChild(style);
  }

  /** Lightweight counter animation */
  function _animateValue(el, start, end, duration, suffix) {
    if (!el) return;
    suffix = suffix || '';
    var startTime = null;
    var diff = end - start;
    function step(ts) {
      if (!startTime) startTime = ts;
      var progress = Math.min((ts - startTime) / duration, 1);
      // ease-out cubic
      var ease = 1 - Math.pow(1 - progress, 3);
      var current = Math.round(start + diff * ease);
      el.textContent = current.toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /** Format number for display */
  function _fmt(n) {
    if (n >= 1000) return n.toLocaleString();
    return String(Math.round(n * 10) / 10);
  }

  /** Generate unique suffix to prevent id collisions across charts */
  var _uid = 0;
  function _nextId() { return '__nc' + (++_uid); }

  /* ────────────────── Colour palette ────────────────── */

  var COLORS = {
    emerald:  '#10b981',
    blue:     '#3b82f6',
    purple:   '#8b5cf6',
    amber:    '#f59e0b',
    rose:     '#f43f5e',
    cyan:     '#06b6d4',
    indigo:   '#6366f1',
    orange:   '#f97316',
    teal:     '#14b8a6',
    gray:     '#6b7280',
    lime:     '#84cc16',
    red:      '#ef4444',
  };

  /* ═══════════════════════════════════════════════════
     1.  DONUT CHART
     ═══════════════════════════════════════════════════ */

  function donutChart(containerId, opts) {
    var c = _container(containerId);
    if (!c) return;
    c.innerHTML = '';

    var consumed = opts.consumed || 0;
    var goal     = opts.goal || 2000;
    var label    = opts.label || 'kcal';
    var color    = opts.color || COLORS.emerald;
    var size     = opts.size || 200;
    var uid      = _nextId();

    var ratio  = Math.min(consumed / (goal || 1), 1.5);       // allow up to 150 %
    var radius = 80;
    var circ   = 2 * Math.PI * radius;
    var stroke = 14;

    var svg = _svgEl('svg', {
      viewBox: '0 0 ' + size + ' ' + size,
      width: '100%',
      style: 'max-width:' + size + 'px;display:block;margin:auto;overflow:visible',
    });

    // Track
    var track = _svgEl('circle', {
      cx: size / 2, cy: size / 2, r: radius,
      fill: 'none',
      stroke: 'var(--nc-track, rgba(128,128,128,.12))',
      'stroke-width': stroke,
    });
    svg.appendChild(track);

    // Filled arc
    var fill = _svgEl('circle', {
      cx: size / 2, cy: size / 2, r: radius,
      fill: 'none',
      stroke: consumed > goal ? COLORS.rose : color,
      'stroke-width': stroke,
      'stroke-linecap': 'round',
      'stroke-dasharray': circ,
      'stroke-dashoffset': circ,                        // start empty
      transform: 'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')',
      style: 'transition: stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1), stroke .3s;',
    });
    svg.appendChild(fill);

    // Centre text — consumed
    var valText = _svgEl('text', {
      x: size / 2, y: size / 2 - 4,
      'text-anchor': 'middle',
      'dominant-baseline': 'auto',
      fill: 'var(--nc-text, #e2e8f0)',
      'font-size': '28',
      'font-weight': '700',
      'font-family': 'Inter, system-ui, sans-serif',
      id: uid + '_val',
    });
    valText.textContent = '0';
    svg.appendChild(valText);

    // Centre text — label
    var lblText = _svgEl('text', {
      x: size / 2, y: size / 2 + 20,
      'text-anchor': 'middle',
      fill: 'var(--nc-muted, #94a3b8)',
      'font-size': '13',
      'font-family': 'Inter, system-ui, sans-serif',
    });
    lblText.textContent = label + '  /  ' + goal.toLocaleString();
    svg.appendChild(lblText);

    c.appendChild(svg);

    // Animate after paint
    requestAnimationFrame(function () {
      var target = circ - circ * Math.min(ratio, 1);
      fill.style.strokeDashoffset = target;
      _animateValue(valText, 0, consumed, 1000);
    });
  }

  /* ═══════════════════════════════════════════════════
     2.  PIE CHART
     ═══════════════════════════════════════════════════ */

  function pieChart(containerId, segments) {
    var c = _container(containerId);
    if (!c) return;
    c.innerHTML = '';

    if (!segments || !segments.length) return;

    var total = segments.reduce(function (s, seg) { return s + (seg.value || 0); }, 0);
    if (total === 0) total = 1;

    var size = 200;
    var cx = size / 2, cy = size / 2, r = 80;
    var uid = _nextId();

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;align-items:center;gap:20px;flex-wrap:wrap;justify-content:center';

    var svg = _svgEl('svg', {
      viewBox: '0 0 ' + size + ' ' + size,
      width: '100%',
      style: 'max-width:' + size + 'px;overflow:visible',
    });

    var startAngle = -90; // start from top
    segments.forEach(function (seg, idx) {
      var pct   = seg.value / total;
      var angle = pct * 360;
      var endAngle = startAngle + angle;

      var startRad = (startAngle * Math.PI) / 180;
      var endRad   = (endAngle * Math.PI) / 180;

      var x1 = cx + r * Math.cos(startRad);
      var y1 = cy + r * Math.sin(startRad);
      var x2 = cx + r * Math.cos(endRad);
      var y2 = cy + r * Math.sin(endRad);

      var largeArc = angle > 180 ? 1 : 0;

      var d = [
        'M', cx, cy,
        'L', x1, y1,
        'A', r, r, 0, largeArc, 1, x2, y2,
        'Z',
      ].join(' ');

      var path = _svgEl('path', {
        d: d,
        fill: seg.color || COLORS.emerald,
        opacity: '0',
        style: 'transition: opacity .6s ease ' + (idx * 0.12) + 's, transform .5s ease ' + (idx * 0.12) + 's;',
        'transform-origin': cx + 'px ' + cy + 'px',
      });

      // Tooltip
      var title = _svgEl('title');
      title.textContent = seg.label + ': ' + _fmt(seg.value) + ' (' + Math.round(pct * 100) + '%)';
      path.appendChild(title);

      svg.appendChild(path);
      startAngle = endAngle;

      // Animate in
      requestAnimationFrame(function () {
        path.setAttribute('opacity', '1');
      });
    });

    wrapper.appendChild(svg);

    // Legend
    var legend = document.createElement('div');
    legend.style.cssText = 'display:flex;flex-direction:column;gap:8px;font-family:Inter,system-ui,sans-serif;font-size:13px;color:var(--nc-text,#e2e8f0)';
    segments.forEach(function (seg) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px';
      var dot = document.createElement('span');
      dot.style.cssText = 'width:12px;height:12px;border-radius:3px;flex-shrink:0;background:' + (seg.color || COLORS.emerald);
      var txt = document.createElement('span');
      txt.textContent = seg.label + '  ' + _fmt(seg.value) + ' (' + Math.round((seg.value / total) * 100) + '%)';
      row.appendChild(dot);
      row.appendChild(txt);
      legend.appendChild(row);
    });
    wrapper.appendChild(legend);
    c.appendChild(wrapper);
  }

  /* ═══════════════════════════════════════════════════
     3.  BAR CHART (vertical)
     ═══════════════════════════════════════════════════ */

  function barChart(containerId, opts) {
    var c = _container(containerId);
    if (!c) return;
    c.innerHTML = '';

    var data     = opts.data || [];
    var maxValue = opts.maxValue || Math.max.apply(null, data.map(function (d) { return d.value; })) || 1;
    var height   = opts.height || 220;
    var padding  = 40;
    var barGap   = 8;
    var uid      = _nextId();

    var chartW = Math.max(data.length * 50, 300);
    var chartH = height;
    var plotH  = chartH - padding - 16;

    var svg = _svgEl('svg', {
      viewBox: '0 0 ' + chartW + ' ' + chartH,
      width: '100%',
      style: 'overflow:visible;font-family:Inter,system-ui,sans-serif',
      preserveAspectRatio: 'xMidYMid meet',
    });

    var barW = Math.max(((chartW - padding * 2) / data.length) - barGap, 12);

    data.forEach(function (d, i) {
      var x = padding + i * (barW + barGap);
      var barH = (d.value / maxValue) * plotH;
      var y = chartH - padding - barH;

      // Bar
      var rect = _svgEl('rect', {
        x: x, y: chartH - padding,             // start at bottom
        width: barW,
        height: 0,
        rx: 4, ry: 4,
        fill: d.color || COLORS.emerald,
        style: 'transition: y .8s cubic-bezier(.4,0,.2,1) ' + (i * 0.06) + 's, height .8s cubic-bezier(.4,0,.2,1) ' + (i * 0.06) + 's;',
      });
      var title = _svgEl('title');
      title.textContent = d.label + ': ' + _fmt(d.value);
      rect.appendChild(title);
      svg.appendChild(rect);

      // Value label above bar
      var vLabel = _svgEl('text', {
        x: x + barW / 2,
        y: y - 4,
        'text-anchor': 'middle',
        fill: 'var(--nc-muted, #94a3b8)',
        'font-size': '11',
        opacity: '0',
        style: 'transition: opacity .5s ease ' + (0.5 + i * 0.06) + 's;',
      });
      vLabel.textContent = _fmt(d.value);
      svg.appendChild(vLabel);

      // X-axis label
      var xLabel = _svgEl('text', {
        x: x + barW / 2,
        y: chartH - padding + 16,
        'text-anchor': 'middle',
        fill: 'var(--nc-muted, #94a3b8)',
        'font-size': '11',
      });
      xLabel.textContent = d.label;
      svg.appendChild(xLabel);

      // Animate
      requestAnimationFrame(function () {
        rect.setAttribute('y', y);
        rect.setAttribute('height', barH);
        vLabel.setAttribute('opacity', '1');
      });
    });

    // Baseline
    svg.appendChild(_svgEl('line', {
      x1: padding - 4, y1: chartH - padding,
      x2: chartW, y2: chartH - padding,
      stroke: 'var(--nc-track, rgba(128,128,128,.18))',
      'stroke-width': 1,
    }));

    c.appendChild(svg);
  }

  /* ═══════════════════════════════════════════════════
     4.  LINE CHART
     ═══════════════════════════════════════════════════ */

  function lineChart(containerId, opts) {
    var c = _container(containerId);
    if (!c) return;
    c.innerHTML = '';

    var data     = opts.data || [];
    var color    = opts.color || COLORS.emerald;
    var height   = opts.height || 200;
    var fillArea = opts.fillArea !== false;
    var uid      = _nextId();

    if (data.length < 2) return;

    var padding = 40;
    var chartW  = Math.max(data.length * 60, 300);
    var chartH  = height;
    var plotH   = chartH - padding - 20;
    var plotW   = chartW - padding * 2;

    var maxVal = Math.max.apply(null, data.map(function (d) { return d.value; })) || 1;

    var svg = _svgEl('svg', {
      viewBox: '0 0 ' + chartW + ' ' + chartH,
      width: '100%',
      style: 'overflow:visible;font-family:Inter,system-ui,sans-serif',
      preserveAspectRatio: 'xMidYMid meet',
    });

    // Grid lines
    for (var g = 0; g <= 4; g++) {
      var gy = chartH - padding - (plotH / 4) * g;
      svg.appendChild(_svgEl('line', {
        x1: padding, y1: gy,
        x2: chartW - 10, y2: gy,
        stroke: 'var(--nc-track, rgba(128,128,128,.10))',
        'stroke-width': 1,
        'stroke-dasharray': '4,4',
      }));
      var gridLabel = _svgEl('text', {
        x: padding - 6, y: gy + 4,
        'text-anchor': 'end',
        fill: 'var(--nc-muted,#94a3b8)',
        'font-size': '10',
      });
      gridLabel.textContent = Math.round((maxVal / 4) * g);
      svg.appendChild(gridLabel);
    }

    // Build polyline points
    var points = [];
    var stepX = plotW / (data.length - 1);
    data.forEach(function (d, i) {
      var x = padding + i * stepX;
      var y = chartH - padding - (d.value / maxVal) * plotH;
      points.push(x + ',' + y);
    });

    // Area fill
    if (fillArea) {
      var areaD = 'M' + padding + ',' + (chartH - padding) + ' L' + points.join(' L') + ' L' + (padding + (data.length - 1) * stepX) + ',' + (chartH - padding) + ' Z';
      var gradId = uid + '_grad';
      var defs = _svgEl('defs');
      var grad = _svgEl('linearGradient', { id: gradId, x1: '0', y1: '0', x2: '0', y2: '1' });
      var s1 = _svgEl('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': '0.25' });
      var s2 = _svgEl('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': '0.02' });
      grad.appendChild(s1);
      grad.appendChild(s2);
      defs.appendChild(grad);
      svg.appendChild(defs);

      var area = _svgEl('path', {
        d: areaD,
        fill: 'url(#' + gradId + ')',
        opacity: '0',
        style: 'transition: opacity .8s ease .4s;',
      });
      svg.appendChild(area);
      requestAnimationFrame(function () { area.setAttribute('opacity', '1'); });
    }

    // Polyline
    var totalLen = 0;
    for (var pi = 1; pi < data.length; pi++) {
      var dx = stepX;
      var dy = ((data[pi].value - data[pi - 1].value) / maxVal) * plotH;
      totalLen += Math.sqrt(dx * dx + dy * dy);
    }

    var polyline = _svgEl('polyline', {
      points: points.join(' '),
      fill: 'none',
      stroke: color,
      'stroke-width': 2.5,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'stroke-dasharray': totalLen,
      'stroke-dashoffset': totalLen,
      style: 'transition: stroke-dashoffset 1.4s cubic-bezier(.4,0,.2,1);',
    });
    svg.appendChild(polyline);

    // Dots & labels
    data.forEach(function (d, i) {
      var x = padding + i * stepX;
      var y = chartH - padding - (d.value / maxVal) * plotH;

      var dot = _svgEl('circle', {
        cx: x, cy: y, r: 4,
        fill: color,
        stroke: 'var(--nc-bg, #0f172a)',
        'stroke-width': 2,
        opacity: '0',
        style: 'transition: opacity .3s ease ' + (0.8 + i * 0.08) + 's;',
      });
      var title = _svgEl('title');
      title.textContent = d.label + ': ' + _fmt(d.value);
      dot.appendChild(title);
      svg.appendChild(dot);

      // X label
      var xLbl = _svgEl('text', {
        x: x, y: chartH - padding + 16,
        'text-anchor': 'middle',
        fill: 'var(--nc-muted, #94a3b8)',
        'font-size': '10',
      });
      xLbl.textContent = d.label;
      svg.appendChild(xLbl);

      requestAnimationFrame(function () { dot.setAttribute('opacity', '1'); });
    });

    c.appendChild(svg);

    // Animate polyline draw
    requestAnimationFrame(function () {
      polyline.style.strokeDashoffset = '0';
    });
  }

  /* ═══════════════════════════════════════════════════
     5.  HORIZONTAL PROGRESS BARS
     ═══════════════════════════════════════════════════ */

  function horizontalBars(containerId, data) {
    var c = _container(containerId);
    if (!c) return;
    c.innerHTML = '';

    if (!data || !data.length) return;

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;flex-direction:column;gap:14px;font-family:Inter,system-ui,sans-serif;';

    data.forEach(function (item, i) {
      var max   = item.max || 100;
      var pct   = Math.min((item.value / max) * 100, 100);
      var color = item.color || COLORS.emerald;
      var unit  = item.unit || '';

      var row = document.createElement('div');

      // Label row
      var header = document.createElement('div');
      header.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px;color:var(--nc-text,#e2e8f0)';

      var labelSpan = document.createElement('span');
      labelSpan.textContent = item.label;
      labelSpan.style.fontWeight = '500';

      var valueSpan = document.createElement('span');
      valueSpan.style.color = 'var(--nc-muted,#94a3b8)';
      valueSpan.textContent = _fmt(item.value) + (unit ? ' ' + unit : '') + '  /  ' + _fmt(max) + (unit ? ' ' + unit : '');

      header.appendChild(labelSpan);
      header.appendChild(valueSpan);
      row.appendChild(header);

      // Track
      var track = document.createElement('div');
      track.style.cssText = 'height:8px;border-radius:4px;background:var(--nc-track,rgba(128,128,128,.12));overflow:hidden;';

      var fill = document.createElement('div');
      fill.style.cssText = 'height:100%;border-radius:4px;width:0;transition:width .9s cubic-bezier(.4,0,.2,1) ' + (i * 0.08) + 's;background:' + color + ';';

      track.appendChild(fill);
      row.appendChild(track);
      wrapper.appendChild(row);

      // Animate
      requestAnimationFrame(function () {
        fill.style.width = pct + '%';
      });
    });

    c.appendChild(wrapper);
  }

  /* ═══════════════════════════════════════════════════
     6.  HEATMAP (GitHub-style calendar)
     ═══════════════════════════════════════════════════ */

  function heatmap(containerId, opts) {
    var c = _container(containerId);
    if (!c) return;
    c.innerHTML = '';

    var data      = opts.data || [];
    var startDate = new Date(opts.startDate);
    var endDate   = new Date(opts.endDate);
    var uid       = _nextId();

    // Build lookup
    var lookup = {};
    data.forEach(function (d) {
      lookup[d.date] = d;
    });

    var cellSize = 14;
    var gap = 3;
    var step = cellSize + gap;

    // Walk days
    var cur = new Date(startDate);
    // Align to start of week (Sunday)
    cur.setDate(cur.getDate() - cur.getDay());

    var cells = [];
    while (cur <= endDate || cells.length % 7 !== 0) {
      cells.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
      if (cells.length > 400) break; // safety
    }

    var weeks = Math.ceil(cells.length / 7);
    var svgW = weeks * step + 30;
    var svgH = 7 * step + 24;

    var svg = _svgEl('svg', {
      viewBox: '0 0 ' + svgW + ' ' + svgH,
      width: '100%',
      style: 'overflow:visible;font-family:Inter,system-ui,sans-serif',
    });

    // Day labels
    var dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
    dayLabels.forEach(function (lbl, i) {
      if (!lbl) return;
      var t = _svgEl('text', {
        x: 0, y: 20 + i * step + cellSize / 2,
        'text-anchor': 'start',
        'dominant-baseline': 'central',
        fill: 'var(--nc-muted, #94a3b8)',
        'font-size': '10',
      });
      t.textContent = lbl;
      svg.appendChild(t);
    });

    cells.forEach(function (date, idx) {
      var week = Math.floor(idx / 7);
      var day  = idx % 7;
      var key  = _formatDateLocal(date);
      var entry = lookup[key];

      var fillColor = 'var(--nc-track, rgba(128,128,128,.10))'; // no data
      if (entry) {
        var ratio = entry.value / (entry.max || 1);
        if (ratio <= 0) {
          fillColor = 'var(--nc-track, rgba(128,128,128,.10))';
        } else if (ratio < 0.5) {
          fillColor = '#065f46'; // dark teal
        } else if (ratio < 0.85) {
          fillColor = '#059669'; // medium green
        } else if (ratio <= 1.1) {
          fillColor = '#10b981'; // at goal — emerald
        } else {
          fillColor = '#f43f5e'; // over goal — rose
        }
      }

      var rect = _svgEl('rect', {
        x: 28 + week * step,
        y: 14 + day * step,
        width: cellSize,
        height: cellSize,
        rx: 3, ry: 3,
        fill: fillColor,
        opacity: '0',
        style: 'transition: opacity .4s ease ' + (idx * 0.004) + 's;',
      });

      var title = _svgEl('title');
      title.textContent = key + (entry ? ': ' + _fmt(entry.value) + ' / ' + _fmt(entry.max || 0) : ': no data');
      rect.appendChild(title);
      svg.appendChild(rect);

      requestAnimationFrame(function () {
        rect.setAttribute('opacity', '1');
      });
    });

    c.appendChild(svg);
  }

  /** Formats a Date to YYYY-MM-DD without timezone shifts */
  function _formatDateLocal(d) {
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  /* ═══════════════════════════════════════════════════
     7.  STACKED BAR CHART
     ═══════════════════════════════════════════════════ */

  function stackedBar(containerId, opts) {
    var c = _container(containerId);
    if (!c) return;
    c.innerHTML = '';

    var data   = opts.data || [];
    var height = opts.height || 220;
    var padding = 40;
    var barGap  = 10;

    if (!data.length) return;

    // Compute max total
    var maxTotal = 0;
    data.forEach(function (d) {
      var t = (d.segments || []).reduce(function (s, seg) { return s + (seg.value || 0); }, 0);
      if (t > maxTotal) maxTotal = t;
    });
    if (maxTotal === 0) maxTotal = 1;

    var chartW = Math.max(data.length * 60, 300);
    var chartH = height;
    var plotH  = chartH - padding - 16;
    var barW   = Math.max(((chartW - padding * 2) / data.length) - barGap, 14);

    var svg = _svgEl('svg', {
      viewBox: '0 0 ' + chartW + ' ' + chartH,
      width: '100%',
      style: 'overflow:visible;font-family:Inter,system-ui,sans-serif',
      preserveAspectRatio: 'xMidYMid meet',
    });

    // Baseline
    svg.appendChild(_svgEl('line', {
      x1: padding - 4, y1: chartH - padding,
      x2: chartW, y2: chartH - padding,
      stroke: 'var(--nc-track, rgba(128,128,128,.18))',
      'stroke-width': 1,
    }));

    data.forEach(function (d, i) {
      var x = padding + i * (barW + barGap);
      var segments = d.segments || [];
      var yOffset = chartH - padding; // bottom

      segments.forEach(function (seg, si) {
        var segH = (seg.value / maxTotal) * plotH;
        var y = yOffset - segH;

        var isFirst = si === 0;
        var isLast  = si === segments.length - 1;

        var rect = _svgEl('rect', {
          x: x,
          y: chartH - padding,          // start at bottom
          width: barW,
          height: 0,
          rx: isLast ? 4 : 0,
          ry: isLast ? 4 : 0,
          fill: seg.color || COLORS.emerald,
          style: 'transition: y .8s cubic-bezier(.4,0,.2,1) ' + (i * 0.06 + si * 0.05) + 's, height .8s cubic-bezier(.4,0,.2,1) ' + (i * 0.06 + si * 0.05) + 's;',
        });

        var title = _svgEl('title');
        title.textContent = (seg.label || '') + ': ' + _fmt(seg.value);
        rect.appendChild(title);
        svg.appendChild(rect);

        // Animate
        (function (r, ty, th) {
          requestAnimationFrame(function () {
            r.setAttribute('y', ty);
            r.setAttribute('height', th);
          });
        })(rect, y, segH);

        yOffset = y;
      });

      // X label
      var xLabel = _svgEl('text', {
        x: x + barW / 2,
        y: chartH - padding + 16,
        'text-anchor': 'middle',
        fill: 'var(--nc-muted, #94a3b8)',
        'font-size': '11',
      });
      xLabel.textContent = d.label || '';
      svg.appendChild(xLabel);
    });

    c.appendChild(svg);
  }

  /* ═══════════════════════════════════════════════════
     PUBLIC API
     ═══════════════════════════════════════════════════ */

  return {
    donutChart:     donutChart,
    pieChart:       pieChart,
    barChart:       barChart,
    lineChart:      lineChart,
    horizontalBars: horizontalBars,
    heatmap:        heatmap,
    stackedBar:     stackedBar,
    clear:          _clear,
  };

})();
