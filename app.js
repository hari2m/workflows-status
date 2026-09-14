(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const homeView = $("#home-view");
  const jobView = $("#job-view");
  const homeCards = $("#home-cards");
  const homeError = $("#home-error");
  const generatedAt = $("#generated-at");
  const jobName = $("#job-name");
  const jobRows = $("#job-rows");
  const jobError = $("#job-error");
  const homeFooter = $("#home-footer");

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  function relTime(iso) {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return "";
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return Math.floor(s) + "s ago";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function fmtWhen(iso) {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return "";
    const d = new Date(t);
    const p = (n) => String(n).padStart(2, "0");
    return MONTHS[d.getUTCMonth()] + " " + d.getUTCDate() + ", " +
      p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + " UTC";
  }

  function statusIcon(status) {
    const ok = status === "succeeded";
    return '<span class="row-status ' + (ok ? "status-ok" : "status-fail") + '">' +
      (ok ? "&#10003;" : "&#10007;") + "</span>";
  }

  // Self-hosted: same origin, the vhost proxies /status to the container.
  // GitHub Pages: cross-origin, so go through the /status proxy route
  // (same JSON, CORS *, no credentials) on workflows.supremeporter.com.
  // Self-hosted: same origin, the vhost proxies /status to the container.
  // GitHub Pages: cross-origin, so go through the /status.js proxy worker
  // (same JSON, CORS *, no credentials) installed on this origin.
  function statusUrl(query) {
    const selfHosted =
      location.hostname === "workflows.supremeporter.com" ||
      location.hostname === "localhost";
    return selfHosted ? "/status" + query : "/status.js" + query;
  }

  async function fetchStatus(query) {
    let res;
    try {
      res = await fetch(statusUrl(query), { cache: "no-store" });
    } catch (netErr) {
      // Network-level failure: on the self-hosted origin the status route
      // is proxied by Apache; if that is misconfigured or down, go through
      // the /status.js proxy worker instead (it targets the same endpoint).
      res = await fetch("/status.js" + query, { cache: "no-store" });
    }
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  function cardEl(name, last, total, failCount) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "card";
    const when = last.started_at ? relTime(last.started_at) : "never";
    el.innerHTML =
      '<span class="card-status ' + (last.status === "succeeded" ? "status-ok" : "status-fail") + '">' +
        (last.status === "succeeded" ? "&#10003;" : "&#10007;") + "</span>" +
      '<span class="card-main">' +
        '<span class="card-name">' + esc(name) + "</span>" +
        '<span class="card-when">' + esc(when) +
          (failCount > 0 ? " &middot; " + failCount + " failed" : "") +
        "</span>" +
      "</span>" +
      '<span class="badge">' + total + " runs</span>";
    el.addEventListener("click", () => openJob(name));
    return el;
  }

  function loadHome() {
    homeError.hidden = true;
    homeCards.innerHTML = "";
    generatedAt.hidden = true;
    fetchStatus("?limit=500")
      .then((data) => {
        const jobs = new Map();
        for (const run of data.runs) {
          let entry = jobs.get(run.job);
          if (!entry) {
            entry = { last: null, total: 0, fail: 0 };
            jobs.set(run.job, entry);
          }
          entry.total += 1;
          if (run.status !== "succeeded") entry.fail += 1;
          if (!entry.last) entry.last = run;
        }
        if (data.generated_at) {
          generatedAt.textContent = "updated " + relTime(data.generated_at);
          generatedAt.hidden = false;
        }
        if (jobs.size === 0) {
          homeCards.innerHTML =
            '<p class="meta" style="text-align:center">No runs yet</p>';
          homeFooter.hidden = true;
          return;
        }
        for (const [name, entry] of jobs) {
          homeCards.appendChild(cardEl(name, entry.last, entry.total, entry.fail));
        }
        homeFooter.textContent =
          data.count + " runs in the last 500 \u00b7 jobs with recent runs only";
      })
      .catch((err) => {
        homeError.textContent = "Could not load status (" + err.message + "). Are you offline?";
        homeError.hidden = false;
      });
  }

  function openJob(name) {
    jobName.textContent = name;
    jobError.hidden = true;
    jobRows.innerHTML = "";
    jobView.hidden = false;
    homeView.hidden = true;
    window.scrollTo(0, 0);
    fetchStatus("?job=" + encodeURIComponent(name))
      .then((data) => {
        jobRows.innerHTML = "";
        if (data.count === 0) {
          jobRows.innerHTML = '<p class="meta" style="text-align:center">No runs for this job in the last 50</p>';
          return;
        }
        for (const run of data.runs) {
          const row = document.createElement("div");
          row.className = "row";
          row.innerHTML =
            statusIcon(run.status) +
            '<span class="row-body">' +
              '<span class="row-when">' + esc(fmtWhen(run.started_at)) + "</span>" +
              (run.message ? '<div class="row-message" title="' + esc(run.message) + '">' + esc(run.message) + "</div>" : "") +
              (run.error ? '<div class="row-error">' + esc(run.error) + "</div>" : "") +
            "</span>";
          jobRows.appendChild(row);
        }
      })
      .catch((err) => {
        jobError.textContent = "Could not load run history (" + err.message + ").";
        jobError.hidden = false;
      });
  }

  function closeJob() {
    jobView.hidden = true;
    homeView.hidden = false;
    loadHome();
  }

  $("#back").addEventListener("click", closeJob);
  $("#home-refresh").addEventListener("click", () => loadHome());
  $("#job-refresh").addEventListener("click", () => {
    if (jobName.textContent) openJob(jobName.textContent);
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      const selfHosted =
        location.hostname === "workflows.supremeporter.com" ||
        location.hostname === "localhost";
      navigator.serviceWorker
        .register(selfHosted ? window.APP_BASE + "sw.js" : "status.js")
        .catch(() => {});
    });
  }

  loadHome();
})();
