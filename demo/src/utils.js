/**
 * Shortcut for document.getElementById(id).
 *
 * @param {string} id HTML element ID attribute
 * @returns {HTMLElement} Element if present
 */
const $$ = id => document.getElementById(id);

/**
 * No-op function; does nothing, returns nothing.
 */
const noop = () => {};

/**
 * Retrieves the project name from the query string, a global variable
 * or if those fail, the default value.
 *
 * @returns {string} Project name
 */
const getProject = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const project = urlParams.get('project');
  if (project) return project;
  return window.PROJECT || 'default';
};

/**
 * Store local variables relative to the current project.
 * @param {string} key LocalStorage partial key
 * @param {*} val Result to be saved
 */
const store = (key, val) => localStorage.setItem(`${getProject()}__${key}`, val);

/**
 * Retrieve local variables relative to the current project.
 * @param {string} key LocalStorage partial key
 * @returns {*} Result to be returned
 */
const retrieve = (key) => localStorage.getItem(`${getProject()}__${key}`);

/**
 * Clamp with default value.
 * 
 * @param {number} num Number to clamp
 * @param {number} lo Lower bound
 * @param {number} hi Upper bound
 * @param {number} def Default value
 */
const clampWithDefault = (num, lo, hi, def) => {
  const n = parseInt(num, 10);
  if (isNaN(n)) return def;
  if (typeof n !== 'number') return def;
  return Math.max(lo, Math.min(hi, n));
};

module.exports = {
  $$,
  noop,
  store,
  retrieve,
  clampWithDefault,
};
