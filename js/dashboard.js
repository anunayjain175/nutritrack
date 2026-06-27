'use strict';

window.DashboardPage = (function () {

    const PAGE_ID = 'page-dashboard';
    let container = null;
    let reminderBannerDismissed = false;

    /* ───────── helpers ───────── */

    function _totalOf(entries, key) {
        return entries.reduce(function (sum, e) { return sum + (parseFloat(e[key]) || 0); }, 0);
    }

    function _groupByMeal(entries) {
        const groups = { breakfast: [], lunch: [], dinner: [], snacks: [] };
        entries.forEach(function (e) {
            const meal = (e.meal || 'snacks').toLowerCase();
            if (groups[meal]) groups[meal].push(e);
            else groups.snacks.push(e);
        });
        return groups;
    }

    function _mealIcon(meal) {
        const icons = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snacks: '🍿' };
        return icons[meal] || '🍽️';
    }

    function _capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function _pct(value, goal) {
        if (!goal) return 0;
        return Math.min(Math.round((value / goal) * 100), 100);
    }

    /* ───────── render helpers ───────── */

    function _buildCalendarStrip(selectedDate) {
        var date = new Date(selectedDate);
        var currentDayOfWeek = date.getDay(); // 0 is Sunday, 6 is Saturday
        var sundayOfThisWeek = new Date(date);
        sundayOfThisWeek.setDate(date.getDate() - currentDayOfWeek);

        var daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        var today = NutriStorage.getTodayDate();

        var daysHtml = '';
        for (var i = 0; i < 7; i++) {
            var tempDate = new Date(sundayOfThisWeek);
            tempDate.setDate(sundayOfThisWeek.getDate() + i);
            var dateStr = NutriStorage.formatDate(tempDate);
            var dateNum = tempDate.getDate();
            var dayLabel = daysOfWeek[i];

            // Check if selected
            var isSelected = (dateStr === selectedDate);
            // Check streak (day has food logged)
            var foodLog = NutriStorage.getFoodLog(dateStr) || [];
            var hasFood = foodLog.length > 0;

            var itemCls = 'calendar-day-item';
            if (isSelected) itemCls += ' calendar-day-item--selected';
            if (hasFood) itemCls += ' calendar-day-item--streak';

            daysHtml += '<div class="' + itemCls + '" data-date="' + dateStr + '">' +
                            '<span class="calendar-day-item__day">' + dayLabel + '</span>' +
                            '<span class="calendar-day-item__date">' + dateNum + '</span>' +
                        '</div>';
        }

        // Streak count: consecutive days ending in today
        var allDatesWithData = NutriStorage.getAllDatesWithData() || [];
        var streak = 0;
        var checkDate = new Date(); // start checking from today backwards
        while (true) {
            var checkStr = NutriStorage.formatDate(checkDate);
            var log = NutriStorage.getFoodLog(checkStr) || [];
            if (log.length > 0) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
        if (streak === 0 && allDatesWithData.length > 0) {
            // Check if they logged yesterday instead of today
            var yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            var yesterdayStr = NutriStorage.formatDate(yesterday);
            var logYesterday = NutriStorage.getFoodLog(yesterdayStr) || [];
            if (logYesterday.length > 0) {
                streak = 1; // start checking backwards from yesterday
                var checkYesterday = new Date(yesterday);
                while (true) {
                    checkYesterday.setDate(checkYesterday.getDate() - 1);
                    var checkYesterdayStr = NutriStorage.formatDate(checkYesterday);
                    var logPrev = NutriStorage.getFoodLog(checkYesterdayStr) || [];
                    if (logPrev.length > 0) {
                        streak++;
                    } else {
                        break;
                    }
                }
            }
        }

        // Header titles
        var isToday = (selectedDate === today);
        var titleText = isToday ? 'Today' : selectedDate;

        return '<div class="calendar-strip">' +
                   '<div class="calendar-strip__header">' +
                       '<button class="calendar-strip__title-dropdown" id="dashboard-date-selector-btn">' +
                           '<span id="calendar-title-text">' + titleText + '</span> <span class="arrow-down">▼</span>' +
                       '</button>' +
                       '<div class="calendar-strip__right-icons">' +
                           '<span class="inline-streak">⚡ <span id="streak-val">' + streak + '</span></span>' +
                       '</div>' +
                   '</div>' +
                   '<div class="calendar-strip__days">' +
                       daysHtml +
                   '</div>' +
               '</div>';
    }

    function _buildReminderBanner() {
        if (reminderBannerDismissed) return '';
        return '<div class="reminder-banner" id="reminder-banner">' +
                   '<div class="reminder-banner__icon">⏰</div>' +
                   '<div class="reminder-banner__content">' +
                       '<h4 class="reminder-banner__title">Stay on track every day</h4>' +
                       '<p class="reminder-banner__sub">Tap to set daily reminders</p>' +
                   '</div>' +
                   '<button class="reminder-banner__close" data-action="dismiss-reminder" aria-label="Dismiss">&times;</button>' +
               '</div>';
    }

    function _buildSummaryRow(totalCals, goal, burned, protein, carbs, fat) {
        var net = totalCals - burned;
        var remaining = goal - net; // goal - consumed + burned
        
        // Macro goals
        var proteinGoal = Math.round((goal * 0.25) / 4);
        var carbsGoal   = Math.round((goal * 0.50) / 4);
        var fatGoal      = Math.round((goal * 0.25) / 9);

        return '<div class="dashboard-summary-row">' +
                   /* Card 1: Calories */
                   '<div class="summary-card">' +
                       '<div class="summary-card__header">' +
                           '<span class="summary-card__header-icon">🔥</span>' +
                           '<span>Calories</span>' +
                       '</div>' +
                       '<div class="summary-card__grid">' +
                           '<div class="summary-card__col">' +
                               '<span class="summary-card__val">' + Math.round(totalCals) + '</span>' +
                               '<span class="summary-card__label">Food</span>' +
                           '</div>' +
                           '<div class="summary-card__col">' +
                               '<span class="summary-card__val">' + Math.round(burned) + '</span>' +
                               '<span class="summary-card__label">Exercise</span>' +
                           '</div>' +
                           '<div class="summary-card__col">' +
                               '<span class="summary-card__val summary-card__val--highlight">' + Math.round(remaining) + '</span>' +
                               '<span class="summary-card__label">Remaining</span>' +
                           '</div>' +
                       '</div>' +
                   '</div>' +
                   /* Card 2: Macros */
                   '<div class="summary-card">' +
                       '<div class="summary-card__header">' +
                           '<span class="summary-card__header-icon">🍩</span>' +
                           '<span>Macros</span>' +
                       '</div>' +
                       '<div class="summary-card__grid">' +
                           '<div class="summary-card__col">' +
                               '<span class="summary-card__val">' + Math.round(carbs) + '/' + carbsGoal + '</span>' +
                               '<span class="summary-card__label">Carbs (g)</span>' +
                           '</div>' +
                           '<div class="summary-card__col">' +
                               '<span class="summary-card__val">' + Math.round(protein) + '/' + proteinGoal + '</span>' +
                               '<span class="summary-card__label">Protein (g)</span>' +
                           '</div>' +
                           '<div class="summary-card__col">' +
                               '<span class="summary-card__val">' + Math.round(fat) + '/' + fatGoal + '</span>' +
                               '<span class="summary-card__label">Fat (g)</span>' +
                           '</div>' +
                       '</div>' +
                   '</div>' +
               '</div>';
    }

    function _buildQuickActions() {
        return '<div class="quick-actions-row">' +
                   '<button class="quick-action-btn quick-action-btn--food" data-action="add-food">' +
                       '<span class="quick-action-btn__icon">🍎</span>' +
                       '<span class="quick-action-btn__label">Log Food</span>' +
                   '</button>' +
                   '<button class="quick-action-btn quick-action-btn--exercise" data-action="add-exercise">' +
                       '<span class="quick-action-btn__icon">💪</span>' +
                       '<span class="quick-action-btn__label">Log Exercise</span>' +
                   '</button>' +
               '</div>';
    }

    function _buildGroupedFoodCard(entry) {
        // Parse serving time
        var formattedTime = 'Logged';
        if (entry.timestamp || entry.loggedAt) {
            var dateObj = new Date(entry.timestamp || entry.loggedAt);
            var hours = dateObj.getHours();
            var minutes = dateObj.getMinutes();
            var ampm = hours >= 12 ? 'pm' : 'am';
            hours = hours % 12;
            hours = hours ? hours : 12; // the hour '0' should be '12'
            minutes = minutes < 10 ? '0' + minutes : minutes;
            formattedTime = hours + ':' + minutes + ' ' + ampm;
        }

        // Subitems list
        var subItemsHtml = '';
        var subItems = entry.subItems || [];
        
        // Fallback if entry has no subitems (older format)
        if (subItems.length === 0) {
            subItems = [{
                name: entry.name,
                calories: entry.calories,
                carbs: entry.carbs,
                protein: entry.protein,
                fat: entry.fat
            }];
        }

        subItems.forEach(function (item) {
            subItemsHtml += '<div class="grouped-food-item">' +
                                '<div class="grouped-food-item__name">' + item.name + '</div>' +
                                '<div class="grouped-food-item__macros">' +
                                    'Calories: ' + Math.round(item.calories || 0) + ' | ' +
                                    'Carbs: ' + Math.round(item.carbs || 0) + 'g | ' +
                                    'Protein: ' + Math.round(item.protein || 0) + 'g | ' +
                                    'Fat: ' + Math.round(item.fat || 0) + 'g' +
                                '</div>' +
                            '</div>';
        });

        // Totals and progress percentages
        // Let's get user goals to compute percentages
        var settings = NutriStorage.getUserSettings() || {};
        var goal = parseInt(settings.dailyCalorieGoal, 10) || 2000;
        var proteinGoal = Math.round((goal * 0.25) / 4);
        var carbsGoal   = Math.round((goal * 0.50) / 4);
        var fatGoal      = Math.round((goal * 0.25) / 9);

        var calPct = _pct(entry.calories, goal);
        var carbsPct = _pct(entry.carbs, carbsGoal);
        var proteinPct = _pct(entry.protein, proteinGoal);
        var fatPct = _pct(entry.fat, fatGoal);

        return '<div class="grouped-food-card" data-id="' + entry.id + '" data-meal="' + entry.meal + '">' +
                   '<div class="grouped-food-card__desc">' + (entry.description || entry.name) + '</div>' +
                   '<div class="grouped-food-card__items">' +
                       subItemsHtml +
                   '</div>' +
                   '<div class="grouped-food-card__totals">' +
                       '<div class="total-macro-col">' +
                           '<span class="total-macro-label">Calories</span>' +
                           '<span class="total-macro-val">' + Math.round(entry.calories || 0) + '</span>' +
                           '<div class="micro-progress"><div class="micro-progress-fill fill-calories" style="width:' + calPct + '%"></div></div>' +
                           '<span class="total-macro-pct">' + calPct + '%</span>' +
                       '</div>' +
                       '<div class="total-macro-col">' +
                           '<span class="total-macro-label">Carbs</span>' +
                           '<span class="total-macro-val">' + Math.round(entry.carbs || 0) + 'g</span>' +
                           '<div class="micro-progress"><div class="micro-progress-fill fill-carbs" style="width:' + carbsPct + '%"></div></div>' +
                           '<span class="total-macro-pct">' + carbsPct + '%</span>' +
                       '</div>' +
                       '<div class="total-macro-col">' +
                           '<span class="total-macro-label">Protein</span>' +
                           '<span class="total-macro-val">' + Math.round(entry.protein || 0) + 'g</span>' +
                           '<div class="micro-progress"><div class="micro-progress-fill fill-protein" style="width:' + proteinPct + '%"></div></div>' +
                           '<span class="total-macro-pct">' + proteinPct + '%</span>' +
                       '</div>' +
                       '<div class="total-macro-col">' +
                           '<span class="total-macro-label">Fat</span>' +
                           '<span class="total-macro-val">' + Math.round(entry.fat || 0) + 'g</span>' +
                           '<div class="micro-progress"><div class="micro-progress-fill fill-fat" style="width:' + fatPct + '%"></div></div>' +
                           '<span class="total-macro-pct">' + fatPct + '%</span>' +
                       '</div>' +
                   '</div>' +
                   '<div class="grouped-food-card__footer">' +
                       '<span class="grouped-food-card__time">' + formattedTime + '</span>' +
                       '<div class="grouped-food-card__actions">' +
                           '<button class="action-icon-btn" data-action="edit-food-pencil" aria-label="Edit">✏️</button>' +
                           '<button class="action-icon-btn" data-action="show-food-options" aria-label="Options">⋮</button>' +
                       '</div>' +
                   '</div>' +
               '</div>';
    }

    function _buildMealsTimeline(groups) {
        var meals = ['breakfast', 'lunch', 'dinner', 'snacks'];
        var hasEntries = false;

        var html = '<div class="meals-timeline">' +
                       '<h3 class="card__title" style="margin-bottom: 16px;">Today\'s Meals</h3>';

        meals.forEach(function (meal) {
            var items = groups[meal];
            if (!items.length) return;
            hasEntries = true;

            html += '<div class="timeline-group" style="margin-bottom: 24px;">' +
                        '<div class="timeline-group__header" style="display:flex; align-items:center; gap: 8px; margin-bottom: 12px; font-weight:700; color:var(--text-primary);">' +
                            '<span class="timeline-group__icon">' + _mealIcon(meal) + '</span>' +
                            '<span class="timeline-group__name">' + _capitalize(meal) + '</span>' +
                        '</div>';

            items.forEach(function (entry) {
                html += _buildGroupedFoodCard(entry);
            });

            html += '</div>';
        });

        if (!hasEntries) {
            html += '<div class="empty-state">' +
                        '<div class="empty-state__icon">🍽️</div>' +
                        '<p class="empty-state__text">No meals logged today.</p>' +
                        '<p class="empty-state__sub">Tap "+ Food" to get started!</p>' +
                    '</div>';
        }

        html += '</div>';
        return html;
    }

    function _buildExerciseSummary(exercises, burned) {
        var html = '<div class="card exercise-summary">' +
                       '<h3 class="card__title">Exercise Summary</h3>';

        if (!exercises.length) {
            html += '<div class="empty-state">' +
                        '<div class="empty-state__icon">🏃</div>' +
                        '<p class="empty-state__text">No exercises logged today.</p>' +
                    '</div>';
        } else {
            html += '<div class="exercise-summary__total">' +
                        '<span class="exercise-summary__burned">🔥 ' + Math.round(burned) + ' kcal burned</span>' +
                    '</div>' +
                    '<ul class="exercise-summary__list">';

            exercises.forEach(function (ex) {
                html += '<li class="exercise-summary__item">' +
                            '<span class="exercise-summary__name">' + (ex.name || 'Exercise') + '</span>' +
                            '<span class="exercise-summary__duration">' + (ex.duration || 0) + ' min</span>' +
                            '<span class="exercise-summary__cals">' + Math.round(ex.caloriesBurned || 0) + ' kcal</span>' +
                        '</li>';
            });

            html += '</ul>';
        }

        html += '</div>';
        return html;
    }

    function _buildMicroQuickView() {
        return '<div class="card micro-quick-view">' +
                   '<h3 class="card__title">Micro Nutrients Quick View</h3>' +
                   '<div id="dashboard-micro-bars" class="chart-container"></div>' +
               '</div>';
    }

    /* ───────── aggregate micronutrients ───────── */

    function _aggregateMicros(foodEntries) {
        var totals = {};
        var keyMap = {
            'A': 'Vitamin A', 'B6': 'Vitamin B6', 'B12': 'Vitamin B12',
            'C': 'Vitamin C', 'D': 'Vitamin D', 'E': 'Vitamin E', 'K': 'Vitamin K',
            'iron': 'Iron', 'calcium': 'Calcium', 'potassium': 'Potassium',
            'magnesium': 'Magnesium', 'zinc': 'Zinc', 'sodium': 'Sodium'
        };

        foodEntries.forEach(function (entry) {
            var vitamins = entry.vitamins || {};
            var minerals = entry.minerals || {};
            var all = Object.assign({}, vitamins, minerals);
            Object.keys(all).forEach(function (k) {
                var mappedKey = keyMap[k] || k;
                var val = parseFloat(all[k]) || 0;
                totals[mappedKey] = (totals[mappedKey] || 0) + val;
            });
        });
        return totals;
    }

    /* Daily values reference (simplified) - API returns % DV directly, so target is 100% */
    var DAILY_VALUES = {
        'Vitamin A': 100, 'Vitamin B6': 100, 'Vitamin B12': 100,
        'Vitamin C': 100, 'Vitamin D': 100, 'Vitamin E': 100, 'Vitamin K': 100,
        'Iron': 100, 'Calcium': 100, 'Potassium': 100,
        'Magnesium': 100, 'Zinc': 100, 'Sodium': 100
    };

    function _microBarsData(foodEntries) {
        var micros = _aggregateMicros(foodEntries);
        var items = [];
        var keys = Object.keys(DAILY_VALUES);

        /* pick top 6 that have data, else fill with zeros */
        var withData = keys.filter(function (k) { return (micros[k] || 0) > 0; });
        var chosen = withData.length >= 6 ? withData.slice(0, 6) : keys.slice(0, 6);

        chosen.forEach(function (k) {
            var val = micros[k] || 0;
            var dv = DAILY_VALUES[k] || 1;
            items.push({ label: k, value: Math.round((val / dv) * 100), maxValue: 100 });
        });

        return items;
    }

    /* ───────── event handling ───────── */

    function _handleClick(e) {
        // Handle calendar day click
        var dayItem = e.target.closest('.calendar-day-item');
        if (dayItem) {
            var dateStr = dayItem.getAttribute('data-date');
            NutriApp.setCurrentDate(dateStr);
            render();
            return;
        }

        var btn = e.target.closest('[data-action]');
        if (!btn) {
            // Date selector click opens Settings Modal (handy fallback)
            var dateSel = e.target.closest('#dashboard-date-selector-btn');
            if (dateSel) {
                NutriApp.openSettingsModal();
            }
            return;
        }

        var action = btn.getAttribute('data-action');
        if (action === 'add-food') {
            NutriApp.navigate('food');
        } else if (action === 'add-exercise') {
            NutriApp.navigate('exercise');
        } else if (action === 'dismiss-reminder') {
            reminderBannerDismissed = true;
            render();
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

        var today = NutriApp.getCurrentDate();
        var dateStr = NutriStorage.formatDate(today);
        var settings = NutriStorage.getUserSettings() || {};
        var goal = parseInt(settings.dailyCalorieGoal, 10) || 2000;

        var foodEntries = NutriStorage.getFoodLog(today) || [];
        var exerciseEntries = NutriStorage.getExerciseLog(today) || [];

        var totalCalories  = _totalOf(foodEntries, 'calories');
        var totalProtein   = _totalOf(foodEntries, 'protein');
        var totalCarbs     = _totalOf(foodEntries, 'carbs');
        var totalFat       = _totalOf(foodEntries, 'fat');
        var caloriesBurned = _totalOf(exerciseEntries, 'caloriesBurned');

        var groups = _groupByMeal(foodEntries);

        /* build HTML */
        container.innerHTML =
            _buildCalendarStrip(today) +
            _buildReminderBanner() +
            _buildSummaryRow(totalCalories, goal, caloriesBurned, totalProtein, totalCarbs, totalFat) +
            _buildQuickActions() +
            _buildMealsTimeline(groups) +
            _buildExerciseSummary(exerciseEntries, caloriesBurned) +
            _buildMicroQuickView();

        /* charts */
        try {
            NutriCharts.horizontalBars('dashboard-micro-bars', _microBarsData(foodEntries), {
                barHeight: 18,
                showValues: true,
                colorFn: function (v) {
                    if (v < 30) return '#dc2626';
                    if (v < 70) return '#ca8a04';
                    if (v > 150) return '#ffa34d';
                    return '#16a34a';
                }
            });
        } catch (_) { /* chart lib may not be ready */ }
    }

    return { init: init, render: render };

})();
