'use strict';

window.ExerciseLogPage = (function () {

    const PAGE_ID = 'page-exercise';
    let container = null;
    let activeCategory = 'all';
    let searchQuery = '';
    let selectedExercise = null;
    let showCustomForm = false;

    /* ───────── Exercise Database ───────── */

    const EXERCISE_DATABASE = [
        { name: 'Running (6 mph)', met: 9.8, category: 'cardio' },
        { name: 'Walking (3.5 mph)', met: 4.3, category: 'cardio' },
        { name: 'Cycling (moderate)', met: 8.0, category: 'cardio' },
        { name: 'Swimming (moderate)', met: 7.0, category: 'cardio' },
        { name: 'Jump Rope', met: 12.3, category: 'cardio' },
        { name: 'Rowing Machine', met: 7.0, category: 'cardio' },
        { name: 'Elliptical', met: 5.0, category: 'cardio' },
        { name: 'Stair Climbing', met: 9.0, category: 'cardio' },
        { name: 'Dancing', met: 5.5, category: 'cardio' },
        { name: 'Hiking', met: 6.0, category: 'cardio' },
        { name: 'HIIT', met: 12.0, category: 'cardio' },
        { name: 'Kickboxing', met: 10.0, category: 'cardio' },
        { name: 'Aerobics', met: 7.3, category: 'cardio' },
        { name: 'Spinning', met: 8.5, category: 'cardio' },
        { name: 'Weight Training (general)', met: 6.0, category: 'strength' },
        { name: 'Weight Training (vigorous)', met: 8.0, category: 'strength' },
        { name: 'Push-ups', met: 8.0, category: 'strength' },
        { name: 'Pull-ups', met: 8.0, category: 'strength' },
        { name: 'Squats', met: 5.0, category: 'strength' },
        { name: 'Deadlifts', met: 6.0, category: 'strength' },
        { name: 'Bench Press', met: 6.0, category: 'strength' },
        { name: 'Lunges', met: 5.0, category: 'strength' },
        { name: 'Plank', met: 4.0, category: 'strength' },
        { name: 'Burpees', met: 10.0, category: 'strength' },
        { name: 'Kettlebell Swings', met: 9.0, category: 'strength' },
        { name: 'Resistance Bands', met: 4.5, category: 'strength' },
        { name: 'Crunches/Sit-ups', met: 5.0, category: 'strength' },
        { name: 'Dumbbell Curls', met: 5.0, category: 'strength' },
        { name: 'Yoga (hatha)', met: 2.5, category: 'flexibility' },
        { name: 'Yoga (power)', met: 4.0, category: 'flexibility' },
        { name: 'Pilates', met: 3.0, category: 'flexibility' },
        { name: 'Stretching', met: 2.3, category: 'flexibility' },
        { name: 'Tai Chi', met: 3.0, category: 'flexibility' },
        { name: 'Foam Rolling', met: 2.0, category: 'flexibility' },
        { name: 'Basketball', met: 6.5, category: 'sports' },
        { name: 'Soccer/Football', met: 7.0, category: 'sports' },
        { name: 'Tennis', met: 7.3, category: 'sports' },
        { name: 'Badminton', met: 5.5, category: 'sports' },
        { name: 'Table Tennis', met: 4.0, category: 'sports' },
        { name: 'Volleyball', met: 4.0, category: 'sports' },
        { name: 'Cricket', met: 5.0, category: 'sports' },
        { name: 'Golf', met: 4.8, category: 'sports' },
        { name: 'Martial Arts', met: 10.3, category: 'sports' },
        { name: 'Rock Climbing', met: 8.0, category: 'sports' },
        { name: 'Skating', met: 7.0, category: 'sports' },
        { name: 'Skiing', met: 7.0, category: 'sports' },
        { name: 'Surfing', met: 3.0, category: 'sports' },
        { name: 'Boxing (sparring)', met: 7.8, category: 'sports' },
        { name: 'Gardening', met: 3.8, category: 'cardio' },
        { name: 'House Cleaning', met: 3.5, category: 'cardio' },
    ];

    /* ───────── helpers ───────── */

    function _totalOf(entries, key) {
        return entries.reduce(function (s, e) { return s + (parseFloat(e[key]) || 0); }, 0);
    }

    function _capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

    function _categoryColor(cat) {
        var colors = { cardio: '#ef4444', strength: '#3b82f6', flexibility: '#a855f7', sports: '#f59e0b' };
        return colors[cat] || '#64748b';
    }

    function _categoryIcon(cat) {
        var icons = { cardio: '🏃', strength: '💪', flexibility: '🧘', sports: '⚽' };
        return icons[cat] || '🏅';
    }

    function _getUserWeight() {
        var settings = NutriStorage.getUserSettings() || {};
        return parseFloat(settings.weight) || 70;
    }

    function _calcCalories(met, durationMinutes) {
        var weightKg = _getUserWeight();
        return Math.round(met * weightKg * (durationMinutes / 60));
    }

    function _filteredExercises() {
        var list = EXERCISE_DATABASE;
        if (activeCategory !== 'all') {
            list = list.filter(function (ex) { return ex.category === activeCategory; });
        }
        if (searchQuery) {
            var q = searchQuery.toLowerCase();
            list = list.filter(function (ex) { return ex.name.toLowerCase().indexOf(q) !== -1; });
        }
        return list;
    }

    /* ───────── HTML builders ───────── */

    function _buildHeader(dateStr) {
        return '<div class="page-header">' +
                   '<h1 class="page-title">Exercise Log</h1>' +
                   '<p class="page-subtitle">' + dateStr + '</p>' +
               '</div>';
    }

    function _buildSummaryCard(exercises) {
        var totalDuration = _totalOf(exercises, 'duration');
        var totalBurned = _totalOf(exercises, 'caloriesBurned');
        return '<div class="card exercise-summary-stats">' +
                   '<div class="stat-cards-row">' +
                       '<div class="stat-card">' +
                           '<div class="stat-card__value">' + exercises.length + '</div>' +
                           '<div class="stat-card__label">Exercises</div>' +
                       '</div>' +
                       '<div class="stat-card">' +
                           '<div class="stat-card__value">' + Math.round(totalDuration) + '</div>' +
                           '<div class="stat-card__label">Minutes</div>' +
                       '</div>' +
                       '<div class="stat-card">' +
                           '<div class="stat-card__value">🔥 ' + Math.round(totalBurned) + '</div>' +
                           '<div class="stat-card__label">kcal Burned</div>' +
                       '</div>' +
                   '</div>' +
               '</div>';
    }

    function _buildCategoryChips() {
        var cats = ['all', 'cardio', 'strength', 'flexibility', 'sports'];
        var html = '<div class="category-chips">';
        cats.forEach(function (cat) {
            var cls = 'chip' + (activeCategory === cat ? ' chip--active' : '');
            html += '<button class="' + cls + '" data-category="' + cat + '">' +
                        (cat === 'all' ? '🏅 ' : _categoryIcon(cat) + ' ') + _capitalize(cat) +
                    '</button>';
        });
        html += '</div>';
        return html;
    }

    function _buildSearchInput() {
        return '<div class="exercise-search">' +
                   '<input type="text" id="exercise-search-input" class="search-input" ' +
                       'placeholder="Search exercises..." value="' + (searchQuery || '') + '" autocomplete="off">' +
               '</div>';
    }

    function _buildExerciseGrid(filtered) {
        if (!filtered.length) {
            return '<div class="card"><div class="empty-state">' +
                       '<div class="empty-state__icon">🔍</div>' +
                       '<p class="empty-state__text">No exercises match your filter.</p>' +
                   '</div></div>';
        }

        var html = '<div class="exercise-grid">';
        filtered.forEach(function (ex, idx) {
            var isSelected = selectedExercise && selectedExercise.name === ex.name;
            var cls = 'exercise-card card' + (isSelected ? ' exercise-card--selected' : '');
            html += '<div class="' + cls + '" data-action="select-exercise" data-index="' + idx + '">' +
                        '<div class="exercise-card__name">' + ex.name + '</div>' +
                        '<span class="category-badge" style="background:' + _categoryColor(ex.category) + '">' +
                            _capitalize(ex.category) +
                        '</span>' +
                        '<div class="exercise-card__met">MET: ' + ex.met + '</div>';

            if (isSelected) {
                html += '<div class="exercise-card__form" onclick="event.stopPropagation()">' +
                            '<label>Duration (min)' +
                                '<input type="number" id="exercise-duration-input" class="input-sm" value="30" min="1" max="600">' +
                            '</label>' +
                            '<div class="exercise-card__calc" id="exercise-cal-preview">' +
                                '≈ ' + _calcCalories(ex.met, 30) + ' kcal' +
                            '</div>' +
                            '<button class="btn btn-primary btn-sm" data-action="log-exercise">Log Exercise</button>' +
                        '</div>';
            }

            html += '</div>';
        });
        html += '</div>';
        return html;
    }

    function _buildTodaysExercises(exercises) {
        var html = '<div class="card todays-exercises">' +
                       '<h3 class="card__title">Today\'s Exercises</h3>';

        if (!exercises.length) {
            html += '<div class="empty-state">' +
                        '<div class="empty-state__icon">🏋️</div>' +
                        '<p class="empty-state__text">No exercises logged today.</p>' +
                        '<p class="empty-state__sub">Select an exercise above to get started!</p>' +
                    '</div>';
        } else {
            html += '<ul class="exercise-list">';
            exercises.forEach(function (ex) {
                html += '<li class="exercise-list__item">' +
                            '<div class="exercise-list__info">' +
                                '<span class="exercise-list__name">' + (ex.name || 'Exercise') + '</span>' +
                                '<span class="category-badge category-badge--sm" style="background:' + _categoryColor(ex.category || 'cardio') + '">' +
                                    _capitalize(ex.category || 'other') +
                                '</span>' +
                            '</div>' +
                            '<div class="exercise-list__stats">' +
                                '<span>' + (ex.duration || 0) + ' min</span>' +
                                '<span>🔥 ' + Math.round(ex.caloriesBurned || 0) + ' kcal</span>' +
                            '</div>' +
                            '<button class="btn-icon-sm btn-danger-ghost" data-action="delete-exercise" data-id="' + ex.id + '" title="Delete">✕</button>' +
                        '</li>';
            });
            html += '</ul>';
        }

        html += '</div>';
        return html;
    }

    function _buildCustomExercise() {
        var html = '<button class="btn btn-secondary manual-entry-toggle" data-action="toggle-custom">' +
                       (showCustomForm ? '✕ Close Custom Entry' : '✏️ Custom Exercise') +
                   '</button>';

        if (showCustomForm) {
            html += '<div class="card custom-exercise-form">' +
                        '<h3 class="card__title">Custom Exercise</h3>' +
                        '<form id="custom-exercise-form">' +
                            '<div class="form-group">' +
                                '<label>Exercise Name *</label>' +
                                '<input type="text" name="name" class="input" required placeholder="e.g., Jump squats">' +
                            '</div>' +
                            '<div class="form-row">' +
                                '<div class="form-group">' +
                                    '<label>Duration (min) *</label>' +
                                    '<input type="number" name="duration" class="input" required min="1" value="30">' +
                                '</div>' +
                                '<div class="form-group">' +
                                    '<label>Calories Burned *</label>' +
                                    '<input type="number" name="caloriesBurned" class="input" required min="0">' +
                                '</div>' +
                            '</div>' +
                            '<div class="form-group">' +
                                '<label>Category</label>' +
                                '<select name="category" class="input">' +
                                    '<option value="cardio">Cardio</option>' +
                                    '<option value="strength">Strength</option>' +
                                    '<option value="flexibility">Flexibility</option>' +
                                    '<option value="sports">Sports</option>' +
                                '</select>' +
                            '</div>' +
                            '<button type="submit" class="btn btn-primary btn-block">Log Exercise</button>' +
                        '</form>' +
                    '</div>';
        }
        return html;
    }

    /* ───────── actions ───────── */

    function _logSelectedExercise() {
        if (!selectedExercise) return;
        var durationInput = document.getElementById('exercise-duration-input');
        var duration = parseInt(durationInput ? durationInput.value : 30, 10) || 30;
        var burned = _calcCalories(selectedExercise.met, duration);

        var entry = {
            id: NutriStorage.generateId(),
            name: selectedExercise.name,
            category: selectedExercise.category,
            met: selectedExercise.met,
            duration: duration,
            caloriesBurned: burned,
            loggedAt: new Date().toISOString()
        };

        var today = NutriApp.getCurrentDate();
        NutriStorage.addExerciseEntry(today, entry);
        NutriApp.showToast(entry.name + ' logged! 🔥 ' + burned + ' kcal', 'success');
        selectedExercise = null;
        render();
    }

    function _submitCustomForm(form) {
        var data = new FormData(form);
        var entry = {
            id: NutriStorage.generateId(),
            name: data.get('name'),
            category: data.get('category') || 'cardio',
            duration: parseInt(data.get('duration'), 10) || 0,
            caloriesBurned: parseInt(data.get('caloriesBurned'), 10) || 0,
            loggedAt: new Date().toISOString()
        };
        var today = NutriApp.getCurrentDate();
        NutriStorage.addExerciseEntry(today, entry);
        NutriApp.showToast(entry.name + ' logged! 🔥 ' + entry.caloriesBurned + ' kcal', 'success');
        showCustomForm = false;
        render();
    }

    /* ───────── event handling ───────── */

    function _handleClick(e) {
        /* category chips */
        var chip = e.target.closest('[data-category]');
        if (chip) {
            activeCategory = chip.getAttribute('data-category');
            selectedExercise = null;
            render();
            return;
        }

        var btn = e.target.closest('[data-action]');
        if (!btn) return;

        var action = btn.getAttribute('data-action');
        switch (action) {
            case 'select-exercise':
                var filtered = _filteredExercises();
                var idx = parseInt(btn.getAttribute('data-index'), 10);
                var ex = filtered[idx];
                if (ex) {
                    selectedExercise = (selectedExercise && selectedExercise.name === ex.name) ? null : ex;
                    render();
                }
                break;
            case 'log-exercise':
                _logSelectedExercise();
                break;
            case 'delete-exercise':
                var exId = btn.getAttribute('data-id');
                NutriStorage.removeExerciseEntry(NutriApp.getCurrentDate(), exId);
                NutriApp.showToast('Exercise removed.', 'info');
                render();
                break;
            case 'toggle-custom':
                showCustomForm = !showCustomForm;
                render();
                break;
        }
    }

    function _handleInput(e) {
        if (e.target.id === 'exercise-search-input') {
            searchQuery = e.target.value;
            selectedExercise = null;
            render();
            /* restore focus */
            var inp = document.getElementById('exercise-search-input');
            if (inp) { inp.focus(); inp.selectionStart = inp.selectionEnd = inp.value.length; }
        }
        if (e.target.id === 'exercise-duration-input' && selectedExercise) {
            var dur = parseInt(e.target.value, 10) || 0;
            var preview = document.getElementById('exercise-cal-preview');
            if (preview) {
                preview.textContent = '≈ ' + _calcCalories(selectedExercise.met, dur) + ' kcal';
            }
        }
    }

    function _handleSubmit(e) {
        if (e.target.id === 'custom-exercise-form') {
            e.preventDefault();
            _submitCustomForm(e.target);
        }
    }

    /* ───────── public ───────── */

    function init() {
        container = document.getElementById(PAGE_ID);
        if (container) {
            container.addEventListener('click', _handleClick);
            container.addEventListener('input', _handleInput);
            container.addEventListener('submit', _handleSubmit);
        }
    }

    function render() {
        if (!container) container = document.getElementById(PAGE_ID);
        if (!container) return;

        var today = NutriApp.getCurrentDate();
        var dateStr = NutriStorage.formatDate(today);
        var exercises = NutriStorage.getExerciseLog(today) || [];
        var filtered = _filteredExercises();

        container.innerHTML =
            _buildHeader(dateStr) +
            _buildSummaryCard(exercises) +
            _buildCategoryChips() +
            _buildSearchInput() +
            _buildExerciseGrid(filtered) +
            _buildTodaysExercises(exercises) +
            _buildCustomExercise();
    }

    return { init: init, render: render };

})();
