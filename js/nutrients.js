'use strict';

window.NutrientsPage = (function () {

    const PAGE_ID = 'page-nutrients';
    let container = null;
    let timePeriod = 'today';  /* 'today' | 'week' | 'month' */

    /* ───────── Daily Value references ───────── */

    var DAILY_VALUES = {
        'Vitamin A': { dv: 100, unit: '%' },
        'Vitamin B6': { dv: 100, unit: '%' },
        'Vitamin B12': { dv: 100, unit: '%' },
        'Vitamin C': { dv: 100, unit: '%' },
        'Vitamin D': { dv: 100, unit: '%' },
        'Vitamin E': { dv: 100, unit: '%' },
        'Vitamin K': { dv: 100, unit: '%' },
        'Iron': { dv: 100, unit: '%' },
        'Calcium': { dv: 100, unit: '%' },
        'Potassium': { dv: 100, unit: '%' },
        'Magnesium': { dv: 100, unit: '%' },
        'Zinc': { dv: 100, unit: '%' },
        'Sodium': { dv: 100, unit: '%' }
    };

    var VITAMIN_KEYS  = ['Vitamin A', 'Vitamin B6', 'Vitamin B12', 'Vitamin C', 'Vitamin D', 'Vitamin E', 'Vitamin K'];
    var MINERAL_KEYS  = ['Iron', 'Calcium', 'Potassium', 'Magnesium', 'Zinc', 'Sodium'];

    /* ───────── helpers ───────── */

    function _totalOf(entries, key) {
        return entries.reduce(function (s, e) { return s + (parseFloat(e[key]) || 0); }, 0);
    }

    function _getGoal() {
        var settings = NutriStorage.getUserSettings() || {};
        return parseInt(settings.dailyCalorieGoal, 10) || 2000;
    }

    function _dateOffset(base, days) {
        var d = new Date(base);
        d.setDate(d.getDate() + days);
        return d.toISOString().slice(0, 10);
    }

    function _today() { return NutriApp.getCurrentDate(); }

    function _getDateRange() {
        var count = timePeriod === 'today' ? 1 : (timePeriod === 'week' ? 7 : 30);
        var dates = [];
        var t = _today();
        for (var i = count - 1; i >= 0; i--) dates.push(_dateOffset(t, -i));
        return dates;
    }

    function _gatherEntries() {
        var dates = _getDateRange();
        var all = [];
        dates.forEach(function (d) {
            var entries = NutriStorage.getFoodLog(d) || [];
            all = all.concat(entries);
        });
        return all;
    }

    function _gatherExercises() {
        var dates = _getDateRange();
        var all = [];
        dates.forEach(function (d) {
            var entries = NutriStorage.getExerciseLog(d) || [];
            all = all.concat(entries);
        });
        return all;
    }

    function _aggregateMicros(entries) {
        var totals = {};
        var keyMap = {
            'A': 'Vitamin A', 'B6': 'Vitamin B6', 'B12': 'Vitamin B12',
            'C': 'Vitamin C', 'D': 'Vitamin D', 'E': 'Vitamin E', 'K': 'Vitamin K',
            'iron': 'Iron', 'calcium': 'Calcium', 'potassium': 'Potassium',
            'magnesium': 'Magnesium', 'zinc': 'Zinc', 'sodium': 'Sodium'
        };

        entries.forEach(function (entry) {
            var vitamins = entry.vitamins || {};
            var minerals = entry.minerals || {};
            var all = Object.assign({}, vitamins, minerals);
            Object.keys(all).forEach(function (k) {
                var mappedKey = keyMap[k] || k;
                totals[mappedKey] = (totals[mappedKey] || 0) + (parseFloat(all[k]) || 0);
            });
        });
        return totals;
    }

    function _microPct(name, micros) {
        var info = DAILY_VALUES[name];
        if (!info || !info.dv) return 0;
        var val = micros[name] || 0;
        var days = _getDateRange().length;
        var avg = val / days;
        return Math.round((avg / info.dv) * 100);
    }

    function _dvColor(pct) {
        if (pct < 30)  return '#ef4444';
        if (pct < 70)  return '#eab308';
        if (pct > 150) return '#f97316';
        return '#22c55e';
    }

    function _pct(a, b) { return b ? Math.min(Math.round((a / b) * 100), 999) : 0; }

    /* ───────── nutrient alerts ───────── */

    function _getAlerts() {
        var alerts = [];
        /* check last 3 days for consistently low or high */
        var t = _today();
        var days3 = [];
        for (var i = 0; i < 3; i++) days3.push(_dateOffset(t, -i));

        var allKeys = VITAMIN_KEYS.concat(MINERAL_KEYS);

        allKeys.forEach(function (name) {
            var lowCount = 0;
            var highCount = 0;

            days3.forEach(function (d) {
                var entries = NutriStorage.getFoodLog(d) || [];
                var micros = _aggregateMicros(entries);
                var info = DAILY_VALUES[name];
                if (!info) return;
                var val = micros[name] || 0;
                var pct = Math.round((val / info.dv) * 100);
                if (pct < 30) lowCount++;
                if (pct > 150) highCount++;
            });

            if (lowCount >= 3) {
                alerts.push({ type: 'low', nutrient: name, message: '⚠️ Your ' + name + ' intake has been low for the past 3 days.' });
            }
            if (highCount >= 3) {
                alerts.push({ type: 'high', nutrient: name, message: '⚠️ Your ' + name + ' intake has been excessively high recently.' });
            }
        });

        return alerts;
    }

    /* ───────── HTML builders ───────── */

    function _buildHeader() {
        return '<div class="page-header">' +
                   '<h1 class="page-title">Nutrient Analysis</h1>' +
               '</div>';
    }

    function _buildPeriodSelector() {
        var periods = ['today', 'week', 'month'];
        var labels  = { today: 'Today', week: 'This Week', month: 'This Month' };
        var html = '<div class="period-toggle">';
        periods.forEach(function (p) {
            html += '<button class="chip' + (timePeriod === p ? ' chip--active' : '') + '" data-period="' + p + '">' + labels[p] + '</button>';
        });
        html += '</div>';
        return html;
    }

    function _buildMacroAnalysis(protein, carbs, fat, goal) {
        var totalMacroCal = (protein * 4) + (carbs * 4) + (fat * 9);
        var pPct = totalMacroCal ? Math.round((protein * 4 / totalMacroCal) * 100) : 0;
        var cPct = totalMacroCal ? Math.round((carbs * 4 / totalMacroCal) * 100) : 0;
        var fPct = totalMacroCal ? Math.round((fat * 9 / totalMacroCal) * 100) : 0;

        var days = _getDateRange().length;
        var dailyGoal = goal;
        var proteinGoal = Math.round((dailyGoal * 0.25) / 4) * days;
        var carbsGoal   = Math.round((dailyGoal * 0.50) / 4) * days;
        var fatGoal      = Math.round((dailyGoal * 0.25) / 9) * days;

        return '<div class="card macro-analysis">' +
                   '<h3 class="card__title">Macro Analysis</h3>' +
                   '<div id="nutrients-macro-pie" class="chart-container donut-container"></div>' +
                   '<p class="macro-analysis__ratio">' +
                       'Your ratio: <strong>' + pPct + '/' + cPct + '/' + fPct + '%</strong>' +
                       ' &nbsp;|&nbsp; Recommended: <strong>25/50/25%</strong>' +
                   '</p>' +
                   '<div class="macro-detail-cards">' +
                       _macroDetailCard('Protein', protein, proteinGoal, protein * 4, totalMacroCal, '#3b82f6') +
                       _macroDetailCard('Carbs', carbs, carbsGoal, carbs * 4, totalMacroCal, '#22c55e') +
                       _macroDetailCard('Fat', fat, fatGoal, fat * 9, totalMacroCal, '#f59e0b') +
                   '</div>' +
               '</div>';
    }

    function _macroDetailCard(name, grams, goalGrams, macroCal, totalCal, color) {
        var pct = _pct(grams, goalGrams);
        var calPct = totalCal ? Math.round((macroCal / totalCal) * 100) : 0;
        return '<div class="stat-card macro-detail-card">' +
                   '<div class="macro-detail-card__name" style="color:' + color + '">' + name + '</div>' +
                   '<div class="macro-detail-card__grams">' + Math.round(grams) + 'g / ' + Math.round(goalGrams) + 'g</div>' +
                   '<div class="macro-detail-card__cals">' + Math.round(macroCal) + ' kcal (' + calPct + '% of total)</div>' +
                   '<div class="progress-bar"><div class="progress-bar__fill" style="width:' + Math.min(pct, 100) + '%;background:' + color + '"></div></div>' +
               '</div>';
    }

    function _buildCalorieBreakdown(consumed, burned, goal) {
        var days = _getDateRange().length;
        var totalGoal = goal * days;
        var net = consumed - burned;
        var pct = _pct(net, totalGoal);

        return '<div class="card calorie-breakdown">' +
                   '<h3 class="card__title">Calorie Breakdown</h3>' +
                   '<div class="calorie-breakdown__rows">' +
                       '<div class="calorie-breakdown__row">' +
                           '<span>🍔 Food Calories</span><span>+' + Math.round(consumed) + ' kcal</span>' +
                       '</div>' +
                       '<div class="calorie-breakdown__row">' +
                           '<span>🏃 Exercise Burned</span><span>−' + Math.round(burned) + ' kcal</span>' +
                       '</div>' +
                       '<div class="calorie-breakdown__row calorie-breakdown__row--net">' +
                           '<span>⚡ Net Calories</span><span>' + Math.round(net) + ' kcal</span>' +
                       '</div>' +
                   '</div>' +
                   '<div class="calorie-breakdown__goal">' +
                       '<span>Goal: ' + totalGoal + ' kcal (' + days + ' day' + (days > 1 ? 's' : '') + ')</span>' +
                       '<span>' + pct + '%</span>' +
                   '</div>' +
                   '<div class="progress-bar"><div class="progress-bar__fill" style="width:' + Math.min(pct, 100) + '%;background:' + (pct > 110 ? '#ef4444' : '#22c55e') + '"></div></div>' +
               '</div>';
    }

    function _buildMicroSection(micros) {
        function barsHtml(keys, id) {
            return '<div id="' + id + '" class="chart-container"></div>';
        }

        return '<div class="card micro-section">' +
                   '<h3 class="card__title">Vitamins & Minerals</h3>' +
                   '<h4 class="micro-section__sub">Vitamins</h4>' +
                   barsHtml(VITAMIN_KEYS, 'nutrients-vitamins-bars') +
                   '<h4 class="micro-section__sub">Minerals</h4>' +
                   barsHtml(MINERAL_KEYS, 'nutrients-minerals-bars') +
               '</div>';
    }

    function _buildAlerts(alerts) {
        if (!alerts.length) return '';
        var html = '<div class="card nutrient-alerts">' +
                       '<h3 class="card__title">Nutrient Alerts</h3>';
        alerts.forEach(function (a) {
            var cls = a.type === 'low' ? 'alert--warning' : 'alert--danger';
            html += '<div class="alert ' + cls + '">' + a.message + '</div>';
        });
        html += '</div>';
        return html;
    }

    function _buildEmptyState() {
        return '<div class="card">' +
                   '<div class="empty-state">' +
                       '<div class="empty-state__icon">📊</div>' +
                       '<p class="empty-state__text">No food logged for this period.</p>' +
                       '<p class="empty-state__sub">Log your meals to see detailed nutrient analysis.</p>' +
                       '<button class="btn btn-primary" data-action="go-food">Go to Food Log</button>' +
                   '</div>' +
               '</div>';
    }

    /* ───────── chart rendering ───────── */

    function _renderCharts(protein, carbs, fat, micros) {
        /* Macro pie chart */
        try {
            NutriCharts.pieChart('nutrients-macro-pie', [
                { label: 'Protein', value: Math.round(protein * 4), color: '#3b82f6' },
                { label: 'Carbs',   value: Math.round(carbs * 4),   color: '#22c55e' },
                { label: 'Fat',     value: Math.round(fat * 9),     color: '#f59e0b' }
            ], { size: 200, thickness: 22 });
        } catch (_) {}

        /* Vitamin bars */
        try {
            var vitData = VITAMIN_KEYS.map(function (k) {
                var pct = _microPct(k, micros);
                return { label: k, value: pct, maxValue: 100, color: _dvColor(pct) };
            });
            NutriCharts.horizontalBars('nutrients-vitamins-bars', vitData, {
                barHeight: 22,
                showValues: true,
                suffix: '%',
                colorFn: function (v) { return _dvColor(v); }
            });
        } catch (_) {}

        /* Mineral bars */
        try {
            var minData = MINERAL_KEYS.map(function (k) {
                var pct = _microPct(k, micros);
                return { label: k, value: pct, maxValue: 100, color: _dvColor(pct) };
            });
            NutriCharts.horizontalBars('nutrients-minerals-bars', minData, {
                barHeight: 22,
                showValues: true,
                suffix: '%',
                colorFn: function (v) { return _dvColor(v); }
            });
        } catch (_) {}
    }

    /* ───────── event handling ───────── */

    function _handleClick(e) {
        var period = e.target.closest('[data-period]');
        if (period) {
            timePeriod = period.getAttribute('data-period');
            render();
            return;
        }

        var btn = e.target.closest('[data-action]');
        if (btn && btn.getAttribute('data-action') === 'go-food') {
            NutriApp.showPage('page-food-log');
        }
    }

    /* ───────── public ───────── */

    function init() {
        container = document.getElementById(PAGE_ID);
        if (container) {
            container.addEventListener('click', _handleClick);
        }
    }

    function render() {
        if (!container) container = document.getElementById(PAGE_ID);
        if (!container) return;

        var foodEntries = _gatherEntries();
        var exerciseEntries = _gatherExercises();
        var goal = _getGoal();

        if (!foodEntries.length) {
            container.innerHTML = _buildHeader() + _buildPeriodSelector() + _buildEmptyState();
            return;
        }

        var protein = _totalOf(foodEntries, 'protein');
        var carbs   = _totalOf(foodEntries, 'carbs');
        var fat     = _totalOf(foodEntries, 'fat');
        var consumed = _totalOf(foodEntries, 'calories');
        var burned   = _totalOf(exerciseEntries, 'caloriesBurned');
        var micros   = _aggregateMicros(foodEntries);
        var alerts   = _getAlerts();

        container.innerHTML =
            _buildHeader() +
            _buildPeriodSelector() +
            _buildMacroAnalysis(protein, carbs, fat, goal) +
            _buildCalorieBreakdown(consumed, burned, goal) +
            _buildMicroSection(micros) +
            _buildAlerts(alerts);

        _renderCharts(protein, carbs, fat, micros);
    }

    return { init: init, render: render };

})();
