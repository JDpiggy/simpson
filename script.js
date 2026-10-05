/* =========================================================
   Simpson Diversity Index Calculator — script.js
   All math runs in the browser. No network calls, no storage.
   ========================================================= */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     DOM references
     --------------------------------------------------------- */
  const tbody = document.getElementById("species-tbody");
  const form = document.getElementById("diversity-form");
  const btnAdd = document.getElementById("btn-add");
  const btnExample = document.getElementById("btn-example");
  const btnClear = document.getElementById("btn-clear");
  const messageEl = document.getElementById("message");
  const resultsSection = document.getElementById("results-section");

  const statTotalSpecies = document.getElementById("stat-total-species");
  const statPositiveSpecies = document.getElementById("stat-positive-species");
  const statTotalIndividuals = document.getElementById("stat-total-individuals");
  const statD = document.getElementById("stat-D");
  const stat1minusD = document.getElementById("stat-1minusD");
  const stat1overD = document.getElementById("stat-1overD");
  const interpretationText = document.getElementById("interpretation-text");

  /* ---------------------------------------------------------
     Constants
     --------------------------------------------------------- */
  const DEFAULT_ROW_COUNT = 4;      // Start with Species 1–4
  const EXAMPLE_DATA = [
    { name: "Oak trees",  count: 12 },
    { name: "Maple trees", count: 8 },
    { name: "Pine trees", count: 4 },
    { name: "Birch trees", count: 6 },
  ];

  /* ---------------------------------------------------------
     Row rendering
     --------------------------------------------------------- */

  /**
   * Create one editable species row.
   * @param {{name: string, count: string|number}} [initial]
   * @returns {HTMLTableRowElement}
   */
  function createRow(initial) {
    const tr = document.createElement("tr");

    // Species name cell
    const tdName = document.createElement("td");
    const inputName = document.createElement("input");
    inputName.type = "text";
    inputName.className = "input-species";
    inputName.placeholder = "e.g. Oak trees";
    inputName.setAttribute("aria-label", "Species name");
    inputName.autocomplete = "off";
    if (initial && typeof initial.name === "string") {
      inputName.value = initial.name;
    }
    tdName.appendChild(inputName);

    // Count cell
    const tdCount = document.createElement("td");
    const inputCount = document.createElement("input");
    inputCount.type = "number";
    inputCount.className = "input-count";
    inputCount.min = "0";
    inputCount.step = "1";
    inputCount.inputMode = "numeric";
    inputCount.placeholder = "0";
    inputCount.setAttribute("aria-label", "Number of individuals");
    if (initial && initial.count !== undefined && initial.count !== "") {
      inputCount.value = String(initial.count);
    }
    tdCount.appendChild(inputCount);

    // Remove button cell
    const tdActions = document.createElement("td");
    const btnRemove = document.createElement("button");
    btnRemove.type = "button";
    btnRemove.className = "btn-remove";
    btnRemove.setAttribute("aria-label", "Remove this species row");
    btnRemove.title = "Remove row";
    btnRemove.textContent = "×";
    btnRemove.addEventListener("click", function () {
      // Keep at least one row so the table never disappears
      if (tbody.querySelectorAll("tr").length <= 1) {
        showMessage("The table needs at least one row. Use “Clear All” to reset it.", "info");
        return;
      }
      tr.remove();
      // Refocus a sensible control after removal
      const firstInput = tbody.querySelector("input.input-species");
      if (firstInput) firstInput.focus();
    });
    tdActions.appendChild(btnRemove);

    tr.appendChild(tdName);
    tr.appendChild(tdCount);
    tr.appendChild(tdActions);
    return tr;
  }

  /** Add `n` blank rows (or rows filled from `data`). */
  function renderRows(n, data) {
    tbody.innerHTML = "";
    for (let i = 0; i < n; i += 1) {
      tbody.appendChild(createRow(data ? data[i] : undefined));
    }
  }

  /* ---------------------------------------------------------
     Messages
     --------------------------------------------------------- */
  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = "message message-" + (type || "info");
    messageEl.hidden = false;
  }

  function hideMessage() {
    messageEl.hidden = true;
    messageEl.textContent = "";
  }

  /* ---------------------------------------------------------
     Reading & validating input
     --------------------------------------------------------- */

  /**
   * Collect the raw table values.
   * Returns rows of the form { name: string, countRaw: string, count: number|null }.
   */
  function readRows() {
    const rows = [];
    const trs = tbody.querySelectorAll("tr");
    trs.forEach(function (tr) {
      const nameInput = tr.querySelector("input.input-species");
      const countInput = tr.querySelector("input.input-count");
      const name = nameInput ? nameInput.value.trim() : "";
      const countRaw = countInput ? countInput.value.trim() : "";
      rows.push({
        name: name,
        countRaw: countRaw,
        count: countInput,
        nameInput: nameInput,
        countInput: countInput,
      });
    });
    return rows;
  }

  /** Clear any previous invalid styling. */
  function clearInvalidFlags() {
    tbody.querySelectorAll("input").forEach(function (el) {
      el.classList.remove("is-invalid");
      el.removeAttribute("aria-invalid");
    });
  }

  /**
   * Validate the table and return either an error message or the
   * cleaned dataset used for calculations.
   *
   * Rules (from the assignment):
   *  - Counts must be whole numbers >= 0
   *  - Blank species names are ignored when their count is blank or zero
   *  - Error if fewer than 2 species have positive counts
   *  - Error if total individuals N < 2 (prevents division by zero)
   */
  function validateAndCollect() {
    clearInvalidFlags();

    const rawRows = readRows();
    const positive = [];   // species with count > 0
    const ignored = [];    // rows we deliberately skip
    let invalidFound = false;
    let firstInvalidEl = null;

    rawRows.forEach(function (row) {
      const countRaw = row.countRaw;

      // Blank count → treat as zero
      let count = 0;
      if (countRaw !== "") {
        // Must be a whole number >= 0
        if (!/^\d+$/.test(countRaw)) {
          invalidFound = true;
          if (row.countInput) {
            row.countInput.classList.add("is-invalid");
            row.countInput.setAttribute("aria-invalid", "true");
          }
          if (!firstInvalidEl) firstInvalidEl = row.countInput;
          return;
        }
        count = parseInt(countRaw, 10);
      }

      // Blank name + (blank or zero count) → ignore the row entirely
      if (row.name === "" && count === 0) {
        ignored.push(row);
        return;
      }

      // Count > 0 → keep, even if the name is blank (shown as "Unnamed species")
      if (count > 0) {
        positive.push({
          name: row.name || "Unnamed species",
          count: count,
        });
        return;
      }

      // Name present but count is 0 / blank → contributes nothing to diversity
      ignored.push(row);
    });

    if (invalidFound) {
      if (firstInvalidEl) firstInvalidEl.focus();
      return {
        ok: false,
        error:
          "Counts must be whole numbers (0 or greater). Please fix the highlighted field(s).",
      };
    }

    // --- Minimum species with positive counts ---
    if (positive.length < 2) {
      return {
        ok: false,
        error:
          "You need at least two species with positive counts to calculate diversity. " +
          "Right now only " +
          positive.length +
          " species " +
          (positive.length === 1 ? "has" : "have") +
          " a positive count.",
      };
    }

    // --- Total individuals must be at least 2 (avoids N(N-1) = 0) ---
    let N = 0;
    positive.forEach(function (s) {
      N += s.count;
    });

    if (N < 2) {
      return {
        ok: false,
        error:
          "The total number of individuals must be at least 2. Your total N is " +
          N +
          ".",
      };
    }

    return {
      ok: true,
      species: positive,
      totalEntered: rawRows.length,
      ignoredCount: ignored.length,
      N: N,
    };
  }

  /* ---------------------------------------------------------
     THE FORMULA
     ---------------------------------------------------------

     Simpson's Index (D):
         D = Σ [ n (n - 1) ]  /  [ N (N - 1) ]

       - n = number of individuals of one species
       - N = total number of individuals across all species
       - The sum runs over every species
       - Example: if a species has 12 individuals, it contributes 12 × 11 = 132
       - D is a probability-like value between 0 and 1:
           · D close to 0  → two randomly picked individuals are almost
                             always different species (high diversity)
           · D close to 1  → the same species dominates (low diversity)

     Simpson's Index of Diversity (1 - D):
         Often what textbooks mean by "Simpson's Diversity Index".
         Closer to 1 = more diverse.

     Reciprocal Simpson's Index (1 / D):
         Interpreted as the "effective number of species".
         A perfectly even community of S species has 1/D = S.
     --------------------------------------------------------- */

  /**
   * Compute all three Simpson metrics.
   * @param {Array<{name: string, count: number}>} species
   * @param {number} N total individuals
   * @returns {{D: number, oneMinusD: number, oneOverD: number|null}}
   */
  function computeSimpson(species, N) {
    // Denominator: N(N - 1) — guaranteed >= 2 by validation, so never 0
    const denominator = N * (N - 1);

    // Numerator: Σ n(n - 1) over all species
    let numerator = 0;
    species.forEach(function (s) {
      numerator += s.count * (s.count - 1);
    });

    const D = numerator / denominator;              // Simpson's Index
    const oneMinusD = 1 - D;                        // Index of Diversity
    // 1/D only makes sense when D > 0 (otherwise it is undefined / infinite)
    const oneOverD = D > 0 ? 1 / D : null;

    return { D: D, oneMinusD: oneMinusD, oneOverD: oneOverD };
  }

  /* ---------------------------------------------------------
     Display helpers
     --------------------------------------------------------- */

  /** Consistent 4-decimal formatting (with trailing zeros kept). */
  function format4(value) {
    return Number(value).toFixed(4);
  }

  /** Human-friendly integer with thousands separators. */
  function formatInt(value) {
    return Number(value).toLocaleString("en-US");
  }

  /**
   * Plain-language interpretation of the Index of Diversity (1 - D).
   * Values closer to 1 → more diverse and evenly distributed.
   */
  function buildInterpretation(oneMinusD, species, N) {
    const value = format4(oneMinusD);
    const lines = [];

    lines.push(
      "Your community has an index of diversity of " +
        value +
        ". Values closer to 1 generally indicate a more diverse and evenly distributed community."
    );

    // How far from 1 is this community?
    if (oneMinusD >= 0.85) {
      lines.push(
        "This is a high diversity score — many species are present and individuals are spread fairly evenly among them."
      );
    } else if (oneMinusD >= 0.65) {
      lines.push(
        "This is a moderate diversity score — there is a reasonable mix of species, though some may be more common than others."
      );
    } else if (oneMinusD >= 0.35) {
      lines.push(
        "This is a relatively low diversity score — fewer species are present, and/or one or two species dominate the count."
      );
    } else {
      lines.push(
        "This is a very low diversity score — the community is likely dominated by one species, or very few species are present."
      );
    }

    // Richness vs evenness explanation for beginners
    const richness = species.length;
    const dominant = species.reduce(function (best, s) {
      return s.count > best.count ? s : best;
    }, species[0]);
    const dominantShare = dominant.count / N;

    lines.push(
      "You recorded " +
        richness +
        " species (richness) and a total of " +
        formatInt(N) +
        " individuals (N). The most common species, “" +
        dominant.name +
        ",” makes up about " +
        Math.round(dominantShare * 100) +
        "% of all individuals."
    );

    lines.push(
      "Lower diversity can result from fewer species being present (low richness) or from one species dominating the population (low evenness). " +
        "Evenness describes how equally individuals are shared among the species you recorded."
    );

    return lines.join(" ");
  }

  /* ---------------------------------------------------------
     Main calculation flow
     --------------------------------------------------------- */
  function calculate(options) {
    const result = validateAndCollect();

    if (!result.ok) {
      showMessage(result.error, "error");
      // Keep previous results on screen? Hide them to avoid stale numbers.
      resultsSection.hidden = true;
      return false;
    }

    const metrics = computeSimpson(result.species, result.N);

    // --- Update the stats panel ---
    statTotalSpecies.textContent = formatInt(result.totalEntered);
    statPositiveSpecies.textContent = formatInt(result.species.length);
    statTotalIndividuals.textContent = formatInt(result.N);

    statD.textContent = format4(metrics.D);
    stat1minusD.textContent = format4(metrics.oneMinusD);

    // Reciprocal is undefined when D = 0 (every species has 1 individual
    // in a community large enough that... actually D=0 needs every n<=1
    // with N>=2, which is impossible with integer counts >=0 and N>=2
    // unless some species has n=1 only — possible only if all have n=1
    // and N = species count; then n(n-1)=0 so D=0).
    if (metrics.oneOverD === null || !isFinite(metrics.oneOverD)) {
      stat1overD.textContent = "n/a";
      stat1overD.setAttribute(
        "title",
        "1/D is undefined when D = 0 (no species dominates; effectively infinite diversity in this measure)."
      );
    } else {
      stat1overD.textContent = format4(metrics.oneOverD);
      stat1overD.removeAttribute("title");
    }

    interpretationText.textContent = buildInterpretation(
      metrics.oneMinusD,
      result.species,
      result.N
    );

    resultsSection.hidden = false;

    // Success message (not error styling)
    const note =
      result.ignoredCount > 0
        ? " Calculation complete. " +
          result.ignoredCount +
          " blank or zero-count row(s) were ignored."
        : " Calculation complete.";
    showMessage(note.trim(), "success");

    // Optionally scroll results into view on small screens
    if (options && options.scroll) {
      resultsSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    return true;
  }

  /* ---------------------------------------------------------
     Button handlers
     --------------------------------------------------------- */
  btnAdd.addEventListener("click", function () {
    tbody.appendChild(createRow());
    // Focus the new row's name field for quick typing
    const rows = tbody.querySelectorAll("tr");
    const lastRow = rows[rows.length - 1];
    const input = lastRow && lastRow.querySelector("input.input-species");
    if (input) input.focus();
    hideMessage();
  });

  btnExample.addEventListener("click", function () {
    renderRows(EXAMPLE_DATA.length, EXAMPLE_DATA);
    hideMessage();
    showMessage(
      "Example dataset loaded (Oak 12 · Maple 8 · Pine 4 · Birch 6). Press “Calculate Diversity” to see the results.",
      "info"
    );
    // Focus the calculate button so keyboard users can proceed immediately
    const calcBtn = document.getElementById("btn-calculate");
    if (calcBtn) calcBtn.focus();
  });

  btnClear.addEventListener("click", function () {
    renderRows(DEFAULT_ROW_COUNT);
    hideMessage();
    resultsSection.hidden = true;
    // Reset the interpretation panel content
    interpretationText.textContent = "";
    statD.textContent = "—";
    stat1minusD.textContent = "—";
    stat1overD.textContent = "—";
    statTotalSpecies.textContent = "—";
    statPositiveSpecies.textContent = "—";
    statTotalIndividuals.textContent = "—";
    // Focus the first field so the user can start typing right away
    const first = tbody.querySelector("input.input-species");
    if (first) first.focus();
  });

  // Form submit = Calculate
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    calculate({ scroll: true });
  });

  /**
   * Optional live updates: recalculate as the user types, but only
   * when the current table state is valid enough to show something
   * sensible. Errors are NOT spam-shown while typing — only on submit.
   */
  let liveTimer = null;
  tbody.addEventListener("input", function () {
    if (liveTimer) window.clearTimeout(liveTimer);
    liveTimer = window.setTimeout(function () {
      const result = validateAndCollect();
      if (!result.ok) {
        // Do not clear results mid-edit unless the user already saw them;
        // just leave the last valid results on screen.
        return;
      }
      // Quietly refresh results (no success toast while typing)
      const metrics = computeSimpson(result.species, result.N);
      statTotalSpecies.textContent = formatInt(result.totalEntered);
      statPositiveSpecies.textContent = formatInt(result.species.length);
      statTotalIndividuals.textContent = formatInt(result.N);
      statD.textContent = format4(metrics.D);
      stat1minusD.textContent = format4(metrics.oneMinusD);
      if (metrics.oneOverD === null || !isFinite(metrics.oneOverD)) {
        stat1overD.textContent = "n/a";
      } else {
        stat1overD.textContent = format4(metrics.oneOverD);
      }
      interpretationText.textContent = buildInterpretation(
        metrics.oneMinusD,
        result.species,
        result.N
      );
      resultsSection.hidden = false;
      hideMessage();
    }, 400); // debounce 400 ms
  });

  /* ---------------------------------------------------------
     Initial render
     --------------------------------------------------------- */
  renderRows(DEFAULT_ROW_COUNT);
})();
