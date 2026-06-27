'use strict';

/**
 * NutriStorage — localStorage persistence layer for NutriTrack
 * Revealing module pattern (IIFE) exposed on window.NutriStorage
 *
 * All keys are prefixed with 'nutritrack_' to avoid collisions.
 * Every public read method wraps JSON.parse in try/catch so
 * corrupted data never crashes the app.
 */
window.NutriStorage = (function () {

  /* ───────────────────── Constants ───────────────────── */

  const PREFIX = 'nutritrack_';
  const KEYS = {
    settings:      PREFIX + 'user_settings',
    foodLog:       PREFIX + 'food_log_',       // + YYYY-MM-DD
    exerciseLog:   PREFIX + 'exercise_log_',   // + YYYY-MM-DD
    savedMeals:    PREFIX + 'saved_meals',
    nutritionCache: PREFIX + 'nutrition_cache',
  };

  const DEFAULT_SETTINGS = {
    dailyCalorieGoal: 2000,
    name: '',
    weight: 70,
    height: 170,
    age: 25,
    activityLevel: 'moderate',
    geminiApiKey: '',
  };

  /* ───────────────── Internal helpers ────────────────── */

  function _read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? null : JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function _write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      if (window.NutriSync && typeof window.NutriSync.onLocalWrite === 'function') {
        window.NutriSync.onLocalWrite(key, value);
      }
    } catch (_) {
      console.warn('[NutriStorage] Could not write to localStorage (quota?).');
    }
  }

  function _remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (_) { /* noop */ }
  }

  /* ──────────────── ID / Date utilities ─────────────── */

  function generateId() {
    // RFC-4122-ish v4 UUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getTodayDate() {
    return formatDate(new Date());
  }

  function formatDate(date) {
    if (typeof date === 'string') return date; // already formatted
    var d = new Date(date);
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  /* ───────────────── User Settings ──────────────────── */

  function getUserSettings() {
    var stored = _read(KEYS.settings);
    // Merge with defaults so new fields are always present
    return Object.assign({}, DEFAULT_SETTINGS, stored || {});
  }

  function saveUserSettings(settings) {
    var merged = Object.assign({}, DEFAULT_SETTINGS, settings);
    _write(KEYS.settings, merged);
  }

  /* ──────────────────── Food Log ─────────────────────── */

  function _foodKey(date) {
    return KEYS.foodLog + formatDate(date);
  }

  function getFoodLog(date) {
    return _read(_foodKey(date)) || [];
  }

  function addFoodEntry(date, entry) {
    var log = getFoodLog(date);
    entry.id = entry.id || generateId();
    entry.timestamp = entry.timestamp || new Date().toISOString();
    log.push(entry);
    _write(_foodKey(date), log);
    return entry;
  }

  function updateFoodEntry(date, entryId, updates) {
    var log = getFoodLog(date);
    for (var i = 0; i < log.length; i++) {
      if (log[i].id === entryId) {
        log[i] = Object.assign({}, log[i], updates, { id: entryId });
        break;
      }
    }
    _write(_foodKey(date), log);
  }

  function removeFoodEntry(date, entryId) {
    var log = getFoodLog(date).filter(function (e) { return e.id !== entryId; });
    _write(_foodKey(date), log);
  }

  /* ────────────────── Exercise Log ──────────────────── */

  function _exerciseKey(date) {
    return KEYS.exerciseLog + formatDate(date);
  }

  function getExerciseLog(date) {
    return _read(_exerciseKey(date)) || [];
  }

  function addExerciseEntry(date, entry) {
    var log = getExerciseLog(date);
    entry.id = entry.id || generateId();
    entry.timestamp = entry.timestamp || new Date().toISOString();
    log.push(entry);
    _write(_exerciseKey(date), log);
    return entry;
  }

  function removeExerciseEntry(date, entryId) {
    var log = getExerciseLog(date).filter(function (e) { return e.id !== entryId; });
    _write(_exerciseKey(date), log);
  }

  /* ─────────────────── Saved Meals ──────────────────── */

  function getSavedMeals() {
    return _read(KEYS.savedMeals) || [];
  }

  function addSavedMeal(meal) {
    var meals = getSavedMeals();
    meal.id = meal.id || generateId();
    meal.createdAt = meal.createdAt || new Date().toISOString();
    meals.push(meal);
    _write(KEYS.savedMeals, meals);
    return meal;
  }

  function updateSavedMeal(mealId, updates) {
    var meals = getSavedMeals();
    for (var i = 0; i < meals.length; i++) {
      if (meals[i].id === mealId) {
        meals[i] = Object.assign({}, meals[i], updates, { id: mealId });
        break;
      }
    }
    _write(KEYS.savedMeals, meals);
  }

  function removeSavedMeal(mealId) {
    var meals = getSavedMeals().filter(function (m) { return m.id !== mealId; });
    _write(KEYS.savedMeals, meals);
  }

  /* ─────────────── History / Analytics ───────────────── */

  function getDateRange(startDate, endDate) {
    var result = {};
    var cur = new Date(startDate);
    var end = new Date(endDate);
    while (cur <= end) {
      var key = formatDate(cur);
      result[key] = {
        food: getFoodLog(key),
        exercise: getExerciseLog(key),
      };
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }

  function getAllDatesWithData() {
    var dates = [];
    var seen = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k) continue;
      var match;
      if (k.indexOf(KEYS.foodLog) === 0) {
        match = k.substring(KEYS.foodLog.length);
      } else if (k.indexOf(KEYS.exerciseLog) === 0) {
        match = k.substring(KEYS.exerciseLog.length);
      }
      if (match && !seen[match]) {
        seen[match] = true;
        dates.push(match);
      }
    }
    return dates.sort();
  }

  /* ──────────────── Nutrition Cache ─────────────────── */

  function _getCache() {
    return _read(KEYS.nutritionCache) || {};
  }

  function getCachedNutrition(foodName) {
    var cache = _getCache();
    var key = foodName.trim().toLowerCase();
    return cache[key] || null;
  }

  function setCachedNutrition(foodName, data) {
    var cache = _getCache();
    cache[foodName.trim().toLowerCase()] = data;
    _write(KEYS.nutritionCache, cache);
  }

  /* ───────────────── Export / Import ─────────────────── */

  function exportAllData() {
    var data = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) {
        data[k] = _read(k);
      }
    }
    return JSON.stringify(data, null, 2);
  }

  function importData(jsonString) {
    try {
      var data = JSON.parse(jsonString);
      if (typeof data !== 'object' || data === null) return false;
      Object.keys(data).forEach(function (k) {
        if (k.indexOf(PREFIX) === 0) {
          _write(k, data[k]);
        }
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  /* ─────────────────── Public API ────────────────────── */

  return {
    // User Settings
    getUserSettings: getUserSettings,
    saveUserSettings: saveUserSettings,

    // Food Log
    getFoodLog: getFoodLog,
    addFoodEntry: addFoodEntry,
    updateFoodEntry: updateFoodEntry,
    removeFoodEntry: removeFoodEntry,

    // Exercise Log
    getExerciseLog: getExerciseLog,
    addExerciseEntry: addExerciseEntry,
    removeExerciseEntry: removeExerciseEntry,

    // Saved Meals
    getSavedMeals: getSavedMeals,
    addSavedMeal: addSavedMeal,
    updateSavedMeal: updateSavedMeal,
    removeSavedMeal: removeSavedMeal,

    // History / Analytics
    getDateRange: getDateRange,
    getAllDatesWithData: getAllDatesWithData,

    // Nutrition Cache
    getCachedNutrition: getCachedNutrition,
    setCachedNutrition: setCachedNutrition,

    // Export / Import
    exportAllData: exportAllData,
    importData: importData,

    // Utilities
    generateId: generateId,
    getTodayDate: getTodayDate,
    formatDate: formatDate,
  };

})();
