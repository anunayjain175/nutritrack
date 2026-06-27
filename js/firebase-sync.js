'use strict';

/**
 * NutriSync — Firebase Authentication and Firestore synchronization layer
 * Exposes window.NutriSync
 */
window.NutriSync = (function () {
    let db = null;
    let auth = null;
    let currentUser = null;
    let isInitialized = false;

    // Phone auth objects
    let recaptchaVerifier = null;
    let confirmationResult = null;

    // LocalStorage keys used by storage.js
    const PREFIX = 'nutritrack_';
    const SETTINGS_KEY = PREFIX + 'user_settings';
    const SAVED_MEALS_KEY = PREFIX + 'saved_meals';
    const FOOD_KEY_PREFIX = PREFIX + 'food_log_';
    const EXERCISE_KEY_PREFIX = PREFIX + 'exercise_log_';

    /* ─────────────────── Initialization ─────────────────── */

    function isEmbeddedConfigValid() {
        return window.firebaseConfig && 
               window.firebaseConfig.apiKey && 
               !window.firebaseConfig.apiKey.startsWith('YOUR_');
    }

    function init() {
        if (isInitialized) return;

        let configObj = null;

        // Check if there is a valid embedded config in firebase-config.js
        if (isEmbeddedConfigValid()) {
            configObj = window.firebaseConfig;
            console.log('[NutriSync] Using embedded Firebase configuration.');
        } else {
            // Fall back to settings-based config
            const settings = NutriStorage.getUserSettings();
            if (!settings || !settings.firebaseConfig) {
                console.log('[NutriSync] Firebase config not found. Running in local-only mode.');
                return;
            }
            configObj = settings.firebaseConfig;
        }

        try {
            if (typeof configObj === 'string') {
                let cleanStr = configObj.trim();
                cleanStr = cleanStr.replace(/^(const|let|var)\s+\w+\s*=\s*/i, '');
                cleanStr = cleanStr.replace(/;\s*$/, '');
                if (!cleanStr.startsWith('{')) {
                    cleanStr = '{' + cleanStr + '}';
                }
                try {
                    configObj = new Function("return (" + cleanStr + ")")();
                } catch (e) {
                    configObj = JSON.parse(configObj); // fallback
                }
            }

            // Initialize Firebase if not already initialized by another script
            if (!firebase.apps.length) {
                firebase.initializeApp(configObj);
            }

            db = firebase.firestore();
            auth = firebase.auth();

            // Enable offline persistence in Firestore
            db.enablePersistence().catch((err) => {
                if (err.code === 'failed-precondition') {
                    console.warn('[NutriSync] Firestore persistence failed (multiple tabs open).');
                } else if (err.code === 'unimplemented') {
                    console.warn('[NutriSync] Firestore persistence is not supported by this browser.');
                }
            });

            // Initialize Phone Auth Recaptcha
            initPhoneAuth();

            // Listen for Auth State Changes
            auth.onAuthStateChanged((user) => {
                currentUser = user;
                console.log('[NutriSync] Auth state changed. User:', user ? user.email || user.phoneNumber : 'None');

                // Trigger custom event so index.html and app.js can update the UI
                const event = new CustomEvent('nutri-auth-changed', { detail: { user } });
                window.dispatchEvent(event);

                if (user) {
                    const uid = user.uid;
                    // Check if this is a new user (has no settings document in Firestore)
                    db.collection('users').doc(uid).collection('config').doc('settings').get().then((doc) => {
                        if (!doc.exists) {
                            console.log('[NutriSync] New user detected. Uploading existing local logs...');
                            uploadAllLocalData(uid).then(() => {
                                if (window.NutriApp) {
                                    window.NutriApp.showToast('First-time login: uploaded your local logs to cloud!', 'success');
                                }
                            });
                        } else {
                            console.log('[NutriSync] Existing user. Syncing cloud logs down...');
                            syncDown().then(() => {
                                if (window.NutriApp) {
                                    window.NutriApp.showToast('Logged in! Cloud data synced.', 'success');
                                }
                            });
                        }
                    }).catch(err => {
                        console.error('[NutriSync] Error checking user document in Firestore:', err);
                        // Fallback sync down
                        syncDown();
                    });
                }
            });

            isInitialized = true;
            console.log('[NutriSync] Firebase successfully initialized.');
        } catch (e) {
            console.error('[NutriSync] Failed to initialize Firebase:', e);
            if (window.NutriApp) {
                window.NutriApp.showToast('Firebase init failed: ' + e.message, 'error');
            }
        }
    }

    /* ────────────────── Authentication ────────────────── */

    function login(email, password) {
        if (!auth) return Promise.reject(new Error('Firebase not configured.'));
        return auth.signInWithEmailAndPassword(email, password);
    }

    function signup(email, password) {
        if (!auth) return Promise.reject(new Error('Firebase not configured.'));
        // We register the user. The onAuthStateChanged listener will automatically detect the new user
        // and trigger the upload of their existing local logs.
        return auth.createUserWithEmailAndPassword(email, password);
    }

    function logout() {
        if (!auth) return Promise.resolve();
        return auth.signOut().then(() => {
            // Clear local storage logs when logging out, so no leftover user data remains
            clearLocalLogs();
            // Force reload to dashboard
            window.location.hash = 'dashboard';
        });
    }

    function disconnectConfig() {
        // Remove firebase config from settings
        const settings = NutriStorage.getUserSettings();
        delete settings.firebaseConfig;
        NutriStorage.saveUserSettings(settings);

        // If logged in, log out first
        const logoutPromise = auth ? auth.signOut() : Promise.resolve();

        return logoutPromise.then(() => {
            db = null;
            auth = null;
            currentUser = null;
            recaptchaVerifier = null;
            confirmationResult = null;
            isInitialized = false;

            // Clear logs
            clearLocalLogs();

            // Notify UI
            const event = new CustomEvent('nutri-auth-changed', { detail: { user: null } });
            window.dispatchEvent(event);

            if (window.NutriApp) {
                window.NutriApp.showToast('Firebase disconnected. Returned to local-only mode.', 'info');
            }
            setTimeout(() => window.location.reload(), 1000);
        });
    }

    function isConfigured() {
        return isInitialized && db !== null;
    }

    function isAuthenticated() {
        return currentUser !== null;
    }

    function getUserEmail() {
        if (!currentUser) return null;
        return currentUser.email || currentUser.phoneNumber || 'Authenticated User';
    }

    /* ────────────────── Phone Auth ────────────────── */

    function initPhoneAuth() {
        if (!auth || recaptchaVerifier) return;
        const container = document.getElementById('recaptcha-container');
        if (!container) return;

        try {
            recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
                'size': 'invisible',
                'callback': (response) => {
                    // reCAPTCHA solved
                }
            });
            console.log('[NutriSync] Invisible Recaptcha initialized.');
        } catch (e) {
            console.error('[NutriSync] Recaptcha initialization failed:', e);
        }
    }

    function sendOTP(phoneNumber) {
        if (!auth) return Promise.reject(new Error('Firebase not configured.'));
        
        // Re-ensure recaptcha container is bound if not already
        if (!recaptchaVerifier) {
            initPhoneAuth();
        }

        if (!recaptchaVerifier) {
            return Promise.reject(new Error('ReCAPTCHA verifier could not be initialized.'));
        }

        return auth.signInWithPhoneNumber(phoneNumber, recaptchaVerifier).then((result) => {
            confirmationResult = result;
            return result;
        });
    }

    function verifyOTP(code) {
        if (!confirmationResult) {
            return Promise.reject(new Error('No active confirmation session. Send OTP first.'));
        }
        return confirmationResult.confirm(code);
    }

    /* ─────────────────── Sync Operations ────────────────── */

    /**
     * Called by storage.js whenever a write to localStorage happens.
     * Performs a background write to Firestore if configured and authenticated.
     */
    function onLocalWrite(key, value) {
        if (!isConfigured() || !currentUser) return;

        const uid = currentUser.uid;

        // Sync settings
        if (key === SETTINGS_KEY) {
            // Don't sync the firebaseConfig itself to Firestore (security & redundancy)
            const settingsToSync = Object.assign({}, value);
            delete settingsToSync.firebaseConfig;
            db.collection('users').doc(uid).collection('config').doc('settings').set(settingsToSync)
                .catch(err => console.warn('[NutriSync] Firestore settings sync failed:', err));
        }
        // Sync saved meals
        else if (key === SAVED_MEALS_KEY) {
            db.collection('users').doc(uid).collection('config').doc('saved_meals').set({ meals: value })
                .catch(err => console.warn('[NutriSync] Firestore saved meals sync failed:', err));
        }
        // Sync food logs
        else if (key.indexOf(FOOD_KEY_PREFIX) === 0) {
            const date = key.substring(FOOD_KEY_PREFIX.length);
            db.collection('users').doc(uid).collection('food_logs').doc(date).set({ entries: value })
                .catch(err => console.warn('[NutriSync] Firestore food log sync failed:', err));
        }
        // Sync exercise logs
        else if (key.indexOf(EXERCISE_KEY_PREFIX) === 0) {
            const date = key.substring(EXERCISE_KEY_PREFIX.length);
            db.collection('users').doc(uid).collection('exercise_logs').doc(date).set({ entries: value })
                .catch(err => console.warn('[NutriSync] Firestore exercise log sync failed:', err));
        }
    }

    /**
     * Pulls all documents from Firestore and updates localStorage.
     */
    function syncDown() {
        if (!isConfigured() || !currentUser) return Promise.resolve();

        const uid = currentUser.uid;
        const promises = [];

        // 1. Pull Settings
        const settingsPromise = db.collection('users').doc(uid).collection('config').doc('settings').get().then((doc) => {
            if (doc.exists) {
                const cloudSettings = doc.data();
                const localSettings = NutriStorage.getUserSettings();
                
                // Merge cloud settings with local config
                const merged = Object.assign({}, localSettings, cloudSettings);
                
                // Intelligent merge for Gemini API Key:
                // If local settings has a key but cloud doesn't, keep local key and push it to cloud.
                if (localSettings.geminiApiKey && !cloudSettings.geminiApiKey) {
                    merged.geminiApiKey = localSettings.geminiApiKey;
                    setTimeout(() => {
                        onLocalWrite(SETTINGS_KEY, merged);
                    }, 1000);
                }
                
                // Ensure local firebaseConfig is kept
                merged.firebaseConfig = localSettings.firebaseConfig;
                
                // Write directly to localStorage to avoid trigger onLocalWrite loop
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
            }
        });
        promises.push(settingsPromise);

        // 2. Pull Saved Meals
        const mealsPromise = db.collection('users').doc(uid).collection('config').doc('saved_meals').get().then((doc) => {
            if (doc.exists) {
                const cloudMeals = doc.data().meals || [];
                localStorage.setItem(SAVED_MEALS_KEY, JSON.stringify(cloudMeals));
            }
        });
        promises.push(mealsPromise);

        // 3. Pull Food Logs
        const foodPromise = db.collection('users').doc(uid).collection('food_logs').get().then((snapshot) => {
            snapshot.forEach((doc) => {
                const date = doc.id;
                const entries = doc.data().entries || [];
                localStorage.setItem(FOOD_KEY_PREFIX + date, JSON.stringify(entries));
            });
        });
        promises.push(foodPromise);

        // 4. Pull Exercise Logs
        const exercisePromise = db.collection('users').doc(uid).collection('exercise_logs').get().then((snapshot) => {
            snapshot.forEach((doc) => {
                const date = doc.id;
                const entries = doc.data().entries || [];
                localStorage.setItem(EXERCISE_KEY_PREFIX + date, JSON.stringify(entries));
            });
        });
        promises.push(exercisePromise);

        return Promise.all(promises).then(() => {
            // Trigger a refresh of the currently active page in NutriApp
            if (window.NutriApp && typeof window.NutriApp.refreshCurrentPage === 'function') {
                window.NutriApp.refreshCurrentPage();
            }
        });
    }

    /**
     * Uploads all current local storage data to cloud. Used on signup/first link.
     */
    function uploadAllLocalData(uid) {
        if (!db) return Promise.resolve();

        const batch = db.batch();
        let operationsCount = 0;

        // 1. Settings
        const localSettings = NutriStorage.getUserSettings();
        const settingsToSync = Object.assign({}, localSettings);
        delete settingsToSync.firebaseConfig;
        const settingsRef = db.collection('users').doc(uid).collection('config').doc('settings');
        batch.set(settingsRef, settingsToSync);
        operationsCount++;

        // 2. Saved Meals
        const localMeals = NutriStorage.getSavedMeals();
        const mealsRef = db.collection('users').doc(uid).collection('config').doc('saved_meals');
        batch.set(mealsRef, { meals: localMeals });
        operationsCount++;

        // 3. Logs
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;

            if (key.indexOf(FOOD_KEY_PREFIX) === 0) {
                const date = key.substring(FOOD_KEY_PREFIX.length);
                const entries = JSON.parse(localStorage.getItem(key)) || [];
                const ref = db.collection('users').doc(uid).collection('food_logs').doc(date);
                batch.set(ref, { entries });
                operationsCount++;
            } else if (key.indexOf(EXERCISE_KEY_PREFIX) === 0) {
                const date = key.substring(EXERCISE_KEY_PREFIX.length);
                const entries = JSON.parse(localStorage.getItem(key)) || [];
                const ref = db.collection('users').doc(uid).collection('exercise_logs').doc(date);
                batch.set(ref, { entries });
                operationsCount++;
            }
        }

        return batch.commit().then(() => {
            console.log('[NutriSync] Uploaded all local logs to Firestore.');
        });
    }

    /**
     * Clears all local logs and saved meals, leaving only basic settings.
     */
    function clearLocalLogs() {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.indexOf(PREFIX) === 0 && key !== SETTINGS_KEY) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));

        // Reset settings fields to defaults (keep firebaseConfig and Gemini key)
        const settings = NutriStorage.getUserSettings();
        const cleanedSettings = {
            dailyCalorieGoal: 2000,
            name: '',
            weight: 70,
            height: 170,
            age: 25,
            activityLevel: 'moderate',
            geminiApiKey: settings.geminiApiKey || '',
            firebaseConfig: settings.firebaseConfig || ''
        };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(cleanedSettings));
    }

    return {
        init: init,
        login: login,
        signup: signup,
        logout: logout,
        disconnectConfig: disconnectConfig,
        onLocalWrite: onLocalWrite,
        syncDown: syncDown,
        isConfigured: isConfigured,
        isAuthenticated: isAuthenticated,
        getUserEmail: getUserEmail,

        // Phone Auth methods
        initPhoneAuth: initPhoneAuth,
        sendOTP: sendOTP,
        verifyOTP: verifyOTP,
        isEmbeddedConfigValid: isEmbeddedConfigValid
    };
})();
