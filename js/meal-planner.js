'use strict';

window.MealPlannerPage = (function () {

    const PAGE_ID = 'page-meals';
    let container = null;
    let editingMeal = null;            /* null | { id?, name, category, items[] } */
    let showMealForm = false;
    let showAiGenerator = false;
    let quickLogMealId = null;         /* id of meal being quick-logged */
    let activeCategoryFilter = 'all';  /* 'all' | 'breakfast' | 'lunch' | 'dinner' | 'snacks' | 'workout' */
    let searchQuery = '';
    let isAiGenerating = false;
    let isAiAddingItem = false;
    let activeItemMode = 'manual';     /* 'manual' | 'ai' */

    /* ───────── Preset Templates ───────── */
    const PRESET_TEMPLATES = [
        {
            name: 'High-Protein Breakfast Bowl',
            category: 'breakfast',
            icon: '🍳',
            tagline: 'Energizing morning meal with complete proteins',
            items: [
                { id: 'p1_1', name: 'Scrambled Eggs (3 large)', calories: 215, protein: 18, carbs: 1.5, fat: 15 },
                { id: 'p1_2', name: 'Whole Wheat Toast (2 slices)', calories: 160, protein: 8, carbs: 28, fat: 2 },
                { id: 'p1_3', name: 'Oatmeal (40g) with Blueberries', calories: 165, protein: 5, carbs: 32, fat: 2.5 }
            ]
        },
        {
            name: 'Mediterranean Grilled Chicken & Quinoa',
            category: 'lunch',
            icon: '🥗',
            tagline: 'Clean lean protein with complex carbohydrates',
            items: [
                { id: 'p2_1', name: 'Grilled Chicken Breast (180g)', calories: 295, protein: 54, carbs: 0, fat: 6.5 },
                { id: 'p2_2', name: 'Cooked Quinoa (1 cup)', calories: 222, protein: 8, carbs: 39, fat: 3.5 },
                { id: 'p2_3', name: 'Mixed Greens & Olive Oil (1 tbsp)', calories: 135, protein: 1, carbs: 3, fat: 14 }
            ]
        },
        {
            name: 'Keto Salmon & Avocado Plate',
            category: 'dinner',
            icon: '🥑',
            tagline: 'Rich in Omega-3s and healthy fats',
            items: [
                { id: 'p3_1', name: 'Baked Salmon Fillet (200g)', calories: 415, protein: 40, carbs: 0, fat: 26 },
                { id: 'p3_2', name: 'Fresh Avocado (1/2 fruit)', calories: 160, protein: 2, carbs: 8.5, fat: 15 },
                { id: 'p3_3', name: 'Steamed Asparagus with Butter', calories: 75, protein: 3, carbs: 4, fat: 6 }
            ]
        },
        {
            name: 'Post-Workout Anabolic Shake',
            category: 'workout',
            icon: '⚡',
            tagline: 'Rapid post-exercise recovery fuel',
            items: [
                { id: 'p4_1', name: 'Whey Protein Isolate (1 scoop)', calories: 130, protein: 27, carbs: 2, fat: 1.5 },
                { id: 'p4_2', name: 'Ripe Banana (1 medium)', calories: 105, protein: 1.3, carbs: 27, fat: 0.3 },
                { id: 'p4_3', name: 'Natural Peanut Butter (1.5 tbsp)', calories: 140, protein: 6, carbs: 5, fat: 12 },
                { id: 'p4_4', name: 'Unsweetened Almond Milk (300ml)', calories: 40, protein: 1.5, carbs: 1.5, fat: 3 }
            ]
        },
        {
            name: 'Lean Roast Turkey & Hummus Wrap',
            category: 'lunch',
            icon: '🥪',
            tagline: 'Portable high-protein balanced lunch',
            items: [
                { id: 'p5_1', name: 'Whole Wheat Tortilla Wrap (1 large)', calories: 180, protein: 6, carbs: 32, fat: 3.5 },
                { id: 'p5_2', name: 'Sliced Roast Turkey (120g)', calories: 135, protein: 28, carbs: 1, fat: 2 },
                { id: 'p5_3', name: 'Classic Hummus (2 tbsp)', calories: 70, protein: 2.5, carbs: 5, fat: 5 },
                { id: 'p5_4', name: 'Baby Spinach & Sliced Tomatoes', calories: 25, protein: 1.5, carbs: 4, fat: 0.2 }
            ]
        },
        {
            name: 'Overnight Chia & Berry Parfait',
            category: 'breakfast',
            icon: '🥣',
            tagline: 'Gut-friendly probiotics & antioxidant rich',
            items: [
                { id: 'p6_1', name: 'Greek Yogurt Nonfat (200g)', calories: 130, protein: 20, carbs: 7, fat: 0 },
                { id: 'p6_2', name: 'Chia Seeds (1 tbsp)', calories: 60, protein: 2.5, carbs: 5, fat: 4 },
                { id: 'p6_3', name: 'Fresh Mixed Berries (1/2 cup)', calories: 45, protein: 0.7, carbs: 11, fat: 0.3 },
                { id: 'p6_4', name: 'Raw Honey (1 tbsp)', calories: 64, protein: 0.1, carbs: 17, fat: 0 },
                { id: 'p6_5', name: 'Sliced Almonds (10g)', calories: 58, protein: 2.1, carbs: 2.1, fat: 5 }
            ]
        }
    ];

    /* ───────── helpers ───────── */

    function _totalOf(items, key) {
        return (items || []).reduce(function (s, e) { return s + (parseFloat(e[key]) || 0); }, 0);
    }

    function _capitalize(s) {
        if (!s) return '';
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    function _getCategoryIcon(cat) {
        switch ((cat || '').toLowerCase()) {
            case 'breakfast': return '🍳';
            case 'lunch': return '🥗';
            case 'dinner': return '🍲';
            case 'snacks': return '🍎';
            case 'workout': return '⚡';
            default: return '🍱';
        }
    }

    /* ───────── HTML builders ───────── */

    function _buildHeader(mealsCount) {
        return '<div class="meal-planner-hero">' +
                   '<div class="meal-planner-hero__content">' +
                       '<div class="meal-planner-badge">' +
                           '<span>🍱</span> Meal Planner & Combos' +
                       '</div>' +
                       '<h1 class="meal-planner-title">Plan, Save & Quick Log</h1>' +
                       '<p class="meal-planner-subtitle">Create reusable meal templates and log complete nutrient combinations with a single tap.</p>' +
                   '</div>' +
                   '<div class="meal-planner-hero__actions">' +
                       '<button class="btn btn-primary btn-glow" data-action="open-create">' +
                           '<span class="btn-icon">＋</span> Create Meal' +
                       '</button>' +
                       '<button class="btn btn-secondary ' + (showAiGenerator ? 'btn--active' : '') + '" data-action="toggle-ai-gen">' +
                           '<span>✨</span> AI Assistant' +
                       '</button>' +
                   '</div>' +
               '</div>';
    }

    function _buildAiGenerator() {
        if (!showAiGenerator) return '';

        var isConfigured = typeof NutritionAI !== 'undefined' && NutritionAI.isConfigured();

        return '<div class="card meal-ai-card animate-scale-in">' +
                   '<div class="meal-ai-card__header">' +
                       '<div class="meal-ai-card__title-wrap">' +
                           '<span class="meal-ai-card__icon">✨</span>' +
                           '<div>' +
                               '<h3 class="meal-ai-card__title">AI Meal Generator</h3>' +
                               '<p class="meal-ai-card__sub">Describe the meal you want and Gemini AI will construct ingredients, portions, and exact macros.</p>' +
                           '</div>' +
                       '</div>' +
                       '<button class="btn-icon-sm btn-ghost" data-action="toggle-ai-gen" title="Close">✕</button>' +
                   '</div>' +
                   (!isConfigured ?
                       '<div class="meal-ai-unconfigured">' +
                           '<p>🔑 Gemini API key required for AI Meal Generation.</p>' +
                           '<button class="btn btn-secondary btn-sm" data-action="go-settings">Configure in Settings</button>' +
                       '</div>' :
                       '<div class="meal-ai-input-wrap">' +
                           '<input type="text" id="ai-meal-prompt" class="input-field" ' +
                               'placeholder="e.g. 500 kcal high-protein breakfast with oats and eggs..." ' +
                               'value="" autocomplete="off">' +
                           '<button class="btn btn-primary" data-action="run-ai-gen" ' + (isAiGenerating ? 'disabled' : '') + '>' +
                               (isAiGenerating ? '<span class="spinner-sm"></span> Generating...' : '<span>⚡</span> Generate') +
                           '</button>' +
                       '</div>' +
                       '<div class="meal-ai-chips">' +
                           '<span class="meal-ai-chips__label">Try:</span>' +
                           '<button class="chip-sm" data-action="preset-ai-prompt" data-prompt="High-protein post workout smoothie around 400 calories">💪 Post-Workout Shake</button>' +
                           '<button class="chip-sm" data-action="preset-ai-prompt" data-prompt="Low-carb keto dinner with salmon and veggies 550 kcal">🥑 Keto Salmon Plate</button>' +
                           '<button class="chip-sm" data-action="preset-ai-prompt" data-prompt="Balanced Mediterranean chicken lunch wrap 450 kcal">🥗 Mediterranean Wrap</button>' +
                       '</div>'
                   ) +
               '</div>';
    }

    function _buildMealForm() {
        if (!showMealForm) return '';

        var meal = editingMeal || { name: '', category: 'lunch', items: [] };
        var totalCal = _totalOf(meal.items, 'calories');
        var totalP   = _totalOf(meal.items, 'protein');
        var totalC   = _totalOf(meal.items, 'carbs');
        var totalF   = _totalOf(meal.items, 'fat');

        /* macro ratios */
        var calFromP = totalP * 4;
        var calFromC = totalC * 4;
        var calFromF = totalF * 9;
        var totalMacroCal = calFromP + calFromC + calFromF;
        var pctP = totalMacroCal > 0 ? Math.round((calFromP / totalMacroCal) * 100) : 0;
        var pctC = totalMacroCal > 0 ? Math.round((calFromC / totalMacroCal) * 100) : 0;
        var pctF = totalMacroCal > 0 ? Math.round((calFromF / totalMacroCal) * 100) : 0;

        var selectedCat = (meal.category || 'lunch').toLowerCase();
        var categories = [
            { key: 'breakfast', label: 'Breakfast', icon: '🍳' },
            { key: 'lunch', label: 'Lunch', icon: '🥗' },
            { key: 'dinner', label: 'Dinner', icon: '🍲' },
            { key: 'snacks', label: 'Snacks', icon: '🍎' },
            { key: 'workout', label: 'Workout', icon: '⚡' }
        ];

        var html = '<div class="card meal-form-card animate-scale-in">' +
                       '<div class="meal-form-card__header">' +
                           '<div class="meal-form-card__title-wrap">' +
                               '<span class="meal-form-card__icon">' + (meal.id ? '✏️' : '🍱') + '</span>' +
                               '<div>' +
                                   '<h3 class="meal-form-card__title">' + (meal.id ? 'Edit Meal Template' : 'Create Meal Template') + '</h3>' +
                                   '<p class="meal-form-card__sub">Group foods together into a reusable meal combo</p>' +
                               '</div>' +
                           '</div>' +
                           '<button class="btn-icon-sm btn-ghost" data-action="close-form" title="Close">✕</button>' +
                       '</div>' +

                       /* Meal Name & Category */
                       '<div class="meal-form__section">' +
                           '<div class="input-group">' +
                               '<label class="input-label">Meal Name *</label>' +
                               '<input type="text" id="meal-name-input" class="input-field" placeholder="e.g. Morning Power Oatmeal Bowl" value="' + (meal.name || '') + '">' +
                           '</div>' +
                           '<div class="input-group">' +
                               '<label class="input-label">Category</label>' +
                               '<div class="meal-category-chips-select">';

        categories.forEach(function(c) {
            var active = (selectedCat === c.key) ? 'active' : '';
            html += '<button type="button" class="meal-cat-pill ' + active + '" data-action="select-form-cat" data-category="' + c.key + '">' +
                        '<span>' + c.icon + '</span> ' + c.label +
                    '</button>';
        });

        html += '</div></div></div>' +

                /* Add Food Items Section */
                '<div class="meal-form__add-section">' +
                    '<div class="meal-form__add-tabs">' +
                        '<button type="button" class="meal-tab-btn ' + (activeItemMode === 'manual' ? 'active' : '') + '" data-action="set-item-mode" data-mode="manual">✍️ Manual Entry</button>' +
                        '<button type="button" class="meal-tab-btn ' + (activeItemMode === 'ai' ? 'active' : '') + '" data-action="set-item-mode" data-mode="ai">✨ AI Quick Add</button>' +
                    '</div>';

        if (activeItemMode === 'ai') {
            html += '<div class="meal-form__ai-box">' +
                        '<p class="meal-form__ai-hint">Type any food description (e.g. "2 boiled eggs and 1 slice toast") and AI will calculate the nutrients automatically:</p>' +
                        '<div class="meal-ai-input-wrap">' +
                            '<input type="text" id="meal-item-ai-desc" class="input-field" placeholder="e.g. 150g grilled chicken breast with 1 cup rice" autocomplete="off">' +
                            '<button class="btn btn-primary" data-action="ai-add-item" ' + (isAiAddingItem ? 'disabled' : '') + '>' +
                                (isAiAddingItem ? '<span class="spinner-sm"></span> Analyzing...' : '＋ Add') +
                            '</button>' +
                        '</div>' +
                    '</div>';
        } else {
            html += '<div class="meal-form__manual-box">' +
                        '<div class="input-group" style="margin-bottom: 10px;">' +
                            '<label class="input-label">Food Item Name *</label>' +
                            '<input type="text" id="meal-item-name" class="input-field" placeholder="e.g. Scrambled Eggs (2 whole)">' +
                        '</div>' +
                        '<div class="meal-form__macro-inputs">' +
                            '<div class="macro-input-col">' +
                                '<label class="input-label">Calories</label>' +
                                '<div class="macro-input-wrap">' +
                                    '<input type="number" id="meal-item-cal" class="input-field input-field--sm" placeholder="0" min="0">' +
                                    '<span class="macro-unit">kcal</span>' +
                                '</div>' +
                            '</div>' +
                            '<div class="macro-input-col">' +
                                '<label class="input-label">Protein</label>' +
                                '<div class="macro-input-wrap">' +
                                    '<input type="number" id="meal-item-protein" class="input-field input-field--sm" placeholder="0" min="0" step="0.1">' +
                                    '<span class="macro-unit">g</span>' +
                                '</div>' +
                            '</div>' +
                            '<div class="macro-input-col">' +
                                '<label class="input-label">Carbs</label>' +
                                '<div class="macro-input-wrap">' +
                                    '<input type="number" id="meal-item-carbs" class="input-field input-field--sm" placeholder="0" min="0" step="0.1">' +
                                    '<span class="macro-unit">g</span>' +
                                '</div>' +
                            '</div>' +
                            '<div class="macro-input-col">' +
                                '<label class="input-label">Fat</label>' +
                                '<div class="macro-input-wrap">' +
                                    '<input type="number" id="meal-item-fat" class="input-field input-field--sm" placeholder="0" min="0" step="0.1">' +
                                    '<span class="macro-unit">g</span>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                        '<button class="btn btn-secondary btn-block" style="margin-top: 10px;" data-action="add-meal-item">＋ Add Food Item to Meal</button>' +
                    '</div>';
        }

        html += '</div>'; /* end meal-form__add-section */

        /* Added Items List */
        html += '<div class="meal-form__items-container">' +
                    '<div class="meal-form__items-header">' +
                        '<h4 class="meal-form__section-title">Ingredients (' + (meal.items ? meal.items.length : 0) + ')</h4>' +
                    '</div>';

        if (!meal.items || meal.items.length === 0) {
            html += '<div class="meal-form__empty-items">' +
                        '<span>🍽️</span>' +
                        '<p>No food items added yet. Use the inputs above to build your meal.</p>' +
                    '</div>';
        } else {
            html += '<div class="meal-form__items-list">';
            meal.items.forEach(function (item, idx) {
                html += '<div class="meal-form__item-card">' +
                            '<div class="meal-form__item-info">' +
                                '<div class="meal-form__item-name">' + (item.name || 'Item') + '</div>' +
                                '<div class="meal-form__item-macros">' +
                                    '<span class="macro-badge macro-badge--cal">' + Math.round(item.calories || 0) + ' kcal</span>' +
                                    '<span class="macro-badge macro-badge--protein">P: ' + Math.round(item.protein || 0) + 'g</span>' +
                                    '<span class="macro-badge macro-badge--carbs">C: ' + Math.round(item.carbs || 0) + 'g</span>' +
                                    '<span class="macro-badge macro-badge--fat">F: ' + Math.round(item.fat || 0) + 'g</span>' +
                                '</div>' +
                            '</div>' +
                            '<button class="btn-icon-sm btn-danger-ghost" data-action="remove-meal-item" data-index="' + idx + '" title="Remove item">✕</button>' +
                        '</div>';
            });
            html += '</div>';
        }
        html += '</div>';

        /* Live Nutrition Totals Summary Card */
        if (meal.items && meal.items.length > 0) {
            html += '<div class="meal-form__totals-card">' +
                        '<div class="meal-totals__header">' +
                            '<div class="meal-totals__energy">' +
                                '<span class="meal-totals__energy-icon">🔥</span>' +
                                '<div>' +
                                    '<div class="meal-totals__cal-value">' + Math.round(totalCal) + ' <span class="meal-totals__cal-unit">kcal</span></div>' +
                                    '<div class="meal-totals__cal-sub">Total Meal Energy</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="meal-totals__macros-grid">' +
                            '<div class="meal-macro-box meal-macro-box--protein">' +
                                '<div class="meal-macro-box__label">Protein</div>' +
                                '<div class="meal-macro-box__val">' + Math.round(totalP) + 'g</div>' +
                                '<div class="meal-macro-box__pct">' + pctP + '% cals</div>' +
                            '</div>' +
                            '<div class="meal-macro-box meal-macro-box--carbs">' +
                                '<div class="meal-macro-box__label">Carbs</div>' +
                                '<div class="meal-macro-box__val">' + Math.round(totalC) + 'g</div>' +
                                '<div class="meal-macro-box__pct">' + pctC + '% cals</div>' +
                            '</div>' +
                            '<div class="meal-macro-box meal-macro-box--fat">' +
                                '<div class="meal-macro-box__label">Fat</div>' +
                                '<div class="meal-macro-box__val">' + Math.round(totalF) + 'g</div>' +
                                '<div class="meal-macro-box__pct">' + pctF + '% cals</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="meal-ratio-bar">' +
                            '<div class="meal-ratio-bar__seg meal-ratio-bar__seg--p" style="width: ' + pctP + '%;" title="Protein: ' + pctP + '%"></div>' +
                            '<div class="meal-ratio-bar__seg meal-ratio-bar__seg--c" style="width: ' + pctC + '%;" title="Carbs: ' + pctC + '%"></div>' +
                            '<div class="meal-ratio-bar__seg meal-ratio-bar__seg--f" style="width: ' + pctF + '%;" title="Fat: ' + pctF + '%"></div>' +
                        '</div>' +
                    '</div>';
        }

        /* Form Footer Buttons */
        html += '<div class="meal-form__footer">' +
                    '<button class="btn btn-secondary" data-action="close-form">Cancel</button>' +
                    '<button class="btn btn-primary btn-glow" data-action="save-meal">' +
                        '💾 ' + (meal.id ? 'Update Meal Template' : 'Save Meal Template') +
                    '</button>' +
                '</div>' +
                '</div>'; /* end card */

        return html;
    }

    function _buildFilterBar(allMeals) {
        var counts = {
            all: allMeals.length,
            breakfast: 0,
            lunch: 0,
            dinner: 0,
            snacks: 0,
            workout: 0
        };

        allMeals.forEach(function(m) {
            var c = (m.category || 'other').toLowerCase();
            if (counts[c] !== undefined) counts[c]++;
            else counts.snacks++;
        });

        var filters = [
            { key: 'all', label: 'All Meals', icon: '🍱' },
            { key: 'breakfast', label: 'Breakfast', icon: '🍳' },
            { key: 'lunch', label: 'Lunch', icon: '🥗' },
            { key: 'dinner', label: 'Dinner', icon: '🍲' },
            { key: 'snacks', label: 'Snacks', icon: '🍎' },
            { key: 'workout', label: 'Workout', icon: '⚡' }
        ];

        var html = '<div class="meal-filter-wrapper">' +
                       '<div class="search-input-wrapper meal-search-wrap">' +
                           '<span class="search-icon">🔍</span>' +
                           '<input type="text" id="meal-search-input" class="input-field" ' +
                               'placeholder="Search saved meals by name or food..." ' +
                               'value="' + searchQuery + '" autocomplete="off">' +
                           (searchQuery ? '<button class="search-clear-btn" data-action="clear-search">✕</button>' : '') +
                       '</div>' +
                       '<div class="meal-category-filter-chips">';

        filters.forEach(function(f) {
            var active = (activeCategoryFilter === f.key) ? 'active' : '';
            var count = counts[f.key] || 0;
            html += '<button class="meal-filter-chip ' + active + '" data-action="set-filter" data-filter="' + f.key + '">' +
                        '<span class="meal-filter-chip__icon">' + f.icon + '</span> ' +
                        '<span class="meal-filter-chip__label">' + f.label + '</span>' +
                        '<span class="meal-filter-chip__count">' + count + '</span>' +
                    '</button>';
        });

        html += '</div></div>';
        return html;
    }

    function _buildSavedMealsGrid(filteredMeals, allMeals) {
        if (!allMeals.length && !showMealForm) {
            return '<div class="card meal-empty-hero">' +
                       '<div class="empty-state">' +
                           '<div class="empty-state__icon" style="font-size: 3.5rem;">🍱</div>' +
                           '<h3 class="empty-state__title" style="margin-top: 12px; font-weight: 700;">No Custom Meals Saved Yet</h3>' +
                           '<p class="empty-state__sub" style="max-width: 420px; margin: 8px auto 20px;">' +
                               'Create your own custom meal templates or pick from our curated starter presets below to log full meals with a single tap.' +
                           '</p>' +
                           '<div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">' +
                               '<button class="btn btn-primary btn-glow" data-action="open-create">' +
                                   '＋ Create Custom Meal' +
                               '</button>' +
                               '<button class="btn btn-secondary" data-action="toggle-ai-gen">' +
                                   '✨ Generate with AI' +
                               '</button>' +
                           '</div>' +
                       '</div>' +
                   '</div>';
        }

        if (!filteredMeals.length && allMeals.length > 0) {
            return '<div class="card meal-empty-filter">' +
                       '<div class="empty-state">' +
                           '<div class="empty-state__icon">🔍</div>' +
                           '<p class="empty-state__text">No meals found for "' + (searchQuery || activeCategoryFilter) + '"</p>' +
                           '<button class="btn btn-secondary btn-sm" data-action="reset-filters">Reset Filters</button>' +
                       '</div>' +
                   '</div>';
        }

        var html = '<div class="meal-section-header-bar">' +
                       '<h3 class="section-title">My Saved Meals (' + filteredMeals.length + ')</h3>' +
                   '</div>' +
                   '<div class="meals-grid">';

        filteredMeals.forEach(function (meal) {
            var totalCal = _totalOf(meal.items || [], 'calories');
            var totalP   = _totalOf(meal.items || [], 'protein');
            var totalC   = _totalOf(meal.items || [], 'carbs');
            var totalF   = _totalOf(meal.items || [], 'fat');
            var cat = (meal.category || 'other').toLowerCase();
            var catIcon = _getCategoryIcon(cat);

            html += '<div class="meal-card" data-meal-id="' + meal.id + '">' +
                        '<div class="meal-card__top">' +
                            '<span class="meal-cat-badge meal-cat-badge--' + cat + '">' +
                                catIcon + ' ' + _capitalize(cat) +
                            '</span>' +
                            '<span class="meal-card__items-count">📦 ' + (meal.items || []).length + ' items</span>' +
                        '</div>' +

                        '<div class="meal-card__main">' +
                            '<h4 class="meal-card__title">' + (meal.name || 'Meal Combo') + '</h4>' +
                            '<div class="meal-card__macros">' +
                                '<span class="macro-badge macro-badge--cal">' + Math.round(totalCal) + ' kcal</span>' +
                                '<span class="macro-badge macro-badge--protein">P: ' + Math.round(totalP) + 'g</span>' +
                                '<span class="macro-badge macro-badge--carbs">C: ' + Math.round(totalC) + 'g</span>' +
                                '<span class="macro-badge macro-badge--fat">F: ' + Math.round(totalF) + 'g</span>' +
                            '</div>' +
                        '</div>';

            /* Items list preview tags */
            if (meal.items && meal.items.length > 0) {
                html += '<div class="meal-card__items-preview">';
                meal.items.forEach(function(it) {
                    html += '<span class="meal-item-chip" title="' + Math.round(it.calories || 0) + ' kcal">' +
                                (it.name || 'Item') + ' <small>(' + Math.round(it.calories || 0) + ')</small>' +
                            '</span>';
                });
                html += '</div>';
            }

            /* Quick log popup panel */
            if (quickLogMealId === meal.id) {
                html += '<div class="meal-card__quicklog-panel animate-scale-in">' +
                            '<div class="quicklog-panel__title">⚡ Quick Log to Diary</div>' +
                            '<div class="quicklog-panel__controls">' +
                                '<div class="input-group" style="margin-bottom:0; flex:1;">' +
                                    '<label class="input-label" style="font-size:0.75rem;">Meal Slot</label>' +
                                    '<select id="quicklog-slot-select-' + meal.id + '" class="input-field select-field input-field--sm">' +
                                        '<option value="breakfast" ' + (cat === 'breakfast' ? 'selected' : '') + '>🍳 Breakfast</option>' +
                                        '<option value="lunch" ' + (cat === 'lunch' ? 'selected' : '') + '>🥗 Lunch</option>' +
                                        '<option value="dinner" ' + (cat === 'dinner' ? 'selected' : '') + '>🍲 Dinner</option>' +
                                        '<option value="snacks" ' + (cat === 'snacks' || cat === 'workout' ? 'selected' : '') + '>🍎 Snacks</option>' +
                                    '</select>' +
                                '</div>' +
                            '</div>' +
                            '<div class="quicklog-panel__actions">' +
                                '<button class="btn btn-secondary btn-sm" data-action="cancel-quicklog">Cancel</button>' +
                                '<button class="btn btn-primary btn-sm btn-glow" data-action="confirm-quicklog" data-meal-id="' + meal.id + '">Confirm Log (+' + Math.round(totalCal) + ' kcal)</button>' +
                            '</div>' +
                        '</div>';
            } else {
                html += '<div class="meal-card__footer">' +
                            '<button class="btn btn-primary btn-sm btn-glow" data-action="quicklog" data-meal-id="' + meal.id + '">' +
                                '⚡ Quick Log' +
                            '</button>' +
                            '<div class="meal-card__tool-btns">' +
                                '<button class="btn-icon-sm btn-ghost" data-action="edit-meal" data-meal-id="' + meal.id + '" title="Edit meal">✏️</button>' +
                                '<button class="btn-icon-sm btn-ghost" data-action="duplicate-meal" data-meal-id="' + meal.id + '" title="Duplicate meal">📋</button>' +
                                '<button class="btn-icon-sm btn-danger-ghost" data-action="delete-meal" data-meal-id="' + meal.id + '" title="Delete meal">🗑️</button>' +
                            '</div>' +
                        '</div>';
            }

            html += '</div>'; /* end meal-card */
        });

        html += '</div>';
        return html;
    }

    function _buildPresetsSection() {
        var html = '<div class="presets-section">' +
                       '<div class="presets-section__header">' +
                           '<div>' +
                               '<h3 class="section-title" style="margin-bottom: 2px;">💡 Starter Meal Library</h3>' +
                               '<p class="presets-section__sub">Popular, nutrient-dense meal templates ready to add to your collection</p>' +
                           '</div>' +
                       '</div>' +
                       '<div class="presets-grid">';

        PRESET_TEMPLATES.forEach(function(preset, idx) {
            var totalCal = _totalOf(preset.items, 'calories');
            var totalP   = _totalOf(preset.items, 'protein');
            var totalC   = _totalOf(preset.items, 'carbs');
            var totalF   = _totalOf(preset.items, 'fat');

            html += '<div class="card preset-card">' +
                        '<div class="preset-card__top">' +
                            '<span class="preset-card__icon">' + preset.icon + '</span>' +
                            '<span class="meal-cat-badge meal-cat-badge--' + preset.category + '">' +
                                _capitalize(preset.category) +
                            '</span>' +
                        '</div>' +
                        '<h4 class="preset-card__title">' + preset.name + '</h4>' +
                        '<p class="preset-card__tagline">' + preset.tagline + '</p>' +
                        '<div class="preset-card__items-preview">';

            preset.items.forEach(function(it) {
                html += '<span class="meal-item-chip">• ' + it.name + '</span>';
            });

            html += '</div>' +
                    '<div class="preset-card__macros">' +
                        '<span class="macro-badge macro-badge--cal">' + Math.round(totalCal) + ' kcal</span>' +
                        '<span class="macro-badge macro-badge--protein">P: ' + Math.round(totalP) + 'g</span>' +
                        '<span class="macro-badge macro-badge--carbs">C: ' + Math.round(totalC) + 'g</span>' +
                        '<span class="macro-badge macro-badge--fat">F: ' + Math.round(totalF) + 'g</span>' +
                    '</div>' +
                    '<div class="preset-card__action">' +
                        '<button class="btn btn-secondary btn-sm btn-block" data-action="use-preset" data-index="' + idx + '">' +
                            '＋ Add to My Meals' +
                        '</button>' +
                    '</div>' +
                '</div>';
        });

        html += '</div></div>';
        return html;
    }

    /* ───────── Actions ───────── */

    function _addMealItem() {
        var nameInput = document.getElementById('meal-item-name');
        var calInput  = document.getElementById('meal-item-cal');
        var pInput    = document.getElementById('meal-item-protein');
        var cInput    = document.getElementById('meal-item-carbs');
        var fInput    = document.getElementById('meal-item-fat');

        var name = nameInput ? nameInput.value.trim() : '';
        if (!name) {
            NutriApp.showToast('Enter a food item name.', 'warning');
            if (nameInput) nameInput.focus();
            return;
        }

        if (!editingMeal) {
            editingMeal = { name: '', category: 'lunch', items: [] };
        }

        /* Preserve current meal name from input */
        var currentNameInput = document.getElementById('meal-name-input');
        if (currentNameInput) editingMeal.name = currentNameInput.value;

        editingMeal.items.push({
            id: NutriStorage.generateId(),
            name: name,
            calories: parseFloat(calInput ? calInput.value : 0) || 0,
            protein: parseFloat(pInput ? pInput.value : 0) || 0,
            carbs: parseFloat(cInput ? cInput.value : 0) || 0,
            fat: parseFloat(fInput ? fInput.value : 0) || 0
        });

        NutriApp.showToast('Added ' + name, 'success');
        render();
    }

    function _aiAddFoodItem() {
        var descInput = document.getElementById('meal-item-ai-desc');
        var desc = descInput ? descInput.value.trim() : '';
        if (!desc) {
            NutriApp.showToast('Please type a food description.', 'warning');
            return;
        }

        if (typeof NutritionAI === 'undefined' || !NutritionAI.isConfigured()) {
            NutriApp.showToast('Gemini API key is required. Go to Settings.', 'warning');
            return;
        }

        /* Preserve current meal name from input */
        var currentNameInput = document.getElementById('meal-name-input');
        if (currentNameInput && editingMeal) editingMeal.name = currentNameInput.value;

        isAiAddingItem = true;
        render();

        NutritionAI.analyze(desc, 1).then(function (result) {
            isAiAddingItem = false;
            if (!editingMeal) editingMeal = { name: '', category: 'lunch', items: [] };

            if (result && result.subItems && result.subItems.length > 0) {
                result.subItems.forEach(function (sub) {
                    editingMeal.items.push({
                        id: NutriStorage.generateId(),
                        name: sub.name || desc,
                        calories: parseFloat(sub.calories) || 0,
                        protein: parseFloat(sub.protein) || 0,
                        carbs: parseFloat(sub.carbs) || 0,
                        fat: parseFloat(sub.fat) || 0
                    });
                });
                NutriApp.showToast('AI added ' + result.subItems.length + ' food items!', 'success');
            } else if (result) {
                editingMeal.items.push({
                    id: NutriStorage.generateId(),
                    name: result.name || desc,
                    calories: parseFloat(result.calories) || 0,
                    protein: parseFloat(result.protein) || 0,
                    carbs: parseFloat(result.carbs) || 0,
                    fat: parseFloat(result.fat) || 0
                });
                NutriApp.showToast('Added ' + (result.name || desc), 'success');
            }
            render();
        }).catch(function (err) {
            isAiAddingItem = false;
            NutriApp.showToast('AI analysis failed: ' + (err.message || err), 'error');
            render();
        });
    }

    function _runAiGenerator(prompt) {
        if (!prompt) {
            NutriApp.showToast('Please enter a meal description.', 'warning');
            return;
        }

        if (typeof NutritionAI === 'undefined' || !NutritionAI.isConfigured()) {
            NutriApp.showToast('Gemini API key required. Go to Settings.', 'warning');
            return;
        }

        isAiGenerating = true;
        render();

        NutritionAI.analyzeGlobal(prompt).then(function (result) {
            isAiGenerating = false;
            if (!result) {
                NutriApp.showToast('AI could not generate this meal. Please try another description.', 'error');
                render();
                return;
            }

            var newItems = [];
            if (result.subItems && result.subItems.length > 0) {
                result.subItems.forEach(function (sub) {
                    newItems.push({
                        id: NutriStorage.generateId(),
                        name: sub.name || 'Food item',
                        calories: parseFloat(sub.calories) || 0,
                        protein: parseFloat(sub.protein) || 0,
                        carbs: parseFloat(sub.carbs) || 0,
                        fat: parseFloat(sub.fat) || 0
                    });
                });
            } else {
                newItems.push({
                    id: NutriStorage.generateId(),
                    name: result.name || prompt,
                    calories: parseFloat(result.calories) || 0,
                    protein: parseFloat(result.protein) || 0,
                    carbs: parseFloat(result.carbs) || 0,
                    fat: parseFloat(result.fat) || 0
                });
            }

            var detectedCat = 'lunch';
            var pLower = prompt.toLowerCase();
            if (pLower.includes('breakfast') || pLower.includes('morning') || pLower.includes('egg') || pLower.includes('oat')) detectedCat = 'breakfast';
            else if (pLower.includes('lunch') || pLower.includes('salad') || pLower.includes('wrap')) detectedCat = 'lunch';
            else if (pLower.includes('dinner') || pLower.includes('salmon') || pLower.includes('steak')) detectedCat = 'dinner';
            else if (pLower.includes('shake') || pLower.includes('workout') || pLower.includes('protein shake')) detectedCat = 'workout';
            else if (pLower.includes('snack')) detectedCat = 'snacks';

            editingMeal = {
                id: null,
                name: result.name ? _capitalize(result.name) : _capitalize(prompt),
                category: detectedCat,
                items: newItems
            };

            showMealForm = true;
            showAiGenerator = false;
            NutriApp.showToast('✨ AI generated meal with ' + newItems.length + ' items! Review and save.', 'success');
            render();
        }).catch(function (err) {
            isAiGenerating = false;
            NutriApp.showToast('AI generation failed: ' + (err.message || err), 'error');
            render();
        });
    }

    function _removeMealItem(index) {
        if (editingMeal && editingMeal.items) {
            var currentNameInput = document.getElementById('meal-name-input');
            if (currentNameInput) editingMeal.name = currentNameInput.value;

            editingMeal.items.splice(index, 1);
            render();
        }
    }

    function _saveMeal() {
        var nameInput = document.getElementById('meal-name-input');
        var name = nameInput ? nameInput.value.trim() : '';

        if (!name) {
            NutriApp.showToast('Please enter a name for your meal.', 'warning');
            if (nameInput) nameInput.focus();
            return;
        }

        if (!editingMeal || !editingMeal.items || !editingMeal.items.length) {
            NutriApp.showToast('Add at least one food item to this meal.', 'warning');
            return;
        }

        editingMeal.name = name;

        if (editingMeal.id) {
            NutriStorage.updateSavedMeal(editingMeal.id, editingMeal);
            NutriApp.showToast('Meal "' + name + '" updated!', 'success');
        } else {
            editingMeal.id = NutriStorage.generateId();
            NutriStorage.addSavedMeal(editingMeal);
            NutriApp.showToast('Meal "' + name + '" saved to templates!', 'success');
        }

        editingMeal = null;
        showMealForm = false;
        render();
    }

    function _quickLog(mealId) {
        var meals = NutriStorage.getSavedMeals() || [];
        var meal = meals.find(function (m) { return m.id === mealId; });
        if (!meal) return;

        var selectEl = document.getElementById('quicklog-slot-select-' + mealId);
        var mealType = selectEl ? selectEl.value : (meal.category || 'snacks');
        var today = NutriApp.getCurrentDate();
        var totalCal = 0;

        (meal.items || []).forEach(function (item) {
            var entry = Object.assign({}, item, {
                id: NutriStorage.generateId(),
                meal: mealType,
                loggedAt: new Date().toISOString()
            });
            NutriStorage.addFoodEntry(today, entry);
            totalCal += (entry.calories || 0);
        });

        NutriApp.showToast('Logged ' + meal.name + ' (+' + Math.round(totalCal) + ' kcal) to ' + _capitalize(mealType) + '!', 'success');
        quickLogMealId = null;
        render();
    }

    function _duplicateMeal(mealId) {
        var meals = NutriStorage.getSavedMeals() || [];
        var meal = meals.find(function (m) { return m.id === mealId; });
        if (!meal) return;

        var clone = JSON.parse(JSON.stringify(meal));
        clone.id = NutriStorage.generateId();
        clone.name = clone.name + ' (Copy)';
        NutriStorage.addSavedMeal(clone);
        NutriApp.showToast('Meal duplicated!', 'success');
        render();
    }

    function _deleteMeal(mealId) {
        var meals = NutriStorage.getSavedMeals() || [];
        var meal = meals.find(function (m) { return m.id === mealId; });
        var mealName = meal ? meal.name : 'this meal';

        if (!confirm('Are you sure you want to delete "' + mealName + '"?')) return;

        NutriStorage.removeSavedMeal(mealId);
        NutriApp.showToast('Meal deleted.', 'info');
        render();
    }

    function _editMeal(mealId) {
        var meals = NutriStorage.getSavedMeals() || [];
        var meal = meals.find(function (m) { return m.id === mealId; });
        if (!meal) return;

        editingMeal = JSON.parse(JSON.stringify(meal));
        showMealForm = true;
        render();

        /* Smooth scroll to form */
        setTimeout(function() {
            var formEl = document.querySelector('.meal-form-card');
            if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    function _usePreset(index) {
        var preset = PRESET_TEMPLATES[index];
        if (!preset) return;

        var newMeal = JSON.parse(JSON.stringify(preset));
        newMeal.id = NutriStorage.generateId();
        NutriStorage.addSavedMeal(newMeal);
        NutriApp.showToast('Added "' + preset.name + '" to your saved meals!', 'success');
        render();
    }

    /* ───────── Event Handling ───────── */

    function _handleClick(e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;

        var action = btn.getAttribute('data-action');
        switch (action) {
            case 'open-create':
                editingMeal = { name: '', category: 'breakfast', items: [] };
                showMealForm = true;
                showAiGenerator = false;
                render();
                setTimeout(function() {
                    var input = document.getElementById('meal-name-input');
                    if (input) input.focus();
                }, 100);
                break;
            case 'close-form':
                editingMeal = null;
                showMealForm = false;
                render();
                break;
            case 'toggle-ai-gen':
                showAiGenerator = !showAiGenerator;
                render();
                if (showAiGenerator) {
                    setTimeout(function() {
                        var input = document.getElementById('ai-meal-prompt');
                        if (input) input.focus();
                    }, 100);
                }
                break;
            case 'run-ai-gen':
                var pInput = document.getElementById('ai-meal-prompt');
                _runAiGenerator(pInput ? pInput.value.trim() : '');
                break;
            case 'preset-ai-prompt':
                var promptVal = btn.getAttribute('data-prompt');
                var pInput2 = document.getElementById('ai-meal-prompt');
                if (pInput2) pInput2.value = promptVal;
                _runAiGenerator(promptVal);
                break;
            case 'select-form-cat':
                var cat = btn.getAttribute('data-category');
                if (editingMeal) {
                    editingMeal.category = cat;
                    var nameInput = document.getElementById('meal-name-input');
                    if (nameInput) editingMeal.name = nameInput.value;
                }
                render();
                break;
            case 'set-item-mode':
                activeItemMode = btn.getAttribute('data-mode') || 'manual';
                var nameInput2 = document.getElementById('meal-name-input');
                if (nameInput2 && editingMeal) editingMeal.name = nameInput2.value;
                render();
                break;
            case 'add-meal-item':
                _addMealItem();
                break;
            case 'ai-add-item':
                _aiAddFoodItem();
                break;
            case 'remove-meal-item':
                _removeMealItem(parseInt(btn.getAttribute('data-index'), 10));
                break;
            case 'save-meal':
                _saveMeal();
                break;
            case 'quicklog':
                quickLogMealId = btn.getAttribute('data-meal-id');
                render();
                break;
            case 'confirm-quicklog':
                _quickLog(btn.getAttribute('data-meal-id'));
                break;
            case 'cancel-quicklog':
                quickLogMealId = null;
                render();
                break;
            case 'edit-meal':
                _editMeal(btn.getAttribute('data-meal-id'));
                break;
            case 'duplicate-meal':
                _duplicateMeal(btn.getAttribute('data-meal-id'));
                break;
            case 'delete-meal':
                _deleteMeal(btn.getAttribute('data-meal-id'));
                break;
            case 'use-preset':
                _usePreset(parseInt(btn.getAttribute('data-index'), 10));
                break;
            case 'set-filter':
                activeCategoryFilter = btn.getAttribute('data-filter') || 'all';
                render();
                break;
            case 'clear-search':
                searchQuery = '';
                render();
                break;
            case 'reset-filters':
                searchQuery = '';
                activeCategoryFilter = 'all';
                render();
                break;
            case 'go-settings':
                if (typeof NutriApp !== 'undefined' && NutriApp.navigateTo) {
                    NutriApp.navigateTo('settings');
                }
                break;
        }
    }

    function _handleInput(e) {
        if (e.target.id === 'meal-search-input') {
            searchQuery = e.target.value;
            _renderGridOnly();
        }
    }

    function _handleKeydown(e) {
        if (e.key === 'Enter') {
            if (e.target.id === 'ai-meal-prompt') {
                e.preventDefault();
                _runAiGenerator(e.target.value.trim());
            } else if (e.target.id === 'meal-item-ai-desc') {
                e.preventDefault();
                _aiAddFoodItem();
            } else if (e.target.id === 'meal-item-name' || e.target.id === 'meal-item-cal' || e.target.id === 'meal-item-fat') {
                e.preventDefault();
                _addMealItem();
            }
        }
    }

    /* ───────── Render Helpers ───────── */

    function _getFilteredMeals(allMeals) {
        return allMeals.filter(function (meal) {
            /* Category match */
            if (activeCategoryFilter !== 'all') {
                var mealCat = (meal.category || 'other').toLowerCase();
                if (activeCategoryFilter === 'snacks' && mealCat === 'other') {
                    /* match */
                } else if (mealCat !== activeCategoryFilter) {
                    return false;
                }
            }

            /* Search query match */
            if (searchQuery.trim()) {
                var q = searchQuery.toLowerCase().trim();
                var nameMatch = (meal.name || '').toLowerCase().includes(q);
                var itemsMatch = (meal.items || []).some(function (it) {
                    return (it.name || '').toLowerCase().includes(q);
                });
                return nameMatch || itemsMatch;
            }

            return true;
        });
    }

    function _renderGridOnly() {
        var gridContainer = container ? container.querySelector('#meal-grid-container') : null;
        if (gridContainer) {
            var allMeals = NutriStorage.getSavedMeals() || [];
            var filtered = _getFilteredMeals(allMeals);
            gridContainer.innerHTML = _buildSavedMealsGrid(filtered, allMeals);
        }
    }

    /* ───────── Public API ───────── */

    function init() {
        container = document.getElementById(PAGE_ID);
        if (container) {
            container.addEventListener('click', _handleClick);
            container.addEventListener('input', _handleInput);
            container.addEventListener('keydown', _handleKeydown);
        }
    }

    function render() {
        if (!container) container = document.getElementById(PAGE_ID);
        if (!container) return;

        var allMeals = NutriStorage.getSavedMeals() || [];
        var filteredMeals = _getFilteredMeals(allMeals);

        var inner = container.querySelector('.page-inner') || container;

        inner.innerHTML =
            _buildHeader(allMeals.length) +
            _buildAiGenerator() +
            _buildMealForm() +
    return { init: init, render: render };

})();
