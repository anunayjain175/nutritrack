'use strict';

/**
 * NutriApp — Main application controller
 * Handles routing, global state, settings modal, and toast notifications.
 */
window.NutriApp = (function () {
    // ─── State ───────────────────────────────────
    let currentPage = 'dashboard';
    let currentDate = null; // YYYY-MM-DD

    // Page module references
    const pages = {
        'dashboard':  () => window.DashboardPage,
        'food-log':   () => window.FoodLogPage,
        'exercise':   () => window.ExerciseLogPage,
        'meals':      () => window.MealPlannerPage,
        'history':    () => window.HistoryPage,
        'nutrients':  () => window.NutrientsPage,
    };

    // ─── Routing ─────────────────────────────────
    function showPage(pageId) {
        if (!pages[pageId]) return;
        currentPage = pageId;

        // Update page sections visibility
        document.querySelectorAll('.page-section').forEach(section => {
            section.classList.remove('active');
        });
        const target = document.getElementById('page-' + pageId);
        if (target) {
            target.classList.add('active');
        }

        // Update sidebar active state
        document.querySelectorAll('.sidebar-link[data-page]').forEach(link => {
            link.classList.toggle('active', link.dataset.page === pageId);
        });

        // Update bottom nav active state
        document.querySelectorAll('.bottom-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === pageId);
        });

        // Render the page module
        const mod = pages[pageId]();
        if (mod && typeof mod.render === 'function') {
            mod.render();
        }

        // Scroll to top
        const mainContent = document.getElementById('main-content');
        if (mainContent) mainContent.scrollTop = 0;
    }

    function navigate(pageId) {
        window.location.hash = pageId;
    }

    function handleHashChange() {
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        const pageMap = {
            'dashboard': 'dashboard',
            'food': 'food-log',
            'exercise': 'exercise',
            'meals': 'meals',
            'history': 'history',
            'nutrients': 'nutrients',
        };
        const pageId = pageMap[hash] || 'dashboard';
        showPage(pageId);
    }

    // ─── Date Management ─────────────────────────
    function getCurrentDate() {
        return currentDate || NutriStorage.getTodayDate();
    }

    function setCurrentDate(dateStr) {
        currentDate = dateStr;
    }

    // ─── Toast Notifications ─────────────────────
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
            warning: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" aria-label="Dismiss">&times;</button>
        `;

        container.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('toast-show');
        });

        // Close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            dismissToast(toast);
        });

        // Auto-dismiss after 4 seconds
        setTimeout(() => dismissToast(toast), 4000);
    }

    function dismissToast(toast) {
        toast.classList.remove('toast-show');
        toast.classList.add('toast-hide');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }

    // ─── Settings Modal ──────────────────────────
    function openSettingsModal() {
        const modal = document.getElementById('modal-settings');
        if (!modal) return;

        const settings = NutriStorage.getUserSettings();

        document.getElementById('setting-name').value = settings.name || '';
        document.getElementById('setting-calorie-goal').value = settings.dailyCalorieGoal || 2000;
        document.getElementById('setting-weight').value = settings.weight || 70;
        document.getElementById('setting-height').value = settings.height || 170;
        document.getElementById('setting-age').value = settings.age || 25;
        document.getElementById('setting-activity').value = settings.activityLevel || 'moderate';
        document.getElementById('setting-api-key').value = settings.geminiApiKey || '';
        
        const configTextarea = document.getElementById('setting-firebase-config');
        if (configTextarea) {
            configTextarea.value = typeof settings.firebaseConfig === 'object'
                ? JSON.stringify(settings.firebaseConfig, null, 2)
                : (settings.firebaseConfig || '');
        }
        updateSettingsFirebaseUI();

        modal.style.display = 'flex';
        requestAnimationFrame(() => modal.classList.add('modal-visible'));
    }

    function closeSettingsModal() {
        const modal = document.getElementById('modal-settings');
        if (!modal) return;
        modal.classList.remove('modal-visible');
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    }

    function saveSettings() {
        let configVal = document.getElementById('setting-firebase-config').value.trim();
        let firebaseConfig = '';
        if (configVal) {
            // Clean up wrappers like "const firebaseConfig = " and trailing semicolon
            configVal = configVal.replace(/^(const|let|var)\s+\w+\s*=\s*/i, '');
            configVal = configVal.replace(/;\s*$/, '');
            if (!configVal.startsWith('{')) {
                configVal = '{' + configVal + '}';
            }
            try {
                const parsed = new Function("return (" + configVal + ")")();
                if (parsed && typeof parsed === 'object') {
                    firebaseConfig = parsed;
                }
            } catch (e) {
                firebaseConfig = configVal;
            }
        }

        const settings = {
            name: document.getElementById('setting-name').value.trim(),
            dailyCalorieGoal: parseInt(document.getElementById('setting-calorie-goal').value) || 2000,
            weight: parseFloat(document.getElementById('setting-weight').value) || 70,
            height: parseFloat(document.getElementById('setting-height').value) || 170,
            age: parseInt(document.getElementById('setting-age').value) || 25,
            activityLevel: document.getElementById('setting-activity').value || 'moderate',
            geminiApiKey: document.getElementById('setting-api-key').value.trim(),
            firebaseConfig: firebaseConfig
        };

        NutriStorage.saveUserSettings(settings);
        closeSettingsModal();
        showToast('Settings saved!', 'success');

        // Re-render current page to reflect new settings
        showPage(currentPage);
    }

    // ─── Data Export/Import ──────────────────────
    function exportData() {
        try {
            const data = NutriStorage.exportAllData();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `nutritrack-backup-${NutriStorage.getTodayDate()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Data exported successfully!', 'success');
        } catch (e) {
            showToast('Export failed: ' + e.message, 'error');
        }
    }

    function importData() {
        document.getElementById('import-file-input').click();
    }

    function handleImportFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (event) {
            try {
                const success = NutriStorage.importData(event.target.result);
                if (success) {
                    showToast('Data imported successfully!', 'success');
                    showPage(currentPage);
                } else {
                    showToast('Import failed: invalid data format.', 'error');
                }
            } catch (err) {
                showToast('Import failed: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset file input
    }

    // ─── First-Run Welcome ───────────────────────
    function checkFirstRun() {
        const settings = NutriStorage.getUserSettings();
        if (!settings.geminiApiKey) {
            // Delay the settings prompt slightly so user sees the app first
            setTimeout(() => {
                showToast('Welcome to NutriTrack! Add your Gemini API key in Settings to get started.', 'info');
            }, 1500);
        }
    }

    // ─── Event Binding ───────────────────────────
    function bindEvents() {
        // Navigation - sidebar
        document.querySelectorAll('.sidebar-link[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                navigate(link.dataset.page === 'food-log' ? 'food' : link.dataset.page);
            });
        });

        // Navigation - bottom nav
        document.querySelectorAll('.bottom-nav-item[data-page]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                navigate(item.dataset.page === 'food-log' ? 'food' : item.dataset.page);
            });
        });

        // Settings modal
        const settingsBtns = [
            document.getElementById('nav-settings-sidebar'),
            document.getElementById('bnav-settings')
        ];
        settingsBtns.forEach(btn => {
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    openSettingsModal();
                });
            }
        });

        document.getElementById('close-settings-modal')?.addEventListener('click', closeSettingsModal);
        document.getElementById('btn-save-settings')?.addEventListener('click', saveSettings);

        // Close modal on overlay click
        document.getElementById('modal-settings')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                closeSettingsModal();
            }
        });

        // Export/Import
        document.getElementById('btn-export-data')?.addEventListener('click', exportData);
        document.getElementById('btn-import-data')?.addEventListener('click', importData);
        document.getElementById('import-file-input')?.addEventListener('change', handleImportFile);

        // Hash change routing
        window.addEventListener('hashchange', handleHashChange);

        // Global chat input handlers
        document.getElementById('global-chat-submit-btn')?.addEventListener('click', handleGlobalChatSubmit);
        document.getElementById('global-chat-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleGlobalChatSubmit();
            }
        });

        // Event delegation for grouped food card action triggers (pencil and 3 dots ⋮)
        document.body.addEventListener('click', (e) => {
            const pencilBtn = e.target.closest('[data-action="edit-food-pencil"]');
            const optionsBtn = e.target.closest('[data-action="show-food-options"]');
            
            if (pencilBtn) {
                const card = pencilBtn.closest('.grouped-food-card');
                if (card) {
                    const id = card.dataset.id;
                    const date = getCurrentDate();
                    const foodLog = NutriStorage.getFoodLog(date) || [];
                    const entry = foodLog.find(item => item.id === id);
                    if (entry) {
                        openManualEntryModalForEdit(entry, date);
                    }
                }
                return;
            }
            
            if (optionsBtn) {
                const card = optionsBtn.closest('.grouped-food-card');
                if (card) {
                    const id = card.dataset.id;
                    const date = getCurrentDate();
                    showBottomSheetMenu(id, date);
                }
                return;
            }
        });

        // Bottom sheet menu overlay click & options selection
        document.getElementById('bottom-sheet-menu')?.addEventListener('click', (e) => {
            if (e.target.id === 'bottom-sheet-menu' || e.target.closest('.bottom-sheet__item')) {
                const item = e.target.closest('.bottom-sheet__item');
                if (item) {
                    const action = item.dataset.action;
                    handleBottomSheetAction(action);
                }
                closeBottomSheetMenu();
            }
        });

        // Edit food modal events
        document.getElementById('close-edit-food-modal')?.addEventListener('click', closeEditFoodModal);
        document.getElementById('edit-food-form')?.addEventListener('submit', saveEditedFood);

        // Keyboard: Escape closes modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeSettingsModal();
                closeEditFoodModal();
                closeBottomSheetMenu();
            }
        });

        // Firebase Cloud Sync UI Event Listeners
        window.addEventListener('nutri-auth-changed', () => {
            updateSettingsFirebaseUI();
        });

        document.getElementById('btn-connect-firebase')?.addEventListener('click', () => {
            let configVal = document.getElementById('setting-firebase-config').value.trim();
            if (!configVal) {
                showToast('Please paste a Firebase configuration.', 'warning');
                return;
            }
            
            // Clean up wrappers like "const firebaseConfig = " and trailing semicolon
            configVal = configVal.replace(/^(const|let|var)\s+\w+\s*=\s*/i, '');
            configVal = configVal.replace(/;\s*$/, '');
            if (!configVal.startsWith('{')) {
                configVal = '{' + configVal + '}';
            }

            try {
                const parsed = new Function("return (" + configVal + ")")();
                if (parsed && typeof parsed === 'object' && parsed.apiKey) {
                    const settings = NutriStorage.getUserSettings();
                    settings.firebaseConfig = parsed;
                    NutriStorage.saveUserSettings(settings);
                    
                    showToast('Connecting to Firebase...', 'info');
                    window.NutriSync.init();
                } else {
                    showToast('Invalid configuration: make sure "apiKey" is present.', 'error');
                }
            } catch (err) {
                showToast('Format error. Copy the entire config object starting with { and ending with }.', 'error');
            }
        });

        document.getElementById('btn-disconnect-firebase')?.addEventListener('click', () => {
            if (confirm('Disconnect Firebase cloud backup? This will reset your local database to empty logs.')) {
                window.NutriSync.disconnectConfig();
            }
        });

        document.getElementById('btn-toggle-auth-method')?.addEventListener('click', (e) => {
            const btn = e.target;
            const emailGroup = document.getElementById('email-auth-inputs');
            const phoneGroup = document.getElementById('phone-auth-inputs');
            if (!emailGroup || !phoneGroup) return;

            if (emailGroup.style.display === 'block' || emailGroup.style.display === '') {
                emailGroup.style.display = 'none';
                phoneGroup.style.display = 'block';
                btn.textContent = 'Switch to Email Sign-In';
            } else {
                emailGroup.style.display = 'block';
                phoneGroup.style.display = 'none';
                btn.textContent = 'Switch to Phone Sign-In';
            }
        });

        document.getElementById('btn-send-otp')?.addEventListener('click', () => {
            const phoneInput = document.getElementById('auth-phone');
            const phoneNumber = phoneInput.value.trim();
            if (!phoneNumber) {
                showToast('Please enter your phone number with country code, e.g. +919999999999', 'warning');
                return;
            }
            showToast('Sending OTP...', 'info');
            window.NutriSync.sendOTP(phoneNumber)
                .then(() => {
                    showToast('OTP sent successfully! Check your phone.', 'success');
                    document.getElementById('otp-verification-inputs').style.display = 'block';
                })
                .catch((err) => {
                    showToast('Failed to send OTP: ' + err.message, 'error');
                });
        });

        document.getElementById('btn-verify-otp')?.addEventListener('click', () => {
            const otpInput = document.getElementById('auth-otp');
            const code = otpInput.value.trim();
            if (!code || code.length !== 6) {
                showToast('Please enter a valid 6-digit OTP.', 'warning');
                return;
            }
            showToast('Verifying code...', 'info');
            window.NutriSync.verifyOTP(code)
                .then(() => {
                    showToast('Phone verified! Logged in successfully.', 'success');
                    closeSettingsModal();
                })
                .catch((err) => {
                    showToast('Verification failed: ' + err.message, 'error');
                });
        });

        document.getElementById('btn-auth-login')?.addEventListener('click', () => {
            const email = document.getElementById('auth-email').value.trim();
            const password = document.getElementById('auth-password').value;
            if (!email || !password) {
                showToast('Please enter both email and password.', 'warning');
                return;
            }
            showToast('Logging in...', 'info');
            window.NutriSync.login(email, password)
                .then(() => {
                    showToast('Logged in successfully! Synced data.', 'success');
                })
                .catch((err) => {
                    showToast('Login failed: ' + err.message, 'error');
                });
        });

        document.getElementById('btn-auth-register')?.addEventListener('click', () => {
            const email = document.getElementById('auth-email').value.trim();
            const password = document.getElementById('auth-password').value;
            if (!email || !password) {
                showToast('Please enter both email and password.', 'warning');
                return;
            }
            if (password.length < 6) {
                showToast('Password should be at least 6 characters.', 'warning');
                return;
            }
            showToast('Registering and uploading logs...', 'info');
            window.NutriSync.signup(email, password)
                .then(() => {
                    showToast('Registered successfully! Data backed up to cloud.', 'success');
                })
                .catch((err) => {
                    showToast('Registration failed: ' + err.message, 'error');
                });
        });

        document.getElementById('btn-auth-logout')?.addEventListener('click', () => {
            if (confirm('Are you sure you want to log out? Local logs will be cleared for security.')) {
                window.NutriSync.logout();
            }
        });

        // PWA Install Prompt handling
        let deferredPrompt = null;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            const installBtn = document.getElementById('pwa-install-btn');
            if (installBtn) {
                installBtn.style.display = 'flex';
            }
        });

        document.getElementById('pwa-install-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                } else {
                    console.log('User dismissed the install prompt');
                }
                deferredPrompt = null;
                const installBtn = document.getElementById('pwa-install-btn');
                if (installBtn) installBtn.style.display = 'none';
            });
        });
    }

    // Global Chat Submit
    function handleGlobalChatSubmit() {
        const input = document.getElementById('global-chat-input');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;

        if (!NutritionAI.isConfigured()) {
            showToast('Please add your Gemini API key in Settings first.', 'warning');
            openSettingsModal();
            return;
        }

        showToast('Analyzing input with AI...', 'info');
        input.value = ''; // clear immediately
        input.blur();

        const startTime = Date.now();
        const settings = NutriStorage.getUserSettings();
        const weight = parseFloat(settings.weight) || 70;

        NutritionAI.analyzeGlobal(text, weight).then(result => {
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            const today = getCurrentDate();
            if (result.type === 'food') {
                // Determine meal type by time
                const hour = new Date().getHours();
                let meal = 'snacks';
                if (hour >= 6 && hour < 11) meal = 'breakfast';
                else if (hour >= 11 && hour < 16) meal = 'lunch';
                else if (hour >= 18 && hour < 22) meal = 'dinner';

                const entry = Object.assign({}, result.data, {
                    id: NutriStorage.generateId(),
                    meal: meal,
                    loggedAt: new Date().toISOString()
                });
                NutriStorage.addFoodEntry(today, entry);
                showToast(`Logged ${entry.name} (${Math.round(entry.calories)} kcal) to ${meal}! (took ${duration}s)`, 'success');
            } else if (result.type === 'exercise') {
                const entry = Object.assign({}, result.data, {
                    id: NutriStorage.generateId(),
                    loggedAt: new Date().toISOString()
                });
                NutriStorage.addExerciseEntry(today, entry);
                showToast(`Logged exercise: ${entry.name} (-${Math.round(entry.caloriesBurned)} kcal)! (took ${duration}s)`, 'success');
            }
            // Re-render current page
            showPage(currentPage);
        }).catch(err => {
            showToast('Analysis failed: ' + (err.message || err), 'error');
            input.value = text; // restore on failure
        });
    }

    // ─── Bottom Sheet Menu and Edit Food Modal Helpers ───────────────────────────
    let activeSheetEntryId = null;
    let activeSheetDate = null;

    function showBottomSheetMenu(entryId, date) {
        activeSheetEntryId = entryId;
        activeSheetDate = date;
        const sheet = document.getElementById('bottom-sheet-menu');
        if (sheet) {
            sheet.style.display = 'flex';
            sheet.classList.add('active');
        }
    }

    function closeBottomSheetMenu() {
        const sheet = document.getElementById('bottom-sheet-menu');
        if (sheet) {
            sheet.style.display = 'none';
            sheet.classList.remove('active');
        }
        activeSheetEntryId = null;
        activeSheetDate = null;
    }

    function handleBottomSheetAction(action) {
        if (!activeSheetEntryId || !activeSheetDate) return;
        
        const date = activeSheetDate;
        const id = activeSheetEntryId;
        
        const foodLog = NutriStorage.getFoodLog(date) || [];
        const entry = foodLog.find(item => item.id === id);
        if (!entry) return;

        if (action === 'sheet-delete') {
            NutriStorage.removeFoodEntry(date, id);
            showToast('Food entry deleted.', 'success');
            showPage(currentPage);
        } else if (action === 'sheet-edit' || action === 'sheet-adjust') {
            openManualEntryModalForEdit(entry, date);
        } else if (action === 'sheet-datetime') {
            const newDate = prompt('Enter new date (YYYY-MM-DD):', date);
            if (newDate && /^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
                NutriStorage.removeFoodEntry(date, id);
                NutriStorage.addFoodEntry(newDate, entry);
                showToast('Entry date updated.', 'success');
                showPage(currentPage);
            } else if (newDate) {
                showToast('Invalid date format. Use YYYY-MM-DD.', 'error');
            }
        } else if (action === 'sheet-save') {
            const subItems = entry.subItems || [{
                name: entry.name,
                calories: entry.calories,
                protein: entry.protein,
                carbs: entry.carbs,
                fat: entry.fat
            }];
            const mealToSave = {
                id: NutriStorage.generateId(),
                name: entry.description || entry.name,
                foods: subItems.map(item => Object.assign({ id: NutriStorage.generateId() }, item)),
                totalCalories: entry.calories,
                totalProtein: entry.protein,
                totalCarbs: entry.carbs,
                totalFat: entry.fat,
                createdAt: new Date().toISOString()
            };
            NutriStorage.addSavedMeal(mealToSave);
            showToast('Saved to custom meals!', 'success');
        }
    }

    function openManualEntryModalForEdit(entry, date) {
        document.getElementById('edit-food-id').value = entry.id;
        document.getElementById('edit-food-date').value = date;
        document.getElementById('edit-food-name').value = entry.name || '';
        document.getElementById('edit-food-calories').value = Math.round(entry.calories || 0);
        document.getElementById('edit-food-carbs').value = entry.carbs || 0;
        document.getElementById('edit-food-protein').value = entry.protein || 0;
        document.getElementById('edit-food-fat').value = entry.fat || 0;
        document.getElementById('edit-food-meal').value = entry.meal || 'snacks';

        const modal = document.getElementById('modal-edit-food');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
        }
    }

    function closeEditFoodModal() {
        const modal = document.getElementById('modal-edit-food');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }
    }

    function saveEditedFood(e) {
        e.preventDefault();
        const id = document.getElementById('edit-food-id').value;
        const date = document.getElementById('edit-food-date').value;
        
        const updates = {
            name: document.getElementById('edit-food-name').value,
            calories: parseFloat(document.getElementById('edit-food-calories').value) || 0,
            carbs: parseFloat(document.getElementById('edit-food-carbs').value) || 0,
            protein: parseFloat(document.getElementById('edit-food-protein').value) || 0,
            fat: parseFloat(document.getElementById('edit-food-fat').value) || 0,
            meal: document.getElementById('edit-food-meal').value
        };

        const foodLog = NutriStorage.getFoodLog(date) || [];
        const entry = foodLog.find(item => item.id === id);
        if (entry) {
            if (entry.subItems && entry.subItems.length > 0) {
                entry.subItems = [{
                    name: updates.name,
                    calories: updates.calories,
                    carbs: updates.carbs,
                    protein: updates.protein,
                    fat: updates.fat
                }];
            }
            
            const finalUpdates = Object.assign({}, entry, updates);
            NutriStorage.updateFoodEntry(date, id, finalUpdates);
            showToast('Food entry updated.', 'success');
        }
        
        closeEditFoodModal();
        showPage(currentPage);
    }

    function updateSettingsFirebaseUI() {
        const setupSec = document.getElementById('firebase-setup-section');
        const authSec = document.getElementById('firebase-auth-section');
        const authInputs = document.getElementById('firebase-auth-inputs');
        const logoutBtn = document.getElementById('btn-auth-logout');
        const userInfo = document.getElementById('firebase-user-info');
        const disconnectBtn = document.getElementById('btn-disconnect-firebase');

        if (!setupSec || !authSec) return;

        if (disconnectBtn) {
            if (window.NutriSync && window.NutriSync.isEmbeddedConfigValid()) {
                disconnectBtn.style.display = 'none';
            } else {
                disconnectBtn.style.display = 'block';
            }
        }

        if (!window.NutriSync || !window.NutriSync.isConfigured()) {
            setupSec.style.display = 'block';
            authSec.style.display = 'none';
        } else {
            setupSec.style.display = 'none';
            authSec.style.display = 'block';
            
            if (window.NutriSync.isAuthenticated()) {
                userInfo.textContent = 'Logged in as: ' + window.NutriSync.getUserEmail();
                authInputs.style.display = 'none';
                logoutBtn.style.display = 'block';
            } else {
                userInfo.textContent = 'Firebase Config Connected (Not Signed In)';
                authInputs.style.display = 'block';
                logoutBtn.style.display = 'none';

                // Reset toggles to email view by default
                const emailGroup = document.getElementById('email-auth-inputs');
                const phoneGroup = document.getElementById('phone-auth-inputs');
                const otpInputs = document.getElementById('otp-verification-inputs');
                if (emailGroup) emailGroup.style.display = 'block';
                if (phoneGroup) phoneGroup.style.display = 'none';
                if (otpInputs) otpInputs.style.display = 'none';
                
                const toggleBtn = document.getElementById('btn-toggle-auth-method');
                if (toggleBtn) toggleBtn.textContent = 'Switch to Phone Sign-In';

                // Clear fields
                const fields = ['auth-email', 'auth-password', 'auth-phone', 'auth-otp'];
                fields.forEach(fid => {
                    const el = document.getElementById(fid);
                    if (el) el.value = '';
                });
            }
        }
    }

    // ─── Initialize ──────────────────────────────
    function init() {
        currentDate = NutriStorage.getTodayDate();

        // Initialize all page modules
        Object.values(pages).forEach(getModule => {
            const mod = getModule();
            if (mod && typeof mod.init === 'function') {
                mod.init();
            }
        });

        // Bind events
        bindEvents();

        // Handle initial route
        handleHashChange();

        // Check first run
        checkFirstRun();

        // Initialize Firebase Synchronizer
        if (window.NutriSync) {
            window.NutriSync.init();
        }

        // Register PWA Service Worker
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./service-worker.js')
                    .then(reg => console.log('[PWA] Service Worker registered:', reg.scope))
                    .catch(err => console.error('[PWA] Service Worker registration failed:', err));
            });
        }
    }

    // ─── Public API ──────────────────────────────
    return {
        init,
        showPage,
        navigate,
        showToast,
        getCurrentDate,
        setCurrentDate,
        openSettingsModal,
        refreshCurrentPage: () => showPage(currentPage),
    };
})();

// ─── Boot ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    NutriApp.init();
});
