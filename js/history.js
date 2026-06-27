'use strict';

window.HistoryPage = (function () {

    const PAGE_ID = 'page-history';
    let container = null;
    let timePeriod = 'week';   /* 'week' | 'month' */
    let selectedDay = null;    /* date string for detail view */

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

    function _today() {
        return NutriApp.getCurrentDate();
    }

    function _datesInRange(count) {
        var dates = [];
        var t = _today();
        for (var i = count - 1; i >= 0; i--) {
            dates.push(_dateOffset(t, -i));
        }
        return dates;
    }

    function _dayLabel(dateStr) {
        var d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    }

    function _shortDay(dateStr) {
        var d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString(undefined, { weekday: 'short' });
    }

    /* ───────── data gathering ───────── */

    function _getDailyData(dateStr) {
        var food = NutriStorage.getFoodLog(dateStr) || [];
        var exercise = NutriStorage.getExerciseLog(dateStr) || [];
        return {
            date: dateStr,
            calories: _totalOf(food, 'calories'),
            protein: _totalOf(food, 'protein'),
            carbs: _totalOf(food, 'carbs'),
            fat: _totalOf(food, 'fat'),
            burned: _totalOf(exercise, 'caloriesBurned'),
            foodCount: food.length,
            exerciseCount: exercise.length,
            foods: food,
            exercises: exercise
        };
    }

    function _getRangeData() {
        var count = timePeriod === 'week' ? 7 : 30;
        var dates = _datesInRange(count);
        return dates.map(_getDailyData);
    }

    function _calcStreak() {
        var allDates = NutriStorage.getAllDatesWithData() || [];
        if (!allDates.length) return 0;
        var sorted = allDates.slice().sort().reverse();
        var streak = 0;
        var expected = _today();
        for (var i = 0; i < sorted.length; i++) {
            if (sorted[i] === expected) {
                streak++;
                expected = _dateOffset(expected, -1);
            } else if (sorted[i] < expected) {
                break;
            }
        }
        return streak;
    }

    /* ───────── HTML builders ───────── */

    function _buildHeader() {
        return '<div class="page-header">' +
                   '<h1 class="page-title">History & Trends</h1>' +
               '</div>';
    }

    function _buildStatsOverview(rangeData) {
        var goal = _getGoal();
        var streak = _calcStreak();

        /* avg calories last 7 days */
        var last7 = rangeData.slice(-7);
        var daysWithData = last7.filter(function (d) { return d.foodCount > 0; });
        var avgCal = daysWithData.length
            ? Math.round(_totalOf(daysWithData, 'calories') / daysWithData.length)
            : 0;

        /* best day (closest to goal) */
        var bestDay = null;
        var bestDiff = Infinity;
        rangeData.forEach(function (d) {
            if (d.foodCount === 0) return;
            var diff = Math.abs(d.calories - goal);
            if (diff < bestDiff) { bestDiff = diff; bestDay = d; }
        });

        var totalEntries = rangeData.reduce(function (s, d) { return s + d.foodCount; }, 0);

        return '<div class="card">' +
                   '<div class="stat-cards-row">' +
                       '<div class="stat-card"><div class="stat-card__value">🔥 ' + streak + '</div><div class="stat-card__label">Day Streak</div></div>' +
                       '<div class="stat-card"><div class="stat-card__value">' + avgCal + '</div><div class="stat-card__label">Avg kcal (7d)</div></div>' +
                       '<div class="stat-card"><div class="stat-card__value">' + (bestDay ? _shortDay(bestDay.date) : '—') + '</div><div class="stat-card__label">Best Day</div></div>' +
                       '<div class="stat-card"><div class="stat-card__value">' + totalEntries + '</div><div class="stat-card__label">Entries</div></div>' +
                   '</div>' +
               '</div>';
    }

    function _buildPeriodToggle() {
        return '<div class="period-toggle">' +
                   '<button class="chip' + (timePeriod === 'week' ? ' chip--active' : '') + '" data-period="week">Week</button>' +
                   '<button class="chip' + (timePeriod === 'month' ? ' chip--active' : '') + '" data-period="month">Month</button>' +
               '</div>';
    }

    function _buildCalorieTrendChart() {
        return '<div class="card">' +
                   '<h3 class="card__title">Calorie Trend</h3>' +
                   '<div id="history-calorie-trend" class="chart-container chart-container--lg"></div>' +
               '</div>';
    }

    function _buildMacroTrendChart() {
        return '<div class="card">' +
                   '<h3 class="card__title">Macro Breakdown</h3>' +
                   '<div id="history-macro-trend" class="chart-container chart-container--lg"></div>' +
               '</div>';
    }

    function _buildHeatmap() {
        return '<div class="card">' +
                   '<h3 class="card__title">Calendar Heatmap</h3>' +
                   '<p class="card__subtitle">Click a day to see details</p>' +
                   '<div id="history-heatmap" class="chart-container chart-container--lg"></div>' +
               '</div>';
    }

    function _buildDayDetail() {
        if (!selectedDay) return '';
        var data = _getDailyData(selectedDay);
        var goal = _getGoal();
        var net = data.calories - data.burned;

        var html = '<div class="card day-detail">' +
                       '<div class="day-detail__header">' +
                           '<h3 class="card__title">' + _dayLabel(selectedDay) + '</h3>' +
                           '<button class="btn-icon-sm" data-action="close-detail" title="Close">✕</button>' +
                       '</div>' +
                       '<div class="stat-cards-row">' +
                           '<div class="stat-card"><div class="stat-card__value">' + Math.round(data.calories) + '</div><div class="stat-card__label">kcal</div></div>' +
                           '<div class="stat-card"><div class="stat-card__value">' + Math.round(data.protein) + 'g</div><div class="stat-card__label">Protein</div></div>' +
                           '<div class="stat-card"><div class="stat-card__value">' + Math.round(data.carbs) + 'g</div><div class="stat-card__label">Carbs</div></div>' +
                           '<div class="stat-card"><div class="stat-card__value">' + Math.round(data.fat) + 'g</div><div class="stat-card__label">Fat</div></div>' +
                       '</div>' +
                       '<div class="day-detail__net">Net: ' + Math.round(net) + ' kcal  |  Goal: ' + goal + ' kcal</div>';

        if (data.foods.length) {
            html += '<h4>Foods</h4><ul class="day-detail__list">';
            data.foods.forEach(function (f) {
                html += '<li>' + (f.name || 'Food') + ' — ' + Math.round(f.calories || 0) + ' kcal</li>';
            });
            html += '</ul>';
        }

        if (data.exercises.length) {
            html += '<h4>Exercises</h4><ul class="day-detail__list">';
            data.exercises.forEach(function (ex) {
                html += '<li>' + (ex.name || 'Exercise') + ' — ' + (ex.duration || 0) + ' min, 🔥 ' + Math.round(ex.caloriesBurned || 0) + ' kcal</li>';
            });
            html += '</ul>';
        }

        if (!data.foods.length && !data.exercises.length) {
            html += '<div class="empty-state"><p class="empty-state__text">No data for this day.</p></div>';
        }

        html += '</div>';
        return html;
    }

    function _buildWeeklySummary(rangeData) {
        var last7 = rangeData.slice(-7);
        var totalCal = _totalOf(last7, 'calories');
        var avgP = last7.length ? Math.round(_totalOf(last7, 'protein') / last7.length) : 0;
        var avgC = last7.length ? Math.round(_totalOf(last7, 'carbs') / last7.length) : 0;
        var avgF = last7.length ? Math.round(_totalOf(last7, 'fat') / last7.length) : 0;

        /* most eaten food */
        var foodCounts = {};
        last7.forEach(function (d) {
            d.foods.forEach(function (f) {
                var n = (f.name || '').toLowerCase();
                if (n) foodCounts[n] = (foodCounts[n] || 0) + 1;
            });
        });
        var topFood = '—';
        var topFoodCount = 0;
        Object.keys(foodCounts).forEach(function (k) {
            if (foodCounts[k] > topFoodCount) { topFood = k; topFoodCount = foodCounts[k]; }
        });

        /* most done exercise */
        var exCounts = {};
        last7.forEach(function (d) {
            d.exercises.forEach(function (ex) {
                var n = (ex.name || '').toLowerCase();
                if (n) exCounts[n] = (exCounts[n] || 0) + 1;
            });
        });
        var topEx = '—';
        var topExCount = 0;
        Object.keys(exCounts).forEach(function (k) {
            if (exCounts[k] > topExCount) { topEx = k; topExCount = exCounts[k]; }
        });

        return '<div class="card weekly-summary">' +
                   '<h3 class="card__title">Weekly Summary</h3>' +
                   '<div class="weekly-summary__grid">' +
                       '<div class="weekly-summary__item"><span class="weekly-summary__label">Total Calories</span><span class="weekly-summary__value">' + Math.round(totalCal) + ' kcal</span></div>' +
                       '<div class="weekly-summary__item"><span class="weekly-summary__label">Avg Protein</span><span class="weekly-summary__value">' + avgP + 'g</span></div>' +
                       '<div class="weekly-summary__item"><span class="weekly-summary__label">Avg Carbs</span><span class="weekly-summary__value">' + avgC + 'g</span></div>' +
                       '<div class="weekly-summary__item"><span class="weekly-summary__label">Avg Fat</span><span class="weekly-summary__value">' + avgF + 'g</span></div>' +
                       '<div class="weekly-summary__item"><span class="weekly-summary__label">Most Eaten</span><span class="weekly-summary__value" style="text-transform:capitalize">' + topFood + '</span></div>' +
                       '<div class="weekly-summary__item"><span class="weekly-summary__label">Top Exercise</span><span class="weekly-summary__value" style="text-transform:capitalize">' + topEx + '</span></div>' +
                   '</div>' +
               '</div>';
    }

    /* ───────── chart rendering ───────── */

    function _renderCharts(rangeData) {
        var goal = _getGoal();

        /* Calorie trend line chart */
        try {
            var lineData = rangeData.map(function (d) {
                return { label: _shortDay(d.date), value: Math.round(d.calories) };
            });
            NutriCharts.lineChart('history-calorie-trend', lineData, {
                goalLine: goal,
                goalLabel: 'Goal',
                color: '#22c55e',
                fill: true
            });
        } catch (_) {}

        /* Macro stacked bar */
        try {
            var stackedData = rangeData.map(function (d) {
                return {
                    label: _shortDay(d.date),
                    segments: [
                        { label: 'Protein', value: Math.round(d.protein), color: '#3b82f6' },
                        { label: 'Carbs',   value: Math.round(d.carbs),   color: '#22c55e' },
                        { label: 'Fat',     value: Math.round(d.fat),     color: '#f59e0b' }
                    ]
                };
            });
            NutriCharts.stackedBar('history-macro-trend', stackedData);
        } catch (_) {}

        /* Calendar heatmap */
        try {
            var heatData = rangeData.map(function (d) {
                var ratio = d.calories / goal;
                var color;
                if (d.foodCount === 0) color = 'rgba(255,255,255,0.05)';
                else if (ratio >= 0.9 && ratio <= 1.1) color = '#22c55e';
                else if (ratio < 0.9) color = '#eab308';
                else color = '#ef4444';

                return { date: d.date, value: Math.round(d.calories), color: color, label: _dayLabel(d.date) };
            });
            NutriCharts.heatmap('history-heatmap', heatData, {
                onClick: function (dateStr) {
                    selectedDay = dateStr;
                    /* re-render only the detail section to avoid full rebuild */
                    var existing = container.querySelector('.day-detail');
                    if (existing) existing.remove();
                    var heatmapCard = container.querySelector('#history-heatmap').closest('.card');
                    if (heatmapCard) {
                        heatmapCard.insertAdjacentHTML('afterend', _buildDayDetail());
                    }
                }
            });
        } catch (_) {}
    }

    /* ───────── event handling ───────── */

    function _handleClick(e) {
        var period = e.target.closest('[data-period]');
        if (period) {
            timePeriod = period.getAttribute('data-period');
            selectedDay = null;
            render();
            return;
        }

        var btn = e.target.closest('[data-action]');
        if (btn && btn.getAttribute('data-action') === 'close-detail') {
            selectedDay = null;
            var detail = container.querySelector('.day-detail');
            if (detail) detail.remove();
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

        var rangeData = _getRangeData();

        container.innerHTML =
            _buildHeader() +
            _buildStatsOverview(rangeData) +
            _buildPeriodToggle() +
            _buildCalorieTrendChart() +
            _buildMacroTrendChart() +
            _buildHeatmap() +
            _buildDayDetail() +
            _buildWeeklySummary(rangeData);

        _renderCharts(rangeData);
    }

    return { init: init, render: render };

})();
