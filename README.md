# 🍎 NutriTrack — AI Calorie & Nutrition Tracker

NutriTrack is a premium, single-page web application that leverages Google Gemini AI to analyze your meals in natural language, tracking calories, macronutrients, and micronutrients over time, alongside exercise logs, custom charts, and trend reports.

## ✨ Features

- **🤖 AI-Powered Food Logging**: Type what you ate in plain English (e.g., `"2 rotis with paneer butter masala and a cup of curd"` or `"double shot latte with oat milk and half avocado toast"`). The app calls Gemini 2.0 Flash to return full macro/micro breakdown.
- **📊 Interactive SVG Charts**:
  - Calorie Ring progress indicator
  - Macro ratio breakdown (Protein / Carbs / Fat)
  - 13 detailed Micronutrient (Vitamins & Minerals) tracking bars showing percentage of recommended daily value
  - Daily calorie line charts and macro trend stacked bar charts
  - GitHub-style contributions heatmap of calorie adherence
- **🏃 Exercise Tracker**: Choose from over 50 activities or add custom exercises. Uses MET values multiplied by your weight to estimate calories burned.
- **🍱 Saved Meals & Meal Planner**: Save complex meal logs as templates (e.g., "Standard Breakfast") and log them later with a single click.
- **💾 Local Persistence & Privacy**: All data is saved in your browser's `localStorage`. No accounts or server database needed. Your Gemini API key is stored locally and sent only directly to Google AI Studio.
- **📱 Responsive Glassmorphic Dark UI**: Modern dark theme with transparent, blurred cards, smooth transition animations, and a layout optimized for both desktop and mobile viewports.

---

## 🚀 How to Run

Since NutriTrack is built with standard, dependency-free HTML, CSS, and JavaScript, you can run it in two ways:

### Option A: Double-Click (No setup)
Simply open the `index.html` file in any modern web browser!

### Option B: Local Web Server (Recommended)
Running through a local web server ensures standard environment behavior:
1. Make sure you have [Node.js](https://nodejs.org/) installed.
2. Run the dev server script:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your web browser.

---

## 🔑 Setting up the Gemini API Key

To use the AI-powered food entry feature, you will need a Gemini API Key:
1. Visit [Google AI Studio](https://aistudio.google.com/apikey).
2. Click **Create API Key**.
3. Copy the key.
4. In NutriTrack, click **Settings** (bottom nav on mobile, sidebar bottom on desktop).
5. Paste your API key into the **Gemini API Key** field and click **Save Settings**.

---

## 📂 File Structure

```
Calorie tracker/
├── index.html              # Main application shell
├── package.json            # Dev server configuration
├── README.md               # Setup and documentation
├── css/
│   ├── design-system.css   # Variables, typography, keyframes, and utilities
│   ├── components.css      # Reusable styled widgets (buttons, cards, forms, rings)
│   └── pages.css           # Grid layouts and viewport responsiveness
└── js/
    ├── app.js              # SPA router, settings manager, and app initializer
    ├── storage.js          # localStorage data serialization layer
    ├── api.js              # Google Gemini AI connection and caching
    ├── charts.js           # Lightweight custom SVG/Canvas charting library
    ├── dashboard.js        # Main summary page with calorie progress and timeline
    ├── food-log.js         # Food logs, AI analyzer, manual and quick re-logs
    ├── exercise-log.js     # Activity finder, MET-based burn calculator, and logs
    ├── meal-planner.js     # Saved meals builder and quick-logging
    ├── history.js          # Weekly/monthly trend lines, stacked bars, and heatmap
    └── nutrients.js        # Detailed macro ratios and micronutrient analysis
```
