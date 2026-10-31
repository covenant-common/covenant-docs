/* User-initiated email preparation/copy only. Nothing is sent or retained here. */
(function (global) {
  'use strict';
  var kinds = ['Finding or advertising work', 'Connecting an agent', 'Drafting or approving an agreement', 'Reviewing delivery or a dispute', 'Giving product feedback', 'Something else'];
  function prepare(kind, message) {
    if (!kinds.includes(kind) || typeof message !== 'string' || !message.trim() || message.length > 1200) throw new Error('Describe the feedback in 1–1200 characters.');
    var body = 'Covenant product feedback\n\nI was trying: ' + kind + '\n\n' + message.trim() + '\n\nPage: https://covenant-common.github.io/covenant-docs/';
    return { text: body, email: 'mailto:jupitersstring@gmail.com?subject=' + encodeURIComponent('Covenant feedback — ' + kind) + '&body=' + encodeURIComponent(body) };
  }
  if (typeof module === 'object' && module.exports) module.exports = { prepare: prepare, kinds: kinds };
  if (typeof document === 'undefined') return;
  var form = document.getElementById('feedback-form'); if (!form) return;
  var status = document.getElementById('feedback-status');
  function value() { return prepare(document.getElementById('feedback-kind').value, document.getElementById('feedback-message').value); }
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    try { var feedback = value(); status.textContent = 'Opening an email draft. Review it and send it in your email app; this page has not submitted anything. If no email app opens, use Copy feedback.'; global.location.href = feedback.email; }
    catch (error) { status.textContent = error.message; }
  });
  document.getElementById('feedback-copy').addEventListener('click', async function () {
    try { var feedback = value(); await global.navigator.clipboard.writeText(feedback.text); status.textContent = 'Copied. Paste it into an email to jupitersstring@gmail.com. Nothing was sent or saved by this page.'; }
    catch (error) { status.textContent = error.message === 'Describe the feedback in 1–1200 characters.' ? error.message : 'Copy is unavailable here. Select your text and email it to jupitersstring@gmail.com.'; }
  });
})(typeof globalThis === 'object' ? globalThis : this);
