// ==UserScript==
// @name         GitHub Collapse Markdown
// @version      1.1.0
// @description  A userscript that collapses markdown headers
// @license      https://creativecommons.org/licenses/by-sa/4.0/
// @namespace    https://github.com/Mottie
// @include      https://github.com/*
// @include      https://gist.github.com/*
// @include      https://help.github.com/*
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @author       Rob Garrison
// ==/UserScript==
/* global GM_addStyle, GM_getValue, GM_setValue, GM_registerMenuCommand */
/* jshint esnext:true, unused:true */
(() => {
  "use strict";

  let startCollapsed = GM_getValue("ghcm-collapsed", true),
    // palette generated by http://tools.medialab.sciences-po.fr/iwanthue/ (colorblind friendly, soft)
    defaultColors = ["#6778d0", "#ac9c3d", "#b94a73", "#56ae6c", "#9750a1", "#ba543d"],
    colors = GM_getValue("ghcm-colors", defaultColors),

    headers = "H1 H2 H3 H4 H5 H6".split(" "),
    collapsed = "ghcm-collapsed",

    arrowColors = document.createElement("style");

  GM_addStyle(`
    .markdown-body h1, .markdown-body h2, .markdown-body h3,
    .markdown-body h4, .markdown-body h5, .markdown-body h6,
    .markdown-format h1, .markdown-format h2, .markdown-format h3,
    .markdown-format h4, .markdown-format h5, .markdown-format h6 {
      position:relative;
      padding-right:.8em;
      cursor:pointer;
    }
    .markdown-body h1:after, .markdown-body h2:after, .markdown-body h3:after,
    .markdown-body h4:after, .markdown-body h5:after, .markdown-body h6:after,
    .markdown-format h1:after, .markdown-format h2:after, .markdown-format h3:after,
    .markdown-format h4:after, .markdown-format h5:after, .markdown-format h6:after {
      display:inline-block;
      position:absolute;
      right:0;
      top:calc(50% - .5em);
      font-size:.8em;
      content:"\u25bc";
    }
    .markdown-body .${collapsed}:after, .markdown-format .${collapsed}:after {
      transform: rotate(90deg);
    }
    /* clicking on header link won't pass svg as the event.target */
    .octicon-link, .octicon-link > * {
      pointer-events:none;
    }
    .ghcm-hidden {
      display:none !important;
    }
  `);

  function addColors() {
    arrowColors.textContent = `
      .markdown-body h1:after, .markdown-format h1:after { color:${colors[0]} }
      .markdown-body h2:after, .markdown-format h2:after { color:${colors[1]} }
      .markdown-body h3:after, .markdown-format h3:after { color:${colors[2]} }
      .markdown-body h4:after, .markdown-format h4:after { color:${colors[3]} }
      .markdown-body h5:after, .markdown-format h5:after { color:${colors[4]} }
      .markdown-body h6:after, .markdown-format h6:after { color:${colors[5]} }
    `;
  }

  function toggle(el, shifted) {
    if (el) {
      el.classList.toggle(collapsed);
      let els,
        name = el.nodeName || "",
        level = parseInt(name.replace(/[^\d]/, ""), 10),
        isCollapsed = el.classList.contains(collapsed);
      if (shifted) {
        // collapse all same level anchors
        els = $$(`.markdown-body ${name}, .markdown-format ${name}`);
        for (el of els) {
          nextHeader(el, level, isCollapsed);
        }
      } else {
        nextHeader(el, level, isCollapsed);
      }
      removeSelection();
    }
  }

  function nextHeader(el, level, isCollapsed) {
    el.classList[isCollapsed ? "add" : "remove"](collapsed);
    let selector = headers.slice(0, level).join(","),
      els = [];
    el = el.nextElementSibling;
    while (el && !el.matches(selector)) {
      els[els.length] = el;
      el = el.nextElementSibling;
    }
    if (els.length) {
      if (isCollapsed) {
        addClass(els, "ghcm-hidden");
      } else {
        removeClass(els, collapsed + " ghcm-hidden");
      }
    }
  }

  // show siblings of hash target
  function siblings(target) {
    let level = parseInt((target.nodeName || "").replace(/[^\d]/, ""), 10),
      el = target.nextElementSibling,
      selector = headers.slice(0, level - 1).join(","),
      els = [target];
    while (el && !el.matches(selector)) {
      els[els.length] = el;
      el = el.nextElementSibling;
    }
    el = target.previousElementSibling;
    while (el && !el.matches(selector)) {
      els[els.length] = el;
      el = el.previousElementSibling;
    }
    if (els.length) {
      els = els.filter(el => {
        return el.nodeName === target.nodeName;
      });
      removeClass(els, "ghcm-hidden");
    }
    nextHeader(target, level, false);
  }

  function removeSelection() {
    // remove text selection - http://stackoverflow.com/a/3171348/145346
    var sel = window.getSelection ? window.getSelection() : document.selection;
    if (sel) {
      if (sel.removeAllRanges) {
        sel.removeAllRanges();
      } else if (sel.empty) {
        sel.empty();
      }
    }
  }

  function addBinding() {
    document.addEventListener("click", event => {
      let target = event.target,
        name = (target && target.nodeName || "").toLowerCase();
      if (name === "path") {
        target = closest(target, "svg");
      }
      if (!target || target.classList.contains("anchor") ||
        name === "a" || name === "img" ||
        // add support for "pointer-events:none" applied to "anchor" in
        // https://github.com/StylishThemes/GitHub-FixedHeader
        target.classList.contains("octicon-link")) {
        return;
      }
      // check if element is inside a header
      target = closest(event.target, headers.join(","));
      if (target && headers.indexOf(target.nodeName || "") > -1) {
        // make sure the header is inside of markdown
        if (closest(target, ".markdown-body, .markdown-format")) {
          toggle(target, event.shiftKey);
        }
      }
    });
  }

  function checkHash() {
    let el, els, md, tmp,
      mds = $$(".markdown-body, .markdown-format");
    for (md of mds) {
      els = $$(headers.join(","), md);
      if (els.length > 1) {
        for (el of els) {
          if (el && !el.classList.contains(collapsed)) {
            toggle(el, true);
          }
        }
      }
    }
    // open up
    tmp = (window.location.hash || "").replace(/#/, "");
    if (tmp) {
      els = $(`#user-content-${tmp}`);
      if (els && els.classList.contains("anchor")) {
        el = els.parentNode;
        if (el.matches(headers.join(","))) {
          siblings(el);
          document.documentElement.scrollTop = el.offsetTop;
          // set scrollTop a second time, in case of browser lag
          setTimeout(() => {
            document.documentElement.scrollTop = el.offsetTop;
          }, 500);
        }
      }
    }
  }

  function checkColors() {
    if (!colors || colors.length !== 6) {
      colors = [].concat(defaultColors);
    }
  }

  function init() {
    document.querySelector("head").appendChild(arrowColors);
    checkColors();
    addColors();
    addBinding();
    if (startCollapsed) {
      checkHash();
    }
  }

  function $(selector, el) {
    return (el || document).querySelector(selector);
  }
  function $$(selectors, el) {
    return Array.from((el || document).querySelectorAll(selectors));
  }
  function addClass(els, name) {
    for (let el of els) {
      el.classList.add(name);
    }
  }
  function removeClass(els, name) {
    name = (name || "").split(" ");
    for (let el of els) {
      el.classList.remove(...name);
    }
  }
  function closest(el, selector) {
    while (el && el.nodeName !== "BODY" && !el.matches(selector)) {
      el = el.parentNode;
    }
    return el && el.matches(selector) ? el : null;
  }

  // Add GM options
  GM_registerMenuCommand("Set collapse markdown state", () => {
    let val = prompt("Initially collapse headers:", !startCollapsed);
    if (val !== null) {
      startCollapsed = /^t/.test(val);
      GM_setValue("ghcm-collapsed", startCollapsed);
      console.log(`GitHub Collapse Markdown: Headers will ${startCollapsed ? "be" : "not be"} initially collapsed`);
    }
  });
  GM_registerMenuCommand("Set collapse markdown colors", () => {
    let val = prompt("Set header arrow colors:", JSON.stringify(colors));
    if (val !== null) {
      // allow pasting in a JSON format
      try {
        val = JSON.parse(val);
        if (val && val.length === 6) {
          colors = val;
          GM_setValue("ghcm-colors", colors);
          console.log("GitHub Collapse Markdown: colors set to", colors);
          addColors();
          return;
        } else {
          console.error("GitHub Collapse Markdown: invalid color definition (6 colors)", val);
          // reset colors to default (in case colors variable is corrupted)
          checkColors();
        }
      } catch(err) {
        console.error("GitHub Collapse Markdown: invalid JSON");
      }
    }
  });

  init();

})();
