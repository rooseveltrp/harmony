import { formatDates, initTooltips } from "../table.js";

/**
 * Format all of the dates in the user's browser timezone.
 */
function decorateTurboRequests() {
  const requestCodes = document.getElementsByClassName('mode-td');
  [...requestCodes].forEach(
    (element) => {
      const request = element.getAttribute('data-job-url');
      if (request.indexOf('turbo=true') > -1) {
        element.textContent = '🚀';
        element.setAttribute('title', 'turbo=true was requested');
      } else if (request.indexOf('turbo=false') > -1) {
        element.textContent = '🐙';
        element.setAttribute('title', 'turbo=false was requested');
      } else {
        element.textContent = '🚫';
        element.setAttribute('title', 'turbo=[true|false] was not specified');
      }
    }
  );
}

export default {

  /**
   * Handles jobs table logic.
   */
  async init() {
    decorateTurboRequests();
    formatDates();
    initTooltips('[data-bs-toggle="tooltip"]');
  }
}