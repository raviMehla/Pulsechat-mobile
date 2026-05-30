// ============================================================
// analytics.js — Stubs for Firebase Analytics & Crashlytics
// Production-grade logging placeholders that map to console logging in development
// ============================================================

export const logEvent = (eventName, params = {}) => {
  console.log(`[Analytics] Event: ${eventName}`, params);
  // Production mapping example:
  // firebase.analytics().logEvent(eventName, params);
};

export const logScreenView = (screenName) => {
  console.log(`[Analytics] Screen View: ${screenName}`);
  // Production mapping example:
  // firebase.analytics().logScreenView({ screen_name: screenName, screen_class: screenName });
};

export const recordError = (error, context = '') => {
  console.error(`[Crashlytics] Recorded Error: ${error.message}`, { error, context });
  // Production mapping example:
  // firebase.crashlytics().recordError(error, context);
};

export const setUserId = (userId) => {
  console.log(`[Analytics/Crashlytics] Set User ID: ${userId}`);
  // Production mapping example:
  // firebase.analytics().setUserId(userId);
  // firebase.crashlytics().setUserId(userId);
};
