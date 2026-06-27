'use strict';

window.MealPlannerPage = (function () {

    const PAGE_ID = 'page-meals';
    let container = null;
    let editingMeal = null;        /* null | { id?, name, items[] }  */
    let showMealForm = false;
    let quickLogMealId = null;     /* id of meal being quick-logged (show meal selector) */

    /* ───────── helpers ───────── */

    function _totalOf(items, key) {
        return items.reduce(function (s, e) { return s + (parseFloat(e[key]) || 0); }, 0);
    }

    function _capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

    /* ───────── HTML builders ───────── */

    function _buildHeader() {
        return '<div class="page-header">' +
                   '<h1 class="page-title">Meal Planner</h1>' +
                   '<p class="page-subtitle">Save & reuse your favorite meals</p>' +
               '</div>';
    }

    function _buildCreateButton() {
        return '<button class="btn btn-primary btn-block create-meal-btn" data-action="open-create">' +
                   '<span class="btn-icon">+</span> Create New Meal' +
               '</button>';
    }

    function _buildMealForm() {
        if (!showMealForm) return '';

        var meal = editingMeal || { name: '', items: [] };
        var totalCal = _totalOf(meal.items, 'calories');
        var totalP   = _totalOf(meal.items, 'protein');
        var totalC   = _totalOf(meal.items, 'carbs');
        var totalF   = _totalOf(meal.items, 'fat');

        var html = '<div class="card meal-form-card">' +
                       '<div class="meal-form-card__header">' +
                           '<h3 class="card__title">' + (meal.id ? 'Edit Meal' : 'Create Meal') + '</h3>' +
                           '<button class="btn-icon-sm" data-action="close-form" title="Close">✕</button>' +
                       '</div>' +
                       '<div class="form-group">' +
                           '<label>Meal Name *</label>' +
                           '<input type="text" id="meal-name-input" class="input" placeholder="e.g., Morning Power Bowl" value="' + (meal.name || '') + '">' +
                       '</div>' +
                       '<div class="meal-form__add-item">' +
                           '<h4>Add Food Items</h4>' +
                           '<div class="form-row">' +
                               '<input type="text" id="meal-item-name" class="input" placeholder="Food name">' +
                               '<input type="number" id="meal-item-cal" class="input-sm" placeholder="kcal" min="0">' +
                           '</div>' +
                           '<div class="form-row">' +
                               '<input type="number" id="meal-item-protein" class="input-sm" placeholder="Protein (g)" min="0" step="0.1">' +
                               '<input type="number" id="meal-item-carbs" class="input-sm" placeholder="Carbs (g)" min="0" step="0.1">' +
                               '<input type="number" id="meal-item-fat" class="input-sm" placeholder="Fat (g)" min="0" step="0.1">' +
                           '</div>' +
                           '<button class="btn btn-secondary btn-sm" data-action="add-meal-item">+ Add Item</button>' +
                       '</div>';

        /* items list */
        if (meal.items.length) {
            html += '<div class="meal-form__items">';
            meal.items.forEach(function (item, idx) {
                html += '<div class="meal-form__item">' +
                            '<span class="meal-form__item-name">' + (item.name || 'Item') + '</span>' +
                            '<span class="meal-form__item-cal">' + Math.round(item.calories || 0) + ' kcal</span>' +
                            '<button class="btn-icon-sm btn-danger-ghost" data-action="remove-meal-item" data-index="' + idx + '">✕</button>' +
                        '</div>';
            });
            html += '</div>' +
                    '<div class="meal-form__totals">' +
                        '<span>Total: ' + Math.round(totalCal) + ' kcal</span>' +
                        '<span class="macro-badge macro-badge--protein">P: ' + Math.round(totalP) + 'g</span>' +
                        '<span class="macro-badge macro-badge--carbs">C: ' + Math.round(totalC) + 'g</span>' +
                        '<span class="macro-badge macro-badge--fat">F: ' + Math.round(totalF) + 'g</span>' +
                    '</div>';
        }

        html += '<button class="btn btn-primary btn-block" data-action="save-meal">' +
                    (meal.id ? 'Update Meal' : 'Save Meal') +
                '</button>' +
                '</div>';

        return html;
    }

    function _buildSavedMealsGrid(meals) {
        if (!meals.length && !showMealForm) {
            return '<div class="card">' +
                       '<div class="empty-state">' +
                           '<div class="empty-state__icon">🍱</div>' +
                           '<p class="empty-state__text">No saved meals yet!</p>' +
                           '<p class="empty-state__sub">Create your first meal to quickly log it anytime.</p>' +
                       '</div>' +
                   '</div>';
        }

        if (!meals.length) return '';

        var html = '<h3 class="section-title">Saved Meals</h3><div class="meals-grid">';
        meals.forEach(function (meal) {
            var totalCal = _totalOf(meal.items || [], 'calories');
            var totalP = _totalOf(meal.items || [], 'protein');
            var totalC = _totalOf(meal.items || [], 'carbs');
            var totalF = _totalOf(meal.items || [], 'fat');

            html += '<div class="card meal-card" data-meal-id="' + meal.id + '">' +
                        '<div class="meal-card__header">' +
                            '<h4 class="meal-card__name">' + (meal.name || 'Meal') + '</h4>' +
                            '<span class="meal-card__count">' + (meal.items || []).length + ' items</span>' +
                        '</div>' +
                        '<div class="meal-card__macros">' +
                            '<span class="macro-badge macro-badge--cal">' + Math.round(totalCal) + ' kcal</span>' +
                            '<span class="macro-badge macro-badge--protein">P: ' + Math.round(totalP) + 'g</span>' +
                            '<span class="macro-badge macro-badge--carbs">C: ' + Math.round(totalC) + 'g</span>' +
                            '<span class="macro-badge macro-badge--fat">F: ' + Math.round(totalF) + 'g</span>' +
                        '</div>';

            /* quick log: show meal selector or button */
            if (quickLogMealId === meal.id) {
                html += '<div class="meal-card__quicklog">' +
                            '<select id="quicklog-meal-select-' + meal.id + '" class="select-sm">' +
                                '<option value="breakfast">Breakfast</option>' +
                                '<option value="lunch">Lunch</option>' +
                                '<option value="dinner">Dinner</option>' +
                                '<option value="snacks">Snacks</option>' +
                            '</select>' +
                            '<button class="btn btn-primary btn-sm" data-action="confirm-quicklog" data-meal-id="' + meal.id + '">Log</button>' +
                            '<button class="btn btn-secondary btn-sm" data-action="cancel-quicklog">Cancel</button>' +
                        '</div>';
            } else {
                html += '<div class="meal-card__actions">' +
                            '<button class="btn btn-primary btn-sm" data-action="quicklog" data-meal-id="' + meal.id + '">⚡ Quick Log</button>' +
                            '<button class="btn btn-secondary btn-sm" data-action="edit-meal" data-meal-id="' + meal.id + '">✏️ Edit</button>' +
                            '<button class="btn btn-danger-ghost btn-sm" data-action="delete-meal" data-meal-id="' + meal.id + '">🗑️</button>' +
                        '</div>';
            }

            html += '</div>';
        });
        html += '</div>';
        return html;
    }

    /* ───────── actions ───────── */

    function _addMealItem() {
        var nameInput = document.getElementById('meal-item-name');
        var calInput  = document.getElementById('meal-item-cal');
        var pInput    = document.getElementById('meal-item-protein');
        var cInput    = document.getElementById('meal-item-carbs');
        var fInput    = document.getElementById('meal-item-fat');

        var name = nameInput ? nameInput.value.trim() : '';
        if (!name) { NutriApp.showToast('Enter a food name.', 'warning'); return; }

        if (!editingMeal) editingMeal = { name: '', items: [] };
        editingMeal.items.push({
            id: NutriStorage.generateId(),
            name: name,
            calories: parseFloat(calInput ? calInput.value : 0) || 0,
            protein: parseFloat(pInput ? pInput.value : 0) || 0,
            carbs: parseFloat(cInput ? cInput.value : 0) || 0,
            fat: parseFloat(fInput ? fInput.value : 0) || 0
        });
        render();
    }

    function _removeMealItem(index) {
        if (editingMeal && editingMeal.items) {
            editingMeal.items.splice(index, 1);
            render();
        }
    }

    function _saveMeal() {
        var nameInput = document.getElementById('meal-name-input');
        var name = nameInput ? nameInput.value.trim() : '';
        if (!name) { NutriApp.showToast('Please name your meal.', 'warning'); return; }
        if (!editingMeal || !editingMeal.items.length) {
            NutriApp.showToast('Add at least one food item.', 'warning');
            return;
        }

        editingMeal.name = name;

        if (editingMeal.id) {
            NutriStorage.updateSavedMeal(editingMeal.id, editingMeal);
            NutriApp.showToast('Meal updated!', 'success');
        } else {
            editingMeal.id = NutriStorage.generateId();
            NutriStorage.addSavedMeal(editingMeal);
            NutriApp.showToast('Meal saved!', 'success');
        }

        editingMeal = null;
        showMealForm = false;
        render();
    }

    function _quickLog(mealId) {
        var meals = NutriStorage.getSavedMeals() || [];
        var meal = meals.find(function (m) { return m.id === mealId; });
        if (!meal) return;

        var selectEl = document.getElementById('quicklog-meal-select-' + mealId);
        var mealType = selectEl ? selectEl.value : 'snacks';
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

        NutriApp.showToast('Meal logged! +' + Math.round(totalCal) + ' kcal', 'success');
        quickLogMealId = null;
        render();
    }

    function _deleteMeal(mealId) {
        if (!confirm('Delete this saved meal?')) return;
        NutriStorage.removeSavedMeal(mealId);
        NutriApp.showToast('Meal deleted.', 'info');
        render();
    }

    function _editMeal(mealId) {
        var meals = NutriStorage.getSavedMeals() || [];
        var meal = meals.find(function (m) { return m.id === mealId; });
        if (!meal) return;
        editingMeal = JSON.parse(JSON.stringify(meal)); /* deep copy */
        showMealForm = true;
        render();
    }

    /* ───────── event handling ───────── */

    function _handleClick(e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;

        var action = btn.getAttribute('data-action');
        switch (action) {
            case 'open-create':
                editingMeal = { name: '', items: [] };
                showMealForm = true;
                render();
                break;
            case 'close-form':
                editingMeal = null;
                showMealForm = false;
                render();
                break;
            case 'add-meal-item':
                _addMealItem();
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
            case 'delete-meal':
                _deleteMeal(btn.getAttribute('data-meal-id'));
                break;
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

        var meals = NutriStorage.getSavedMeals() || [];

        container.innerHTML =
            _buildHeader() +
            _buildCreateButton() +
            _buildMealForm() +
            _buildSavedMealsGrid(meals);
    }

    return { init: init, render: render };

})();
