'use strict';

window.FoodLogPage = (function () {

    const PAGE_ID = 'page-food-log';
    let container = null;
    let activeTab = 'all';
    let analysisResult = null;
    let isAnalyzing = false;
    let showManualForm = false;
    let recentFoodsCache = [];

    /* ───────── helpers ───────── */

    function _totalOf(entries, key) {
        return entries.reduce(function (s, e) { return s + (parseFloat(e[key]) || 0); }, 0);
    }

    function _capitalize(s) {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    function _getRecentFoods() {
        var allDates = NutriStorage.getAllDatesWithData() || [];
        var seen = {};
        var recent = [];
        /* walk backwards through dates */
        for (var i = allDates.length - 1; i >= 0 && recent.length < 10; i--) {
            var entries = NutriStorage.getFoodLog(allDates[i]) || [];
            for (var j = entries.length - 1; j >= 0 && recent.length < 10; j--) {
                var name = (entries[j].name || '').toLowerCase();
                if (name && !seen[name]) {
                    seen[name] = true;
                    recent.push(entries[j]);
                }
            }
        }
        return recent;
    }

    /* ───────── HTML builders ───────── */

    function _buildHeader(dateStr) {
        return '<div class="page-header">' +
                   '<h1 class="page-title">Food Log</h1>' +
                   '<p class="page-subtitle">' + dateStr + '</p>' +
               '</div>';
    }

    function _buildAISearch() {
        var configured = typeof NutritionAI !== 'undefined' && NutritionAI.isConfigured();

        if (!configured) {
            return '<div class="card ai-search-section ai-search--unconfigured">' +
                       '<div class="empty-state">' +
                           '<div class="empty-state__icon">🔑</div>' +
                           '<p class="empty-state__text">AI Food Analysis requires a Gemini API key.</p>' +
                           '<p class="empty-state__sub">Go to Settings to add your API key.</p>' +
                           '<button class="btn btn-primary" data-action="go-settings">Open Settings</button>' +
                       '</div>' +
                   '</div>';
        }

        var html = '<div class="card ai-search-section">' +
                       '<h3 class="card__title"><span class="ai-sparkle">✨</span> AI Food Analysis</h3>' +
                       '<div class="ai-search__inputs">' +
                           '<input type="text" id="food-search-input" class="search-input" ' +
                               'placeholder="Describe your food... (e.g., 2 eggs with toast)" autocomplete="off">' +
                           '<div class="ai-search__row">' +
                               '<label class="ai-search__servings-label">Servings' +
                                   '<input type="number" id="food-servings-input" class="input-sm" value="1" min="0.25" step="0.25">' +
                               '</label>' +
                               '<button class="btn btn-primary" id="analyze-food-btn" data-action="analyze">' +
                                   '<span class="ai-sparkle">✨</span> Analyze' +
                               '</button>' +
                           '</div>' +
                       '</div>';

        if (isAnalyzing) {
            html += '<div class="ai-search__loading">' +
                        '<div class="skeleton skeleton--text"></div>' +
                        '<div class="skeleton skeleton--text skeleton--short"></div>' +
                        '<div class="skeleton skeleton--text skeleton--shorter"></div>' +
                    '</div>';
        }

        if (analysisResult && !isAnalyzing) {
            var r = analysisResult;
            html += '<div class="ai-result-card">' +
                        '<div class="ai-result__header">' +
                            '<h4 class="ai-result__name">' + (r.name || 'Food') + '</h4>' +
                            '<span class="ai-result__serving">' + (r.servingSize || '') + ' ' + (r.servingUnit || '') + '</span>' +
                        '</div>' +
                        '<div class="ai-result__macros">' +
                            '<div class="macro-badge macro-badge--cal">' + Math.round(r.calories || 0) + ' kcal</div>' +
                            '<div class="macro-badge macro-badge--protein">P: ' + Math.round(r.protein || 0) + 'g</div>' +
                            '<div class="macro-badge macro-badge--carbs">C: ' + Math.round(r.carbs || 0) + 'g</div>' +
                            '<div class="macro-badge macro-badge--fat">F: ' + Math.round(r.fat || 0) + 'g</div>' +
                        '</div>' +
                        '<div class="ai-result__extras">' +
                            (r.fiber ? '<span>Fiber: ' + Math.round(r.fiber) + 'g</span>' : '') +
                            (r.sugar ? '<span>Sugar: ' + Math.round(r.sugar) + 'g</span>' : '') +
                        '</div>' +
                        '<div class="ai-result__actions">' +
                            '<select id="ai-meal-select" class="select-sm">' +
                                '<option value="breakfast">Breakfast</option>' +
                                '<option value="lunch">Lunch</option>' +
                                '<option value="dinner">Dinner</option>' +
                                '<option value="snacks">Snacks</option>' +
                            '</select>' +
                            '<button class="btn btn-primary" data-action="add-ai-result">Add to Log</button>' +
                        '</div>' +
                    '</div>';
        }

        html += '</div>';
        return html;
    }

    function _buildMealTabs() {
        var tabs = ['all', 'breakfast', 'lunch', 'dinner', 'snacks'];
        var html = '<div class="meal-tabs">';
        tabs.forEach(function (tab) {
            var cls = 'chip' + (activeTab === tab ? ' chip--active' : '');
            html += '<button class="' + cls + '" data-tab="' + tab + '">' + _capitalize(tab) + '</button>';
        });
        html += '</div>';
        return html;
    }

    function _pct(value, goal) {
        if (!goal) return 0;
        return Math.min(Math.round((value / goal) * 100), 100);
    }

    function _buildGroupedFoodCard(entry) {
        var formattedTime = 'Logged';
        if (entry.timestamp || entry.loggedAt) {
            var dateObj = new Date(entry.timestamp || entry.loggedAt);
            var hours = dateObj.getHours();
            var minutes = dateObj.getMinutes();
            var ampm = hours >= 12 ? 'pm' : 'am';
            hours = hours % 12;
            hours = hours ? hours : 12;
            minutes = minutes < 10 ? '0' + minutes : minutes;
            formattedTime = hours + ':' + minutes + ' ' + ampm;
        }

        var subItemsHtml = '';
        var subItems = entry.subItems || [];
        
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

    function _buildFoodEntries(entries) {
        var filtered = activeTab === 'all'
            ? entries
            : entries.filter(function (e) { return (e.meal || 'snacks').toLowerCase() === activeTab; });

        if (!filtered.length) {
            return '<div class="food-entries-list">' +
                       '<div class="empty-state">' +
                           '<div class="empty-state__icon">📋</div>' +
                           '<p class="empty-state__text">No food entries' + (activeTab !== 'all' ? ' for ' + _capitalize(activeTab) : '') + '.</p>' +
                       '</div>' +
                   '</div>';
        }

        var html = '<div class="food-entries-list">';
        filtered.forEach(function (entry) {
            html += _buildGroupedFoodCard(entry);
        });
        html += '</div>';
        return html;
    }

    function _buildManualEntryToggle() {
        var html = '<button class="btn btn-secondary manual-entry-toggle" data-action="toggle-manual">' +
                       (showManualForm ? '✕ Close Manual Entry' : '✏️ Manual Entry') +
                   '</button>';

        if (showManualForm) {
            html += '<div class="card manual-entry-form">' +
                        '<h3 class="card__title">Add Food Manually</h3>' +
                        '<form id="manual-food-form">' +
                            '<div class="form-group">' +
                                '<label>Food Name *</label>' +
                                '<input type="text" name="name" class="input" required placeholder="e.g., Chicken Breast">' +
                            '</div>' +
                            '<div class="form-row">' +
                                '<div class="form-group"><label>Calories *</label><input type="number" name="calories" class="input" required min="0"></div>' +
                                '<div class="form-group"><label>Protein (g)</label><input type="number" name="protein" class="input" min="0" step="0.1"></div>' +
                            '</div>' +
                            '<div class="form-row">' +
                                '<div class="form-group"><label>Carbs (g)</label><input type="number" name="carbs" class="input" min="0" step="0.1"></div>' +
                                '<div class="form-group"><label>Fat (g)</label><input type="number" name="fat" class="input" min="0" step="0.1"></div>' +
                            '</div>' +
                            '<div class="form-row">' +
                                '<div class="form-group"><label>Fiber (g)</label><input type="number" name="fiber" class="input" min="0" step="0.1"></div>' +
                                '<div class="form-group"><label>Sugar (g)</label><input type="number" name="sugar" class="input" min="0" step="0.1"></div>' +
                            '</div>' +
                            '<div class="form-row">' +
                                '<div class="form-group"><label>Serving Size</label><input type="number" name="servingSize" class="input" min="0" step="0.1"></div>' +
                                '<div class="form-group"><label>Serving Unit</label><input type="text" name="servingUnit" class="input" placeholder="g, oz, cup..."></div>' +
                            '</div>' +
                            '<div class="form-group">' +
                                '<label>Meal</label>' +
                                '<select name="meal" class="input">' +
                                    '<option value="breakfast">Breakfast</option>' +
                                    '<option value="lunch">Lunch</option>' +
                                    '<option value="dinner">Dinner</option>' +
                                    '<option value="snacks">Snacks</option>' +
                                '</select>' +
                            '</div>' +
                            '<button type="submit" class="btn btn-primary btn-block">Add to Log</button>' +
                        '</form>' +
                    '</div>';
        }
        return html;
    }

    function _buildRecentFoods(recent) {
        if (!recent.length) return '';

        var html = '<div class="card recent-foods">' +
                       '<h3 class="card__title">Recent Foods</h3>' +
                       '<div class="recent-foods__list">';

        recent.forEach(function (item, idx) {
            html += '<button class="recent-food-chip" data-action="relog" data-index="' + idx + '">' +
                        '<span class="recent-food-chip__name">' + (item.name || 'Food') + '</span>' +
                        '<span class="recent-food-chip__cals">' + Math.round(item.calories || 0) + ' kcal</span>' +
                    '</button>';
        });

        html += '</div></div>';
        return html;
    }

    /* ───────── actions ───────── */

    function _doAnalyze() {
        var input = document.getElementById('food-search-input');
        var servingsInput = document.getElementById('food-servings-input');
        if (!input) return;
        var desc = input.value.trim();
        if (!desc) {
            NutriApp.showToast('Please describe a food item.', 'warning');
            return;
        }
        var servings = parseFloat(servingsInput ? servingsInput.value : 1) || 1;

        isAnalyzing = true;
        analysisResult = null;
        render();

        NutritionAI.analyze(desc, servings).then(function (result) {
            analysisResult = result;
            isAnalyzing = false;
            render();
        }).catch(function (err) {
            isAnalyzing = false;
            NutriApp.showToast('Analysis failed: ' + (err.message || err), 'error');
            render();
        });
    }

    function _addAIResult() {
        if (!analysisResult) return;
        var mealSelect = document.getElementById('ai-meal-select');
        var meal = mealSelect ? mealSelect.value : 'snacks';
        var today = NutriApp.getCurrentDate();

        var entry = Object.assign({}, analysisResult, {
            id: NutriStorage.generateId(),
            meal: meal,
            loggedAt: new Date().toISOString()
        });

        NutriStorage.addFoodEntry(today, entry);
        NutriApp.showToast(entry.name + ' added! +' + Math.round(entry.calories) + ' kcal', 'success');
        analysisResult = null;
        render();
    }

    function _deleteEntry(id) {
        var today = NutriApp.getCurrentDate();
        NutriStorage.removeFoodEntry(today, id);
        NutriApp.showToast('Entry removed.', 'info');
        render();
    }

    function _submitManualForm(form) {
        var data = new FormData(form);
        var entry = {
            id: NutriStorage.generateId(),
            name: data.get('name'),
            calories: parseFloat(data.get('calories')) || 0,
            protein: parseFloat(data.get('protein')) || 0,
            carbs: parseFloat(data.get('carbs')) || 0,
            fat: parseFloat(data.get('fat')) || 0,
            fiber: parseFloat(data.get('fiber')) || 0,
            sugar: parseFloat(data.get('sugar')) || 0,
            servingSize: parseFloat(data.get('servingSize')) || 0,
            servingUnit: data.get('servingUnit') || '',
            meal: data.get('meal') || 'snacks',
            loggedAt: new Date().toISOString()
        };
        var today = NutriApp.getCurrentDate();
        NutriStorage.addFoodEntry(today, entry);
        NutriApp.showToast(entry.name + ' added! +' + Math.round(entry.calories) + ' kcal', 'success');
        showManualForm = false;
        render();
    }

    function _relogFood(index) {
        var item = recentFoodsCache[index];
        if (!item) return;
        var today = NutriApp.getCurrentDate();
        var entry = Object.assign({}, item, {
            id: NutriStorage.generateId(),
            loggedAt: new Date().toISOString()
        });
        NutriStorage.addFoodEntry(today, entry);
        NutriApp.showToast(entry.name + ' re-logged! +' + Math.round(entry.calories) + ' kcal', 'success');
        render();
    }

    /* ───────── event handling ───────── */

    function _handleClick(e) {
        /* tabs */
        var tab = e.target.closest('[data-tab]');
        if (tab) {
            activeTab = tab.getAttribute('data-tab');
            render();
            return;
        }

        var btn = e.target.closest('[data-action]');
        if (!btn) return;

        var action = btn.getAttribute('data-action');
        switch (action) {
            case 'analyze':        _doAnalyze(); break;
            case 'add-ai-result':  _addAIResult(); break;
            case 'toggle-manual':  showManualForm = !showManualForm; render(); break;
            case 'go-settings':    NutriApp.showPage('page-settings'); break;
            case 'relog':          _relogFood(parseInt(btn.getAttribute('data-index'), 10)); break;
            case 'delete-entry':   _deleteEntry(btn.getAttribute('data-id')); break;
        }
    }

    function _handleSubmit(e) {
        if (e.target.id === 'manual-food-form') {
            e.preventDefault();
            _submitManualForm(e.target);
        }
    }

    function _handleKeydown(e) {
        if (e.key === 'Enter' && e.target.id === 'food-search-input') {
            e.preventDefault();
            _doAnalyze();
        }
    }

    /* ───────── public ───────── */

    function init() {
        container = document.getElementById(PAGE_ID);
        if (container) {
            container.addEventListener('click', _handleClick);
            container.addEventListener('submit', _handleSubmit);
            container.addEventListener('keydown', _handleKeydown);
        }
    }

    function render() {
        if (!container) container = document.getElementById(PAGE_ID);
        if (!container) return;

        var today = NutriApp.getCurrentDate();
        var dateStr = NutriStorage.formatDate(today);
        var foodEntries = NutriStorage.getFoodLog(today) || [];
        recentFoodsCache = _getRecentFoods();

        container.innerHTML =
            _buildHeader(dateStr) +
            _buildAISearch() +
            _buildMealTabs() +
            _buildFoodEntries(foodEntries) +
            _buildManualEntryToggle() +
            _buildRecentFoods(recentFoodsCache);
    }

    return { init: init, render: render };

})();
