'use strict';

/**
 * NutritionAI — Gemini API integration for NutriTrack
 * Analyses a free-text food description and returns structured
 * nutrition data (calories, macros, vitamins, minerals).
 *
 * Depends on: window.NutriStorage
 */
window.NutritionAI = (function () {

  /* ───────────────── Constants ──────────────────────── */

  var ENDPOINT =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

  var MODELS_TO_TRY = [
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-1.5-flash-lite',
    'gemini-flash-latest'
  ];

  var _cachedModelName = null;
  try {
    _cachedModelName = localStorage.getItem('nutritrack_last_working_model');
  } catch (_) {}

  var MIN_REQUEST_GAP_MS = 4000; // 4 seconds between calls
  var _lastRequestTime = 0;

  /* ─────────────── System prompt ────────────────────── */

  var SYSTEM_PROMPT = [
    'You are a highly accurate nutrition database. ',
    'The user will describe a food item or meal combination. ',
    'Respond with ONLY valid JSON (no markdown, no explanation) matching this exact schema:\n\n',
    '{\n',
    '  "name": "cleaned overall food description",\n',
    '  "description": "original query description of the food/combination",\n',
    '  "calories": <total combined calories>,\n',
    '  "protein": <total combined protein in grams>,\n',
    '  "carbs": <total combined carbs in grams>,\n',
    '  "fat": <total combined fat in grams>,\n',
    '  "fiber": <total combined fiber in grams>,\n',
    '  "sugar": <total combined sugar in grams>,\n',
    '  "vitamins": { "A": <% DV>, "B6": <% DV>, "B12": <% DV>, "C": <% DV>, "D": <% DV>, "E": <% DV>, "K": <% DV> },\n',
    '  "minerals": { "iron": <% DV>, "calcium": <% DV>, "potassium": <% DV>, "magnesium": <% DV>, "zinc": <% DV>, "sodium": <% DV> },\n',
    '  "servingSize": <number>,\n',
    '  "servingUnit": "<g, ml, oz, piece, cup, etc.>",\n',
    '  "subItems": [\n',
    '    {\n',
    '      "name": "cleaned single food item name with serving size (e.g. Khaman (5 pieces))",\n',
    '      "calories": <number>,\n',
    '      "protein": <grams>,\n',
    '      "carbs": <grams>,\n',
    '      "fat": <grams>\n',
    '    }\n',
    '  ]\n',
    '}\n\n',
    'Rules:\n',
    '- If the query contains multiple distinct foods (e.g. "5 khaman with sev and chatni"), break them down into separate objects in the "subItems" array. Sum their calories, protein, carbs, fat, fiber, sugar to calculate the top-level values.\n',
    '- If it is a single food, the "subItems" array should contain exactly one item (the food itself).\n',
    '- All vitamin and mineral values are percentage of daily recommended value (0-100+).\n',
    '- Use realistic database values.\n',
    '- All numeric fields must be numbers, not strings.\n',
    '- Do NOT wrap the JSON in code fences or add any other text.'
  ].join('');

  /* ──────────────── Helpers ─────────────────────────── */

  function _multiplyByServings(data, servings) {
    if (servings === 1) return data;
    var s = servings;
    var result = {
      name: data.name,
      description: data.description,
      calories:    Math.round(data.calories * s),
      protein:     Math.round(data.protein * s * 10) / 10,
      carbs:       Math.round(data.carbs * s * 10) / 10,
      fat:         Math.round(data.fat * s * 10) / 10,
      fiber:       Math.round(data.fiber * s * 10) / 10,
      sugar:       Math.round(data.sugar * s * 10) / 10,
      vitamins: {
        A:   Math.round((data.vitamins.A || 0) * s),
        B6:  Math.round((data.vitamins.B6 || 0) * s),
        B12: Math.round((data.vitamins.B12 || 0) * s),
        C:   Math.round((data.vitamins.C || 0) * s),
        D:   Math.round((data.vitamins.D || 0) * s),
        E:   Math.round((data.vitamins.E || 0) * s),
        K:   Math.round((data.vitamins.K || 0) * s),
      },
      minerals: {
        iron:      Math.round((data.minerals.iron || 0) * s),
        calcium:   Math.round((data.minerals.calcium || 0) * s),
        potassium: Math.round((data.minerals.potassium || 0) * s),
        magnesium: Math.round((data.minerals.magnesium || 0) * s),
        zinc:      Math.round((data.minerals.zinc || 0) * s),
        sodium:    Math.round((data.minerals.sodium || 0) * s),
      },
      servingSize: Math.round(data.servingSize * s * 10) / 10,
      servingUnit: data.servingUnit,
    };

    if (data.subItems && Array.isArray(data.subItems)) {
      result.subItems = data.subItems.map(function(item) {
        return {
          name: item.name,
          calories: Math.round(item.calories * s),
          carbs: Math.round(item.carbs * s * 10) / 10,
          protein: Math.round(item.protein * s * 10) / 10,
          fat: Math.round(item.fat * s * 10) / 10
        };
      });
    }

    return result;
  }

  function _sanitiseResponse(raw) {
    // Ensure every expected field exists with a safe default
    var defaults = {
      name: 'Unknown food',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      vitamins: { A: 0, B6: 0, B12: 0, C: 0, D: 0, E: 0, K: 0 },
      minerals: { iron: 0, calcium: 0, potassium: 0, magnesium: 0, zinc: 0, sodium: 0 },
      servingSize: 100,
      servingUnit: 'g',
    };

    var out = Object.assign({}, defaults, raw);
    out.vitamins = Object.assign({}, defaults.vitamins, raw.vitamins || {});
    out.minerals = Object.assign({}, defaults.minerals, raw.minerals || {});

    if (raw.subItems && Array.isArray(raw.subItems)) {
      out.subItems = raw.subItems.map(function(item) {
        return {
          name: item.name || 'Food item',
          calories: Number(item.calories) || 0,
          carbs: Number(item.carbs) || 0,
          protein: Number(item.protein) || 0,
          fat: Number(item.fat) || 0
        };
      });
    } else {
      out.subItems = [];
    }

    // Coerce values to numbers
    ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'servingSize'].forEach(function (k) {
      out[k] = Number(out[k]) || 0;
    });
    Object.keys(out.vitamins).forEach(function (k) {
      out.vitamins[k] = Number(out.vitamins[k]) || 0;
    });
    Object.keys(out.minerals).forEach(function (k) {
      out.minerals[k] = Number(out.minerals[k]) || 0;
    });
    return out;
  }

  async function _waitForRateLimit() {
    var now = Date.now();
    var elapsed = now - _lastRequestTime;
    if (elapsed < MIN_REQUEST_GAP_MS) {
      var wait = MIN_REQUEST_GAP_MS - elapsed;
      await new Promise(function (resolve) { setTimeout(resolve, wait); });
    }
  }

  /* ──────────────── Public API ──────────────────────── */

  function isConfigured() {
    var key = getApiKey();
    return typeof key === 'string' && key.trim().length > 0;
  }

  function getApiKey() {
    return (window.NutriStorage.getUserSettings().geminiApiKey || '').trim();
  }

  /**
   * Analyse a food description and return partial FoodEntry data
   * (no id, meal, or timestamp — those are added by the caller).
   *
   * @param {string} foodDescription  Free-text e.g. "2 scrambled eggs with toast"
   * @param {number} [servings=1]     Multiplier for nutrition values
   * @returns {Promise<Object>}       Partial FoodEntry
   */
  async function analyze(foodDescription, servings) {
    if (servings === undefined || servings === null) servings = 1;
    servings = Math.max(0.01, Number(servings) || 1);

    var descNorm = foodDescription.trim();
    if (!descNorm) {
      throw new Error('Food description cannot be empty.');
    }

    /* ── 1. Check cache ──────────────────────────────── */
    var cached = window.NutriStorage.getCachedNutrition(descNorm);
    if (cached) {
      return _multiplyByServings(cached, servings);
    }

    /* ── 2. Validate API key ─────────────────────────── */
    if (!isConfigured()) {
      throw new Error(
        'Gemini API key is not configured. Please add your API key in Settings.'
      );
    }

    /* ── 3. Rate-limit ───────────────────────────────── */
    await _waitForRateLimit();

    /* ── 4. Build request ────────────────────────────── */
    var apiKey = getApiKey();
    var body = {
      contents: [
        {
          parts: [
            {
              text: SYSTEM_PROMPT + '\n\nFood: ' + descNorm,
            },
          ],
        },
      ],
    };

    /* ── 5. Try models with fallbacks ────────────────── */
    var modelsToTry = MODELS_TO_TRY.slice();
    if (_cachedModelName) {
      var idx = modelsToTry.indexOf(_cachedModelName);
      if (idx !== -1) modelsToTry.splice(idx, 1);
      modelsToTry.unshift(_cachedModelName);
    }

    var response;
    var successModel = null;
    var lastError = null;
    var lastRateLimitError = null;

    for (var i = 0; i < modelsToTry.length; i++) {
      var modelName = modelsToTry[i];
      // Try v1beta first, if we get 404 try v1
      var endpoints = [
        'https://generativelanguage.googleapis.com/v1beta/models/' + modelName + ':generateContent',
        'https://generativelanguage.googleapis.com/v1/models/' + modelName + ':generateContent'
      ];

      for (var j = 0; j < endpoints.length; j++) {
        var url = endpoints[j] + '?key=' + encodeURIComponent(apiKey);
        try {
          _lastRequestTime = Date.now();
          response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

          if (response.ok) {
            successModel = modelName;
            _cachedModelName = modelName;
            try {
              localStorage.setItem('nutritrack_last_working_model', modelName);
            } catch (_) {}
            break;
          }

          if (!response.ok) {
            var status = response.status;
            var errMsg = 'API request failed with status ' + status + '.';
            try {
              var errJson = await response.json();
              if (errJson && errJson.error && errJson.error.message) {
                errMsg = errJson.error.message;
              }
            } catch (_) {}

            if (status === 404) {
              lastError = new Error('Model ' + modelName + ' not found: ' + errMsg);
              continue;
            } else if (status === 429) {
              lastRateLimitError = new Error('Rate limit: ' + errMsg);
              continue; // Keep trying other models in case they are free
            } else if (status === 401 || status === 403) {
              throw new Error('Invalid or unauthorised API key. Please check your Gemini API key in Settings.');
            } else if (status === 400) {
              throw new Error('Bad request: ' + errMsg);
            } else if (status >= 500) {
              lastError = new Error('Gemini API server error (' + status + '): ' + errMsg);
              continue;
            }
            throw new Error(errMsg);
          }
        } catch (err) {
          if (err.message.indexOf('Invalid or unauthorised') !== -1 || 
              err.message.indexOf('Bad request') !== -1) {
            throw err;
          }
          if (err.message.indexOf('Rate limit') !== -1) {
            lastRateLimitError = err;
          } else {
            lastError = err;
          }
        }
      }

      if (successModel) break;
    }

    if (!successModel || !response) {
      // Debug: query available models to see what the API key has access to in case of complete failure
      try {
        var debugUrl = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(apiKey);
        fetch(debugUrl).then(function(r) { return r.json(); }).then(function(data) {
          console.log('[NutriTrack Debug] Available models for this key:', data);
        }).catch(function(err) {
          console.warn('[NutriTrack Debug] Could not list models:', err);
        });
      } catch(_) {}

      throw lastRateLimitError || lastError || new Error('Failed to connect to any Gemini models.');
    }

    /* ── 7. Parse response ───────────────────────────── */
    var json;
    try {
      json = await response.json();
    } catch (_) {
      throw new Error('Failed to parse API response.');
    }

    var text = '';
    try {
      text = json.candidates[0].content.parts[0].text;
    } catch (_) {
      throw new Error('Unexpected API response structure.');
    }

    var parsed;
    try {
      // Strip potential markdown code fences just in case
      var clean = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(clean);
    } catch (_) {
      throw new Error('The AI returned invalid JSON. Please try again.');
    }

    /* ── 8. Sanitise, cache, multiply ────────────────── */
    var nutritionData = _sanitiseResponse(parsed);

    // Cache the base (1-serving) data
    window.NutriStorage.setCachedNutrition(descNorm, nutritionData);

    return _multiplyByServings(nutritionData, servings);
  }

  /**
   * Analyse a natural language input that could be food or exercise,
   * classify it, and return structured data.
   */
  async function analyzeGlobal(description, weight) {
    if (weight === undefined || weight === null) weight = 70;
    
    var descNorm = description.trim();
    if (!descNorm) {
      throw new Error('Description cannot be empty.');
    }

    if (!isConfigured()) {
      throw new Error('Gemini API key is not configured. Please add your API key in Settings.');
    }

    await _waitForRateLimit();

    var apiKey = getApiKey();
    var globalPrompt = [
      'You are a calorie tracking assistant. The user will describe either a food item/meal they ate, or an exercise/activity they performed. ',
      'Classify the input as either "food" or "exercise". ',
      'Respond with ONLY valid JSON (no markdown, no explanation) matching this exact schema:\n\n',
      'If it is food:\n',
      '{\n',
      '  "type": "food",\n',
      '  "data": {\n',
      '    "name": "cleaned food name",\n',
      '    "calories": <number>,\n',
      '    "protein": <grams as number>,\n',
      '    "carbs": <grams as number>,\n',
      '    "fat": <grams as number>,\n',
      '    "fiber": <grams as number>,\n',
      '    "sugar": <grams as number>,\n',
      '    "vitamins": { "A": <% DV>, "B6": <% DV>, "B12": <% DV>, "C": <% DV>, "D": <% DV>, "E": <% DV>, "K": <% DV> },\n',
      '    "minerals": { "iron": <% DV>, "calcium": <% DV>, "potassium": <% DV>, "magnesium": <% DV>, "zinc": <% DV>, "sodium": <% DV> },\n',
      '    "servingSize": <number>,\n',
      '    "servingUnit": "g"\n',
      '  }\n',
      '}\n\n',
      'If it is exercise (calculate calories burned using standard MET value for user weight ' + weight + ' kg and duration if not explicitly mentioned by user):\n',
      '{\n',
      '  "type": "exercise",\n',
      '  "data": {\n',
      '    "name": "cleaned exercise name",\n',
      '    "duration": <minutes as number>,\n',
      '    "caloriesBurned": <calories burned as number>,\n',
      '    "category": "<cardio, strength, flexibility, or sports>"\n',
      '  }\n',
      '}\n\n',
      'Rules:\n',
      '- Return ONLY valid JSON.\n',
      '- All nutrient values must be numbers, not strings.\n',
      '- Be realistic and accurate.'
    ].join('');

    var body = {
      contents: [
        {
          parts: [
            {
              text: globalPrompt + '\n\nInput: ' + descNorm,
            },
          ],
        },
      ],
    };

    var response;
    var successModel = null;
    var lastError = null;
    var lastRateLimitError = null;

    var modelsToTry = MODELS_TO_TRY.slice();
    if (_cachedModelName) {
      var idx = modelsToTry.indexOf(_cachedModelName);
      if (idx !== -1) modelsToTry.splice(idx, 1);
      modelsToTry.unshift(_cachedModelName);
    }

    for (var i = 0; i < modelsToTry.length; i++) {
      var modelName = modelsToTry[i];
      var endpoints = [
        'https://generativelanguage.googleapis.com/v1beta/models/' + modelName + ':generateContent',
        'https://generativelanguage.googleapis.com/v1/models/' + modelName + ':generateContent'
      ];

      for (var j = 0; j < endpoints.length; j++) {
        var url = endpoints[j] + '?key=' + encodeURIComponent(apiKey);
        try {
          _lastRequestTime = Date.now();
          response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

          if (response.ok) {
            successModel = modelName;
            _cachedModelName = modelName;
            try {
              localStorage.setItem('nutritrack_last_working_model', modelName);
            } catch (_) {}
            break;
          }

          if (!response.ok) {
            var status = response.status;
            var errMsg = 'API request failed with status ' + status + '.';
            try {
              var errJson = await response.json();
              if (errJson && errJson.error && errJson.error.message) {
                errMsg = errJson.error.message;
              }
            } catch (_) {}

            if (status === 404) {
              lastError = new Error('Model ' + modelName + ' not found: ' + errMsg);
              continue;
            } else if (status === 429) {
              lastRateLimitError = new Error('Rate limit: ' + errMsg);
              continue;
            } else if (status === 401 || status === 403) {
              throw new Error('Invalid or unauthorised API key. Please check your Gemini API key in Settings.');
            } else if (status === 400) {
              throw new Error('Bad request: ' + errMsg);
            } else if (status >= 500) {
              lastError = new Error('Gemini API server error (' + status + '): ' + errMsg);
              continue;
            }
            throw new Error(errMsg);
          }
        } catch (err) {
          if (err.message.indexOf('Invalid or unauthorised') !== -1 || 
              err.message.indexOf('Bad request') !== -1) {
            throw err;
          }
          if (err.message.indexOf('Rate limit') !== -1) {
            lastRateLimitError = err;
          } else {
            lastError = err;
          }
        }
      }

      if (successModel) break;
    }

    if (!successModel || !response) {
      throw lastRateLimitError || lastError || new Error('Failed to connect to any Gemini models.');
    }

    var json = await response.json();
    var textResponse = json.candidates[0].content.parts[0].text;
    var clean = textResponse.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    var parsed = JSON.parse(clean);
    
    if (parsed.type === 'food') {
      parsed.data = _sanitiseResponse(parsed.data);
    }
    
    return parsed;
  }

  /* ─────────────────── Expose ───────────────────────── */

  return {
    analyze: analyze,
    analyzeGlobal: analyzeGlobal,
    isConfigured: isConfigured,
    getApiKey: getApiKey,
  };

})();
